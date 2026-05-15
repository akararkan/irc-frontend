import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowUpRight,
  Bookmark,
  Check,
  Clapperboard,
  Copy,
  Eye,
  FileText,
  Globe,
  Loader2,
  Lock,
  Maximize2,
  MapPin,
  MessageCircle,
  Mic,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Repeat2,
  Share2,
  Trash2,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { MentionText } from '@/components/app/mention-text'
import { RelativeTime } from '@/components/app/relative-time'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Textarea } from '@/components/ui/textarea'
import { AudioPlayer } from '@/components/app/audio-player'
import { EditPostDialog } from '@/components/app/edit-post-dialog'
import { MediaLightbox } from '@/components/app/media-lightbox'
import { PostComments } from '@/components/app/post-comments'
import { RoleBadge } from '@/components/app/role-badge'
import { UserAvatar } from '@/components/app/user-avatar'
import {
  copyPostShareLink,
  deletePost,
  reactToPost,
  removePostReaction,
  repostPost,
  savePost,
  undoRepost,
  unsavePost,
} from '@/features/posts/posts.api'
import {
  followUser,
  getSocialStatus,
  unfollowUser,
} from '@/features/social/social.api'
import { useInView } from '@/hooks/use-in-view'
import { usePostStream } from '@/hooks/use-post-stream'
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
  setCounter,
  useCounter,
} from '@/lib/counter-store'
import { useCooldown } from '@/lib/rate-limit-cooldown'
import {
  seedFromResponse,
  setReacted,
  setSaved,
  useDidIReact,
  useDidISave,
} from '@/lib/my-reaction-store'
import {
  formatNumber,
  getFullName,
  getHandle,
  getRawUsername,
  getUsername,
  resolveMediaUrl,
} from '@/lib/format'
import { FRONTEND_URL } from '@/config/env'

const VISIBILITY = {
  PUBLIC: { Icon: Globe, label: 'Public' },
  FOLLOWERS_ONLY: { Icon: Users, label: 'Followers' },
  ONLY_ME: { Icon: Lock, label: 'Only me' },
}

const TYPE_META = {
  TEXT: null,
  EMBEDDED: null,
  VOICE_POST: {
    label: 'Voice',
    icon: Mic,
    accent: 'pill-purple',
  },
  REEL: {
    label: 'Reel',
    icon: Clapperboard,
    accent: 'pill-warn',
  },
}

const SHORT_TEXT_LIMIT = 140
const LONG_TEXT_LIMIT = 540

// Per-author social-status cache — keyed by author id. Avoids re-issuing
// GET /social-status for every card showing the same user in a long feed,
// and lets a Follow toggle in one card update every other card the
// author appears in for the rest of the session.
const followCache = new Map()
const followSubscribers = new Map()

function readFollowCache(authorId) {
  if (!authorId) return undefined
  return followCache.get(authorId)
}

function writeFollowCache(authorId, value) {
  if (!authorId) return
  followCache.set(authorId, value)
  const subs = followSubscribers.get(authorId)
  if (subs) for (const fn of subs) fn(value)
}

function subscribeFollow(authorId, fn) {
  if (!authorId) return () => {}
  let set = followSubscribers.get(authorId)
  if (!set) {
    set = new Set()
    followSubscribers.set(authorId, set)
  }
  set.add(fn)
  return () => set.delete(fn)
}

// "2412" → "2 412" using a narrow no-break space so the digit run can
// still wrap on small viewports without smearing into the icon. Matches
// the editorial view-counter rendering in the spec mock.
function formatViewCount(value) {
  const num = Number(value ?? 0)
  if (Number.isNaN(num)) return '0'
  if (num < 1000) return String(num)
  return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

function formatFileSize(bytes) {
  const num = Number(bytes)
  if (!num || Number.isNaN(num)) return null
  const units = ['B', 'KB', 'MB', 'GB']
  let value = num
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i += 1
  }
  const rounded = value >= 100 || i === 0 ? Math.round(value) : Math.round(value * 10) / 10
  return `${rounded} ${units[i]}`
}

// Tiny markdown-flavoured block parser — splits the post text into
// paragraph and blockquote runs. Lines that begin with `> ` collapse
// into a single contiguous blockquote so an author can write a pull
// quote inline, the same way the design spec renders it. Mentions
// and whitespace still travel through MentionText.
function parseTextBlocks(text) {
  if (!text) return []
  const lines = text.split('\n')
  const blocks = []
  let current = null
  for (const raw of lines) {
    const isQuote = /^>\s?/.test(raw)
    const type = isQuote ? 'quote' : 'text'
    const content = isQuote ? raw.replace(/^>\s?/, '') : raw
    if (!current || current.type !== type) {
      current = { type, lines: [content] }
      blocks.push(current)
    } else {
      current.lines.push(content)
    }
  }
  return blocks
    .map((block) => ({ type: block.type, text: block.lines.join('\n') }))
    .filter((block, index, all) => {
      // Drop empty leading/trailing whitespace runs so spacing doesn't
      // double up — but keep mid-text blank paragraphs since the author
      // wrote them deliberately.
      if (block.text.trim().length > 0) return true
      return index !== 0 && index !== all.length - 1
    })
}

function normalizeAuthor(post) {
  if (post.author) {
    return {
      id: post.author.id,
      username: post.author.username,
      fullName: post.author.fullName,
      avatarUrl: post.author.avatarUrl,
      profileImage: post.author.avatarUrl,
      role: post.author.role,
    }
  }
  return {
    id: post.authorId,
    username: post.authorUsername,
    fname: post.authorFname,
    lname: post.authorLname,
    profileImage: post.authorProfileImage,
    role: post.authorRole,
  }
}

// ─── Media ──────────────────────────────────────────────────────────
function MediaItem({ item, className, onOpen }) {
  const url = resolveMediaUrl(item.url ?? item.mediaUrl)
  if (!url) return null
  const type = (item.mediaType ?? item.type ?? '').toUpperCase()
  if (type === 'VIDEO') {
    // Native controls stay so users can scrub inline. Clicking the
    // video frame outside the controls opens the lightbox for fullscreen
    // playback with the author header.
    return (
      <div
        role={onOpen ? 'button' : undefined}
        onClick={(e) => {
          if (!onOpen) return
          // Skip when the user is interacting with the native controls
          if (e.target && e.target.tagName === 'VIDEO') {
            const v = e.target
            const rect = v.getBoundingClientRect()
            const bottomZone = e.clientY > rect.bottom - 48
            if (bottomZone) return // let controls handle the click
          }
          onOpen()
        }}
        className="h-full w-full cursor-pointer"
      >
        <video
          src={url}
          controls
          playsInline
          preload="metadata"
          className={cn('h-full w-full bg-black object-contain', className)}
        />
      </div>
    )
  }
  if (type === 'AUDIO_TRACK' || type === 'AUDIO') {
    return (
      <div className={cn('flex items-center bg-muted p-3', className)}>
        <AudioPlayer
          src={url}
          variant="compact"
          trackKind="music"
          subtitle={item.altText ? undefined : 'Audio'}
          title={item.altText}
          className="w-full"
        />
      </div>
    )
  }
  if (type === 'DOCUMENT') {
    const rawName = (item.altText || url.split('/').pop() || 'document').split('?')[0]
    const filename = decodeURIComponent(rawName)
    const ext = filename.includes('.') ? filename.split('.').pop().toLowerCase() : null
    const sizeLabel = formatFileSize(item.fileSize ?? item.sizeBytes ?? item.bytes)
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className={cn(
          'group/doc flex items-center gap-3.5 rounded-xl border-[0.5px] border-border bg-muted/40 px-3.5 py-3 transition-colors hover:bg-muted/70',
          className,
        )}
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-xl border-[0.5px] border-border bg-paper text-ink-2">
          <FileText className="size-5" strokeWidth={1.4} />
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate font-display text-[15px] font-medium tracking-[-0.005em] text-ink">
            {filename}
          </span>
          <span className="mt-1 block font-mono text-[10.5px] uppercase tracking-wider text-ink-3">
            {ext ? `${ext} document` : 'document'}
            {sizeLabel ? ` · ${sizeLabel}` : ''}
          </span>
        </span>
        <ArrowUpRight
          className="size-4 shrink-0 text-ink-3 transition-transform duration-200 group-hover/doc:-translate-y-0.5 group-hover/doc:translate-x-0.5 group-hover/doc:text-ink"
          strokeWidth={1.5}
        />
      </a>
    )
  }
  return (
    <img
      src={url}
      alt={item.altText ?? ''}
      loading="lazy"
      role={onOpen ? 'button' : undefined}
      onClick={onOpen}
      className={cn(
        'h-full w-full object-cover transition-transform duration-700',
        onOpen && 'cursor-zoom-in hover:scale-[1.02]',
        !onOpen && 'hover:scale-[1.02]',
        className,
      )}
      draggable={false}
    />
  )
}

function MediaGrid({ media, author, caption }) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  if (!media?.length) return null

  // Filter to only image/video items — documents and audio shouldn't
  // appear in the lightbox carousel.
  const viewable = media.filter((m) => {
    const t = (m?.mediaType ?? m?.type ?? '').toUpperCase()
    return t === 'IMAGE' || t === 'VIDEO' || t === ''
  })

  function openLightboxAt(index) {
    setLightboxIndex(index)
    setLightboxOpen(true)
  }

  const lightbox = viewable.length > 0 ? (
    <MediaLightbox
      open={lightboxOpen}
      onOpenChange={setLightboxOpen}
      media={viewable}
      startIndex={lightboxIndex}
      author={author}
      postCaption={caption}
    />
  ) : null

  if (media.length === 1) {
    const sole = media[0]
    const isVideo = (sole.mediaType ?? '').toUpperCase() === 'VIDEO'
    if (isVideo) {
      return (
        <>
          <div className="mx-auto max-w-[480px] overflow-hidden rounded-2xl border border-border bg-black">
            <MediaItem
              item={sole}
              className="max-h-[420px] w-full object-contain sm:max-h-[480px]"
              onOpen={() => openLightboxAt(0)}
            />
          </div>
          {lightbox}
        </>
      )
    }
    return (
      <>
        <div className="overflow-hidden rounded-2xl border border-border">
          <MediaItem
            item={sole}
            className="max-h-[560px] w-full object-cover"
            onOpen={() => openLightboxAt(0)}
          />
        </div>
        {lightbox}
      </>
    )
  }

  const sliced = media.slice(0, 4)
  const layout = {
    2: 'grid grid-cols-2 gap-1',
    3: 'grid grid-cols-2 gap-1 [&>:first-child]:row-span-2 [&>:first-child]:aspect-auto',
    4: 'grid grid-cols-2 gap-1',
  }[sliced.length]
  return (
    <>
      <div className={cn('overflow-hidden rounded-2xl border border-border', layout)}>
        {sliced.map((item, index) => (
          <div
            key={item.id ?? index}
            className="relative aspect-square cursor-zoom-in overflow-hidden bg-muted"
          >
            <MediaItem item={item} onOpen={() => openLightboxAt(index)} />
            {index === 3 && media.length > 4 ? (
              <div
                className="absolute inset-0 grid cursor-zoom-in place-items-center bg-black/55 text-white transition-colors hover:bg-black/65"
                onClick={() => openLightboxAt(3)}
              >
                <span className="font-display text-2xl font-semibold">+{media.length - 4}</span>
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {lightbox}
    </>
  )
}

// ─── Reel ───────────────────────────────────────────────────────────
//
// In-feed reel preview — a phone-shaped tile, not a full cinema. Capped to
// ~320px wide on tablet/desktop and centered; on mobile it spans the card
// up to the same cap. Tap the corner to jump to the dedicated reel viewer.
function ReelPlayer({ media, audioTrackName, postId }) {
  const item = media?.[0]
  const url = resolveMediaUrl(item?.url)
  const videoRef = useRef(null)
  const [muted, setMuted] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)

  if (!url) return null

  function togglePlay() {
    const el = videoRef.current
    if (!el) return
    if (playing) el.pause()
    else el.play().catch(() => setPlaying(false))
  }

  // Spec §06 — vertical canvas, top progress bar, glass right-rail.
  // Dark gradient backdrop so this is the only surface in the app that
  // lives in dark mode. Right rail uses `.glass-rail`.
  return (
    <div className="mx-auto w-full max-w-[260px] sm:max-w-[280px]">
      <div
        className="relative isolate aspect-[9/16] overflow-hidden rounded-[14px] border-[0.5px] border-ink"
        style={{ background: 'linear-gradient(170deg, #2a2520 0%, #14110C 100%)' }}
      >
        <video
          ref={videoRef}
          src={url}
          loop
          playsInline
          muted={muted}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(event) => {
            const el = event.currentTarget
            if (!el.duration) return
            setProgress(el.currentTime / el.duration)
          }}
          onClick={togglePlay}
          className="absolute inset-0 h-full w-full cursor-pointer object-cover"
        />

        {/* Top: 5-segment progress bar + mute toggle */}
        <div className="absolute inset-x-3 top-3 flex items-start gap-3">
          <div className="flex flex-1 items-center gap-[3px]">
            {[0, 1, 2, 3, 4].map((i) => {
              const seg = Math.max(0, Math.min(1, progress * 5 - i))
              return (
                <span
                  key={i}
                  className="h-[2px] flex-1 overflow-hidden rounded-full bg-white/30"
                >
                  <span
                    className="block h-full bg-white"
                    style={{ width: `${seg * 100}%` }}
                  />
                </span>
              )
            })}
          </div>
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            className="grid size-[26px] shrink-0 place-items-center rounded-full bg-black/45 text-white backdrop-blur hover:bg-black/60"
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? <VolumeX className="size-3" /> : <Volume2 className="size-3" />}
          </button>
        </div>

        {/* Right rail — react / comment / repost / save / share. Glass blur. */}
        <div className="absolute bottom-16 right-2 flex flex-col items-center gap-3 text-white">
          {postId ? (
            <Link
              to={`/reels?id=${postId}`}
              title="Open in Reels"
              className="glass-rail"
              aria-label="Open in Reels"
            >
              <Maximize2 className="size-3.5" strokeWidth={1.6} />
            </Link>
          ) : null}
          <span className="glass-rail">
            <Play className="size-3.5 translate-x-[1px]" />
          </span>
        </div>

        {/* Bottom-left author + caption stack */}
        <div className="absolute inset-x-3 bottom-3 space-y-2 text-white">
          {audioTrackName ? (
            <span className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full bg-black/35 px-2 py-1 text-[10.5px] font-medium backdrop-blur">
              <span className="size-1.5 animate-pulse rounded-full bg-white" />
              ♪ {audioTrackName}
            </span>
          ) : null}
        </div>

        {/* Center Play overlay when paused */}
        <AnimatePresence>
          {!playing ? (
            <motion.button
              key="play"
              type="button"
              onClick={togglePlay}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              className="absolute inset-0 grid place-items-center"
              aria-label="Play"
            >
              <span className="grid size-14 place-items-center rounded-full bg-white/95 text-black backdrop-blur">
                <Play className="size-5 translate-x-[1px] fill-black" />
              </span>
            </motion.button>
          ) : null}
        </AnimatePresence>

        {/* Reel pill — bottom-right */}
        <span className="absolute right-3 top-9 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2 py-0.5 font-mono text-[9.5px] font-medium uppercase tracking-wider text-black">
          <Clapperboard className="size-2.5" strokeWidth={1.5} />
          Reel
        </span>
      </div>
    </div>
  )
}

// ─── Text body with show-more ───────────────────────────────────────
function PostText({ text, postType }) {
  const [expanded, setExpanded] = useState(false)
  const source = text ?? ''
  const length = source.length
  const showToggle = postType === 'TEXT' && length > LONG_TEXT_LIMIT
  const display =
    showToggle && !expanded ? `${source.slice(0, LONG_TEXT_LIMIT).trimEnd()}…` : source
  const blocks = useMemo(() => parseTextBlocks(source), [source])
  const displayBlocks = useMemo(
    () => (showToggle && !expanded ? parseTextBlocks(display) : blocks),
    [blocks, display, expanded, showToggle],
  )

  if (!text) return null

  const hasQuote = blocks.some((block) => block.type === 'quote')
  const isVeryShort =
    postType === 'TEXT' && length <= SHORT_TEXT_LIMIT && !hasQuote

  if (isVeryShort) {
    return (
      <p
        dir="auto"
        className="font-display text-pretty text-[20px] font-normal leading-[1.45] tracking-[-0.005em] text-ink sm:text-[21px]"
      >
        <MentionText text={text} />
      </p>
    )
  }

  const paragraphClass = cn(
    'whitespace-pre-wrap break-words text-pretty text-ink',
    postType === 'TEXT'
      ? 'font-display text-[17px] font-normal leading-[1.55] tracking-[-0.005em]'
      : 'text-[15px] leading-[1.65]',
  )

  return (
    <div className="space-y-3">
      {displayBlocks.map((block, index) =>
        block.type === 'quote' ? (
          <blockquote
            key={index}
            dir="auto"
            className="border-l-[2px] border-ink-2 pl-4 font-display text-[17px] italic leading-[1.5] tracking-[-0.005em] text-ink-2 sm:text-[18px]"
          >
            <MentionText text={block.text} />
          </blockquote>
        ) : (
          <p key={index} dir="auto" className={paragraphClass}>
            <MentionText text={block.text} />
          </p>
        ),
      )}
      {showToggle ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-semibold text-ink-3 transition-colors hover:text-ink"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      ) : null}
    </div>
  )
}

// ─── Inline follow toggle ───────────────────────────────────────────
//
// Spec § Header pattern — a chunky outline pill that flips to a muted
// "Following" affirmation. Initial state is resolved lazily, once,
// when the card first enters the viewport, so a 50-post feed doesn't
// fire 50 GET /social-status calls during the first scroll-stop. The
// result is fanned out across every other card the same author
// appears in via `followCache` + `subscribeFollow`.
function FollowButton({ authorId, inView }) {
  const toast = useToast()
  const [state, setState] = useState(
    () => readFollowCache(authorId)?.isFollowing ?? null,
  )
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!authorId) return undefined
    return subscribeFollow(authorId, (value) => {
      setState(value?.isFollowing ?? null)
    })
  }, [authorId])

  useEffect(() => {
    if (!authorId || !inView) return undefined
    const cached = readFollowCache(authorId)
    if (cached) {
      setState(cached.isFollowing)
      return undefined
    }
    let cancelled = false
    getSocialStatus(authorId)
      .then((status) => {
        if (cancelled) return
        const value = Boolean(status?.isFollowing ?? status?.following)
        writeFollowCache(authorId, { isFollowing: value, fetchedAt: Date.now() })
      })
      .catch(() => {
        /* Network blip or 401 — leave the button in its unknown state. */
      })
    return () => {
      cancelled = true
    }
  }, [authorId, inView])

  async function handleToggle(event) {
    event.preventDefault()
    event.stopPropagation()
    if (busy || state == null) return
    const previous = state
    setBusy(true)
    setState(!previous)
    writeFollowCache(authorId, { isFollowing: !previous, fetchedAt: Date.now() })
    try {
      if (previous) await unfollowUser(authorId)
      else await followUser(authorId)
    } catch (error) {
      setState(previous)
      writeFollowCache(authorId, {
        isFollowing: previous,
        fetchedAt: Date.now(),
      })
      toast.error(extractApiMessage(error, 'Could not update follow.'))
    } finally {
      setBusy(false)
    }
  }

  const known = state != null
  const isFollowing = state === true

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={busy || !known}
      aria-pressed={isFollowing}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border-[0.5px] px-3 py-1.5 text-[12px] font-medium leading-none tracking-tight transition-colors',
        isFollowing
          ? 'border-border bg-secondary text-ink-3 hover:bg-muted hover:text-ink'
          : 'border-ink/85 bg-paper text-ink hover:bg-secondary',
        (!known || busy) && 'opacity-70',
      )}
    >
      {isFollowing ? (
        <>
          <Check className="size-3.5" strokeWidth={2} />
          Following
        </>
      ) : (
        <>
          <Plus className="size-3.5" strokeWidth={2} />
          Follow
        </>
      )}
    </button>
  )
}

// ─── ShareMenu ──────────────────────────────────────────────────────
//
// One action: "Share post". Always opens a dialog where the user can
// optionally add a note, then click Share. The new repost is pushed
// into the feed in real time via `onRepostCreated`.
//
// Secondary actions (Undo share, Copy link) live in a small dropdown
// next to the primary button so they don't get in the way.
//
// Self-reposts are allowed. The backend still rejects DUPLICATE_REPOST
// (same original twice) — surfaced as a toast.
function ShareMenu({ post, onShared, onRepostCreated }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [note, setNote] = useState('')

  // Fallback used only if the new /copy-link endpoint fails — never
  // bumps a counter, just gives the user *something* to paste.
  function fallbackLink() {
    return `${FRONTEND_URL}/posts/${post.id}`
  }

  async function handleCopy() {
    if (busy) return
    setBusy(true)
    // Optimistic: write a placeholder to the clipboard NOW (some
    // browsers reject async clipboard writes that aren't on the
    // initial user gesture). We'll overwrite with the canonical short
    // URL the server returns once the counter bump round-trips.
    let optimistic = fallbackLink()
    try {
      await navigator.clipboard.writeText(optimistic)
    } catch {
      // ignore — we'll try again with the real URL below.
    }
    try {
      const data = await copyPostShareLink(post.id)
      const url = data?.shortUrl ?? data?.canonicalUrl ?? optimistic
      try {
        await navigator.clipboard.writeText(url)
      } catch {
        // Clipboard rejected the second write — the optimistic one
        // is already there and is a valid permalink; non-fatal.
      }
      // Realtime: the SHARE_COUNT_UPDATED event will land via SSE for
      // anyone with the post stream open, but we also patch the local
      // state so the share-count chip ticks in this tab immediately
      // — the SSE echo will reconcile if it differs.
      const fresh = data?.shareCount
      onShared?.({
        ...post,
        shareCount: fresh ?? (post.shareCount ?? 0) + 1,
      })
      toast.success('Link copied to clipboard.')
    } catch (error) {
      toast.error(friendlyApiMessage(error, 'Could not copy link.'))
    } finally {
      setBusy(false)
    }
  }

  function openDialog() {
    setNote('')
    setDialogOpen(true)
  }

  async function handleShare() {
    if (busy) return
    const captionText = note.trim()
    setBusy(true)
    try {
      const created = await repostPost(post.id, captionText || undefined)
      onShared?.({
        ...post,
        shareCount: (post.shareCount ?? 0) + 1,
      })
      if (created) onRepostCreated?.(created)
      toast.success('Post shared.')
      setDialogOpen(false)
      setNote('')
    } catch (error) {
      toast.error(friendlyApiMessage(error, 'Could not share post.'))
    } finally {
      setBusy(false)
    }
  }

  async function handleUndoShare() {
    if (busy) return
    setBusy(true)
    try {
      await undoRepost(post.id)
      onShared?.({
        ...post,
        shareCount: Math.max(0, (post.shareCount ?? 0) - 1),
      })
      toast.success('Share removed.')
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not undo share.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={busy}
            className="rx disabled:opacity-50"
            aria-label="Share post"
          >
            <Share2 className="size-[14px]" strokeWidth={1.5} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onSelect={openDialog} disabled={busy}>
            <Repeat2 className="mr-2 size-4" />
            Share post
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={handleUndoShare}
            disabled={busy}
            className="text-muted-foreground"
          >
            <Repeat2 className="mr-2 size-4 opacity-60" />
            Undo share
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleCopy}>
            <Copy className="mr-2 size-4" />
            Copy link
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Share post</DialogTitle>
            <DialogDescription>
              Add a note (optional) — it appears above the original post.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value.slice(0, 500))}
              placeholder="Say something about this post…"
              rows={4}
              autoFocus
              className="resize-none rounded-xl"
            />
            <p className="text-right text-[11px] font-mono tabular-nums text-muted-foreground">
              {note.length} / 500
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              disabled={busy}
              className="rounded-full"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleShare}
              disabled={busy}
              className="rounded-full bg-brand text-brand-foreground hover:bg-brand/90"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Share2 className="size-4" />
              )}
              {busy ? 'Sharing…' : 'Share post'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Shared (quoted) post ───────────────────────────────────────────
function QuotedPost({ post }) {
  const author = normalizeAuthor(post)
  const handle = getHandle(author)
  const route = getRawUsername(author)
  // Click → original author's profile. The site has no /post/:id route,
  // so linking there 404s; the profile is the canonical destination.
  const profileHref = route ? `/profile/${route}` : '/'
  return (
    <Link
      to={profileHref}
      className="block overflow-hidden rounded-md border-[0.5px] border-border bg-paper transition-colors hover:border-ink-4/30"
    >
      <div className="flex items-center gap-2 px-3.5 pt-3">
        <UserAvatar user={author} className="size-7" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-xs font-semibold">
            {getFullName(author) || handle}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {handle ? `@${handle} · ` : ''}
            <RelativeTime entity={post} />
          </p>
        </div>
      </div>
      {post.textContent ? (
        <p
          dir="auto"
          className="line-clamp-3 px-3.5 py-2 text-sm text-foreground"
        >
          {post.textContent}
        </p>
      ) : null}
      {post.mediaList?.length ? (
        <div className="px-2 pb-2">
          <MediaGrid media={post.mediaList.slice(0, 1)} author={author} caption={post.textContent} />
        </div>
      ) : null}
    </Link>
  )
}

// ─── PostCard ───────────────────────────────────────────────────────
export function PostCard({ post, onChange, onDelete, onRepostCreated, defaultCommentsOpen = false }) {
  const { user: currentUser, isAuthenticated } = useAuth()
  const toast = useToast()
  const [working, setWorking] = useState(false)
  const [showComments, setShowComments] = useState(defaultCommentsOpen)
  const [commentCount, setCommentCount] = useState(post.commentCount ?? 0)
  const [editOpen, setEditOpen] = useState(false)
  const commentsRef = useRef(null)

  useEffect(() => {
    setCommentCount(post.commentCount ?? 0)
  }, [post.commentCount])

  // Seed the per-viewer reaction store from the prop. Feed list
  // endpoints currently return myReaction: null for every row, so we
  // mark the seed non-authoritative — a known-true state established
  // by a prior detail fetch / optimistic click / SSE actor match is
  // not overwritten by the feed's null.
  useEffect(() => {
    seedFromResponse('post', post, { authoritative: false })
  }, [post])

  // Per-post realtime — subscribe whenever the card is in (or near)
  // the viewport, OR while the comments thread is open. Combining
  // viewport-gating with the open-comments override means a reader
  // looking at a card sees live view / reaction / share / comment
  // counts immediately, while a card that's scrolled offscreen tears
  // its EventSource down so a long feed doesn't hold a dozen open
  // connections. Handlers close over `post` from props on every
  // render — `usePostStream` snapshots them via a ref so the closure
  // stays current without re-creating the EventSource.
  const [setLiveRef, inView] = useInView({ rootMargin: '300px 0px 300px 0px' })

  // Local node ref so we can reach the post's media elements when the
  // card leaves the viewport — used below to silence any playing
  // <video> / <audio> the reader scrolled past. We tee the same node
  // into `setLiveRef` so the IntersectionObserver still tracks it.
  const articleRef = useRef(null)
  const composedRef = useCallback(
    (node) => {
      articleRef.current = node
      setLiveRef(node)
    },
    [setLiveRef],
  )

  // Pause every media element inside this card when it scrolls out of
  // view. Without this, a reel inside the feed (or a voice-post
  // AudioPlayer) keeps playing and the reader hears it long after
  // they've moved on. Triggered only on the in→out transition; the
  // user can hit play again the next time the card is in view.
  useEffect(() => {
    if (inView) return
    const root = articleRef.current
    if (!root) return
    root.querySelectorAll('video, audio').forEach((media) => {
      if (!media.paused) {
        try {
          media.pause()
        } catch {
          /* some elements may throw mid-load — non-fatal */
        }
      }
    })
  }, [inView])

  const postStream = usePostStream(
    post.id,
    {
      POST_UPDATED: (payload) => {
        if (!payload?.id) return
        // Preserve viewer-specific fields the broadcast payload omits.
        onChange?.({ ...post, ...payload, myReaction: post.myReaction })
        // Counters that arrive in the full snapshot also fan into the
        // store so any sibling render reading via useCounter reconciles.
        if (payload.reactionCount != null) setCounter('post', post.id, 'rx', payload.reactionCount)
        if (payload.commentCount != null) setCounter('post', post.id, 'cm', payload.commentCount)
        if (payload.shareCount != null) setCounter('post', post.id, 'sh', payload.shareCount)
        if (payload.viewCount != null) setCounter('post', post.id, 'vw', payload.viewCount)
        if (payload.saveCount != null) setCounter('post', post.id, 'sv', payload.saveCount)
      },
      POST_DELETED: () => {
        onDelete?.(post.id)
      },
      // Own-actor guard: when the SSE event came from the current
      // viewer's own toggle, the optimistic update (and the HTTP
      // response reconciliation in handlePickReaction /
      // handleClearReaction) already wrote the authoritative count
      // locally. The SSE echo for the viewer's own action sometimes
      // races with the read-after-write and carries the pre-toggle
      // count — adopting it here would flip a correct +1 back to the
      // stale value. So for own-actor events we let the local count
      // stand; for other viewers' events we adopt the payload count.
      REACTION_ADDED: (payload) => {
        if (payload?.postReactionCount == null) return
        if (currentUser?.id && payload.actorId === currentUser.id) return
        setCounter('post', post.id, 'rx', payload.postReactionCount)
      },
      REACTION_REMOVED: (payload) => {
        if (payload?.postReactionCount == null) return
        if (currentUser?.id && payload.actorId === currentUser.id) return
        setCounter('post', post.id, 'rx', payload.postReactionCount)
      },
      SHARE_COUNT_UPDATED: (payload) => {
        if (payload?.postShareCount != null) {
          setCounter('post', post.id, 'sh', payload.postShareCount)
        }
      },
      // Own-actor guard: when the SSE echoes this viewer's own
      // save/unsave, the HTTP response reconciliation already wrote
      // the right number locally. Skip the count adoption for
      // own-actor events; other viewers' saves still update live.
      SAVE_COUNT_UPDATED: (payload) => {
        if (payload?.postSaveCount == null) return
        if (currentUser?.id && payload.actorId === currentUser.id) return
        setCounter('post', post.id, 'sv', payload.postSaveCount)
      },
      VIEW_COUNT_UPDATED: (payload) => {
        if (payload?.postViewCount != null) {
          setCounter('post', post.id, 'vw', payload.postViewCount)
        }
      },
      COMMENT_CREATED: (payload) => {
        if (payload?.postCommentCount != null) {
          setCounter('post', post.id, 'cm', payload.postCommentCount)
        }
        // No fallback delta — the backend always carries the
        // authoritative count on COMMENT_CREATED. Skipping the
        // synthetic +1 prevents it from clobbering the prop fallback
        // (commentCount state) if the field is ever absent.
        commentsRef.current?.applyRealtimeEvent('COMMENT_CREATED', payload)
      },
      COMMENT_EDITED: (payload) => {
        commentsRef.current?.applyRealtimeEvent('COMMENT_EDITED', payload)
      },
      COMMENT_DELETED: (payload) => {
        commentsRef.current?.applyRealtimeEvent('COMMENT_DELETED', payload)
        if (payload?.postCommentCount != null) {
          setCounter('post', post.id, 'cm', payload.postCommentCount)
        }
      },
      REPLY_CREATED: (payload) => {
        commentsRef.current?.applyRealtimeEvent('REPLY_CREATED', payload)
      },
      COMMENT_REACTION_ADDED: (payload) => {
        commentsRef.current?.applyRealtimeEvent('COMMENT_REACTION_ADDED', payload)
      },
      COMMENT_REACTION_REMOVED: (payload) => {
        commentsRef.current?.applyRealtimeEvent(
          'COMMENT_REACTION_REMOVED',
          payload,
        )
      },
    },
    { enabled: inView || showComments || defaultCommentsOpen },
  )

  const author = normalizeAuthor(post)
  const authorUsername = getUsername(author)
  const authorHandle = getHandle(author)
  const authorRoute = getRawUsername(author)
  const isMine =
    currentUser &&
    (post.author?.id === currentUser.id ||
      post.authorId === currentUser.id ||
      (authorUsername &&
        currentUser.username &&
        authorUsername === currentUser.username))

  const visibility = post.visibility ?? 'PUBLIC'
  const VisIcon = (VISIBILITY[visibility] ?? VISIBILITY.PUBLIC).Icon
  const visLabel = (VISIBILITY[visibility] ?? VISIBILITY.PUBLIC).label

  const postType = post.postType ?? 'TEXT'
  const typeMeta = TYPE_META[postType]
  const TypeIcon = typeMeta?.icon

  const voiceMediaUrl = useMemo(() => {
    if (postType !== 'VOICE_POST') return null
    return resolveMediaUrl(post.mediaList?.[0]?.url)
  }, [post.mediaList, postType])

  // "Did I react?" — primary source is the in-memory my-reaction
  // store (seeded from API responses + actor-aware SSE). Falls back
  // to the persisted reaction-cache so the heart still remembers
  // across hard reloads when the feed payload omitted myReaction.
  const cachedReaction = useCachedReaction('post', post.id)
  const storeSaysReacted = useDidIReact('post', post.id, false)
  const effectiveReaction =
    post.myReaction ?? (storeSaysReacted ? 'LIKE' : null) ?? cachedReaction

  // Counter reads — the store wins when an SSE event or optimistic
  // delta has touched it; otherwise the prop value is used. Either
  // way, first-paint is correct and live updates are reactive.
  const reactionCount = useCounter('post', post.id, 'rx', post.reactionCount ?? 0)
  const storedShareCount = useCounter('post', post.id, 'sh', post.shareCount ?? 0)
  const storedSaveCount = useCounter('post', post.id, 'sv', post.saveCount ?? 0)
  const storedCommentCount = useCounter('post', post.id, 'cm', commentCount)
  const storedViewCount = useCounter('post', post.id, 'vw', post.viewCount ?? 0)
  // Rate-limit countdown — when the backend's per-user reaction
  // bucket fires 429, the axios interceptor parks the action and
  // this hook ticks down the seconds remaining. We disable the
  // heart and surface the countdown in its label so the user
  // stops pounding the button (which would just stack more 429s).
  const reactionCooldown = useCooldown('reaction')
  const saveCooldown = useCooldown('social')

  async function handlePickReaction(type) {
    if (working || !isAuthenticated) {
      if (!isAuthenticated) toast.info('Sign in to react.')
      return
    }
    // Optimistic: paint the reacted state immediately + remember it
    // locally so the feed survives a reload without losing the heart.
    const previous = post
    const wasReacting = Boolean(effectiveReaction)
    onChange?.({ ...post, myReaction: type })
    rememberReaction('post', post.id, type)
    setReacted('post', post.id, true, type)
    // Bump against the currently rendered count so the optimistic +1
    // always lands on the number the viewer is actually looking at,
    // even when no SSE event has seeded the store yet. SSE echo
    // overwrites with the authoritative value moments later.
    if (!wasReacting) bumpCounter('post', post.id, 'rx', reactionCount, +1)
    setWorking(true)
    try {
      const updated = await reactToPost(post.id, type)
      // Reconcile against the server's authoritative numbers — the
      // POST response is the full PostResponse. Without this, an
      // idempotent re-click (already-liked, returns the same count)
      // could leave a stale optimistic +1 if the SSE echo is delayed
      // or dropped, and the heart could disagree with myReaction if
      // the store wasn't seeded.
      if (updated?.id) {
        onChange?.(updated)
        if (updated.reactionCount != null) {
          setCounter('post', post.id, 'rx', updated.reactionCount)
        }
        seedFromResponse('post', updated, { authoritative: true })
      }
    } catch (error) {
      onChange?.(previous)
      forgetReaction('post', post.id)
      setReacted('post', post.id, wasReacting, wasReacting ? cachedReaction : null)
      if (!wasReacting) setCounter('post', post.id, 'rx', reactionCount)
      toast.error(friendlyApiMessage(error, 'Could not react.'))
    } finally {
      setWorking(false)
    }
  }

  async function handleClearReaction() {
    if (working || !effectiveReaction) return
    const previous = post
    const previousCached = cachedReaction
    const previousCount = reactionCount
    onChange?.({ ...post, myReaction: null })
    forgetReaction('post', post.id)
    setReacted('post', post.id, false)
    bumpCounter('post', post.id, 'rx', reactionCount, -1)
    setWorking(true)
    try {
      // DELETE now returns 200 with the full PostResponse — use the
      // authoritative reactionCount + myReaction:null instead of
      // trusting only the optimistic decrement, which would drift
      // whenever another viewer's reaction landed between paints.
      const updated = await removePostReaction(post.id)
      if (updated?.id) {
        onChange?.(updated)
        if (updated.reactionCount != null) {
          setCounter('post', post.id, 'rx', updated.reactionCount)
        }
        seedFromResponse('post', updated, { authoritative: true })
      }
    } catch (error) {
      onChange?.(previous)
      if (previousCached) rememberReaction('post', post.id, previousCached)
      setReacted('post', post.id, true, previousCached ?? 'LIKE')
      setCounter('post', post.id, 'rx', previousCount)
      toast.error(friendlyApiMessage(error, 'Could not remove reaction.'))
    } finally {
      setWorking(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this post?')) return
    try {
      await deletePost(post.id)
      onDelete?.(post.id)
      toast.success('Post deleted.')
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not delete post.'))
    }
  }

  // Instagram-style bookmark — wired to /api/v1/posts/{id}/save. The
  // optimistic flip lands first; the SSE SAVE_COUNT_UPDATED echo
  // reconciles the count once the backend commits.
  const [savingBookmark, setSavingBookmark] = useState(false)
  const storeSaysSaved = useDidISave('post', post.id, false)
  const isSaved = post.isSaved ?? storeSaysSaved

  async function handleToggleSave() {
    if (savingBookmark) return
    if (!isAuthenticated) {
      toast.info('Sign in to save this post.')
      return
    }
    const previous = post
    const previousSaved = isSaved
    const previousSaveCount = storedSaveCount
    onChange?.({ ...post, isSaved: !isSaved })
    setSaved('post', post.id, !isSaved)
    bumpCounter('post', post.id, 'sv', storedSaveCount, isSaved ? -1 : +1)
    setSavingBookmark(true)
    try {
      // Both endpoints return the full PostResponse (POST→201, DELETE→
      // 200) — reconcile against authoritative isSaved + saveCount so
      // the optimistic toggle never drifts under concurrent reactors.
      const updated = isSaved
        ? await unsavePost(post.id)
        : await savePost(post.id)
      if (updated?.id) {
        onChange?.(updated)
        if (updated.saveCount != null) {
          setCounter('post', post.id, 'sv', updated.saveCount)
        }
        if (updated.isSaved != null) {
          setSaved('post', post.id, Boolean(updated.isSaved))
        }
      }
      if (!isSaved) toast.success('Saved to your library.')
    } catch (error) {
      onChange?.(previous)
      setSaved('post', post.id, previousSaved)
      setCounter('post', post.id, 'sv', previousSaveCount)
      toast.error(extractApiMessage(error, 'Could not update bookmark.'))
    } finally {
      setSavingBookmark(false)
    }
  }

  const displayName = getFullName(author) || authorHandle || 'Unknown'

  return (
    <article
      ref={composedRef}
      className={cn(
        'group/post relative border-b-[0.5px] border-border bg-paper transition-colors duration-150 hover:bg-secondary/30',
      )}
    >
      {/* ── Repost banner — when this card IS a repost ─────── */}
      {(post.isRepost || postType === 'REPOST') && post.sharedPost ? (
        <div className="flex items-center gap-2 px-4 pb-2 pt-4 text-[12px] text-ink-3 sm:px-6">
          <Repeat2 className="size-[14px] text-brand" strokeWidth={1.5} />
          <Link
            to={`/profile/${authorRoute}`}
            className="font-medium text-ink-2 hover:underline"
          >
            {displayName}
          </Link>
          <span>reposted</span>
        </div>
      ) : null}

      {/* ── Header ───────────────────────────────────────────── */}
      <header className="flex items-start gap-3 px-4 pt-5 sm:px-6">
        <Link
          to={`/profile/${authorRoute}`}
          className="shrink-0 transition-opacity hover:opacity-90"
        >
          <UserAvatar user={author} className="size-10" />
        </Link>

        <div className="min-w-0 flex-1 leading-tight">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link
              to={`/profile/${authorRoute}`}
              className="truncate font-display text-[16px] font-semibold tracking-[-0.005em] text-ink hover:underline sm:text-[17px]"
            >
              {displayName}
            </Link>
            {author.role ? <RoleBadge role={author.role} size="sm" /> : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-mono text-[10.5px] uppercase tracking-wider text-ink-3">
            {authorHandle ? (
              <Link
                to={`/profile/${authorRoute}`}
                className="lowercase tracking-normal transition-colors hover:text-ink"
              >
                @{authorHandle}
              </Link>
            ) : null}
            {authorHandle ? <span aria-hidden>·</span> : null}
            <Link
              to={`/posts/${post.id}`}
              className="transition-colors hover:text-ink"
              title={
                postStream?.isConnected
                  ? `${post.formattedDate || 'Open post'} · live updates connected`
                  : post.formattedDate || 'Open post'
              }
            >
              <RelativeTime entity={post} />
              {/* Live pip — kept as a subtle ink-colored dot next to the
                  timestamp so a reader can still tell at a glance that
                  the per-post SSE stream is hooked up, without the
                  prior emerald "LIVE" label competing with the rest of
                  the metadata. */}
              <span
                aria-hidden
                className={cn(
                  'ml-1.5 inline-block size-1 rounded-full align-middle transition-colors',
                  postStream?.isConnected
                    ? 'bg-emerald-500 animate-pulse'
                    : 'bg-ink-4/60',
                )}
              />
            </Link>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1" title={visLabel}>
              <VisIcon className="size-3" strokeWidth={1.5} />
              <span>{visLabel}</span>
            </span>
            {post.locationName ? (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1 normal-case tracking-normal">
                  <MapPin className="size-3" strokeWidth={1.5} />
                  <span className="truncate">{post.locationName}</span>
                </span>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {/* Post-type badge — top-right outlined pill (voice, reel, etc.) */}
          {typeMeta ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border-[0.5px] border-border px-3 py-1 text-[12px] text-ink-3">
              {TypeIcon ? <TypeIcon className="size-3" strokeWidth={1.5} /> : null}
              {typeMeta.label}
            </span>
          ) : null}
          {!isMine && isAuthenticated && author?.id ? (
            <FollowButton authorId={author.id} inView={inView} />
          ) : null}
          {isMine ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-full text-muted-foreground opacity-60 transition-opacity hover:opacity-100 group-hover/post:opacity-100"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                  <Pencil className="mr-2 size-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={handleDelete}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 size-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </header>

      {isMine ? (
        <EditPostDialog
          post={post}
          open={editOpen}
          onOpenChange={setEditOpen}
          onUpdated={(updated) => onChange?.(updated)}
        />
      ) : null}

      {/* ── Body ─────────────────────────────────────────────── */}
      <div className="space-y-3 px-4 pt-4 sm:px-6">
        <PostText text={post.textContent} postType={postType} />

        {postType === 'VOICE_POST' ? (
          <AudioPlayer
            src={voiceMediaUrl}
            trackKind="voice"
            variant="feed"
          />
        ) : postType === 'REEL' ? (
          <ReelPlayer
            media={post.mediaList}
            audioTrackName={post.audioTrackName}
            postId={post.id}
          />
        ) : (
          <MediaGrid media={post.mediaList} author={author} caption={post.textContent} />
        )}

        {postType === 'EMBEDDED' && post.audioTrackUrl ? (
          <AudioPlayer
            src={resolveMediaUrl(post.audioTrackUrl)}
            title={post.audioTrackName || 'Background track'}
            subtitle="Track"
            trackKind="music"
            variant="compact"
          />
        ) : null}

        {post.sharedPost ? <QuotedPost post={post.sharedPost} /> : null}
      </div>

      {/* ── Action bar — every action is a hairline pill on the left,
           the view counter sits alone on the right.  Matches the
           "reading-room" card silhouette from the spec mock. ─── */}
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2 px-4 pb-4 pt-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Single-LIKE Instagram heart toggle. One tap likes, another
              tap unlikes; the count animates up/down on either side. */}
          <motion.button
            type="button"
            onClick={() =>
              effectiveReaction ? handleClearReaction() : handlePickReaction('LIKE')
            }
            disabled={working || reactionCooldown > 0}
            whileTap={{ scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 480, damping: 26 }}
            className={cn('rx', effectiveReaction && 'is-on')}
            aria-pressed={Boolean(effectiveReaction)}
            aria-label={
              reactionCooldown > 0
                ? `Try again in ${reactionCooldown}s`
                : effectiveReaction ? 'Unlike' : 'Like'
            }
            title={
              reactionCooldown > 0 ? `Rate limit — try again in ${reactionCooldown}s` : undefined
            }
          >
            <span className="text-[14px] leading-none">
              {effectiveReaction ? '♥' : '♡'}
            </span>
            {reactionCooldown > 0 ? (
              <span className="tabular-nums">{reactionCooldown}s</span>
            ) : reactionCount > 0 ? (
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={reactionCount}
                  initial={{ y: 6, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -6, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 460, damping: 30 }}
                  className="live-flash inline-block tabular-nums"
                >
                  {formatNumber(reactionCount)}
                </motion.span>
              </AnimatePresence>
            ) : null}
          </motion.button>

          <motion.button
            type="button"
            onClick={() => setShowComments((value) => !value)}
            whileTap={{ scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 480, damping: 26 }}
            className={cn(
              'rx',
              showComments && 'border-ink/40 bg-secondary text-ink',
            )}
            aria-label="Comments"
            aria-expanded={showComments}
          >
            <MessageCircle className="size-[14px]" strokeWidth={1.5} />
            {storedCommentCount > 0 ? (
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={storedCommentCount}
                  initial={{ y: 6, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -6, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 460, damping: 30 }}
                  className="live-flash inline-block tabular-nums"
                >
                  {formatNumber(storedCommentCount)}
                </motion.span>
              </AnimatePresence>
            ) : null}
          </motion.button>

          {storedShareCount > 0 ? (
            <span className="rx pointer-events-none">
              <Repeat2 className="size-[14px]" strokeWidth={1.5} />
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={storedShareCount}
                  initial={{ y: 5, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -5, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 460, damping: 30 }}
                  className="live-flash inline-block tabular-nums"
                >
                  {formatNumber(storedShareCount)}
                </motion.span>
              </AnimatePresence>
            </span>
          ) : null}

          <ShareMenu
            post={post}
            onShared={(updated) => onChange?.(updated)}
            onRepostCreated={onRepostCreated}
          />

          <button
            type="button"
            onClick={handleToggleSave}
            disabled={savingBookmark || saveCooldown > 0}
            className={cn(
              'rx',
              isSaved && 'border-ink/40 bg-secondary text-ink',
            )}
            aria-pressed={isSaved}
            aria-label={
              saveCooldown > 0
                ? `Try again in ${saveCooldown}s`
                : isSaved ? 'Remove bookmark' : 'Bookmark'
            }
            title={
              saveCooldown > 0
                ? `Rate limit — try again in ${saveCooldown}s`
                : isSaved ? 'Remove bookmark' : 'Save'
            }
          >
            <Bookmark
              className={cn('size-[14px]', isSaved && 'fill-current')}
              strokeWidth={1.5}
            />
            {saveCooldown > 0 ? (
              <span className="tabular-nums">{saveCooldown}s</span>
            ) : storedSaveCount > 0 ? (
              <span className="tabular-nums">{formatNumber(storedSaveCount)}</span>
            ) : null}
          </button>
        </div>

        {/* Right side — post-type label for voice/reel cards, or the
            live view counter for regular posts. Both use the same mono
            uppercase dateline style so they read as a single cohesive
            editorial annotation. */}
        {typeMeta ? (
          <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-wider text-ink-3">
            {TypeIcon ? <TypeIcon className="size-3.5" strokeWidth={1.5} /> : null}
            {typeMeta.label}
          </span>
        ) : storedViewCount > 0 ? (
          <span
            className="ml-auto inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-wider text-ink-3"
            title={`${storedViewCount.toLocaleString()} ${storedViewCount === 1 ? 'view' : 'views'}`}
          >
            <Eye className="size-3.5" strokeWidth={1.5} />
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={storedViewCount}
                initial={{ y: 4, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -4, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 460, damping: 30 }}
                className="live-flash tabular-nums"
              >
                {formatViewCount(storedViewCount)}
              </motion.span>
            </AnimatePresence>
            <span>{storedViewCount === 1 ? 'view' : 'views'}</span>
          </span>
        ) : null}
      </div>

      {/* ── Comments ─────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {showComments ? (
          <motion.div
            key="comments"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            className="overflow-hidden"
          >
            <div className="border-t-[0.5px] border-border px-4 pb-5 pt-4 sm:px-6">
              <PostComments
                ref={commentsRef}
                postId={post.id}
                postAuthorId={author?.id}
                postAuthorUsername={authorUsername}
                initialCount={commentCount}
                onCountChange={(next) => {
                  setCommentCount(next)
                  onChange?.({ ...post, commentCount: next })
                }}
              />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </article>
  )
}
