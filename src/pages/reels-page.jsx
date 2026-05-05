import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  BookOpen,
  Clapperboard,
  Loader2,
  Maximize2,
  MessageCircle,
  MoreHorizontal,
  Pause,
  Play,
  Repeat2,
  Share2,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/app/empty-state'
import { PageHeader } from '@/components/app/page-header'
import { PostComments } from '@/components/app/post-comments'
import { ReactionPicker } from '@/components/app/reaction-picker'
import { RoleBadge } from '@/components/app/role-badge'
import { UserAvatar } from '@/components/app/user-avatar'
import {
  getReels,
  getFollowingReels,
  reactToPost,
  removePostReaction,
  repostPost,
} from '@/features/posts/posts.api'
import { recordReelView } from '@/features/activity/activity.api'
import { usePostStream } from '@/hooks/use-post-stream'
import {
  followUser,
  getSocialStatus,
  unfollowUser,
} from '@/features/social/social.api'
import { useAuth } from '@/features/auth/auth-context'
import { useToast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import { extractApiMessage, friendlyApiMessage } from '@/lib/api-error'
import { formatNumber, getFullName, resolveMediaUrl } from '@/lib/format'
import { getPostReaction } from '@/lib/reactions'

// ─── Helpers ────────────────────────────────────────────────────────
function normalizeAuthor(post) {
  if (!post) return null
  if (post.author) {
    return {
      id: post.author.id,
      username: post.author.username,
      fullName: post.author.fullName,
      profileImage: post.author.avatarUrl,
      role: post.author.role,
    }
  }
  return {
    id: post.authorId,
    username: post.authorUsername,
    fullName: post.authorFullName,
    profileImage: post.authorProfileImage,
    role: post.authorRole,
  }
}

function fmtTime(seconds) {
  const total = Math.max(0, Math.floor(seconds || 0))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

// Stripe fallback for thumbnails when a video has no poster.
const STRIPE_TONES = [
  ['var(--brand-soft)', 45],
  ['color-mix(in oklch, var(--accent-rust) 14%, var(--paper))', 30],
  ['var(--gold-soft)', 60],
  ['color-mix(in oklch, var(--accent-violet) 14%, var(--paper))', 120],
  ['color-mix(in oklch, var(--accent-sky) 14%, var(--paper))', 80],
]
function stripeFor(id) {
  const key = String(id ?? '0')
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0
  return STRIPE_TONES[Math.abs(h) % STRIPE_TONES.length]
}
function thumbStyleFor(post) {
  const [tint, angle] = stripeFor(post.id)
  return {
    background: `repeating-linear-gradient(${angle}deg, ${tint} 0 14px, color-mix(in oklch, ${tint} 50%, var(--paper)) 14px 28px)`,
  }
}

// Backend reels endpoints: PUBLIC (`for-you`) and FOLLOWING.
const FILTERS = [
  { value: 'foryou', label: 'For you' },
  { value: 'following', label: 'Following', authOnly: true },
]

// ─── Filter row ─────────────────────────────────────────────────────
function FilterRow({ filter, onFilter, isAuthenticated }) {
  const visible = FILTERS.filter((f) => !f.authOnly || isAuthenticated)
  return (
    <div className="flex flex-wrap items-center gap-2">
      {visible.map((f) => {
        const active = f.value === filter
        return (
          <button
            key={f.value}
            type="button"
            onClick={() => onFilter(f.value)}
            className={cn(
              'inline-flex items-center rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold transition-colors',
              active
                ? 'border-brand bg-ink text-paper shadow-soft'
                : 'border-border bg-paper text-ink-2 hover:border-brand/40 hover:bg-brand-soft/40 hover:text-brand',
            )}
          >
            {f.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Up next rail ───────────────────────────────────────────────────
function UpNextRail({ reels, activeId, onSelect }) {
  return (
    <aside className="flex max-h-[720px] flex-col rounded-2xl border border-border bg-paper p-3">
      <div className="flex items-center gap-2 border-b border-border/70 px-2 pb-3">
        <BookOpen className="size-3.5 text-ink-3" />
        <span className="font-display text-[13px] font-semibold tracking-[-0.005em] text-ink">
          Up next
        </span>
        <span className="ml-auto rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-ink-3">
          {reels.length}
        </span>
      </div>

      <div className="scrollbar-none flex flex-1 flex-col gap-1 overflow-y-auto py-2">
        {reels.map((post) => {
          const author = normalizeAuthor(post)
          const active = post.id === activeId
          const durationSeconds = post.mediaList?.[0]?.durationSeconds
          return (
            <button
              key={post.id}
              type="button"
              onClick={() => onSelect(post.id)}
              className={cn(
                'group/rail relative grid grid-cols-[64px_1fr] items-start gap-2.5 rounded-xl p-1.5 text-left transition-colors',
                active ? 'bg-brand/[0.08]' : 'hover:bg-muted/60',
              )}
            >
              {active ? (
                <span
                  aria-hidden
                  className="absolute left-0 top-3.5 bottom-3.5 w-[2.5px] rounded-full bg-brand"
                />
              ) : null}
              <div
                className="relative h-[88px] w-16 overflow-hidden rounded-lg"
                style={thumbStyleFor(post)}
              >
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/15"
                />
                {durationSeconds ? (
                  <span className="absolute bottom-1 right-1 rounded bg-black/65 px-1 py-[1px] font-mono text-[9.5px] tabular-nums text-white">
                    {fmtTime(durationSeconds)}
                  </span>
                ) : null}
              </div>
              <div className="min-w-0 pt-0.5">
                <p className="line-clamp-3 font-display text-[12px] font-semibold leading-[1.3] tracking-[-0.005em] text-ink">
                  {post.textContent || 'Untitled reel'}
                </p>
                <p className="mt-1 truncate text-[10.5px] text-ink-3 tabular-nums">
                  {(getFullName(author) || author?.username || '—') +
                    ' · ' +
                    formatNumber(post.viewCount ?? 0) +
                    ' views'}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </aside>
  )
}

// ─── Follow button — wired to real backend social API ──────────────
function FollowButton({ author }) {
  const { user, isAuthenticated } = useAuth()
  const toast = useToast()
  const [following, setFollowing] = useState(null)
  const [busy, setBusy] = useState(false)

  const isMe = isAuthenticated && user?.id && author?.id && user.id === author.id

  useEffect(() => {
    if (!author?.id || !isAuthenticated || isMe) {
      setFollowing(null)
      return
    }
    let cancelled = false
    getSocialStatus(author.id)
      .then((status) => {
        if (!cancelled) setFollowing(Boolean(status?.following))
      })
      .catch(() => {
        if (!cancelled) setFollowing(false)
      })
    return () => {
      cancelled = true
    }
  }, [author?.id, isAuthenticated, isMe])

  if (!author?.id || !isAuthenticated || isMe) return null

  async function toggle() {
    if (busy) return
    setBusy(true)
    const previous = following
    setFollowing(!previous)
    try {
      if (previous) await unfollowUser(author.id)
      else await followUser(author.id)
    } catch (error) {
      setFollowing(previous)
      toast.error(extractApiMessage(error, 'Could not update follow.'))
    } finally {
      setBusy(false)
    }
  }

  const label = following ? 'Following' : '+ Follow'

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy || following == null}
      className={cn(
        'rounded-full px-2.5 py-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.04em] transition-all',
        'disabled:opacity-50',
        following
          ? 'bg-muted text-ink-2 hover:bg-muted/80'
          : 'bg-gradient-to-br from-brand to-brand/85 text-brand-foreground shadow-soft hover:-translate-y-px',
      )}
    >
      {busy ? <Loader2 className="size-3 animate-spin" /> : label}
    </button>
  )
}

// ─── Center stage (single reel cinema) ──────────────────────────────
function ReelStage({
  reel,
  reels,
  isMuted,
  onToggleMuted,
  onChange,
  onNext,
  onPrev,
}) {
  const { isAuthenticated } = useAuth()
  const toast = useToast()
  const videoRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [working, setWorking] = useState(false)

  const watchedSecondsRef = useRef(0)
  const lastTickRef = useRef(null)
  const recordedRef = useRef(false)

  const author = normalizeAuthor(reel)
  const media = reel?.mediaList?.[0]
  const url = resolveMediaUrl(media?.url ?? media?.mediaUrl)

  const flushWatch = useCallback(() => {
    if (!isAuthenticated || !reel?.id) return
    if (recordedRef.current) return
    const watched = Math.round(watchedSecondsRef.current)
    if (watched < 2) return
    recordedRef.current = true
    recordReelView(reel.id, watched).catch(() => {
      recordedRef.current = false
    })
  }, [isAuthenticated, reel?.id])

  // Reset on reel change
  useEffect(() => {
    flushWatch()
    watchedSecondsRef.current = 0
    lastTickRef.current = null
    recordedRef.current = false
    const el = videoRef.current
    if (!el) return
    el.currentTime = 0
    setProgress(0)
    setCurrentTime(0)
    el.play().catch(() => setPlaying(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reel?.id])

  useEffect(() => () => flushWatch(), [flushWatch])

  function togglePlay() {
    const el = videoRef.current
    if (!el) return
    if (playing) el.pause()
    else el.play().catch(() => setPlaying(false))
  }

  // Keyboard shortcuts — we advertise them in the hint strip, so wire them.
  // Skip when the user is typing in an input / textarea / contentEditable.
  useEffect(() => {
    function isTypingTarget(target) {
      if (!target) return false
      const tag = target.tagName
      return (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target.isContentEditable
      )
    }
    function onKeyDown(event) {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (isTypingTarget(event.target)) return
      switch (event.key) {
        case ' ':
        case 'Spacebar':
          event.preventDefault()
          togglePlay()
          break
        case 'ArrowDown':
        case 'j':
        case 'J':
          event.preventDefault()
          onNext?.()
          break
        case 'ArrowUp':
        case 'k':
        case 'K':
          event.preventDefault()
          onPrev?.()
          break
        case 'm':
        case 'M':
          event.preventDefault()
          onToggleMuted?.()
          break
        default:
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, onNext, onPrev, onToggleMuted])

  function seek(event) {
    const el = videoRef.current
    if (!el || !duration) return
    const bar = event.currentTarget
    const rect = bar.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    el.currentTime = ratio * duration
    setProgress(ratio)
  }

  // ── Reactions — full 8-type backend palette via ReactionPicker ────
  async function handlePickReaction(type) {
    if (!isAuthenticated) {
      toast.info('Sign in to react.')
      return
    }
    if (working) return
    const previous = reel
    const wasReacting = Boolean(reel.myReaction)
    onChange?.({
      ...reel,
      myReaction: type,
      reactionCount: wasReacting
        ? reel.reactionCount
        : (reel.reactionCount ?? 0) + 1,
    })
    setWorking(true)
    try {
      const updated = await reactToPost(reel.id, type)
      if (updated) onChange?.({ ...updated, myReaction: type })
    } catch (error) {
      onChange?.(previous)
      toast.error(extractApiMessage(error, 'Could not react.'))
    } finally {
      setWorking(false)
    }
  }

  async function handleClearReaction() {
    if (!isAuthenticated || working || !reel?.myReaction) return
    const previous = reel
    onChange?.({
      ...reel,
      myReaction: null,
      reactionCount: Math.max(0, (reel.reactionCount ?? 0) - 1),
    })
    setWorking(true)
    try {
      await removePostReaction(reel.id)
    } catch (error) {
      onChange?.(previous)
      toast.error(extractApiMessage(error, 'Could not remove reaction.'))
    } finally {
      setWorking(false)
    }
  }

  async function handleShare() {
    try {
      const link = reel.shareLink || `${window.location.origin}/reels?id=${reel.id}`
      await navigator.clipboard.writeText(link)
      toast.success('Link copied.')
    } catch {
      toast.error('Could not copy link.')
    }
  }

  async function handleRepost() {
    if (!isAuthenticated) {
      toast.info('Sign in to repost.')
      return
    }
    try {
      await repostPost(reel.id)
      onChange?.({ ...reel, shareCount: (reel.shareCount ?? 0) + 1 })
      toast.success('Reposted to your feed.')
    } catch (error) {
      toast.error(friendlyApiMessage(error, 'Could not repost.'))
    }
  }

  const currentReactionInfo = reel?.myReaction ? getPostReaction(reel.myReaction) : null
  const activeIndex = reels.findIndex((r) => r.id === reel?.id)
  const stripe = thumbStyleFor(reel ?? {})

  return (
    <div className="relative grid place-items-center overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-muted/60 to-background p-5 sm:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 80% at 50% -10%, color-mix(in oklch, var(--brand) 12%, transparent), transparent 60%)',
        }}
      />

      <div className="relative isolate aspect-[9/16] w-full max-w-[420px] overflow-hidden rounded-[22px] bg-paper shadow-soft-lg ring-1 ring-border">
        {url ? (
          <video
            ref={videoRef}
            src={url}
            playsInline
            muted={isMuted}
            onPlay={() => {
              setPlaying(true)
              lastTickRef.current = null
            }}
            onPause={() => setPlaying(false)}
            onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
            onTimeUpdate={(event) => {
              const el = event.currentTarget
              if (!el.duration) return
              setProgress(el.currentTime / el.duration)
              setCurrentTime(el.currentTime)
              const t = el.currentTime
              const last = lastTickRef.current
              if (last != null && t > last) {
                const delta = t - last
                if (delta < 1.5) watchedSecondsRef.current += delta
              }
              lastTickRef.current = t
            }}
            onEnded={() => {
              flushWatch()
              onNext?.()
            }}
            onClick={togglePlay}
            className="absolute inset-0 h-full w-full cursor-pointer object-cover"
          />
        ) : (
          <div aria-hidden className="absolute inset-0" style={stripe} />
        )}

        {/* Top bar — author tag with real role badge */}
        <div className="absolute inset-x-3 top-3 z-10 flex items-center gap-2">
          <Link
            to={author?.username ? `/profile/${author.username}` : '#'}
            className="inline-flex items-center gap-2 rounded-full border border-ink/[0.08] bg-paper/85 py-[5px] pl-[5px] pr-2.5 backdrop-blur transition-colors hover:bg-paper"
          >
            <UserAvatar user={author} className="size-7 ring-1 ring-paper" />
            <div className="leading-tight">
              <p className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold tracking-[-0.005em] text-ink">
                {getFullName(author) || author?.username}
                {author?.role ? (
                  <RoleBadge role={author.role} size="xs" showIcon={false} />
                ) : null}
              </p>
              {author?.username ? (
                <p className="text-[10.5px] text-ink-3">{author.username}</p>
              ) : null}
            </div>
          </Link>

          <FollowButton author={author} />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="ml-auto grid size-8 place-items-center rounded-full border border-ink/[0.08] bg-paper/85 text-ink backdrop-blur transition-colors hover:bg-paper"
                aria-label="More"
              >
                <MoreHorizontal className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={6} className="w-44 rounded-xl">
              <DropdownMenuItem onSelect={handleShare}>
                <Share2 className="mr-2 size-4" />
                Copy link
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleRepost}>
                <Repeat2 className="mr-2 size-4" />
                Repost to my feed
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Editorial title overlay (only when paused) */}
        <AnimatePresence>
          {!playing ? (
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 z-[2] flex flex-col items-center justify-center px-8 text-center"
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-ink/[0.08] bg-paper/85 px-2.5 py-[5px] font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink backdrop-blur">
                <span
                  className="size-[5px] rounded-full"
                  style={{
                    background: 'var(--gold)',
                    boxShadow:
                      '0 0 0 3px color-mix(in oklch, var(--gold) 25%, transparent)',
                  }}
                />
                reel
              </span>
              <p
                className="mt-3 font-display text-[26px] font-semibold leading-[1.15] tracking-[-0.022em] text-ink text-balance"
                style={{ textShadow: '0 1px 24px oklch(1 0 0 / 0.5)' }}
              >
                {reel?.textContent || 'Untitled reel'}
              </p>
              {author ? (
                <p className="mt-2 font-display text-[13px] italic text-ink-2">
                  — {getFullName(author) || author.username}
                </p>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Side rail — reactions / comments / share */}
        <div className="absolute bottom-32 right-2.5 z-[5] flex flex-col items-center gap-3.5">
          <ReactionPicker
            current={reel?.myReaction ?? null}
            onSelect={handlePickReaction}
            onClear={handleClearReaction}
            disabled={working}
            align="right"
            trigger={({ toggleDefault, current }) => (
              <RailIcon
                label={formatNumber(reel?.reactionCount ?? 0)}
                active={Boolean(current)}
                activeBg="bg-accent-rust border-accent-rust"
                onClick={toggleDefault}
              >
                <span className="text-[22px] leading-none">
                  {current?.emoji ?? currentReactionInfo?.emoji ?? '👍'}
                </span>
              </RailIcon>
            )}
          />

          <RailIcon label={formatNumber(reel?.commentCount ?? 0)}>
            <MessageCircle className="size-5" strokeWidth={1.8} />
          </RailIcon>

          <RailIcon
            label={formatNumber(reel?.shareCount ?? 0)}
            onClick={handleRepost}
          >
            <Repeat2 className="size-5" strokeWidth={1.8} />
          </RailIcon>

          <RailIcon label="Share" onClick={handleShare}>
            <Share2 className="size-5" strokeWidth={1.8} />
          </RailIcon>
        </div>

        {/* Bottom info — only real fields */}
        {reel?.textContent ? (
          <div className="absolute inset-x-4 bottom-[60px] z-[3] mr-16 text-white">
            <p
              className="font-display line-clamp-3 text-[14px] leading-[1.35] tracking-[-0.005em]"
              style={{ textShadow: '0 1px 6px oklch(0 0 0 / 0.45)' }}
            >
              {reel.textContent}
            </p>
          </div>
        ) : null}

        {/* Mute */}
        <button
          type="button"
          onClick={onToggleMuted}
          className="absolute right-3 top-14 z-[5] grid size-8 place-items-center rounded-full border border-white/15 bg-black/55 text-white backdrop-blur transition-colors hover:bg-black/75"
          aria-label={isMuted ? 'Unmute' : 'Mute'}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
        </button>

        {/* Big play overlay */}
        <AnimatePresence>
          {!playing ? (
            <motion.button
              key="play"
              type="button"
              onClick={togglePlay}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              className="absolute inset-0 z-[6] grid place-items-center bg-black/25"
              aria-label="Play"
            >
              <span className="grid size-[78px] place-items-center rounded-full bg-paper/95 text-ink shadow-soft-lg">
                <Play className="size-7 translate-x-[2px] fill-current" />
              </span>
            </motion.button>
          ) : null}
        </AnimatePresence>

        {/* Bottom controls strip */}
        <div className="absolute inset-x-3 bottom-3 z-[6] flex items-center gap-2 rounded-xl border border-white/10 bg-black/55 px-2.5 py-1.5 backdrop-blur">
          <button
            type="button"
            onClick={togglePlay}
            className="grid size-7 place-items-center rounded-md text-white transition-colors hover:bg-white/15"
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          </button>
          <span className="min-w-[78px] font-mono text-[10.5px] tabular-nums text-white">
            {fmtTime(currentTime)} / {fmtTime(duration)}
          </span>
          <div
            className="relative h-[3px] flex-1 cursor-pointer rounded-full bg-white/20"
            onClick={seek}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${progress * 100}%`,
                background:
                  'linear-gradient(90deg, var(--brand-muted), var(--gold))',
              }}
            />
            <span
              aria-hidden
              className="absolute top-1/2 size-[11px] -translate-y-1/2 rounded-full bg-white shadow"
              style={{
                left: `calc(${progress * 100}% - 5.5px)`,
              }}
            />
          </div>
          <button
            type="button"
            onClick={onPrev}
            className="grid size-7 place-items-center rounded-md text-white transition-colors hover:bg-white/15"
            aria-label="Previous reel"
            title="Previous reel"
          >
            <SkipBack className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onNext}
            className="grid size-7 place-items-center rounded-md text-white transition-colors hover:bg-white/15"
            aria-label="Next reel"
            title="Next reel"
          >
            <SkipForward className="size-3.5" />
          </button>
          <button
            type="button"
            className="grid size-7 place-items-center rounded-md text-white transition-colors hover:bg-white/15"
            aria-label="Fullscreen"
            title="Fullscreen"
          >
            <Maximize2 className="size-3.5" />
          </button>
        </div>

        {/* Vertical position dots — gilt accent on the active dot */}
        <div className="pointer-events-none absolute -right-4 top-1/2 z-[6] hidden -translate-y-1/2 flex-col gap-1.5 lg:flex">
          {reels.slice(0, 12).map((post, idx) => (
            <span
              key={post.id}
              aria-hidden
              className={cn(
                'block w-[5px] rounded-full transition-all',
                idx === activeIndex ? 'h-6' : 'h-3 bg-ink/25',
              )}
              style={
                idx === activeIndex
                  ? {
                      background: 'var(--gold)',
                      boxShadow:
                        '0 0 0 3px color-mix(in oklch, var(--gold) 25%, transparent)',
                    }
                  : undefined
              }
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function RailIcon({ children, label, active, activeBg, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group/rail flex flex-col items-center gap-1 text-white"
      style={{ textShadow: '0 1px 3px oklch(0 0 0 / 0.5)' }}
    >
      <span
        className={cn(
          'grid size-[42px] place-items-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur transition-all group-hover/rail:bg-black/65',
          active && activeBg,
        )}
      >
        {children}
      </span>
      {label != null ? (
        <span className="font-mono text-[11px] font-semibold tabular-nums">
          {label}
        </span>
      ) : null}
    </button>
  )
}

// ─── Right column — discussion (real PostComments only) ───────────
function DiscussionColumn({ reel, onChange }) {
  return (
    <aside className="flex max-h-[720px] flex-col overflow-hidden rounded-2xl border border-border bg-paper">
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3.5 py-2.5">
        <MessageCircle className="size-3.5 text-ink-3" />
        <span className="font-display text-[13px] font-semibold tracking-[-0.005em] text-ink">
          Discussion
        </span>
        {reel ? (
          <span className="ml-auto rounded-md bg-paper px-1.5 py-0.5 font-mono text-[11px] text-ink-3 ring-1 ring-border">
            {formatNumber(reel.commentCount ?? 0)}
          </span>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {reel ? (
          <PostComments
            postId={reel.id}
            initialCount={reel.commentCount ?? 0}
            onCountChange={(next) => onChange?.({ ...reel, commentCount: next })}
          />
        ) : null}
      </div>
    </aside>
  )
}

// ─── Page ───────────────────────────────────────────────────────────
export function ReelsPage() {
  const { isAuthenticated } = useAuth()
  const toast = useToast()
  const [reels, setReels] = useState([])
  const [page, setPage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState(null)
  const [muted, setMuted] = useState(true)
  const [filter, setFilter] = useState('foryou')
  const [searchParams] = useSearchParams()
  const focusReelId = searchParams.get('id')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const fetcher =
          filter === 'following' && isAuthenticated ? getFollowingReels : getReels
        const data = await fetcher({ page: 0, size: 20 })
        if (!cancelled) {
          setReels(data?.content ?? [])
          setPage(data)
          setActiveId(null)
        }
      } catch (error) {
        if (!cancelled) toast.error(extractApiMessage(error, 'Could not load reels.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [toast, filter, isAuthenticated])

  // Default active to focused / first reel
  useEffect(() => {
    if (!activeId && reels.length > 0) {
      setActiveId(focusReelId ?? reels[0].id)
    }
  }, [activeId, reels, focusReelId])

  const activeReel = useMemo(
    () => reels.find((r) => r.id === activeId) ?? null,
    [reels, activeId],
  )

  function handleChange(updated) {
    setReels((current) =>
      current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
    )
  }

  function handleNext() {
    const idx = reels.findIndex((r) => r.id === activeId)
    const next = reels[idx + 1] ?? reels[0]
    if (next) setActiveId(next.id)
  }

  function handlePrev() {
    const idx = reels.findIndex((r) => r.id === activeId)
    const prev = reels[idx - 1] ?? reels[reels.length - 1]
    if (prev) setActiveId(prev.id)
  }

  // Live updates for the reel currently on the cinema stage. Reactions,
  // shares, view counts, edits, and deletions broadcast from any other
  // viewer flow into the same UI without a refresh. All state edits go
  // through functional `setReels`/`setActiveId` so we never need refs
  // to read the latest value from inside an SSE handler.
  usePostStream(activeReel?.id, {
    POST_UPDATED: (payload) => {
      if (!payload?.id) return
      setReels((current) =>
        current.map((item) =>
          item.id === payload.id
            ? { ...item, ...payload, myReaction: item.myReaction }
            : item,
        ),
      )
    },
    POST_DELETED: (payload) => {
      const removedId = payload?.id ?? activeReel?.id
      if (!removedId) return
      setReels((current) => {
        const idx = current.findIndex((item) => item.id === removedId)
        if (idx === -1) return current
        const fallback = current[idx + 1] ?? current[idx - 1] ?? null
        setActiveId(fallback?.id ?? null)
        return current.filter((item) => item.id !== removedId)
      })
      toast.info('This reel was removed by its author.')
    },
    POST_REACTED: (payload) => {
      if (!payload?.id) return
      setReels((current) =>
        current.map((item) =>
          item.id === payload.id
            ? {
                ...item,
                reactionCount: payload.reactionCount ?? item.reactionCount,
                topReactionTypes:
                  payload.topReactionTypes ?? item.topReactionTypes,
              }
            : item,
        ),
      )
    },
    POST_REACTION_REMOVED: (payload) => {
      if (!payload?.id) return
      setReels((current) =>
        current.map((item) =>
          item.id === payload.id
            ? {
                ...item,
                reactionCount: payload.reactionCount ?? item.reactionCount,
                topReactionTypes:
                  payload.topReactionTypes ?? item.topReactionTypes,
              }
            : item,
        ),
      )
    },
    POST_SHARED: (payload) => {
      if (!payload?.id) return
      setReels((current) =>
        current.map((item) =>
          item.id === payload.id
            ? {
                ...item,
                shareCount: payload.shareCount ?? (item.shareCount ?? 0) + 1,
              }
            : item,
        ),
      )
    },
    POST_VIEWED: (payload) => {
      if (!payload?.id || payload?.viewCount == null) return
      setReels((current) =>
        current.map((item) =>
          item.id === payload.id
            ? { ...item, viewCount: payload.viewCount }
            : item,
        ),
      )
    },
    POST_COMMENTED: (payload) => {
      const targetId = payload?.postId ?? payload?.id ?? activeReel?.id
      if (!targetId) return
      setReels((current) =>
        current.map((item) =>
          item.id === targetId
            ? {
                ...item,
                commentCount:
                  payload?.commentCount ?? (item.commentCount ?? 0) + 1,
              }
            : item,
        ),
      )
    },
    POST_COMMENT_DELETED: (payload) => {
      const targetId = payload?.postId ?? activeReel?.id
      if (!targetId) return
      setReels((current) =>
        current.map((item) =>
          item.id === targetId
            ? {
                ...item,
                commentCount:
                  payload?.commentCount ??
                  Math.max(0, (item.commentCount ?? 0) - 1),
              }
            : item,
        ),
      )
    },
  })

  const totalReels = page?.totalElements ?? reels.length

  if (loading) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Reels — short-form scholarship"
          title="Lectures, manuscripts, and field notes — in 90 seconds"
          description="A vertical-video stage curated for serious learners."
        />
        <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_320px]">
          <Skeleton className="hidden h-[720px] rounded-2xl lg:block" />
          <Skeleton className="aspect-[9/16] w-full max-w-[420px] justify-self-center rounded-3xl" />
          <Skeleton className="hidden h-[720px] rounded-2xl xl:block" />
        </div>
      </div>
    )
  }

  if (reels.length === 0) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Reels — short-form scholarship"
          title="Lectures, manuscripts, and field notes — in 90 seconds"
          description="A vertical-video stage curated for serious learners."
        />
        <FilterRow
          filter={filter}
          onFilter={setFilter}
          isAuthenticated={isAuthenticated}
        />
        <EmptyState
          icon={Clapperboard}
          title={
            filter === 'following'
              ? 'No reels from people you follow'
              : 'No reels yet'
          }
          description={
            filter === 'following'
              ? 'Follow scholars and creators to see their reels here, or switch to For you.'
              : 'Be the first to post a short video. Reels appear here and at the top of Home.'
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Reels — short-form scholarship"
        title="Lectures, manuscripts, and field notes — in 90 seconds"
        description="A vertical-video stage curated for serious learners. Swipe, listen, learn."
        stats={[{ value: formatNumber(totalReels), label: 'Reels' }]}
      />

      <FilterRow
        filter={filter}
        onFilter={setFilter}
        isAuthenticated={isAuthenticated}
      />

      <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_320px]">
        <div className="hidden lg:block">
          <UpNextRail reels={reels} activeId={activeId} onSelect={setActiveId} />
        </div>

        <div className="min-h-0">
          <ReelStage
            reel={activeReel}
            reels={reels}
            isMuted={muted}
            onToggleMuted={() => setMuted((v) => !v)}
            onChange={handleChange}
            onNext={handleNext}
            onPrev={handlePrev}
          />

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5 rounded-xl border border-border bg-paper px-3.5 py-2.5 text-[11.5px] text-ink-3">
            <span>
              <kbd className="mx-0.5 rounded border border-border bg-muted px-1.5 py-[1.5px] font-mono text-[10px] text-ink-2">Space</kbd>
              play / pause
            </span>
            <span className="text-ink-4">·</span>
            <span>
              <kbd className="mx-0.5 rounded border border-border bg-muted px-1.5 py-[1.5px] font-mono text-[10px] text-ink-2">↓</kbd>
              <kbd className="mx-0.5 rounded border border-border bg-muted px-1.5 py-[1.5px] font-mono text-[10px] text-ink-2">↑</kbd>
              <span className="ml-1 text-ink-4">/</span>
              <kbd className="mx-0.5 rounded border border-border bg-muted px-1.5 py-[1.5px] font-mono text-[10px] text-ink-2">J</kbd>
              <kbd className="mx-0.5 rounded border border-border bg-muted px-1.5 py-[1.5px] font-mono text-[10px] text-ink-2">K</kbd>
              next / prev
            </span>
            <span className="text-ink-4">·</span>
            <span>
              <kbd className="mx-0.5 rounded border border-border bg-muted px-1.5 py-[1.5px] font-mono text-[10px] text-ink-2">M</kbd>
              mute
            </span>
            <span className="text-ink-4">·</span>
            <span className="inline-flex items-center gap-1 font-mono text-[10.5px] text-ink-3">
              <span
                aria-hidden
                className="size-[5px] rounded-full"
                style={{ background: 'var(--gold)' }}
              />
              every reel ≤ 1:30
            </span>
          </div>
        </div>

        <div className="hidden xl:block">
          <DiscussionColumn reel={activeReel} onChange={handleChange} />
        </div>
      </div>

      <div className="xl:hidden">
        <DiscussionColumn reel={activeReel} onChange={handleChange} />
      </div>
    </div>
  )
}
