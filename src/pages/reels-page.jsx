import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  ChevronUp,
  ChevronDown,
  Clapperboard,
  Copy,
  Link as LinkIcon,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Play,
  Repeat2,
  Send,
  Share2,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/app/empty-state'
import { PageHeader } from '@/components/app/page-header'
import { PostComments } from '@/components/app/post-comments'
import { ReactionPicker } from '@/components/app/reaction-picker'
import { RoleBadge } from '@/components/app/role-badge'
import { UserAvatar } from '@/components/app/user-avatar'
import {
  copyPostShareLink,
  getReels,
  getFollowingReels,
  reactToPost,
  removePostReaction,
  repostPost,
} from '@/features/posts/posts.api'
import { recordReelView } from '@/features/activity/activity.api'
import { usePostStream } from '@/hooks/use-post-stream'
import { followUser, getSocialStatus } from '@/features/social/social.api'
import { useAuth } from '@/features/auth/auth-context'
import { useToast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import { extractApiMessage, friendlyApiMessage } from '@/lib/api-error'
import {
  formatNumber,
  getFullName,
  getHandle,
  getRawUsername,
  resolveMediaUrl,
} from '@/lib/format'
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
function stripeBackground(id) {
  const [tint, angle] = stripeFor(id)
  return {
    background: `repeating-linear-gradient(${angle}deg, ${tint} 0 14px, color-mix(in oklch, ${tint} 50%, var(--paper)) 14px 28px)`,
  }
}

const FILTERS = [
  { value: 'foryou', label: 'For you' },
  { value: 'following', label: 'Following', authOnly: true },
]

// ─── Filter pill row (stacked on top of feed) ──────────────────────
function FilterRow({ filter, onFilter, isAuthenticated, total }) {
  const visible = FILTERS.filter((f) => !f.authOnly || isAuthenticated)
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 rounded-full border border-white/15 bg-black/45 p-1 backdrop-blur-md">
        {visible.map((f) => {
          const active = f.value === filter
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => onFilter(f.value)}
              className={cn(
                'rounded-full px-3 py-1 font-display text-[12.5px] font-semibold tracking-[-0.005em] transition-all',
                active
                  ? 'bg-white text-ink shadow-soft'
                  : 'text-white/85 hover:text-white',
              )}
            >
              {f.label}
            </button>
          )
        })}
      </div>
      {total ? (
        <span className="rounded-full border border-white/15 bg-black/45 px-2.5 py-1 font-mono text-[10.5px] font-semibold tabular-nums text-white/90 backdrop-blur-md">
          {formatNumber(total)} reels
        </span>
      ) : null}
    </div>
  )
}

// ─── Follow chip — wired to backend social API ──────────────────────
function FollowChip({ author }) {
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

  if (!author?.id || !isAuthenticated || isMe || following) return null

  const followLabel = getFullName(author) || getHandle(author) || 'user'

  async function toggle() {
    if (busy) return
    setBusy(true)
    setFollowing(true)
    try {
      await followUser(author.id)
      toast.success(`Following ${followLabel}`)
    } catch (error) {
      setFollowing(false)
      toast.error(extractApiMessage(error, 'Could not follow.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy || following == null}
      className={cn(
        'absolute -bottom-1 left-1/2 grid size-[18px] -translate-x-1/2 place-items-center rounded-full border-2 border-white bg-gradient-to-br from-accent-rust to-accent-rust/85 text-[13px] font-bold leading-none text-white shadow-soft transition-transform',
        'hover:scale-110 disabled:opacity-50',
      )}
      aria-label={`Follow ${followLabel}`}
      title={`Follow ${followLabel}`}
    >
      {busy ? (
        <Loader2 className="size-2.5 animate-spin" />
      ) : (
        <span className="-mt-px text-[12px]">+</span>
      )}
    </button>
  )
}

// ─── Reaction breakdown — small stacked emoji chip ─────────────────
function ReactionBreakdown({ topTypes = [], total = 0, onClick }) {
  if (!total) return null
  const types = (topTypes?.length ? topTypes : ['LIKE']).slice(0, 3)
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 rounded-full border border-white/15 bg-black/45 px-1.5 py-1 backdrop-blur-md transition-colors hover:bg-black/65"
    >
      <div className="flex -space-x-1.5">
        {types.map((type, idx) => {
          const info = getPostReaction(type)
          return (
            <span
              key={`${type}-${idx}`}
              style={{ zIndex: 5 - idx }}
              className="grid size-[18px] place-items-center rounded-full border border-white/30 bg-paper"
            >
              <span className="text-[11px] leading-none">{info.emoji}</span>
            </span>
          )
        })}
      </div>
      <span className="pr-1 font-mono text-[10.5px] font-semibold tabular-nums text-white">
        {formatNumber(total)}
      </span>
    </button>
  )
}

// ─── Action rail icon (vertical TikTok-style stack) ────────────────
function RailButton({
  icon: Icon,
  emoji,
  count,
  label,
  onClick,
  active,
  activeColorClass,
  glyphSize = 'size-[26px]',
  iconClass,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group/rail flex flex-col items-center gap-1 text-white"
      style={{ textShadow: '0 1px 4px oklch(0 0 0 / 0.55)' }}
      aria-label={label}
      title={label}
    >
      <motion.span
        whileTap={{ scale: 0.84 }}
        whileHover={{ scale: 1.06 }}
        transition={{ type: 'spring', stiffness: 460, damping: 22 }}
        className={cn(
          'grid place-items-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur-md transition-colors group-hover/rail:bg-black/65',
          glyphSize,
          active && activeColorClass,
        )}
      >
        {emoji ? (
          <span className="text-[22px] leading-none">{emoji}</span>
        ) : Icon ? (
          <Icon
            className={cn('size-[22px]', iconClass)}
            strokeWidth={1.9}
          />
        ) : null}
      </motion.span>
      {count != null ? (
        <motion.span
          key={count}
          initial={{ scale: 0.85, opacity: 0.4 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 480, damping: 26 }}
          className="font-mono text-[11.5px] font-bold tabular-nums"
        >
          {typeof count === 'number' ? formatNumber(count) : count}
        </motion.span>
      ) : null}
    </button>
  )
}

// ─── Floating ❤ on double-tap ──────────────────────────────────────
function FloatingHearts({ bursts }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[8] overflow-hidden">
      <AnimatePresence>
        {bursts.map((b) => (
          <motion.span
            key={b.id}
            initial={{ opacity: 0.95, scale: 0.6, x: b.x - 40, y: b.y - 40, rotate: b.rot }}
            animate={{ opacity: 0, scale: 1.6, y: b.y - 180, rotate: b.rot * 1.4 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
            className="absolute text-[80px] leading-none drop-shadow-[0_4px_20px_rgba(255,40,80,0.35)]"
          >
            ❤️
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  )
}

// ─── ReelCard — single full-screen reel (auto-pauses when offscreen) ─
const ReelCard = forwardRef(function ReelCard(
  {
    reel,
    isMuted,
    onToggleMuted,
    onChange,
    onOpenComments,
    onOpenShare,
    onActive,
    eager,
  },
  ref,
) {
  const { isAuthenticated } = useAuth()
  const toast = useToast()

  const containerRef = useRef(null)
  const videoRef = useRef(null)
  const lastTapRef = useRef(0)
  const watchedSecondsRef = useRef(0)
  const lastTickRef = useRef(null)
  const recordedRef = useRef(false)

  const [active, setActive] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [working, setWorking] = useState(false)
  const [bursts, setBursts] = useState([])

  const author = normalizeAuthor(reel)
  const media = reel?.mediaList?.[0]
  const url = resolveMediaUrl(media?.url ?? media?.mediaUrl)
  const stripe = stripeBackground(reel?.id)

  // Display tokens — never expose an email-shaped username.
  // `authorDisplayName` is the full name when known (falls back to a
  // sanitized handle), `authorHandle` is the email-stripped handle for
  // the `@…` line, and `authorRoute` is the raw username for the
  // profile URL (the backend looks it up verbatim).
  const authorDisplayName = getFullName(author) || getHandle(author) || 'Unknown'
  const authorHandle = getHandle(author)
  const authorRoute = getRawUsername(author)

  // Imperative scroll (so the page can focus a specific reel by id)
  useImperativeHandle(
    ref,
    () => ({
      scrollIntoView: (opts) => containerRef.current?.scrollIntoView(opts),
      pause: () => videoRef.current?.pause(),
      play: () => videoRef.current?.play().catch(() => {}),
      el: () => containerRef.current,
    }),
    [],
  )

  function flushWatch() {
    if (!isAuthenticated || !reel?.id) return
    if (recordedRef.current) return
    const watched = Math.round(watchedSecondsRef.current)
    if (watched < 2) return
    recordedRef.current = true
    recordReelView(reel.id, watched).catch(() => {
      recordedRef.current = false
    })
  }

  // Activity tracking via IntersectionObserver — the reel that's most
  // visible is the "active" one. Active reels autoplay; others pause
  // and reset their watched counter.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        const next = entry.intersectionRatio >= 0.6
        setActive((prev) => {
          if (prev === next) return prev
          if (!next) {
            // Becoming inactive — flush, pause, reset.
            flushWatch()
            const v = videoRef.current
            if (v) {
              v.pause()
              v.currentTime = 0
            }
            watchedSecondsRef.current = 0
            lastTickRef.current = null
            recordedRef.current = false
            setProgress(0)
          } else {
            onActive?.(reel?.id)
            const v = videoRef.current
            v?.play().catch(() => setPlaying(false))
          }
          return next
        })
      },
      { threshold: [0, 0.6, 1] },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [reel?.id])

  useEffect(() => () => flushWatch(), []) // unmount flush

  function togglePlay() {
    const el = videoRef.current
    if (!el) return
    if (el.paused) el.play().catch(() => setPlaying(false))
    else el.pause()
  }

  function handleTap(event) {
    const now = Date.now()
    if (now - lastTapRef.current < 280) {
      // Double-tap → quick LOVE reaction + heart burst
      lastTapRef.current = 0
      const rect = containerRef.current?.getBoundingClientRect()
      const cx = rect ? event.clientX - rect.left : 200
      const cy = rect ? event.clientY - rect.top : 200
      const id = Math.random().toString(36).slice(2)
      const rot = Math.random() * 50 - 25
      setBursts((list) => [...list, { id, x: cx, y: cy, rot }])
      setTimeout(() => setBursts((list) => list.filter((b) => b.id !== id)), 1200)
      pickReaction('LOVE', { silent: true })
      return
    }
    lastTapRef.current = now
    setTimeout(() => {
      if (lastTapRef.current && Date.now() - lastTapRef.current >= 280) {
        togglePlay()
        lastTapRef.current = 0
      }
    }, 290)
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

  async function pickReaction(type, { silent = false } = {}) {
    if (!isAuthenticated) {
      if (!silent) toast.info('Sign in to react.')
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
      if (!silent) toast.error(extractApiMessage(error, 'Could not react.'))
    } finally {
      setWorking(false)
    }
  }

  async function clearReaction() {
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

  const currentReactionInfo = reel?.myReaction ? getPostReaction(reel.myReaction) : null

  return (
    <article
      ref={containerRef}
      data-reel-id={reel?.id}
      className="relative grid h-full place-items-center snap-start snap-always"
    >
      <div className="relative isolate flex h-full w-full max-w-[440px] items-center justify-center px-2 sm:px-3">
        <div
          className="relative isolate aspect-[9/16] max-h-full w-full overflow-hidden rounded-[28px] bg-paper shadow-soft-lg ring-1 ring-border/60"
          style={!url ? stripe : undefined}
        >
          {(eager || active) && url ? (
            <video
              ref={videoRef}
              src={url}
              playsInline
              muted={isMuted}
              loop
              preload={active ? 'auto' : 'metadata'}
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
                const t = el.currentTime
                const last = lastTickRef.current
                if (last != null && t > last) {
                  const delta = t - last
                  if (delta < 1.5) watchedSecondsRef.current += delta
                  if (watchedSecondsRef.current >= 2 && !recordedRef.current) flushWatch()
                }
                lastTickRef.current = t
              }}
              onClick={handleTap}
              className="absolute inset-0 h-full w-full cursor-pointer object-cover"
            />
          ) : null}

          {/* Floor/ceiling vignettes for legibility */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/30"
          />

          <FloatingHearts bursts={bursts} />

          {/* Top-right mute pill */}
          <button
            type="button"
            onClick={onToggleMuted}
            className="absolute right-3 top-3 z-[5] grid size-9 place-items-center rounded-full border border-white/20 bg-black/55 text-white backdrop-blur-md transition-colors hover:bg-black/75"
            aria-label={isMuted ? 'Unmute' : 'Mute'}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? (
              <VolumeX className="size-[18px]" strokeWidth={2} />
            ) : (
              <Volume2 className="size-[18px]" strokeWidth={2} />
            )}
          </button>

          {/* Big play overlay (paused state) */}
          <AnimatePresence>
            {!playing && url ? (
              <motion.button
                key="play"
                type="button"
                onClick={togglePlay}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ type: 'spring', stiffness: 400, damping: 26 }}
                className="absolute inset-0 z-[6] grid place-items-center bg-black/25 backdrop-blur-[1px]"
                aria-label="Play"
              >
                <span className="grid size-[80px] place-items-center rounded-full bg-paper/95 text-ink shadow-soft-lg">
                  <Play className="size-7 translate-x-[2px] fill-current" />
                </span>
              </motion.button>
            ) : null}
          </AnimatePresence>

          {/* Bottom — caption + author */}
          <div className="absolute inset-x-0 bottom-0 z-[5] flex items-end gap-3 px-4 pb-12 pr-[88px] sm:pr-[92px]">
            <div className="min-w-0 flex-1 text-white">
              <Link
                to={authorRoute ? `/profile/${authorRoute}` : '#'}
                className="block leading-tight transition-opacity hover:opacity-90"
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className="truncate font-display text-[15.5px] font-bold tracking-[-0.005em]"
                    style={{ textShadow: '0 1px 6px oklch(0 0 0 / 0.6)' }}
                  >
                    {authorDisplayName}
                  </span>
                  {author?.role ? (
                    <RoleBadge role={author.role} size="xs" showIcon={false} />
                  ) : null}
                </span>
                {authorHandle ? (
                  <span
                    className="mt-0.5 block truncate font-mono text-[11.5px] font-semibold text-white/85"
                    style={{ textShadow: '0 1px 4px oklch(0 0 0 / 0.55)' }}
                  >
                    @{authorHandle}
                  </span>
                ) : null}
              </Link>
              {reel?.textContent ? (
                <p
                  className="mt-2 line-clamp-3 text-[13.5px] leading-[1.4] text-white/95"
                  style={{ textShadow: '0 1px 6px oklch(0 0 0 / 0.6)' }}
                >
                  {reel.textContent}
                </p>
              ) : null}
              <div className="mt-2 flex items-center gap-2">
                <ReactionBreakdown
                  topTypes={reel?.topReactionTypes}
                  total={reel?.reactionCount ?? 0}
                  onClick={onOpenComments}
                />
                {reel?.viewCount ? (
                  <span
                    className="font-mono text-[10.5px] font-semibold tabular-nums text-white/85"
                    style={{ textShadow: '0 1px 4px oklch(0 0 0 / 0.55)' }}
                  >
                    {formatNumber(reel.viewCount)} views
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {/* Right — action rail (TikTok-style) */}
          <div className="absolute bottom-14 right-2 z-[6] flex flex-col items-center gap-4">
            {/* Avatar with follow chip */}
            <Link
              to={authorRoute ? `/profile/${authorRoute}` : '#'}
              className="relative"
              aria-label={`Open ${authorDisplayName}'s profile`}
            >
              <span className="block rounded-full ring-2 ring-white/85">
                <UserAvatar user={author} className="size-12 ring-2 ring-paper" />
              </span>
              <FollowChip author={author} />
            </Link>

            {/* Reactions — full Facebook-style picker via long-press / hover */}
            <ReactionPicker
              current={reel?.myReaction ?? null}
              onSelect={pickReaction}
              onClear={clearReaction}
              disabled={working}
              align="right"
              trigger={({ toggleDefault, current }) => (
                <RailButton
                  emoji={current?.emoji ?? currentReactionInfo?.emoji ?? '👍'}
                  count={reel?.reactionCount ?? 0}
                  label="React"
                  onClick={toggleDefault}
                  active={Boolean(current)}
                  activeColorClass="bg-gradient-to-br from-rose-500/85 to-rose-600/85 border-rose-300/60"
                  glyphSize="size-[50px]"
                />
              )}
            />

            <RailButton
              icon={MessageCircle}
              count={reel?.commentCount ?? 0}
              label="Comments"
              onClick={onOpenComments}
              glyphSize="size-[50px]"
            />

            <RailButton
              icon={Repeat2}
              count={reel?.shareCount ?? 0}
              label="Repost"
              onClick={onOpenShare}
              glyphSize="size-[50px]"
            />

            <RailButton
              icon={Share2}
              label="Share"
              onClick={onOpenShare}
              glyphSize="size-[50px]"
            />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="grid size-[42px] place-items-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur-md transition-colors hover:bg-black/65"
                  aria-label="More"
                  title="More"
                >
                  <MoreHorizontal className="size-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={6} className="w-44 rounded-xl">
                <DropdownMenuItem onSelect={onOpenShare}>
                  <Share2 className="mr-2 size-4" />
                  Share / Repost
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onOpenComments}>
                  <MessageCircle className="mr-2 size-4" />
                  Comments
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Bottom — slim progress bar */}
          {url ? (
            <div
              className="absolute inset-x-0 bottom-0 z-[7] h-2.5 cursor-pointer bg-transparent"
              onClick={seek}
            >
              <div className="absolute inset-x-3 bottom-1 h-[3px] overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full transition-[width] duration-150"
                  style={{
                    width: `${progress * 100}%`,
                    background: 'linear-gradient(90deg, var(--brand-muted), var(--gold))',
                  }}
                />
              </div>
            </div>
          ) : null}

          {/* Time pill (bottom-left) */}
          {duration ? (
            <span className="pointer-events-none absolute bottom-3 left-3 z-[6] rounded-md bg-black/55 px-1.5 py-[2px] font-mono text-[10px] font-semibold tabular-nums text-white backdrop-blur-md">
              {fmtTime(duration * progress)} / {fmtTime(duration)}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  )
})

// ─── Share / Repost sheet (bottom on mobile, right on desktop) ─────
function ShareSheet({ open, onOpenChange, reel, onChange }) {
  const { isAuthenticated } = useAuth()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [caption, setCaption] = useState('')
  const [shareLink, setShareLink] = useState('')

  useEffect(() => {
    if (!open || !reel?.id) return
    setShareLink(reel.shareLink || `${window.location.origin}/reels?id=${reel.id}`)
    setCaption('')
  }, [open, reel?.id, reel?.shareLink])

  if (!reel) return null

  async function copyLink() {
    if (busy) return
    setBusy(true)
    try {
      const result = isAuthenticated ? await copyPostShareLink(reel.id) : null
      const link = result?.url || shareLink
      await navigator.clipboard.writeText(link)
      if (result?.shareCount != null) {
        onChange?.({ ...reel, shareCount: result.shareCount })
      } else {
        onChange?.({ ...reel, shareCount: (reel.shareCount ?? 0) + 1 })
      }
      toast.success('Link copied to clipboard.')
    } catch {
      toast.error('Could not copy link.')
    } finally {
      setBusy(false)
    }
  }

  async function repost() {
    if (!isAuthenticated) {
      toast.info('Sign in to repost.')
      return
    }
    if (busy) return
    setBusy(true)
    try {
      await repostPost(reel.id, caption.trim() || undefined)
      onChange?.({ ...reel, shareCount: (reel.shareCount ?? 0) + 1 })
      toast.success('Reposted to your feed.')
      onOpenChange(false)
    } catch (error) {
      toast.error(friendlyApiMessage(error, 'Could not repost.'))
    } finally {
      setBusy(false)
    }
  }

  async function nativeShare() {
    if (!navigator.share) {
      copyLink()
      return
    }
    try {
      await navigator.share({
        title: reel.textContent || 'Reel',
        text: reel.textContent || '',
        url: shareLink,
      })
      onChange?.({ ...reel, shareCount: (reel.shareCount ?? 0) + 1 })
    } catch {
      // user cancelled — no-op
    }
  }

  function externalShare(target) {
    const text = encodeURIComponent(reel.textContent || 'Watch this reel')
    const u = encodeURIComponent(shareLink)
    const urls = {
      twitter: `https://twitter.com/intent/tweet?text=${text}&url=${u}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
      whatsapp: `https://api.whatsapp.com/send?text=${text}%20${u}`,
      telegram: `https://t.me/share/url?url=${u}&text=${text}`,
    }
    const target_url = urls[target]
    if (!target_url) return
    window.open(target_url, '_blank', 'noopener,noreferrer')
    onChange?.({ ...reel, shareCount: (reel.shareCount ?? 0) + 1 })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl border-t border-border bg-paper p-0 sm:max-w-none"
        showClose={false}
      >
        <div className="relative mx-auto w-full max-w-2xl px-5 py-5">
          <span
            aria-hidden
            className="mx-auto mb-4 block h-1.5 w-12 rounded-full bg-ink-4/40"
          />
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 grid size-8 place-items-center rounded-full border border-border bg-paper text-ink-3 transition-colors hover:bg-muted hover:text-ink"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>

          <SheetHeader className="text-center sm:text-center">
            <SheetTitle className="font-display text-[20px] font-semibold tracking-[-0.012em]">
              Share this reel
            </SheetTitle>
            <SheetDescription className="text-[12.5px]">
              Send to a friend, post it, or repost to your feed with your own caption.
            </SheetDescription>
          </SheetHeader>

          {/* Quick share row */}
          <div className="mt-5 grid grid-cols-4 gap-3 sm:grid-cols-6">
            <ShareIcon
              label="Copy link"
              icon={Copy}
              onClick={copyLink}
              tone="bg-ink text-paper"
            />
            <ShareIcon
              label="Native"
              icon={Send}
              onClick={nativeShare}
              tone="bg-gradient-to-br from-brand to-brand/85 text-brand-foreground"
            />
            <ShareIcon
              label="X / Twitter"
              emoji="𝕏"
              onClick={() => externalShare('twitter')}
              tone="bg-ink text-paper"
            />
            <ShareIcon
              label="Facebook"
              emoji="f"
              onClick={() => externalShare('facebook')}
              tone="bg-blue-600 text-white font-display font-bold text-[24px]"
            />
            <ShareIcon
              label="WhatsApp"
              emoji="🟢"
              onClick={() => externalShare('whatsapp')}
              tone="bg-emerald-500 text-white"
            />
            <ShareIcon
              label="Telegram"
              emoji="✈️"
              onClick={() => externalShare('telegram')}
              tone="bg-sky-400 text-white"
            />
          </div>

          {/* Read-only link box */}
          <div className="mt-5 flex items-center gap-2 rounded-xl border border-border bg-muted/40 p-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-paper text-ink-3 ring-1 ring-border">
              <LinkIcon className="size-3.5" />
            </span>
            <input
              readOnly
              value={shareLink}
              onFocus={(event) => event.currentTarget.select()}
              className="min-w-0 flex-1 bg-transparent font-mono text-[12px] text-ink outline-none"
            />
            <button
              type="button"
              onClick={copyLink}
              disabled={busy}
              className="rounded-md bg-ink px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.04em] text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Copy
            </button>
          </div>

          {/* Repost block */}
          <div className="mt-5 rounded-2xl border border-border bg-paper">
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
              <Repeat2 className="size-3.5 text-brand" />
              <span className="font-display text-[13px] font-semibold tracking-[-0.005em]">
                Repost to your feed
              </span>
              <span className="ml-auto rounded-full border border-border bg-muted px-2 py-[1.5px] font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-3">
                +1 share
              </span>
            </div>
            <div className="space-y-3 p-4">
              <Textarea
                placeholder={
                  isAuthenticated
                    ? 'Add an optional caption — your followers will see this on top of the original reel.'
                    : 'Sign in to repost.'
                }
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                disabled={!isAuthenticated || busy}
                rows={3}
                maxLength={280}
                className="resize-none rounded-xl"
              />
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] tabular-nums text-ink-3">
                  {caption.length}/280
                </span>
                <button
                  type="button"
                  onClick={repost}
                  disabled={!isAuthenticated || busy}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full px-4 py-2 font-display text-[13px] font-semibold tracking-[-0.005em] transition-all',
                    'bg-gradient-to-br from-brand to-brand/85 text-brand-foreground shadow-soft hover:-translate-y-px disabled:translate-y-0 disabled:opacity-50',
                  )}
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Repeat2 className="size-4" />
                  )}
                  Repost
                </button>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function ShareIcon({ label, icon: Icon, emoji, onClick, tone }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 transition-transform hover:-translate-y-0.5"
    >
      <span
        className={cn(
          'grid size-12 place-items-center rounded-2xl shadow-soft transition-shadow hover:shadow-soft-lg',
          tone,
        )}
      >
        {Icon ? <Icon className="size-5" strokeWidth={2} /> : null}
        {emoji ? <span className="text-[22px] leading-none">{emoji}</span> : null}
      </span>
      <span className="font-display text-[11px] font-semibold tracking-[-0.005em] text-ink-2">
        {label}
      </span>
    </button>
  )
}

// ─── Comments sheet ────────────────────────────────────────────────
function CommentsSheet({ open, onOpenChange, reel, onChange }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 border-l border-border bg-paper p-0 sm:max-w-md"
        showClose={false}
      >
        <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-3">
          <div className="flex items-center gap-2">
            <MessageCircle className="size-4 text-ink-3" />
            <span className="font-display text-[14px] font-semibold tracking-[-0.005em]">
              Discussion
            </span>
            {reel ? (
              <span className="rounded-md bg-paper px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-ink-3 ring-1 ring-border">
                {formatNumber(reel.commentCount ?? 0)}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="grid size-8 place-items-center rounded-full text-ink-3 transition-colors hover:bg-muted hover:text-ink"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {reel ? (
            <PostComments
              postId={reel.id}
              initialCount={reel.commentCount ?? 0}
              onCountChange={(next) => onChange?.({ ...reel, commentCount: next })}
            />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Page ───────────────────────────────────────────────────────────
export function ReelsPage() {
  const { isAuthenticated } = useAuth()
  const toast = useToast()
  const [reels, setReels] = useState([])
  const [page, setPage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [activeId, setActiveId] = useState(null)
  const [muted, setMuted] = useState(true)
  const [filter, setFilter] = useState('foryou')
  const [searchParams] = useSearchParams()
  const focusReelId = searchParams.get('id')
  const [shareOpen, setShareOpen] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)

  const scrollerRef = useRef(null)
  const itemRefs = useRef(new Map())

  // Load page (resets when filter changes)
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const fetcher =
          filter === 'following' && isAuthenticated ? getFollowingReels : getReels
        const data = await fetcher({ page: 0, size: 12 })
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

  // Infinite-scroll: when activeId is within 3 of the end, fetch next page.
  useEffect(() => {
    if (!page || page.last || loadingMore || reels.length === 0) return
    const idx = reels.findIndex((r) => r.id === activeId)
    if (idx === -1) return
    if (idx < reels.length - 3) return
    let cancelled = false
    setLoadingMore(true)
    const fetcher =
      filter === 'following' && isAuthenticated ? getFollowingReels : getReels
    fetcher({ page: (page.number ?? 0) + 1, size: 12 })
      .then((data) => {
        if (cancelled) return
        const next = data?.content ?? []
        setReels((current) => {
          const seen = new Set(current.map((item) => item.id))
          return [...current, ...next.filter((item) => !seen.has(item.id))]
        })
        setPage(data)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingMore(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeId, reels, page, loadingMore, filter, isAuthenticated])

  // Default active = focused / first reel; scroll to it on first load.
  useEffect(() => {
    if (!loading && reels.length > 0 && !activeId) {
      const targetId = focusReelId ?? reels[0].id
      setActiveId(targetId)
      // Wait a frame so the refs are populated.
      requestAnimationFrame(() => {
        itemRefs.current.get(targetId)?.scrollIntoView({ block: 'start' })
      })
    }
  }, [loading, reels, activeId, focusReelId])

  const activeReel = useMemo(
    () => reels.find((r) => r.id === activeId) ?? null,
    [reels, activeId],
  )
  const activeIndex = activeId
    ? reels.findIndex((r) => r.id === activeId)
    : -1

  function handleChange(updated) {
    setReels((current) =>
      current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
    )
  }

  const goTo = useCallback(
    (delta) => {
      if (reels.length === 0) return
      const idx = reels.findIndex((r) => r.id === activeId)
      const next = reels[Math.min(reels.length - 1, Math.max(0, idx + delta))]
      if (next && next.id !== activeId) {
        itemRefs.current.get(next.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    },
    [reels, activeId],
  )

  // Keyboard shortcuts (only when this page has focus)
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
        case 'Spacebar': {
          event.preventDefault()
          const el = scrollerRef.current?.querySelector(
            `[data-reel-id="${activeId}"] video`,
          )
          if (el?.paused) el.play().catch(() => {})
          else el?.pause()
          break
        }
        case 'ArrowDown':
        case 'j':
        case 'J':
          event.preventDefault()
          goTo(1)
          break
        case 'ArrowUp':
        case 'k':
        case 'K':
          event.preventDefault()
          goTo(-1)
          break
        case 'm':
        case 'M':
          event.preventDefault()
          setMuted((v) => !v)
          break
        case 'c':
        case 'C':
          event.preventDefault()
          setCommentsOpen(true)
          break
        case 's':
        case 'S':
          event.preventDefault()
          setShareOpen(true)
          break
        default:
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeId, goTo])

  // Live updates for the currently-active reel.
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
                topReactionTypes: payload.topReactionTypes ?? item.topReactionTypes,
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
                topReactionTypes: payload.topReactionTypes ?? item.topReactionTypes,
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
            ? { ...item, shareCount: payload.shareCount ?? (item.shareCount ?? 0) + 1 }
            : item,
        ),
      )
    },
    POST_VIEWED: (payload) => {
      if (!payload?.id || payload?.viewCount == null) return
      setReels((current) =>
        current.map((item) =>
          item.id === payload.id ? { ...item, viewCount: payload.viewCount } : item,
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
                commentCount: payload?.commentCount ?? (item.commentCount ?? 0) + 1,
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
                  payload?.commentCount ?? Math.max(0, (item.commentCount ?? 0) - 1),
              }
            : item,
        ),
      )
    },
  })

  const totalReels = page?.totalElements ?? reels.length

  if (loading) {
    return (
      <ReelsShell>
        <div className="grid h-full place-items-center">
          <div className="grid place-items-center gap-4 text-center">
            <Skeleton className="aspect-[9/16] w-full max-w-[420px] rounded-[28px]" />
            <span className="font-display text-[12.5px] text-white/70">
              Curating reels…
            </span>
          </div>
        </div>
      </ReelsShell>
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
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.filter((f) => !f.authOnly || isAuthenticated).map((f) => {
            const active = f.value === filter
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
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
        <EmptyState
          icon={Clapperboard}
          title={
            filter === 'following' ? 'No reels from people you follow' : 'No reels yet'
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
    <ReelsShell>
      {/* Top floating chrome */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 px-4 pt-3 sm:px-5">
        <div className="pointer-events-auto">
          <FilterRow
            filter={filter}
            onFilter={setFilter}
            isAuthenticated={isAuthenticated}
            total={totalReels}
          />
        </div>
        <div className="pointer-events-auto hidden items-center gap-1.5 rounded-full border border-white/15 bg-black/45 px-3 py-1.5 font-mono text-[10.5px] font-semibold tabular-nums text-white/85 backdrop-blur-md sm:inline-flex">
          <Sparkles className="size-3 text-gold" />
          {activeIndex >= 0 ? `${activeIndex + 1} / ${reels.length}` : '—'}
        </div>
      </div>

      {/* Side desktop nav arrows */}
      <div className="pointer-events-none absolute right-3 top-1/2 z-20 hidden -translate-y-1/2 flex-col gap-2 lg:flex">
        <button
          type="button"
          onClick={() => goTo(-1)}
          disabled={activeIndex <= 0}
          className="pointer-events-auto grid size-10 place-items-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur-md transition-colors hover:bg-black/65 disabled:opacity-30"
          aria-label="Previous reel"
          title="Previous reel  (↑ / K)"
        >
          <ChevronUp className="size-5" />
        </button>
        <button
          type="button"
          onClick={() => goTo(1)}
          disabled={activeIndex >= reels.length - 1 && page?.last}
          className="pointer-events-auto grid size-10 place-items-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur-md transition-colors hover:bg-black/65 disabled:opacity-30"
          aria-label="Next reel"
          title="Next reel  (↓ / J)"
        >
          <ChevronDown className="size-5" />
        </button>
      </div>

      {/* Snap-scroll feed */}
      <div
        ref={scrollerRef}
        className="scrollbar-none h-full snap-y snap-mandatory overflow-y-auto"
      >
        {reels.map((reel, index) => {
          const distance = Math.abs(index - Math.max(0, activeIndex))
          // Render video src for the active reel and one neighbor each side.
          const eager = distance <= 1
          return (
            <div
              key={reel.id}
              ref={(node) => {
                if (node) itemRefs.current.set(reel.id, node)
                else itemRefs.current.delete(reel.id)
              }}
              className="h-full snap-start snap-always"
            >
              <ReelCard
                reel={reel}
                eager={eager}
                isMuted={muted}
                onToggleMuted={() => setMuted((v) => !v)}
                onChange={handleChange}
                onActive={(id) => setActiveId(id)}
                onOpenComments={() => {
                  setActiveId(reel.id)
                  setCommentsOpen(true)
                }}
                onOpenShare={() => {
                  setActiveId(reel.id)
                  setShareOpen(true)
                }}
              />
            </div>
          )
        })}

        {/* Fetching-more sentinel */}
        {loadingMore ? (
          <div className="flex h-24 items-center justify-center text-white/70">
            <Loader2 className="size-4 animate-spin" />
          </div>
        ) : null}
      </div>

      {/* Bottom hint strip — keyboard / swipe affordance */}
      <div className="pointer-events-none absolute inset-x-0 bottom-2 z-20 mx-auto hidden w-fit max-w-[90%] items-center gap-2 rounded-full border border-white/15 bg-black/45 px-3 py-1.5 font-mono text-[10.5px] text-white/80 backdrop-blur-md sm:flex">
        <kbd className="rounded border border-white/20 bg-white/10 px-1 py-[1px] text-[9.5px]">Space</kbd>
        play / pause
        <span className="text-white/40">·</span>
        <kbd className="rounded border border-white/20 bg-white/10 px-1 py-[1px] text-[9.5px]">↑↓</kbd>
        scroll reels
        <span className="text-white/40">·</span>
        <kbd className="rounded border border-white/20 bg-white/10 px-1 py-[1px] text-[9.5px]">M</kbd>
        mute
        <span className="text-white/40">·</span>
        <kbd className="rounded border border-white/20 bg-white/10 px-1 py-[1px] text-[9.5px]">C</kbd>
        comments
      </div>

      <ShareSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        reel={activeReel}
        onChange={handleChange}
      />
      <CommentsSheet
        open={commentsOpen}
        onOpenChange={setCommentsOpen}
        reel={activeReel}
        onChange={handleChange}
      />
    </ReelsShell>
  )
}

// ─── Shell — full-bleed black canvas that breaks out of the page padding
function ReelsShell({ children }) {
  return (
    <div
      className="relative -mx-4 -my-6 h-[calc(100dvh-4rem)] overflow-hidden bg-[oklch(0.08_0.012_270)] sm:-mx-8 sm:-my-8 lg:-my-10 lg:h-[calc(100dvh-4.5rem)]"
      style={{
        backgroundImage:
          'radial-gradient(120% 80% at 50% -10%, color-mix(in oklch, var(--brand) 18%, transparent), transparent 60%), radial-gradient(80% 50% at 50% 110%, color-mix(in oklch, var(--gold) 10%, transparent), transparent 70%)',
      }}
    >
      {children}
    </div>
  )
}
