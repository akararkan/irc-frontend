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
  Heart,
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
import { SaveCollectionSheet } from '@/components/app/save-collection-sheet'
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
import { followUser, getSocialStatus, unfollowUser } from '@/features/social/social.api'
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
import { bumpCounter, setCounter, useCounter } from '@/lib/counter-store'
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
  VOICE_POST: { label: 'Voice', icon: Mic },
  REEL: { label: 'Reel', icon: Clapperboard },
}

const SHORT_TEXT_LIMIT = 140
const LONG_TEXT_LIMIT = 540

/* Per-author social-status cache — shared across every card. */
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

function formatViewCount(value) {
  const num = Number(value ?? 0)
  if (Number.isNaN(num)) return '0'
  if (num < 1000) return String(num)
  return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
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

// Tiny markdown-flavoured block parser — splits the text into
// paragraph and blockquote runs (lines starting with `> `).
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

/* ── Action button — used for like / comment / share / save ── */
function ActionButton({
  icon: Icon,
  filled,
  count,
  label,
  onClick,
  disabled,
  tone = 'neutral',
  active,
  className,
}) {
  const activeColor = tone === 'rose' ? 'text-neg' : 'text-fg'
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.93 }}
      transition={{ type: 'spring', stiffness: 500, damping: 28 }}
      aria-label={label}
      className={cn(
        'inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-[12.5px] font-medium tabular-nums transition-colors disabled:opacity-40',
        active ? activeColor : 'text-fg-muted hover:bg-bg-soft hover:text-fg',
        className,
      )}
    >
      {Icon ? (
        <Icon className={cn('size-[15px]', filled && 'fill-current')} strokeWidth={1.8} />
      ) : null}
      {count != null ? (
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={count}
            initial={{ y: 5, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -5, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 460, damping: 30 }}
            className="inline-block tabular-nums"
          >
            {count}
          </motion.span>
        </AnimatePresence>
      ) : null}
    </motion.button>
  )
}

/* ── Media ───────────────────────────────────────────────────── */
function MediaItem({ item, className, onOpen }) {
  const url = resolveMediaUrl(item.url ?? item.mediaUrl)
  if (!url) return null
  const type = (item.mediaType ?? item.type ?? '').toUpperCase()
  if (type === 'VIDEO') {
    return (
      <div
        role={onOpen ? 'button' : undefined}
        onClick={(e) => {
          if (!onOpen) return
          if (e.target && e.target.tagName === 'VIDEO') {
            const v = e.target
            const rect = v.getBoundingClientRect()
            const bottomZone = e.clientY > rect.bottom - 48
            if (bottomZone) return
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
      <div className={cn('flex items-center bg-bg-soft p-3', className)}>
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
          'group flex items-center gap-3.5 rounded-md border border-line bg-bg-soft px-3.5 py-3 transition-colors hover:bg-bg-soft',
          className,
        )}
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-md border border-line bg-background text-fg-soft">
          <FileText className="size-5" strokeWidth={1.5} />
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[14.5px] font-medium text-ink">
            {filename}
          </span>
          <span className="mt-1 block font-mono text-[10.5px] uppercase tracking-wider text-fg-muted">
            {ext ? `${ext} document` : 'document'}
            {sizeLabel ? ` · ${sizeLabel}` : ''}
          </span>
        </span>
        <ArrowUpRight
          className="size-4 shrink-0 text-fg-muted transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink"
          strokeWidth={1.6}
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

  const viewable = media.filter((m) => {
    const t = (m?.mediaType ?? m?.type ?? '').toUpperCase()
    return t === 'IMAGE' || t === 'VIDEO' || t === ''
  })

  function openLightboxAt(index) {
    setLightboxIndex(index)
    setLightboxOpen(true)
  }

  const lightbox =
    viewable.length > 0 ? (
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
          <div className="mx-auto max-w-[480px] overflow-hidden rounded-md border border-line bg-black">
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
        <div className="overflow-hidden rounded-md border border-line">
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
      <div className={cn('overflow-hidden rounded-md border border-line', layout)}>
        {sliced.map((item, index) => (
          <div
            key={item.id ?? index}
            className="relative aspect-square cursor-zoom-in overflow-hidden bg-bg-soft"
          >
            <MediaItem item={item} onOpen={() => openLightboxAt(index)} />
            {index === 3 && media.length > 4 ? (
              <div
                className="absolute inset-0 grid cursor-zoom-in place-items-center bg-black/55 text-white transition-colors hover:bg-black/65"
                onClick={() => openLightboxAt(3)}
              >
                <span className="font-display text-2xl font-semibold">
                  +{media.length - 4}
                </span>
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {lightbox}
    </>
  )
}

/* ── Reel preview ────────────────────────────────────────────── */
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

  return (
    <div className="mx-auto w-full max-w-[260px] sm:max-w-[280px]">
      <div
        className="relative isolate aspect-[9/16] overflow-hidden rounded-xl border border-white/10"
        style={{ background: 'linear-gradient(170deg, #1A1F2E 0%, #0B0E16 100%)' }}
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

        {/* Top — progress + mute */}
        <div className="absolute inset-x-3 top-3 flex items-start gap-3">
          <div className="flex flex-1 items-center gap-[3px]">
            {[0, 1, 2, 3, 4].map((i) => {
              const seg = Math.max(0, Math.min(1, progress * 5 - i))
              return (
                <span
                  key={i}
                  className="h-[2px] flex-1 overflow-hidden rounded-full bg-white/30"
                >
                  <span className="block h-full bg-background" style={{ width: `${seg * 100}%` }} />
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

        {/* Right rail */}
        <div className="absolute bottom-16 right-2 flex flex-col items-center gap-3 text-white">
          {postId ? (
            <Link
              to={`/reels?id=${postId}`}
              title="Open in Reels"
              className="grid size-9 place-items-center rounded-full border border-white/15 bg-white/[0.13] backdrop-blur transition-colors hover:bg-white/25"
              aria-label="Open in Reels"
            >
              <Maximize2 className="size-3.5" strokeWidth={1.7} />
            </Link>
          ) : null}
        </div>

        {/* Audio chip */}
        {audioTrackName ? (
          <div className="absolute inset-x-3 bottom-3">
            <span className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full bg-black/40 px-2 py-1 text-[10.5px] font-medium text-white backdrop-blur">
              <span className="size-1.5 animate-pulse rounded-full bg-brand" />
              ♪ {audioTrackName}
            </span>
          </div>
        ) : null}

        {/* Play overlay */}
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
              <span className="grid size-14 place-items-center rounded-full border border-white/25 bg-white/15 text-white backdrop-blur">
                <Play className="size-5 translate-x-[1px] fill-white" strokeWidth={0} />
              </span>
            </motion.button>
          ) : null}
        </AnimatePresence>

        {/* Reel pill */}
        <span className="absolute right-3 top-9 inline-flex items-center gap-1.5 rounded-full bg-[#0A4A3C] px-2 py-0.5 font-mono text-[9.5px] font-medium uppercase tracking-wider text-white">
          <Clapperboard className="size-2.5" strokeWidth={1.6} />
          Reel
        </span>
      </div>
    </div>
  )
}

/* ── Text body ───────────────────────────────────────────────── */
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
  const isVeryShort = postType === 'TEXT' && length <= SHORT_TEXT_LIMIT && !hasQuote

  if (isVeryShort) {
    return (
      <p
        dir="auto"
        className="text-pretty text-[17px] leading-[1.5] text-ink"
      >
        <MentionText text={text} />
      </p>
    )
  }

  const paragraphClass = cn(
    'whitespace-pre-wrap break-words text-pretty text-ink',
    postType === 'TEXT' ? 'text-[15px] leading-[1.6]' : 'text-[14.5px] leading-[1.6]',
  )

  return (
    <div className="space-y-3">
      {displayBlocks.map((block, index) =>
        block.type === 'quote' ? (
          <blockquote
            key={index}
            dir="auto"
            className="border-l-2 border-line-strong pl-4 text-[14.5px] italic leading-[1.55] text-fg-soft"
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
          className="text-[12.5px] font-medium text-fg-muted transition-colors hover:text-fg hover:underline"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      ) : null}
    </div>
  )
}

/* ── Follow button ───────────────────────────────────────────── */
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
      .catch(() => {})
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
      writeFollowCache(authorId, { isFollowing: previous, fetchedAt: Date.now() })
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
        'inline-flex h-8 shrink-0 items-center gap-1 rounded-md border px-3 text-[12px] font-medium transition-colors',
        isFollowing
          ? 'border-line bg-bg-soft text-fg-muted hover:text-fg'
          : 'border-fg bg-fg text-background hover:bg-fg-soft',
        (!known || busy) && 'opacity-70',
      )}
    >
      {isFollowing ? (
        <>
          <Check className="size-3.5" strokeWidth={2.2} />
          Following
        </>
      ) : (
        <>
          <Plus className="size-3.5" strokeWidth={2.2} />
          Follow
        </>
      )}
    </button>
  )
}

/* ── Share menu ──────────────────────────────────────────────── */
function ShareMenu({ post, onShared, onRepostCreated }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [note, setNote] = useState('')

  const author = normalizeAuthor(post)
  const previewName = getFullName(author) || getHandle(author) || 'Unknown'

  function fallbackLink() {
    return `${FRONTEND_URL}/posts/${post.id}`
  }

  async function handleCopy() {
    if (busy) return
    setBusy(true)
    let optimistic = fallbackLink()
    try {
      await navigator.clipboard.writeText(optimistic)
    } catch {
      /* retry below */
    }
    try {
      const data = await copyPostShareLink(post.id)
      const url = data?.shortUrl ?? data?.canonicalUrl ?? optimistic
      try {
        await navigator.clipboard.writeText(url)
      } catch {
        /* optimistic copy already valid */
      }
      const fresh = data?.shareCount
      onShared?.({ ...post, shareCount: fresh ?? (post.shareCount ?? 0) + 1 })
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
      onShared?.({ ...post, shareCount: (post.shareCount ?? 0) + 1 })
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
      onShared?.({ ...post, shareCount: Math.max(0, (post.shareCount ?? 0) - 1) })
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
            aria-label="Share post"
            className="inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-[12.5px] font-medium text-fg-muted transition-colors hover:bg-bg-soft hover:text-fg disabled:opacity-40"
          >
            <Share2 className="size-[15px]" strokeWidth={1.8} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44 rounded-md border-line shadow-sm">
          <DropdownMenuItem onSelect={openDialog} disabled={busy}>
            <Repeat2 className="mr-2 size-4" />
            Share post
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={handleUndoShare}
            disabled={busy}
            className="text-ink-3"
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
        <DialogContent className="max-w-md rounded-lg border-line">
          <DialogHeader>
            <DialogTitle className="text-[15px] font-semibold tracking-[-0.01em]">
              Share post
            </DialogTitle>
            <DialogDescription className="text-[12.5px]">
              Add a note — it appears above the original.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value.slice(0, 500))}
              placeholder="Say something about this post…"
              rows={3}
              autoFocus
              className="resize-none rounded-md border-line"
            />
            <p className="text-right font-mono text-[11px] tabular-nums text-fg-faint">
              {note.length} / 500
            </p>
            <div className="flex items-start gap-2.5 rounded-md border border-line bg-bg-soft p-3">
              <UserAvatar user={author} className="size-7 shrink-0 rounded-full" />
              <div className="min-w-0 leading-tight">
                <p className="truncate text-[12.5px] font-medium text-fg">
                  {previewName}
                </p>
                {post.textContent ? (
                  <p className="mt-0.5 line-clamp-2 text-[12px] text-fg-muted">
                    {post.textContent}
                  </p>
                ) : (
                  <p className="mt-0.5 text-[12px] italic text-fg-faint">Media post</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              disabled={busy}
              className="rounded-lg"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleShare}
              disabled={busy}
              className="rounded-md bg-fg text-background hover:bg-fg-soft"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />}
              {busy ? 'Sharing…' : 'Share post'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/* ── Quoted (shared) post ────────────────────────────────────── */
function QuotedPost({ post }) {
  const author = normalizeAuthor(post)
  const handle = getHandle(author)
  const route = getRawUsername(author)
  const profileHref = route ? `/profile/${route}` : '/'
  return (
    <Link
      to={profileHref}
      className="block overflow-hidden rounded-md border border-line bg-bg-soft transition-colors hover:border-line-strong"
    >
      <div className="flex items-center gap-2 px-3.5 pt-3">
        <UserAvatar user={author} className="size-7 rounded-full" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[12.5px] font-medium text-ink">
            {getFullName(author) || handle}
          </p>
          <p className="truncate text-[11px] text-fg-muted">
            {handle ? `@${handle} · ` : ''}
            <RelativeTime entity={post} />
          </p>
        </div>
      </div>
      {post.textContent ? (
        <p dir="auto" className="line-clamp-3 px-3.5 py-2 text-[13.5px] text-fg-soft">
          {post.textContent}
        </p>
      ) : null}
      {post.mediaList?.length ? (
        <div className="px-2 pb-2">
          <MediaGrid
            media={post.mediaList.slice(0, 1)}
            author={author}
            caption={post.textContent}
          />
        </div>
      ) : null}
    </Link>
  )
}

/* ─── PostCard ───────────────────────────────────────────────── */
export function PostCard({
  post,
  onChange,
  onDelete,
  onRepostCreated,
  defaultCommentsOpen = false,
}) {
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

  useEffect(() => {
    seedFromResponse('post', post, { authoritative: false })
  }, [post])

  const [setLiveRef, inView] = useInView({ rootMargin: '300px 0px 300px 0px' })

  const articleRef = useRef(null)
  const composedRef = useCallback(
    (node) => {
      articleRef.current = node
      setLiveRef(node)
    },
    [setLiveRef],
  )

  useEffect(() => {
    if (inView) return
    const root = articleRef.current
    if (!root) return
    root.querySelectorAll('video, audio').forEach((media) => {
      if (!media.paused) {
        try {
          media.pause()
        } catch {
          /* non-fatal */
        }
      }
    })
  }, [inView])

  const postStream = usePostStream(
    post.id,
    {
      POST_UPDATED: (payload) => {
        if (!payload?.id) return
        onChange?.({ ...post, ...payload, myReaction: post.myReaction })
        if (payload.reactionCount != null) setCounter('post', post.id, 'rx', payload.reactionCount)
        if (payload.commentCount != null) setCounter('post', post.id, 'cm', payload.commentCount)
        if (payload.shareCount != null) setCounter('post', post.id, 'sh', payload.shareCount)
        if (payload.viewCount != null) setCounter('post', post.id, 'vw', payload.viewCount)
        if (payload.saveCount != null) setCounter('post', post.id, 'sv', payload.saveCount)
      },
      POST_DELETED: () => {
        onDelete?.(post.id)
      },
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
        commentsRef.current?.applyRealtimeEvent('COMMENT_REACTION_REMOVED', payload)
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

  const cachedReaction = useCachedReaction('post', post.id)
  const storeSaysReacted = useDidIReact('post', post.id, false)
  const effectiveReaction =
    post.myReaction ?? (storeSaysReacted ? 'LIKE' : null) ?? cachedReaction

  const reactionCount = useCounter('post', post.id, 'rx', post.reactionCount ?? 0)
  const storedShareCount = useCounter('post', post.id, 'sh', post.shareCount ?? 0)
  const storedSaveCount = useCounter('post', post.id, 'sv', post.saveCount ?? 0)
  const storedCommentCount = useCounter('post', post.id, 'cm', commentCount)
  const storedViewCount = useCounter('post', post.id, 'vw', post.viewCount ?? 0)
  const reactionCooldown = useCooldown('reaction')
  const saveCooldown = useCooldown('social')

  async function handlePickReaction(type) {
    if (working || !isAuthenticated) {
      if (!isAuthenticated) toast.info('Sign in to react.')
      return
    }
    const previous = post
    const wasReacting = Boolean(effectiveReaction)
    onChange?.({ ...post, myReaction: type })
    rememberReaction('post', post.id, type)
    setReacted('post', post.id, true, type)
    if (!wasReacting) bumpCounter('post', post.id, 'rx', reactionCount, +1)
    setWorking(true)
    try {
      const updated = await reactToPost(post.id, type)
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

  const [savingBookmark, setSavingBookmark] = useState(false)
  const [saveSheetOpen, setSaveSheetOpen] = useState(false)
  const storeSaysSaved = useDidISave('post', post.id, false)
  const isSaved = post.isSaved ?? storeSaysSaved

  async function executeSave(collection) {
    if (savingBookmark) return
    const previous = post
    const previousSaved = isSaved
    const previousSaveCount = storedSaveCount
    onChange?.({ ...post, isSaved: !isSaved })
    setSaved('post', post.id, !isSaved)
    bumpCounter('post', post.id, 'sv', storedSaveCount, isSaved ? -1 : +1)
    setSavingBookmark(true)
    try {
      const updated = isSaved ? await unsavePost(post.id) : await savePost(post.id, null, collection)
      if (updated?.id) {
        onChange?.(updated)
        if (updated.saveCount != null) setCounter('post', post.id, 'sv', updated.saveCount)
        if (updated.isSaved != null)   setSaved('post', post.id, Boolean(updated.isSaved))
      }
      if (!isSaved) toast.success(collection && collection !== 'Default' ? `Saved to "${collection}".` : 'Saved to your library.')
    } catch (error) {
      onChange?.(previous)
      setSaved('post', post.id, previousSaved)
      setCounter('post', post.id, 'sv', previousSaveCount)
      toast.error(extractApiMessage(error, 'Could not update bookmark.'))
    } finally {
      setSavingBookmark(false)
    }
  }

  async function handleToggleSave() {
    if (savingBookmark) return
    if (!isAuthenticated) {
      toast.info('Sign in to save this post.')
      return
    }
    if (!isSaved) {
      // Open collection picker on first save
      setSaveSheetOpen(true)
      return
    }
    await executeSave()
  }

  const displayName = getFullName(author) || authorHandle || 'Unknown'

  return (
    <article
      ref={composedRef}
      className="group/post overflow-hidden rounded-lg border border-line bg-background transition-colors"
    >
      {/* ── Repost banner ─────────────────────────────────── */}
      {(post.isRepost || postType === 'REPOST') && post.sharedPost ? (
        <div className="flex items-center gap-1.5 px-5 pb-1.5 pt-3.5 text-[12px] text-fg-muted">
          <Repeat2 className="size-[14px] text-fg-muted" strokeWidth={1.8} />
          <Link
            to={`/profile/${authorRoute}`}
            className="font-medium text-fg-soft hover:underline"
          >
            {displayName}
          </Link>
          <span>reposted</span>
        </div>
      ) : null}

      {/* ── Header ────────────────────────────────────────── */}
      <header className="flex items-start gap-3 px-5 pt-4">
        <Link
          to={`/profile/${authorRoute}`}
          className="shrink-0 transition-opacity hover:opacity-90"
        >
          <UserAvatar user={author} className="size-9 rounded-full" />
        </Link>

        <div className="min-w-0 flex-1 leading-tight">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link
              to={`/profile/${authorRoute}`}
              className="truncate text-[13.5px] font-semibold text-fg hover:underline"
            >
              {displayName}
            </Link>
            {author.role ? <RoleBadge role={author.role} size="sm" /> : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-mono text-[10.5px] text-fg-muted">
            {authorHandle ? (
              <Link
                to={`/profile/${authorRoute}`}
                className="transition-colors hover:text-ink"
              >
                @{authorHandle}
              </Link>
            ) : null}
            {authorHandle ? <span aria-hidden>·</span> : null}
            <Link
              to={`/posts/${post.id}`}
              className="inline-flex items-center transition-colors hover:text-ink"
              title={
                postStream?.isConnected
                  ? `${post.formattedDate || 'Open post'} · live updates connected`
                  : post.formattedDate || 'Open post'
              }
            >
              <RelativeTime entity={post} />
              <span
                aria-hidden
                className={cn(
                  'ml-1.5 inline-block size-1 rounded-full align-middle transition-colors',
                  postStream?.isConnected
                    ? 'animate-pulse bg-emerald-500'
                    : 'bg-ink-4/60',
                )}
              />
            </Link>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1" title={visLabel}>
              <VisIcon className="size-3" strokeWidth={1.6} />
              <span>{visLabel}</span>
            </span>
            {post.locationName ? (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3" strokeWidth={1.6} />
                  <span className="truncate">{post.locationName}</span>
                </span>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {typeMeta ? (
            <span
              className="inline-flex items-center gap-1 rounded-[4px] border border-line bg-bg-soft px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.04em] text-fg-muted"
            >
              {TypeIcon ? <TypeIcon className="size-3" strokeWidth={1.8} /> : null}
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
                  className="rounded-md text-fg-muted opacity-60 transition-opacity hover:opacity-100 group-hover/post:opacity-100"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl">
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

      {/* ── Body ──────────────────────────────────────────── */}
      <div className="space-y-3 px-5 pt-3">
        <PostText text={post.textContent} postType={postType} />

        {postType === 'VOICE_POST' ? (
          <AudioPlayer src={voiceMediaUrl} trackKind="voice" variant="feed" />
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

      {/* ── Action bar ────────────────────────────────────── */}
      <div className="mt-3 flex items-center gap-0.5 border-t border-line px-3 py-2">
        <ActionButton
          icon={Heart}
          filled={Boolean(effectiveReaction)}
          active={Boolean(effectiveReaction)}
          tone="rose"
          count={
            reactionCooldown > 0
              ? `${reactionCooldown}s`
              : reactionCount > 0
                ? formatNumber(reactionCount)
                : null
          }
          label={
            reactionCooldown > 0
              ? `Try again in ${reactionCooldown}s`
              : effectiveReaction
                ? 'Unlike'
                : 'Like'
          }
          disabled={working || reactionCooldown > 0}
          onClick={() =>
            effectiveReaction ? handleClearReaction() : handlePickReaction('LIKE')
          }
        />

        <ActionButton
          icon={MessageCircle}
          active={showComments}
          tone="blue"
          count={storedCommentCount > 0 ? formatNumber(storedCommentCount) : null}
          label="Comments"
          onClick={() => setShowComments((value) => !value)}
        />

        {storedShareCount > 0 ? (
          <span className="inline-flex h-8 items-center gap-1 px-2.5 text-[12.5px] font-medium text-fg-muted">
            <Repeat2 className="size-[15px]" strokeWidth={1.8} />
            <span className="tabular-nums">{formatNumber(storedShareCount)}</span>
          </span>
        ) : null}

        <ShareMenu
          post={post}
          onShared={(updated) => onChange?.(updated)}
          onRepostCreated={onRepostCreated}
        />

        <ActionButton
          icon={Bookmark}
          filled={isSaved}
          active={isSaved}
          tone="blue"
          count={
            saveCooldown > 0
              ? `${saveCooldown}s`
              : storedSaveCount > 0
                ? formatNumber(storedSaveCount)
                : null
          }
          label={
            saveCooldown > 0
              ? `Try again in ${saveCooldown}s`
              : isSaved
                ? 'Remove bookmark'
                : 'Bookmark'
          }
          disabled={savingBookmark || saveCooldown > 0}
          onClick={handleToggleSave}
        />

        {storedViewCount > 0 ? (
          <span
            className="ml-auto inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.04em] text-fg-faint"
            title={`${storedViewCount.toLocaleString()} ${storedViewCount === 1 ? 'view' : 'views'}`}
          >
            <Eye className="size-3.5" strokeWidth={1.6} />
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={storedViewCount}
                initial={{ y: 4, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -4, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 460, damping: 30 }}
                className="tabular-nums"
              >
                {formatViewCount(storedViewCount)}
              </motion.span>
            </AnimatePresence>
            <span>{storedViewCount === 1 ? 'view' : 'views'}</span>
          </span>
        ) : null}
      </div>

      {/* ── Comments ──────────────────────────────────────── */}
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
            <div className="border-t border-line bg-bg-soft px-5 pb-5 pt-4">
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

      <SaveCollectionSheet
        open={saveSheetOpen}
        onOpenChange={setSaveSheetOpen}
        onSave={(collection) => executeSave(collection)}
      />
    </article>
  )
}
