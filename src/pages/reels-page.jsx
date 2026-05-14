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
  Heart,
  Link as LinkIcon,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Play,
  Repeat2,
  Send,
  Share2,
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
import { RoleBadge } from '@/components/app/role-badge'
import { UserAvatar } from '@/components/app/user-avatar'
import {
  copyPostShareLink,
  getReels,
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
  forgetReaction,
  rememberReaction,
  useCachedReaction,
} from '@/lib/reaction-cache'
import {
  bumpCounter,
  getCounter,
  setCounter,
  useCounter,
} from '@/lib/counter-store'
import { useCooldown } from '@/lib/rate-limit-cooldown'
import {
  seedFromResponse,
  setReacted,
  useDidIReact,
} from '@/lib/my-reaction-store'
import {
  formatNumber,
  getFullName,
  getHandle,
  getRawUsername,
  resolveMediaUrl,
} from '@/lib/format'
import { FRONTEND_URL } from '@/config/env'

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

// ─── Action rail icon (vertical TikTok-style stack) ────────────────
function RailButton({
  icon: Icon,
  emoji,
  count,
  label,
  onClick,
  active,
  activeTone = 'reaction',
  iconClass,
}) {
  const isReaction = activeTone === 'reaction'
  return (
    <button
      type="button"
      onClick={onClick}
      className="group/rail flex flex-col items-center gap-1.5 text-white"
      aria-label={label}
      title={label}
    >
      <motion.span
        whileTap={{ scale: 0.86 }}
        whileHover={{ scale: 1.08, y: -2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 24 }}
        style={{
          width: 48,
          height: 48,
          borderRadius: '999px',
          display: 'grid',
          placeItems: 'center',
          background: active && isReaction
            ? 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)'
            : 'rgba(15, 12, 8, 0.55)',
          border: active && isReaction
            ? '1px solid rgba(255, 180, 200, 0.4)'
            : '1px solid rgba(255, 255, 255, 0.14)',
          backdropFilter: 'blur(14px) saturate(180%)',
          WebkitBackdropFilter: 'blur(14px) saturate(180%)',
          boxShadow: active && isReaction
            ? '0 0 24px -8px rgba(244, 63, 94, 0.7), 0 4px 12px -6px rgba(0,0,0,0.6)'
            : '0 4px 16px -8px rgba(0, 0, 0, 0.7)',
          transition: 'all 240ms cubic-bezier(0.22, 0.61, 0.36, 1)',
        }}
      >
        {emoji ? (
          <span className="text-[20px] leading-none drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]">
            {emoji}
          </span>
        ) : Icon ? (
          <Icon
            className={cn('size-[19px] drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]', iconClass)}
            strokeWidth={active && isReaction ? 2 : 1.7}
          />
        ) : null}
      </motion.span>
      {count != null ? (
        <motion.span
          key={count}
          initial={{ scale: 0.8, opacity: 0.3 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 28 }}
          className="font-mono text-[11px] font-bold tabular-nums"
          style={{ textShadow: '0 1px 6px rgba(0, 0, 0, 0.8)' }}
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
  // Network buffering — `true` while the video is stalled fetching
  // more data. Drives the inline spinner so the user knows playback
  // hasn't frozen, just the bytes haven't arrived yet.
  const [buffering, setBuffering] = useState(false)

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
    const reelId = reel.id
    // Optimistic bump from the currently displayed count. Reading via
    // getCounter at call time avoids the stale-closure trap the
    // surrounding observer callback would otherwise create, and lands
    // on the same number the user is looking at — never on a
    // synthetic 0 the store would default to if no SSE event had
    // touched this key yet.
    const base = getCounter('post', reelId, 'vw') ?? (reel.viewCount ?? 0)
    bumpCounter('post', reelId, 'vw', base, +1)
    recordReelView(reelId, watched).catch(() => {
      recordedRef.current = false
      setCounter('post', reelId, 'vw', base)
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

  // Seed the my-reaction store with whatever the reel payload carries.
  // The reels feed endpoint inherits the same myReaction-null bug as
  // every other post-feed path, so the seed is non-authoritative —
  // it only promotes positive signals.
  useEffect(() => {
    if (reel) seedFromResponse('post', reel, { authoritative: false })
  }, [reel])

  // "Did I react to this reel?" — store first (seeded + SSE actor),
  // then the localStorage cache (persists across hard reloads), then
  // whatever the prop says.
  const cachedReaction = useCachedReaction('post', reel?.id)
  const storeSaysReacted = useDidIReact('post', reel?.id, false)
  const effectiveReaction =
    reel?.myReaction ?? (storeSaysReacted ? 'LIKE' : null) ?? cachedReaction

  // Counter reads — store wins when an SSE event or optimistic delta
  // has touched the key; otherwise the prop value is used.
  const railReactionCount = useCounter('post', reel?.id, 'rx', reel?.reactionCount ?? 0)
  const railCommentCount = useCounter('post', reel?.id, 'cm', reel?.commentCount ?? 0)
  const railShareCount = useCounter('post', reel?.id, 'sh', reel?.shareCount ?? 0)
  const railViewCount = useCounter('post', reel?.id, 'vw', reel?.viewCount ?? 0)
  // Rate-limit countdown for the heart on the rail.
  const reactionCooldown = useCooldown('reaction')

  async function pickReaction(type, { silent = false } = {}) {
    if (!isAuthenticated) {
      if (!silent) toast.info('Sign in to react.')
      return
    }
    if (working) return
    const previous = reel
    const wasReacting = Boolean(effectiveReaction)
    const previousReactionCount = railReactionCount
    onChange?.({ ...reel, myReaction: type })
    rememberReaction('post', reel.id, type)
    setReacted('post', reel.id, true, type)
    if (!wasReacting) bumpCounter('post', reel.id, 'rx', railReactionCount, +1)
    setWorking(true)
    try {
      // Reconcile against the server's authoritative PostResponse —
      // see post-card.jsx for the rationale (idempotent re-click,
      // delayed SSE echo, store/heart drift).
      const updated = await reactToPost(reel.id, type)
      if (updated?.id) {
        onChange?.(updated)
        if (updated.reactionCount != null) {
          setCounter('post', reel.id, 'rx', updated.reactionCount)
        }
        seedFromResponse('post', updated, { authoritative: true })
      }
    } catch (error) {
      onChange?.(previous)
      forgetReaction('post', reel.id)
      setReacted('post', reel.id, wasReacting, wasReacting ? cachedReaction : null)
      if (!wasReacting) setCounter('post', reel.id, 'rx', previousReactionCount)
      if (!silent) toast.error(extractApiMessage(error, 'Could not react.'))
    } finally {
      setWorking(false)
    }
  }

  async function clearReaction() {
    if (!isAuthenticated || working || !effectiveReaction) return
    const previous = reel
    const previousCached = cachedReaction
    const previousReactionCount = railReactionCount
    onChange?.({ ...reel, myReaction: null })
    forgetReaction('post', reel.id)
    setReacted('post', reel.id, false)
    bumpCounter('post', reel.id, 'rx', railReactionCount, -1)
    setWorking(true)
    try {
      // DELETE now returns 200 with the full PostResponse — trust it
      // over the optimistic decrement so the rail's count stays exact
      // even when another viewer's reaction is in flight.
      const updated = await removePostReaction(reel.id)
      if (updated?.id) {
        onChange?.(updated)
        if (updated.reactionCount != null) {
          setCounter('post', reel.id, 'rx', updated.reactionCount)
        }
        seedFromResponse('post', updated, { authoritative: true })
      }
    } catch (error) {
      onChange?.(previous)
      if (previousCached) rememberReaction('post', reel.id, previousCached)
      setReacted('post', reel.id, true, previousCached ?? 'LIKE')
      setCounter('post', reel.id, 'rx', previousReactionCount)
      toast.error(extractApiMessage(error, 'Could not remove reaction.'))
    } finally {
      setWorking(false)
    }
  }

  return (
    <article
      ref={containerRef}
      data-reel-id={reel?.id}
      className="relative grid h-full place-items-center snap-start snap-always"
    >
      {/* Mobile: edge-to-edge fill. Desktop: centered phone frame. */}
      <div className="relative isolate flex h-full w-full items-center justify-center lg:max-w-[420px] lg:px-2">
        <div
          className={cn(
            'relative isolate h-full w-full overflow-hidden bg-[oklch(0.08_0.012_270)]',
            'lg:aspect-[9/16] lg:max-h-full lg:rounded-[28px]',
            'lg:border lg:border-white/[0.12]',
            'lg:shadow-[0_0_0_3px_rgba(255,255,255,0.04),0_40px_80px_-20px_rgba(0,0,0,0.95),0_0_100px_-40px_color-mix(in_oklch,var(--brand)_60%,transparent)]',
          )}
          style={
            url
              ? { background: 'linear-gradient(170deg, #2a2520 0%, #14110C 100%)' }
              : stripe
          }
        >
          {/* Specular top-edge highlight on desktop */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 hidden h-px lg:block"
            style={{ background: 'linear-gradient(90deg, transparent 10%, rgba(255,255,255,0.20) 50%, transparent 90%)' }}
          />
          {(eager || active) && url ? (
            <>
              {/* TikTok-style blurred backdrop — same video mirrored
                  behind, blown up and blurred to fill the canvas when
                  the source isn't a perfect 9:16. Keeps the main video
                  at its natural aspect ratio (object-contain) so no
                  cropping ever happens, while the void around it reads
                  as a soft echo of the frame instead of black bars. */}
              <video
                src={url}
                playsInline
                muted
                loop
                preload="metadata"
                aria-hidden
                tabIndex={-1}
                className="pointer-events-none absolute inset-0 h-full w-full scale-[1.25] object-cover opacity-70 blur-2xl"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-black/30"
              />
              <video
                ref={videoRef}
                src={url}
                playsInline
                muted={isMuted}
                loop
                preload={active ? 'auto' : 'metadata'}
                onPlay={() => {
                  setPlaying(true)
                  setBuffering(false)
                  lastTickRef.current = null
                }}
                onPause={() => setPlaying(false)}
                onWaiting={() => setBuffering(true)}
                onPlaying={() => setBuffering(false)}
                onCanPlay={() => setBuffering(false)}
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
                className="relative z-[1] h-full w-full cursor-pointer object-contain"
              />
            </>
          ) : null}

          {/* Islamic-pattern diagonal cross-hatch overlay — there if
              you look, never loud. Sits above the video gradient. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-screen"
            style={{
              backgroundImage:
                'repeating-linear-gradient(60deg, transparent 0 14px, rgba(255,255,255,0.5) 14px 14.5px), repeating-linear-gradient(-60deg, transparent 0 14px, rgba(255,255,255,0.5) 14px 14.5px)',
            }}
          />

          {/* Cinematic vignettes — heavier floor for caption legibility */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background: [
                'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.30) 35%, transparent 55%)',
                'linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, transparent 30%)',
              ].join(', '),
            }}
          />

          <FloatingHearts bursts={bursts} />

          {/* Buffering spinner — TikTok-style. Shows only while playback
              is stalled fetching more data; auto-hides when canplay /
              playing fires. Sits center-screen above the video. */}
          <AnimatePresence>
            {buffering && url && playing ? (
              <motion.div
                key="buffer"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ duration: 0.16 }}
                className="pointer-events-none absolute inset-0 z-[6] grid place-items-center"
              >
                <span
                  className="grid size-12 place-items-center rounded-full bg-black/45 text-white backdrop-blur"
                  aria-label="Buffering"
                >
                  <Loader2 className="size-5 animate-spin" strokeWidth={1.8} />
                </span>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Mute toggle — glass pill, top-right */}
          <button
            type="button"
            onClick={onToggleMuted}
            className="absolute right-3 z-[5] inline-flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1.5 text-white backdrop-blur-md transition-all hover:bg-black/65"
            style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? (
              <VolumeX className="size-[15px]" strokeWidth={1.7} />
            ) : (
              <Volume2 className="size-[15px]" strokeWidth={1.7} />
            )}
            <span className="font-mono text-[10px] uppercase tracking-wider">
              {isMuted ? 'Unmute' : 'Mute'}
            </span>
          </button>

          {/* Big play overlay (paused state) — glass-blur disc per
              the reel mockup. Lives over a dim wash so the underlying
              frame stays partially visible while paused. */}
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
                className="absolute inset-0 z-[6] grid place-items-center bg-black/30 backdrop-blur-[2px]"
                aria-label="Play"
              >
                <motion.span
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.94 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 9999,
                    display: 'grid',
                    placeItems: 'center',
                    background: 'rgba(255, 255, 255, 0.18)',
                    backdropFilter: 'blur(12px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(12px) saturate(180%)',
                    border: '1px solid rgba(255, 255, 255, 0.28)',
                    color: 'white',
                    boxShadow: '0 12px 32px -12px rgba(0, 0, 0, 0.6)',
                  }}
                >
                  <Play className="size-7 translate-x-[2px] fill-white" strokeWidth={0} />
                </motion.span>
              </motion.button>
            ) : null}
          </AnimatePresence>

          {/* Bottom — caption + author. */}
          <div
            className="absolute inset-x-0 bottom-0 z-[5] flex items-end gap-3 px-4 pr-[72px] sm:pr-[86px]"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.25rem)' }}
          >
            <div className="min-w-0 flex-1 text-white">
              <Link
                to={authorRoute ? `/profile/${authorRoute}` : '#'}
                className="block leading-tight transition-opacity hover:opacity-90"
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className="truncate font-display text-[17px] font-bold tracking-[-0.008em]"
                    style={{ textShadow: '0 2px 8px rgba(0,0,0,0.7)' }}
                  >
                    {authorDisplayName}
                  </span>
                  {author?.role ? (
                    <RoleBadge role={author.role} size="xs" showIcon={false} />
                  ) : null}
                </span>
                {authorHandle ? (
                  <span
                    className="mt-0.5 block truncate font-mono text-[12px] text-white/70"
                    style={{ textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}
                  >
                    @{authorHandle}
                  </span>
                ) : null}
              </Link>
              {reel?.textContent ? (
                <p
                  dir="auto"
                  className="mt-2.5 line-clamp-2 text-[14px] leading-[1.45] text-white/90"
                  style={{ textShadow: '0 1px 6px rgba(0,0,0,0.65)' }}
                >
                  {reel.textContent}
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-3">
                {railViewCount > 0 ? (
                  <span
                    className="font-mono text-[10.5px] tabular-nums text-white/60"
                    style={{ textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}
                  >
                    {formatNumber(railViewCount)} views
                  </span>
                ) : null}
                {reel?.audioTrackName ? (
                  <div className="inline-flex max-w-[180px] items-center gap-1.5 truncate rounded-full border border-white/12 bg-black/40 px-2.5 py-1 backdrop-blur-md">
                    <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-white/80" />
                    <span className="truncate font-mono text-[10.5px] text-white/75">
                      ♪ {reel.audioTrackName}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Right — action rail (TikTok-style). Lifted above the
              caption block and the safe-area inset on phones. */}
          <div
            className="absolute right-2.5 z-[6] flex flex-col items-center gap-3.5"
            style={{
              bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.5rem)',
            }}
          >
            {/* Avatar with follow chip */}
            <Link
              to={authorRoute ? `/profile/${authorRoute}` : '#'}
              className="relative mb-1"
              aria-label={`Open ${authorDisplayName}'s profile`}
            >
              <span className="block rounded-full ring-[1.5px] ring-white/90 shadow-[0_4px_14px_-4px_rgba(0,0,0,0.4)]">
                <UserAvatar user={author} className="size-12 ring-2 ring-paper" />
              </span>
              <FollowChip author={author} />
            </Link>

            {/* Single-LIKE Instagram heart toggle. Tap likes, tap again
                unlikes; the rail button fills + the count animates. */}
            <RailButton
              icon={Heart}
              count={reactionCooldown > 0 ? `${reactionCooldown}s` : railReactionCount}
              label={
                reactionCooldown > 0
                  ? `Try again in ${reactionCooldown}s`
                  : effectiveReaction ? 'Unlike' : 'Like'
              }
              onClick={
                reactionCooldown > 0
                  ? undefined
                  : () => (effectiveReaction ? clearReaction() : pickReaction('LIKE'))
              }
              active={Boolean(effectiveReaction)}
              activeTone="reaction"
              iconClass={effectiveReaction ? 'fill-current' : undefined}
            />

            <RailButton
              icon={MessageCircle}
              count={railCommentCount}
              label="Comments"
              onClick={onOpenComments}
            />

            <RailButton
              icon={Repeat2}
              count={railShareCount}
              label="Repost"
              onClick={onOpenShare}
            />

            <RailButton
              icon={Share2}
              label="Share"
              onClick={onOpenShare}
            />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.88 }}
                  whileHover={{ scale: 1.06, y: -1 }}
                  transition={{ type: 'spring', stiffness: 460, damping: 22 }}
                  className="size-11 lg:size-[42px]"
                  style={{
                    borderRadius: 9999,
                    display: 'grid',
                    placeItems: 'center',
                    background: 'rgba(0, 0, 0, 0.42)',
                    border: '0.5px solid rgba(255, 255, 255, 0.18)',
                    backdropFilter: 'blur(10px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(10px) saturate(180%)',
                    color: 'white',
                  }}
                  aria-label="More"
                  title="More"
                >
                  <MoreHorizontal className="size-[20px] lg:size-[18px]" strokeWidth={1.6} />
                </motion.button>
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

            {/* Spinning audio disc — appears when the reel has an
                audioTrackName. Matches the TikTok / Instagram "currently
                playing audio" affordance from the mockup. */}
            {reel?.audioTrackName ? (
              <Link
                to={authorRoute ? `/profile/${authorRoute}` : '#'}
                aria-label={`Audio: ${reel.audioTrackName}`}
                title={reel.audioTrackName}
                className={cn(
                  'mt-1 grid size-[34px] place-items-center rounded-full border-2 border-white/25 text-white shadow-[0_2px_8px_-2px_rgba(0,0,0,0.6)]',
                  playing && 'animate-[spin_4s_linear_infinite]',
                )}
                style={{
                  background:
                    'linear-gradient(135deg, #1A1714 30%, #3A352C 100%)',
                }}
              >
                <span
                  className="block size-[9px] rounded-full bg-white/45"
                  aria-hidden
                />
              </Link>
            ) : null}
          </div>

          {/* Bottom — continuous progress bar, just above the floor */}
          {url ? (
            <div
              role="slider"
              aria-valuemin={0}
              aria-valuemax={1}
              aria-valuenow={progress}
              className="absolute inset-x-0 z-[7] h-5 cursor-pointer touch-none"
              style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 0px)' }}
              onClick={seek}
            >
              <div className="absolute inset-x-0 bottom-0 h-[3px] overflow-hidden">
                <span className="absolute inset-0 bg-white/20" />
                <span
                  className="absolute inset-y-0 left-0 transition-[width] duration-150"
                  style={{
                    width: `${progress * 100}%`,
                    background: 'linear-gradient(90deg, var(--brand) 0%, color-mix(in oklch, var(--brand) 70%, white) 100%)',
                    boxShadow: '0 0 8px var(--brand)',
                  }}
                />
                <span
                  className="absolute top-1/2 -translate-y-1/2 size-2.5 rounded-full bg-white shadow-md"
                  style={{ left: `calc(${progress * 100}% - 5px)` }}
                />
              </div>
            </div>
          ) : null}

          {/* Time pill (bottom-left, mono) */}
          {duration ? (
            <span
              className="pointer-events-none absolute left-3 z-[6] rounded-full bg-black/50 px-2.5 py-1 font-mono text-[10px] tabular-nums text-white/90 backdrop-blur-sm"
              style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
            >
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
    setShareLink(reel.shareLink || `${FRONTEND_URL}/reels?id=${reel.id}`)
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
              postAuthorId={reel.author?.id ?? reel.authorId}
              postAuthorUsername={reel.author?.username ?? reel.authorUsername}
              initialCount={reel.commentCount ?? 0}
              onCountChange={(next) => onChange?.({ ...reel, commentCount: next })}
            />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Loading skeleton ──────────────────────────────────────────────
//
// TikTok-style first-paint state. We mirror the live chrome — top
// progress bar, right-side action rail, avatar + caption block — so
// the reel slot doesn't visibly reflow when the real data arrives.
// Every shimmer surface uses the same shimmer-mask keyframe so the
// rhythm reads as one breath across the whole frame.
function Shimmer({ className, style }) {
  return (
    <span
      aria-hidden
      className={cn(
        'block overflow-hidden bg-white/[0.07]',
        className,
      )}
      style={{
        backgroundImage:
          'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.10) 50%, transparent 100%)',
        backgroundRepeat: 'no-repeat',
        backgroundSize: '200% 100%',
        animation: 'reel-shimmer 1.4s ease-in-out infinite',
        ...style,
      }}
    />
  )
}

function ReelsLoadingSkeleton() {
  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Reel canvas */}
      <div
        className="relative h-full w-full"
        style={{
          background:
            'linear-gradient(170deg, oklch(0.16 0.012 270) 0%, oklch(0.08 0.012 270) 100%)',
        }}
      >
        <Shimmer className="absolute inset-0" />

        {/* Top — 5-segment progress strip (matches live chrome) */}
        <div
          className="absolute inset-x-3 z-[5] flex h-3 items-start gap-[3px]"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)' }}
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="h-[2px] flex-1 overflow-hidden rounded-full bg-white/15"
            >
              {i === 0 ? (
                <span className="block h-full w-1/3 animate-pulse bg-white/60" />
              ) : null}
            </span>
          ))}
        </div>

        {/* Right — action rail placeholders */}
        <div
          className="absolute right-2.5 z-[6] flex flex-col items-center gap-3.5"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.5rem)' }}
        >
          <Shimmer className="size-12 rounded-full" />
          <Shimmer className="size-[54px] rounded-full lg:size-[50px]" />
          <Shimmer className="size-[54px] rounded-full lg:size-[50px]" />
          <Shimmer className="size-[54px] rounded-full lg:size-[50px]" />
          <Shimmer className="size-[54px] rounded-full lg:size-[50px]" />
        </div>

        {/* Bottom — author + caption placeholders */}
        <div
          className="absolute inset-x-0 bottom-0 z-[5] flex items-end gap-3 px-4 pr-[80px] sm:pr-[92px]"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
        >
          <div className="min-w-0 flex-1 space-y-2">
            <Shimmer className="h-4 w-32 rounded-md" />
            <Shimmer className="h-3 w-20 rounded-md" />
            <Shimmer className="mt-1 h-3 w-full max-w-[260px] rounded-md" />
            <Shimmer className="h-3 w-2/3 max-w-[200px] rounded-md" />
          </div>
        </div>

        {/* Center — soft loading pulse so the user knows something's
            in flight beyond the static shimmer. */}
        <div className="absolute inset-0 grid place-items-center">
          <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/45 px-3.5 py-1.5 font-display text-[12px] font-medium text-white/80 backdrop-blur-md">
            <Loader2 className="size-3.5 animate-spin" />
            Curating reels…
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────────────
export function ReelsPage() {
  // Auth state is mostly delegated to per-reel gates (FollowChip,
  // ReelCard's react / clearReaction, ShareSheet's copyLink) — but we
  // do read the viewer id here for the own-actor SSE filter so own
  // save/react echoes don't fight optimistic updates inside cards.
  const { user: currentUser } = useAuth()
  const toast = useToast()
  const [reels, setReels] = useState([])
  const [page, setPage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [activeId, setActiveId] = useState(null)
  const [muted, setMuted] = useState(true)
  const [searchParams] = useSearchParams()
  const focusReelId = searchParams.get('id')
  const [shareOpen, setShareOpen] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)

  const scrollerRef = useRef(null)
  const itemRefs = useRef(new Map())

  // Load the first page on mount.
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const data = await getReels({ page: 0, size: 12 })
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
  }, [toast])

  // Infinite-scroll: when activeId is within 3 of the end, fetch next page.
  useEffect(() => {
    if (!page || page.last || loadingMore || reels.length === 0) return
    const idx = reels.findIndex((r) => r.id === activeId)
    if (idx === -1) return
    if (idx < reels.length - 3) return
    let cancelled = false
    setLoadingMore(true)
    getReels({ page: (page.number ?? 0) + 1, size: 12 })
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
  }, [activeId, reels, page, loadingMore])

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
  const reelStream = usePostStream(activeReel?.id, {
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
    // Counter events feed straight into the global store via
    // setCounter so the rail's `useCounter` reads pick them up. The
    // backend emits authoritative absolute values; we trust them.
    REACTION_ADDED: (payload) => {
      const id = payload?.postId ?? payload?.id ?? activeReel?.id
      const next = payload?.postReactionCount ?? payload?.reactionCount
      if (id && next != null) setCounter('post', id, 'rx', next)
    },
    REACTION_REMOVED: (payload) => {
      const id = payload?.postId ?? payload?.id ?? activeReel?.id
      const next = payload?.postReactionCount ?? payload?.reactionCount
      if (id && next != null) setCounter('post', id, 'rx', next)
    },
    SHARE_COUNT_UPDATED: (payload) => {
      const id = payload?.postId ?? payload?.id ?? activeReel?.id
      const next = payload?.postShareCount ?? payload?.shareCount
      if (id && next != null) setCounter('post', id, 'sh', next)
    },
    VIEW_COUNT_UPDATED: (payload) => {
      const id = payload?.postId ?? payload?.id ?? activeReel?.id
      const next = payload?.postViewCount ?? payload?.viewCount
      if (id && next != null) setCounter('post', id, 'vw', next)
    },
    SAVE_COUNT_UPDATED: (payload) => {
      const id = payload?.postId ?? payload?.id ?? activeReel?.id
      const next = payload?.postSaveCount ?? payload?.saveCount
      if (!id || next == null) return
      // Own-actor guard — optimistic + HTTP-response reconciliation
      // in handleToggleSave already wrote the right number.
      if (currentUser?.id && payload?.actorId === currentUser.id) return
      setCounter('post', id, 'sv', next)
    },
    COMMENT_CREATED: (payload) => {
      const id = payload?.postId ?? payload?.id ?? activeReel?.id
      const next = payload?.postCommentCount ?? payload?.commentCount
      if (id && next != null) setCounter('post', id, 'cm', next)
    },
    COMMENT_DELETED: (payload) => {
      const id = payload?.postId ?? activeReel?.id
      const next = payload?.postCommentCount ?? payload?.commentCount
      if (id && next != null) setCounter('post', id, 'cm', next)
    },
  })

  if (loading) {
    return (
      <ReelsShell>
        <ReelsLoadingSkeleton />
      </ReelsShell>
    )
  }

  if (reels.length === 0) {
    return (
      <div className="space-y-5 p-4 sm:p-6">
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
    <ReelsShell>
      {/* Mobile-only back button — desktop sidebar already handles nav */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start px-3 sm:px-5"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
      >
        <Link
          to="/"
          aria-label="Back to home"
          title="Back"
          className="pointer-events-auto grid size-9 place-items-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur-md transition-colors hover:bg-black/65 lg:hidden"
        >
          <X className="size-[18px]" strokeWidth={1.8} />
        </Link>
      </div>

      {/* Desktop nav arrows — right edge */}
      <div className="pointer-events-none absolute right-4 top-1/2 z-20 hidden -translate-y-1/2 flex-col gap-2 lg:flex">
        <button
          type="button"
          onClick={() => goTo(-1)}
          disabled={activeIndex <= 0}
          className="pointer-events-auto grid size-10 place-items-center rounded-full border border-white/15 bg-black/50 text-white backdrop-blur-md transition-all hover:bg-black/70 hover:scale-105 disabled:opacity-25 disabled:pointer-events-none"
          aria-label="Previous reel"
          title="Previous (↑ / K)"
        >
          <ChevronUp className="size-5" strokeWidth={1.8} />
        </button>
        <button
          type="button"
          onClick={() => goTo(1)}
          disabled={activeIndex >= reels.length - 1 && page?.last}
          className="pointer-events-auto grid size-10 place-items-center rounded-full border border-white/15 bg-black/50 text-white backdrop-blur-md transition-all hover:bg-black/70 hover:scale-105 disabled:opacity-25 disabled:pointer-events-none"
          aria-label="Next reel"
          title="Next (↓ / J)"
        >
          <ChevronDown className="size-5" strokeWidth={1.8} />
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

      {/* The bottom keyboard-hint strip used to live here — it
          collided with the caption block on the centred reel card,
          so it's been removed. The keyboard shortcuts (Space, ↑↓, M,
          C) still work; the up/down arrow buttons on the right rail
          remain as the discoverable affordance. */}

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

// ─── Shell — cinematic full-bleed black canvas
function ReelsShell({ children }) {
  return (
    <div
      className={cn(
        'overflow-hidden',
        'fixed inset-0 z-30',
        'lg:static lg:z-0 lg:h-[calc(100dvh-4.5rem)] lg:rounded-2xl',
      )}
      style={{
        background: 'oklch(0.06 0.014 270)',
        backgroundImage: [
          'radial-gradient(ellipse 80% 60% at 30% 0%, color-mix(in oklch, var(--brand) 16%, transparent), transparent 55%)',
          'radial-gradient(ellipse 60% 70% at 80% 100%, color-mix(in oklch, var(--accent-violet) 10%, transparent), transparent 60%)',
          'radial-gradient(ellipse 40% 40% at 50% 50%, color-mix(in oklch, var(--gold) 6%, transparent), transparent 70%)',
        ].join(', '),
      }}
    >
      {children}
    </div>
  )
}
