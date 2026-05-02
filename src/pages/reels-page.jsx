import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  BadgeCheck,
  BookOpen,
  Bookmark,
  ChevronDown,
  Clapperboard,
  Heart,
  Maximize2,
  MessageCircle,
  MoreHorizontal,
  Pause,
  Play,
  SkipForward,
  SlidersHorizontal,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
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
import { RoleBadge } from '@/components/app/role-badge'
import { UserAvatar } from '@/components/app/user-avatar'
import {
  getReels,
  reactToPost,
  removePostReaction,
  sharePost,
} from '@/features/posts/posts.api'
import { recordReelView } from '@/features/activity/activity.api'
import { useAuth } from '@/features/auth/auth-context'
import { useToast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import { extractApiMessage } from '@/lib/api-error'
import { formatNumber, getFullName, resolveMediaUrl } from '@/lib/format'

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

// ─── Filter chips + sort row ────────────────────────────────────────
const FILTERS = [
  { value: 'foryou',   label: 'For you' },
  { value: 'following', label: 'Following' },
  { value: 'live',     label: 'Live now' },
  { value: 'recitation', label: 'Recitation' },
  { value: 'manuscripts', label: 'Manuscripts' },
  { value: 'lectures', label: 'Lectures' },
]

const SORTS = [
  { value: 'trending', label: 'Trending' },
  { value: 'newest',   label: 'Newest' },
  { value: 'longest',  label: 'Longest' },
]

function FilterRow({ filter, onFilter, sortKey, onSort }) {
  const sort = SORTS.find((s) => s.value === sortKey) ?? SORTS[0]
  return (
    <div className="flex flex-wrap items-center gap-2">
      {FILTERS.map((f) => {
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

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              'ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border bg-paper px-3 py-1.5 text-[12.5px] font-semibold text-ink-2',
              'transition-colors hover:border-brand/40 hover:text-brand',
            )}
          >
            <SlidersHorizontal className="size-[13px]" />
            {sort.label}
            <ChevronDown className="size-3 text-ink-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={6}
          className="w-40 rounded-xl border-border bg-paper p-1 shadow-soft-lg"
        >
          {SORTS.map((opt) => (
            <DropdownMenuItem
              key={opt.value}
              onSelect={() => onSort(opt.value)}
              className={cn(
                'rounded-lg px-2.5 py-1.5 text-[13px]',
                sortKey === opt.value && 'bg-brand-soft/60 text-brand',
              )}
            >
              {opt.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
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
          const duration = post.durationSeconds ?? post.mediaList?.[0]?.durationSeconds
          const isLive = post.live
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
                {isLive ? (
                  <span className="absolute left-1 top-1 rounded bg-accent-rust px-1 py-[2px] font-mono text-[9px] font-extrabold tracking-[0.1em] text-white">
                    LIVE
                  </span>
                ) : null}
                {duration ? (
                  <span className="absolute bottom-1 right-1 rounded bg-black/65 px-1 py-[1px] font-mono text-[9.5px] tabular-nums text-white">
                    {fmtTime(duration)}
                  </span>
                ) : null}
              </div>
              <div className="min-w-0 pt-0.5">
                <p
                  className={cn(
                    'line-clamp-3 font-display text-[12px] font-semibold leading-[1.3] tracking-[-0.005em]',
                    active ? 'text-ink' : 'text-ink',
                  )}
                >
                  {post.title || post.textContent || 'Untitled reel'}
                </p>
                <p className="mt-1 truncate text-[10.5px] text-ink-3 tabular-nums">
                  {(getFullName(author) || author?.username || '—') + ' · ' + formatNumber(post.viewCount ?? 0)}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </aside>
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
}) {
  const { isAuthenticated } = useAuth()
  const toast = useToast()
  const videoRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [working, setWorking] = useState(false)
  const [following, setFollowing] = useState(false)

  const watchedSecondsRef = useRef(0)
  const lastTickRef = useRef(null)
  const recordedRef = useRef(false)

  const author = normalizeAuthor(reel)
  const media = reel?.mediaList?.[0]
  const url = resolveMediaUrl(media?.url ?? media?.mediaUrl)
  const tags = Array.isArray(reel?.tags) ? reel.tags : []

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

  // When the active reel changes, reset watch counters and play
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

  function seek(event) {
    const el = videoRef.current
    if (!el || !duration) return
    const bar = event.currentTarget
    const rect = bar.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    el.currentTime = ratio * duration
    setProgress(ratio)
  }

  async function toggleReact() {
    if (!isAuthenticated) {
      toast.info('Sign in to react.')
      return
    }
    if (working) return
    const previous = reel
    const wasReacting = Boolean(reel.myReaction)
    const next = wasReacting
      ? { ...reel, myReaction: null, reactionCount: Math.max(0, (reel.reactionCount ?? 0) - 1) }
      : { ...reel, myReaction: 'LIKE', reactionCount: (reel.reactionCount ?? 0) + 1 }
    onChange?.(next)
    setWorking(true)
    try {
      if (wasReacting) {
        await removePostReaction(reel.id)
      } else {
        const updated = await reactToPost(reel.id, 'LIKE')
        if (updated) onChange?.({ ...updated, myReaction: 'LIKE' })
      }
    } catch (error) {
      onChange?.(previous)
      toast.error(extractApiMessage(error, 'Could not react.'))
    } finally {
      setWorking(false)
    }
  }

  async function handleShare() {
    try {
      const link = reel.shareLink || `${window.location.origin}/reels?id=${reel.id}`
      await navigator.clipboard.writeText(link)
      toast.success('Link copied.')
      sharePost(reel.id).catch(() => {})
      onChange?.({ ...reel, shareCount: (reel.shareCount ?? 0) + 1 })
    } catch {
      toast.error('Could not copy link.')
    }
  }

  function toggleBookmark() {
    onChange?.({ ...reel, bookmarkedByMe: !reel.bookmarkedByMe })
  }

  const liked = Boolean(reel?.myReaction)
  const bookmarked = Boolean(reel?.bookmarkedByMe)
  const isLive = Boolean(reel?.live)
  const stripe = thumbStyleFor(reel ?? {})
  const eyebrow = (tags[0] ?? reel?.category ?? 'reel').toString()
  const activeIndex = reels.findIndex((r) => r.id === reel?.id)

  return (
    <div className="relative grid place-items-center overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-muted/60 to-background p-5 sm:p-6">
      {/* Brand-tinted radial flare from the top */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 80% at 50% -10%, color-mix(in oklch, var(--brand) 12%, transparent), transparent 60%)',
        }}
      />

      {/* Vertical screen */}
      <div className="relative isolate aspect-[9/16] w-full max-w-[420px] overflow-hidden rounded-[22px] bg-paper shadow-soft-lg ring-1 ring-border">
        {/* Background — video, or stripe fallback */}
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

        {/* Live badge */}
        {isLive ? (
          <span className="absolute left-1/2 top-3.5 z-10 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-accent-rust px-2.5 py-1 font-mono text-[10px] font-extrabold tracking-[0.12em] text-white">
            <span className="size-1.5 animate-pulse rounded-full bg-white" />
            LIVE
          </span>
        ) : null}

        {/* Top bar — author tag */}
        <div className="absolute inset-x-3 top-3 z-10 flex items-center gap-2">
          <Link
            to={author?.username ? `/profile/${author.username}` : '#'}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border border-ink/[0.08] bg-paper/85 py-[5px] pl-[5px] pr-2.5 backdrop-blur transition-colors hover:bg-paper',
            )}
          >
            <UserAvatar user={author} className="size-7 ring-1 ring-paper" />
            <div className="leading-tight">
              <p className="inline-flex items-center gap-1 text-[12.5px] font-semibold tracking-[-0.005em] text-ink">
                {getFullName(author) || `@${author?.username}`}
                {author?.verified ? <BadgeCheck className="size-3 text-gold-2" /> : null}
              </p>
              <p className="text-[10.5px] text-ink-3">@{author?.username}</p>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setFollowing((v) => !v)}
            className={cn(
              'rounded-full px-2.5 py-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.04em]',
              following
                ? 'bg-muted text-ink-2'
                : 'bg-gradient-to-br from-brand to-brand/85 text-brand-foreground shadow-soft',
            )}
          >
            {following ? 'Following' : '+ Follow'}
          </button>

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
                <Sparkles className="mr-2 size-4" />
                Copy link
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Editorial title overlay (only visible when paused / before play) */}
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
                #{eyebrow}
              </span>
              <p
                className="mt-3 font-display text-[26px] font-semibold leading-[1.15] tracking-[-0.022em] text-ink text-balance"
                style={{ textShadow: '0 1px 24px oklch(1 0 0 / 0.5)' }}
              >
                {reel?.title || reel?.textContent || 'Untitled reel'}
              </p>
              {author ? (
                <p className="mt-2 font-display text-[13px] italic text-ink-2">
                  — {getFullName(author) || `@${author.username}`}
                </p>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Side rail — actions (Insta-style) */}
        <div className="absolute bottom-32 right-2.5 z-[5] flex flex-col items-center gap-3.5">
          <RailIcon
            label={formatNumber(reel?.reactionCount ?? 0)}
            active={liked}
            activeBg="bg-accent-rust border-accent-rust"
            onClick={toggleReact}
          >
            <Heart className={cn('size-5', liked && 'fill-current')} strokeWidth={1.8} />
          </RailIcon>
          <RailIcon label={formatNumber(reel?.commentCount ?? 0)}>
            <MessageCircle className="size-5" strokeWidth={1.8} />
          </RailIcon>
          <RailIcon
            label={formatNumber((reel?.saveCount ?? 0) + (bookmarked ? 1 : 0))}
            active={bookmarked}
            activeBg="bg-gold border-gold text-ink"
            onClick={toggleBookmark}
          >
            <Bookmark
              className={cn('size-5', bookmarked && 'fill-current')}
              strokeWidth={1.8}
            />
          </RailIcon>
          <RailIcon label="Share" onClick={handleShare}>
            <Sparkles className="size-5" strokeWidth={1.8} />
          </RailIcon>
        </div>

        {/* Bottom info — title, desc, tags */}
        <div className="absolute inset-x-4 bottom-[60px] z-[3] mr-16 text-white">
          <p
            className="font-display text-[15px] font-semibold leading-[1.2] tracking-[-0.012em] text-balance"
            style={{ textShadow: '0 1px 6px oklch(0 0 0 / 0.45)' }}
          >
            {reel?.title || reel?.textContent || ''}
          </p>
          {reel?.description ? (
            <p
              className="mt-1 line-clamp-2 text-[12.5px] leading-[1.45] opacity-90"
              style={{ textShadow: '0 1px 6px oklch(0 0 0 / 0.45)' }}
            >
              {reel.description}
            </p>
          ) : null}
          {tags.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded-md border border-white/15 bg-black/45 px-1.5 py-[2px] font-mono text-[10.5px] text-white backdrop-blur"
                >
                  #{tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>

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

        {/* Big play overlay (when paused) */}
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

        {/* Vertical position dots — outside the screen on the right */}
        <div className="pointer-events-none absolute -right-4 top-1/2 z-[6] hidden -translate-y-1/2 flex-col gap-1.5 lg:flex">
          {reels.slice(0, 12).map((post, idx) => (
            <span
              key={post.id}
              aria-hidden
              className={cn(
                'block w-[5px] rounded-full transition-all',
                idx === activeIndex ? 'h-6 bg-brand' : 'h-3 bg-ink/25',
              )}
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

// ─── Right column — discussion / chapters / sources ─────────────────
function CommentsColumn({ reel, onChange }) {
  const [tab, setTab] = useState('discussion')

  return (
    <aside className="flex max-h-[720px] flex-col overflow-hidden rounded-2xl border border-border bg-paper">
      <div className="flex gap-1 border-b border-border bg-muted/40 p-1.5">
        {[
          { value: 'discussion', label: 'Discussion' },
          { value: 'chapters',   label: 'Chapters' },
          { value: 'sources',    label: 'Sources' },
        ].map((t) => {
          const active = tab === t.value
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className={cn(
                'flex-1 rounded-lg px-2 py-2 text-[12.5px] font-semibold transition-colors',
                active
                  ? 'bg-paper text-ink shadow-soft'
                  : 'text-ink-3 hover:text-ink',
              )}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {tab === 'discussion' && reel ? (
          <PostComments
            postId={reel.id}
            initialCount={reel.commentCount ?? 0}
            onCountChange={(next) =>
              onChange?.({ ...reel, commentCount: next })
            }
          />
        ) : null}

        {tab === 'chapters' ? (
          <ColumnEmpty
            title="No chapters yet"
            hint="Authors can add timestamped chapters to this reel."
          />
        ) : null}

        {tab === 'sources' ? (
          <ColumnEmpty
            title="No sources cited"
            hint="When the author cites a paper or manuscript, it appears here."
          />
        ) : null}
      </div>
    </aside>
  )
}

function ColumnEmpty({ title, hint }) {
  return (
    <div className="grid place-items-center py-10 text-center">
      <p className="font-display text-[14px] font-semibold tracking-[-0.005em] text-ink">
        {title}
      </p>
      <p className="mt-1 max-w-[24ch] text-[12px] text-ink-3">{hint}</p>
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────────────
export function ReelsPage() {
  const toast = useToast()
  const [reels, setReels] = useState([])
  const [page, setPage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState(null)
  const [muted, setMuted] = useState(true)
  const [filter, setFilter] = useState('foryou')
  const [sortKey, setSortKey] = useState('trending')
  const [searchParams] = useSearchParams()
  const focusReelId = searchParams.get('id')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const data = await getReels({ page: 0, size: 20 })
        if (!cancelled) {
          setReels(data?.content ?? [])
          setPage(data)
        }
      } catch (error) {
        if (!cancelled) toast.error(extractApiMessage(error, 'Could not load reels.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [toast])

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

  // Editorial stats
  const totalReels = page?.totalElements ?? reels.length
  const liveCount = reels.filter((r) => r.live).length
  const newToday = reels.filter((r) => {
    if (!r.createdAt) return false
    const t = new Date(r.createdAt).getTime()
    return Date.now() - t < 24 * 60 * 60 * 1000
  }).length

  if (loading) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Reels — short-form scholarship"
          title="Lectures, manuscripts, and field notes — in 90 seconds"
          description="A vertical-video stage curated for serious learners. Swipe, listen, learn — every reel cites its sources."
        />
        <div className="grid gap-[18px] xl:grid-cols-[220px_minmax(0,1fr)_320px] lg:grid-cols-[200px_minmax(0,1fr)] grid-cols-1">
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
        <EmptyState
          icon={Clapperboard}
          title="No reels yet"
          description="Be the first to post a short video. Reels appear here and at the top of Home."
        />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Reels — short-form scholarship"
        title="Lectures, manuscripts, and field notes — in 90 seconds"
        description="A vertical-video stage curated for serious learners. Swipe, listen, learn — every reel cites its sources."
        stats={[
          { value: formatNumber(totalReels), label: 'Reels' },
          { value: formatNumber(liveCount),  label: 'Live now' },
          { value: formatNumber(newToday),   label: 'New today', tone: 'gold' },
        ]}
      />

      <FilterRow
        filter={filter}
        onFilter={setFilter}
        sortKey={sortKey}
        onSort={setSortKey}
      />

      <div className="grid gap-[18px] grid-cols-1 lg:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_320px]">
        {/* Left rail */}
        <div className="hidden lg:block">
          <UpNextRail reels={reels} activeId={activeId} onSelect={setActiveId} />
        </div>

        {/* Center stage */}
        <div className="min-h-0">
          <ReelStage
            reel={activeReel}
            reels={reels}
            isMuted={muted}
            onToggleMuted={() => setMuted((v) => !v)}
            onChange={handleChange}
            onNext={handleNext}
          />

          {/* Hint strip */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5 rounded-xl border border-border bg-paper px-3.5 py-2.5 text-[11.5px] text-ink-3">
            <span>
              <kbd className="mx-0.5 rounded border border-border bg-muted px-1.5 py-[1.5px] font-mono text-[10px] text-ink-2">Space</kbd>
              play / pause
            </span>
            <span className="text-ink-4">·</span>
            <span>
              <kbd className="mx-0.5 rounded border border-border bg-muted px-1.5 py-[1.5px] font-mono text-[10px] text-ink-2">↓</kbd>
              <kbd className="mx-0.5 rounded border border-border bg-muted px-1.5 py-[1.5px] font-mono text-[10px] text-ink-2">↑</kbd>
              next / prev
            </span>
            <span className="text-ink-4">·</span>
            <span>
              <kbd className="mx-0.5 rounded border border-border bg-muted px-1.5 py-[1.5px] font-mono text-[10px] text-ink-2">M</kbd>
              mute
            </span>
          </div>
        </div>

        {/* Right column */}
        <div className="hidden xl:block">
          <CommentsColumn reel={activeReel} onChange={handleChange} />
        </div>
      </div>

      {/* Mobile / tablet comments — below the stage */}
      <div className="xl:hidden">
        <CommentsColumn reel={activeReel} onChange={handleChange} />
      </div>
    </div>
  )
}
