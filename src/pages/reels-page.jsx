import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  ChevronDown,
  Clapperboard,
  Copy,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Play,
  Repeat2,
  Share2,
  ThumbsUp,
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
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/app/empty-state'
import { PostComments } from '@/components/app/post-comments'
import { ReactionPicker } from '@/components/app/reaction-picker'
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
import { getPostReaction } from '@/lib/reactions'

function normalizeAuthor(post) {
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

// ─── Right-rail action button (Facebook / IG / TikTok style) ────────
function RailAction({
  icon: Icon,
  label,
  count,
  active,
  activeEmoji,
  onClick,
  children,
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'grid size-12 place-items-center rounded-full backdrop-blur transition-all duration-200',
          'bg-white/10 text-white hover:bg-white/20 active:scale-95',
          active && 'bg-white/20',
        )}
        aria-label={label}
        title={label}
      >
        {active && activeEmoji ? (
          <span className="text-[24px] leading-none drop-shadow-md">
            {activeEmoji}
          </span>
        ) : (
          <Icon className="size-[22px]" strokeWidth={2} />
        )}
      </button>
      {count != null ? (
        <span className="text-[11px] font-semibold tabular-nums text-white drop-shadow">
          {formatNumber(count)}
        </span>
      ) : null}
      {children}
    </div>
  )
}

// ─── A single reel page (one full-height vertical "card") ───────────
function ReelItem({
  post,
  isActive,
  isMuted,
  onToggleMuted,
  onChange,
  onEnded,
  onOpenComments,
  scrollContainerRef,
  registerRef,
}) {
  const videoRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [working, setWorking] = useState(false)

  // Watch tracking: cumulative seconds watched while this reel is active.
  // We record once per visit (when the user scrolls away or the reel
  // unmounts), as long as they watched at least 2 seconds — short
  // enough to capture a real intent, long enough to skip accidental
  // swipes past.
  const watchedSecondsRef = useRef(0)
  const lastTickRef = useRef(null)
  const recordedRef = useRef(false)

  const { isAuthenticated } = useAuth()
  const toast = useToast()

  const author = normalizeAuthor(post)
  const media = post.mediaList?.[0]
  const url = resolveMediaUrl(media?.url ?? media?.mediaUrl)
  const myReactionInfo = post.myReaction ? getPostReaction(post.myReaction) : null

  // Flush the watched view to the backend (if there's anything to flush).
  const flushWatch = useCallback(() => {
    if (!isAuthenticated) return
    if (recordedRef.current) return
    const watched = Math.round(watchedSecondsRef.current)
    if (watched < 2) return
    recordedRef.current = true
    // Fire-and-forget: we don't want to block the reel UI on this.
    recordReelView(post.id, watched).catch(() => {
      // Allow a retry if it failed (e.g. transient network issue).
      recordedRef.current = false
    })
  }, [isAuthenticated, post.id])

  // Auto-play / pause when active flips. Reset watch counters on each
  // fresh activation; flush when leaving.
  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    if (isActive) {
      watchedSecondsRef.current = 0
      lastTickRef.current = null
      recordedRef.current = false
      el.currentTime = 0
      el.play().catch(() => setPlaying(false))
    } else {
      el.pause()
      flushWatch()
    }
  }, [isActive, flushWatch])

  // Final flush if the component unmounts while still active (e.g.
  // route change while the reel was the active one).
  useEffect(() => {
    return () => flushWatch()
  }, [flushWatch])

  function togglePlay() {
    const el = videoRef.current
    if (!el) return
    if (playing) el.pause()
    else el.play().catch(() => setPlaying(false))
  }

  async function handlePickReaction(type) {
    if (!isAuthenticated) {
      toast.info('Sign in to react.')
      return
    }
    if (working) return
    const previous = post
    const wasReacting = Boolean(post.myReaction)
    onChange?.({
      ...post,
      myReaction: type,
      reactionCount: wasReacting
        ? post.reactionCount
        : (post.reactionCount ?? 0) + 1,
    })
    setWorking(true)
    try {
      const updated = await reactToPost(post.id, type)
      if (updated) {
        onChange?.({ ...updated, myReaction: type })
      }
    } catch (error) {
      onChange?.(previous)
      toast.error(extractApiMessage(error, 'Could not react.'))
    } finally {
      setWorking(false)
    }
  }

  async function handleClearReaction() {
    if (working || !post.myReaction) return
    const previous = post
    onChange?.({
      ...post,
      myReaction: null,
      reactionCount: Math.max(0, (post.reactionCount ?? 0) - 1),
    })
    setWorking(true)
    try {
      await removePostReaction(post.id)
    } catch (error) {
      onChange?.(previous)
      toast.error(extractApiMessage(error, 'Could not remove reaction.'))
    } finally {
      setWorking(false)
    }
  }

  async function handleCopy() {
    try {
      const link = post.shareLink || `${window.location.origin}/reels?id=${post.id}`
      await navigator.clipboard.writeText(link)
      toast.success('Link copied.')
    } catch {
      toast.error('Could not copy link.')
    }
  }

  async function handleRepost() {
    try {
      await sharePost(post.id)
      onChange?.({ ...post, shareCount: (post.shareCount ?? 0) + 1 })
      toast.success('Reposted.')
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not repost.'))
    }
  }

  return (
    <section
      ref={registerRef}
      data-reel-id={post.id}
      className="relative h-full w-full snap-start snap-always"
    >
      <div className="mx-auto flex h-full items-center justify-center gap-3 px-2 sm:gap-4 sm:px-4">
        {/* ── Reel video card ────────────────────────────── */}
        <div className="relative isolate flex h-full max-h-full w-full max-w-[420px] items-center">
          <div className="relative isolate aspect-[9/16] max-h-full w-full overflow-hidden rounded-2xl bg-black ring-1 ring-white/10 shadow-soft-lg">
            {url ? (
              <video
                ref={videoRef}
                src={url}
                loop={false}
                playsInline
                muted={isMuted}
                onPlay={() => {
                  setPlaying(true)
                  lastTickRef.current = null
                }}
                onPause={() => setPlaying(false)}
                onEnded={() => {
                  flushWatch()
                  onEnded?.()
                }}
                onTimeUpdate={(event) => {
                  const el = event.currentTarget
                  if (!el.duration) return
                  setProgress(el.currentTime / el.duration)
                  // Accumulate watched seconds (forward only) so seeks
                  // backwards don't artificially inflate the total.
                  const t = el.currentTime
                  const last = lastTickRef.current
                  if (last != null && t > last) {
                    const delta = t - last
                    if (delta < 1.5) watchedSecondsRef.current += delta
                  }
                  lastTickRef.current = t
                }}
                onClick={togglePlay}
                className="absolute inset-0 size-full cursor-pointer object-contain"
              />
            ) : (
              <div className="absolute inset-0 grid place-items-center text-white/60">
                <Clapperboard className="size-10" />
              </div>
            )}

            {/* Top + bottom darkening gradients */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/55 to-transparent"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/75 to-transparent"
            />

            {/* Top-left tag */}
            <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-black">
              <Clapperboard className="size-2.5" />
              Reel
            </span>

            {/* Mute toggle */}
            <button
              type="button"
              onClick={onToggleMuted}
              className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-black/55 text-white backdrop-blur transition-colors hover:bg-black/75"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </button>

            {/* Big play overlay when paused */}
            <AnimatePresence>
              {!playing ? (
                <motion.button
                  key="play"
                  type="button"
                  onClick={togglePlay}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  className="absolute inset-0 grid place-items-center"
                  aria-label="Play"
                >
                  <span className="grid size-16 place-items-center rounded-full bg-white/95 text-black shadow-2xl backdrop-blur">
                    <Play className="size-7 translate-x-[2px] fill-black" />
                  </span>
                </motion.button>
              ) : null}
            </AnimatePresence>

            {/* Bottom-left author + caption */}
            <div className="absolute inset-x-3 bottom-6 z-10 space-y-2 text-white">
              <div className="flex items-center gap-2.5">
                <Link to={`/profile/${author.username ?? ''}`} className="shrink-0">
                  <UserAvatar
                    user={author}
                    className="size-9 ring-2 ring-white/30"
                  />
                </Link>
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                    <Link
                      to={`/profile/${author.username ?? ''}`}
                      className="truncate text-[13.5px] font-semibold drop-shadow hover:underline"
                    >
                      {getFullName(author) || `@${author.username}`}
                    </Link>
                    {author.role ? <RoleBadge role={author.role} size="xs" /> : null}
                  </div>
                  {author.username ? (
                    <p className="text-[11px] text-white/70">@{author.username}</p>
                  ) : null}
                </div>
              </div>
              {post.textContent ? (
                <p className="line-clamp-2 max-w-[90%] text-[13px] leading-snug text-white/95 drop-shadow">
                  {post.textContent}
                </p>
              ) : null}
              {post.audioTrackName ? (
                <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-white/85">
                  <span className="size-1.5 animate-pulse rounded-full bg-white" />
                  ♪ {post.audioTrackName}
                </p>
              ) : null}
            </div>

            {/* Progress bar */}
            <div className="pointer-events-none absolute inset-x-3 bottom-2 h-[3px] overflow-hidden rounded-full bg-white/25">
              <div
                className="h-full bg-white transition-[width] duration-150"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>

          {/* ── Inline action rail (mobile, overlaid on the right edge) ── */}
          <div className="pointer-events-none absolute right-1 top-1/2 z-20 -translate-y-1/2 sm:hidden">
            <div className="pointer-events-auto flex flex-col items-center gap-3">
              <ReactionPicker
                current={post.myReaction}
                onSelect={handlePickReaction}
                onClear={handleClearReaction}
                disabled={working}
                trigger={({ toggleDefault, current, open }) => (
                  <RailAction
                    icon={ThumbsUp}
                    activeEmoji={current?.emoji}
                    label={current?.label ?? 'Like'}
                    count={post.reactionCount}
                    active={Boolean(current)}
                    onClick={current ? toggleDefault : open}
                  />
                )}
              />
              <RailAction
                icon={MessageCircle}
                label="Comments"
                count={post.commentCount}
                onClick={onOpenComments}
              />
              <RailAction
                icon={Share2}
                label="Share"
                count={post.shareCount}
                onClick={handleCopy}
              />
            </div>
          </div>
        </div>

        {/* ── Desktop action rail (to the right of the video) ─── */}
        <div className="hidden h-[80%] flex-col items-center justify-end gap-4 pb-4 sm:flex">
          <ReactionPicker
            current={post.myReaction}
            onSelect={handlePickReaction}
            onClear={handleClearReaction}
            disabled={working}
            trigger={({ toggleDefault, current, open }) => (
              <div className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  onClick={toggleDefault}
                  onMouseEnter={open}
                  className={cn(
                    'grid size-12 place-items-center rounded-full bg-card shadow-soft transition-all duration-200 hover:scale-105 active:scale-95',
                    current && cn('ring-1', current.bg, current.ring),
                  )}
                  aria-label={current?.label ?? 'Like'}
                  title={current?.label ?? 'Like'}
                >
                  <span className="text-[24px] leading-none">
                    {current?.emoji ?? '👍'}
                  </span>
                </button>
                <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
                  {formatNumber(post.reactionCount ?? 0)}
                </span>
              </div>
            )}
          />

          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={onOpenComments}
              className="grid size-12 place-items-center rounded-full bg-card text-foreground shadow-soft transition-all hover:scale-105"
              aria-label="Comments"
              title="Comments"
            >
              <MessageCircle className="size-[22px]" strokeWidth={2} />
            </button>
            <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
              {formatNumber(post.commentCount ?? 0)}
            </span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  className="grid size-12 place-items-center rounded-full bg-card text-foreground shadow-soft transition-all hover:scale-105"
                  aria-label="Share"
                  title="Share"
                >
                  <Share2 className="size-[22px]" strokeWidth={2} />
                </button>
                <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
                  {formatNumber(post.shareCount ?? 0)}
                </span>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onSelect={handleCopy}>
                <Copy className="mr-2 size-4" />
                Copy link
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleRepost}>
                <Repeat2 className="mr-2 size-4" />
                Repost
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="grid size-10 place-items-center rounded-full bg-card text-muted-foreground shadow-soft transition-all hover:scale-105 hover:text-foreground"
                aria-label="More"
                title="More"
              >
                <MoreHorizontal className="size-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onSelect={handleCopy}>
                <Copy className="mr-2 size-4" />
                Copy link
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Scroll-down hint to next reel */}
          <button
            type="button"
            onClick={() => {
              const container = scrollContainerRef.current
              if (!container) return
              container.scrollBy({ top: container.clientHeight, behavior: 'smooth' })
            }}
            className="mt-1 grid size-10 place-items-center rounded-full bg-card text-muted-foreground shadow-soft transition-all hover:scale-105 hover:text-foreground"
            aria-label="Next reel"
            title="Next reel"
          >
            <ChevronDown className="size-5" />
          </button>
        </div>
      </div>

      {/* Used inline picker — keep myReactionInfo silent */}
      <span className="sr-only">{myReactionInfo?.label ?? ''}</span>
    </section>
  )
}

// ─── Page ───────────────────────────────────────────────────────────
export function ReelsPage() {
  const toast = useToast()
  const [reels, setReels] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState(null)
  const [muted, setMuted] = useState(true)
  const [commentsForId, setCommentsForId] = useState(null)
  const [searchParams] = useSearchParams()
  const focusReelId = searchParams.get('id')

  const containerRef = useRef(null)
  const itemRefs = useRef(new Map())

  // ── Load reels ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const data = await getReels({ page: 0, size: 20 })
        if (!cancelled) setReels(data?.content ?? [])
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

  // ── Initial scroll to deep-linked reel ─────────────────
  useEffect(() => {
    if (!focusReelId || loading || reels.length === 0) return
    const node = itemRefs.current.get(focusReelId)
    if (node) node.scrollIntoView({ behavior: 'auto', block: 'start' })
  }, [focusReelId, loading, reels])

  // ── Track which reel is currently in view ──────────────
  useEffect(() => {
    if (loading || reels.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the most-visible reel as active
        let bestId = null
        let bestRatio = 0
        entries.forEach((entry) => {
          if (entry.intersectionRatio > bestRatio) {
            bestRatio = entry.intersectionRatio
            bestId = entry.target.dataset.reelId
          }
        })
        if (bestId && bestRatio > 0.6) setActiveId(bestId)
      },
      {
        root: containerRef.current,
        threshold: [0, 0.4, 0.6, 0.8, 1],
      },
    )
    itemRefs.current.forEach((node) => node && observer.observe(node))
    return () => observer.disconnect()
  }, [loading, reels])

  // ── Default active to the first reel ────────────────────
  useEffect(() => {
    if (!activeId && reels.length > 0) setActiveId(focusReelId ?? reels[0].id)
  }, [activeId, reels, focusReelId])

  const registerRef = useCallback((id) => (node) => {
    if (node) itemRefs.current.set(id, node)
    else itemRefs.current.delete(id)
  }, [])

  function handleEnded(currentId) {
    // When the active reel finishes, scroll to the next one.
    const index = reels.findIndex((post) => post.id === currentId)
    const nextPost = reels[index + 1]
    if (!nextPost) return
    const node = itemRefs.current.get(nextPost.id)
    if (node) node.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function handleChange(updated) {
    setReels((current) => current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)))
  }

  const activeReel = useMemo(
    () => reels.find((post) => post.id === commentsForId) ?? null,
    [reels, commentsForId],
  )

  // ── Empty / loading ─────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <Skeleton className="aspect-[9/16] h-full max-h-[80vh] rounded-2xl" />
      </div>
    )
  }

  if (reels.length === 0) {
    return (
      <EmptyState
        icon={Clapperboard}
        title="No reels yet"
        description="Be the first to post a short video. Reels appear here and at the top of Home."
      />
    )
  }

  return (
    <>
      <div
        ref={containerRef}
        className={cn(
          'relative -mx-4 h-[calc(100vh-7rem)] snap-y snap-mandatory overflow-y-scroll bg-background',
          'scrollbar-none scroll-smooth sm:-mx-8',
        )}
        style={{ scrollSnapType: 'y mandatory' }}
      >
        {reels.map((post) => (
          <div
            key={post.id}
            className="h-full w-full snap-start"
          >
            <ReelItem
              post={post}
              isActive={activeId === post.id}
              isMuted={muted}
              onToggleMuted={() => setMuted((value) => !value)}
              onChange={handleChange}
              onEnded={() => handleEnded(post.id)}
              onOpenComments={() => setCommentsForId(post.id)}
              scrollContainerRef={containerRef}
              registerRef={registerRef(post.id)}
            />
          </div>
        ))}
      </div>

      {/* Comments side sheet */}
      <Sheet
        open={Boolean(commentsForId)}
        onOpenChange={(next) => {
          if (!next) setCommentsForId(null)
        }}
      >
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
          showClose={false}
        >
          <SheetHeader className="flex-row items-center justify-between border-b border-border px-4 py-3">
            <SheetTitle className="text-base font-semibold">
              Comments
              {activeReel?.commentCount != null ? (
                <span className="ml-1.5 text-xs font-medium text-muted-foreground tabular-nums">
                  {formatNumber(activeReel.commentCount)}
                </span>
              ) : null}
            </SheetTitle>
            <button
              type="button"
              onClick={() => setCommentsForId(null)}
              className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {commentsForId ? (
              <PostComments
                postId={commentsForId}
                initialCount={activeReel?.commentCount ?? 0}
                onCountChange={(next) =>
                  handleChange({ ...(activeReel ?? { id: commentsForId }), commentCount: next })
                }
              />
            ) : (
              <div className="flex justify-center py-6 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
