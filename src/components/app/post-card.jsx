import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  Clapperboard,
  Copy,
  Globe,
  Loader2,
  Lock,
  MapPin,
  MessageCircle,
  Mic,
  MoreHorizontal,
  Pencil,
  Play,
  Repeat2,
  Share2,
  Sparkles,
  Trash2,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
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
import { PostComments } from '@/components/app/post-comments'
import { ReactionPicker } from '@/components/app/reaction-picker'
import { ReactionSummary } from '@/components/app/reaction-summary'
import { RoleBadge } from '@/components/app/role-badge'
import { UserAvatar } from '@/components/app/user-avatar'
import {
  deletePost,
  reactToPost,
  removePostReaction,
  repostPost,
  undoRepost,
} from '@/features/posts/posts.api'
import { useAuth } from '@/features/auth/auth-context'
import { useToast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import { extractApiMessage } from '@/lib/api-error'
import {
  displayTime,
  formatNumber,
  getFullName,
  getUsername,
  resolveMediaUrl,
} from '@/lib/format'

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
    accent:
      'bg-[oklch(0.62_0.12_285/0.12)] text-[oklch(0.42_0.13_285)] dark:text-[oklch(0.85_0.10_285)]',
  },
  REEL: {
    label: 'Reel',
    icon: Clapperboard,
    accent:
      'bg-[oklch(0.62_0.13_38/0.12)] text-[oklch(0.45_0.13_38)] dark:text-[oklch(0.85_0.12_38)]',
  },
}

const SHORT_TEXT_LIMIT = 140
const LONG_TEXT_LIMIT = 540

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
function MediaItem({ item, className }) {
  const url = resolveMediaUrl(item.url ?? item.mediaUrl)
  if (!url) return null
  const type = (item.mediaType ?? item.type ?? '').toUpperCase()
  if (type === 'VIDEO') {
    return (
      <video
        src={url}
        controls
        playsInline
        preload="metadata"
        className={cn('h-full w-full bg-black object-contain', className)}
      />
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
    const filename = url.split('/').pop()
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className={cn(
          'flex items-center gap-3 bg-muted/60 p-4 transition-colors hover:bg-muted',
          className,
        )}
      >
        <span className="grid size-10 place-items-center rounded-xl bg-foreground/10 text-foreground">
          <Sparkles className="size-4" />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {item.altText || filename}
        </span>
      </a>
    )
  }
  return (
    <img
      src={url}
      alt={item.altText ?? ''}
      loading="lazy"
      className={cn(
        'h-full w-full object-cover transition-transform duration-700 hover:scale-[1.02]',
        className,
      )}
    />
  )
}

function MediaGrid({ media }) {
  if (!media?.length) return null
  if (media.length === 1) {
    const sole = media[0]
    const isVideo = (sole.mediaType ?? '').toUpperCase() === 'VIDEO'
    return (
      <div className="overflow-hidden rounded-2xl border border-border">
        <MediaItem
          item={sole}
          className={cn(
            'w-full',
            isVideo ? 'max-h-[640px] object-contain' : 'max-h-[640px] object-cover',
          )}
        />
      </div>
    )
  }
  const sliced = media.slice(0, 4)
  const layout = {
    2: 'grid grid-cols-2 gap-1',
    3: 'grid grid-cols-2 gap-1 [&>:first-child]:row-span-2 [&>:first-child]:aspect-auto',
    4: 'grid grid-cols-2 gap-1',
  }[sliced.length]
  return (
    <div className={cn('overflow-hidden rounded-2xl border border-border', layout)}>
      {sliced.map((item, index) => (
        <div key={item.id ?? index} className="relative aspect-square overflow-hidden bg-muted">
          <MediaItem item={item} />
          {index === 3 && media.length > 4 ? (
            <div className="absolute inset-0 grid place-items-center bg-black/45 text-white">
              <span className="text-xl font-semibold">+{media.length - 4}</span>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

// ─── Reel ───────────────────────────────────────────────────────────
function ReelPlayer({ media, audioTrackName }) {
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
    <div className="relative isolate overflow-hidden rounded-3xl bg-black">
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
        className="aspect-[9/14] w-full cursor-pointer bg-black object-contain"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/55 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/65 to-transparent"
      />
      <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-black">
        <Clapperboard className="size-2.5" />
        Reel
      </span>
      <button
        type="button"
        onClick={() => setMuted((m) => !m)}
        className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-black/55 text-white backdrop-blur transition-colors hover:bg-black/75"
        title={muted ? 'Unmute' : 'Mute'}
      >
        {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
      </button>
      {audioTrackName ? (
        <span className="pointer-events-none absolute bottom-4 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
          <span className="size-1.5 animate-pulse rounded-full bg-white" />
          ♪ {audioTrackName}
        </span>
      ) : null}
      <div className="pointer-events-none absolute inset-x-3 bottom-2 h-[3px] overflow-hidden rounded-full bg-white/25">
        <div
          className="h-full bg-white transition-[width] duration-150"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
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
    </div>
  )
}

// ─── Text body with show-more ───────────────────────────────────────
function PostText({ text, postType }) {
  const [expanded, setExpanded] = useState(false)
  if (!text) return null

  const length = text.length
  const isVeryShort = postType === 'TEXT' && length <= SHORT_TEXT_LIMIT
  const showToggle = postType === 'TEXT' && length > LONG_TEXT_LIMIT
  const display =
    showToggle && !expanded ? `${text.slice(0, LONG_TEXT_LIMIT).trimEnd()}…` : text

  if (isVeryShort) {
    return (
      <p className="text-[20px] font-medium leading-[1.35] tracking-[-0.01em] text-foreground sm:text-[22px]">
        {text}
      </p>
    )
  }

  return (
    <div className="space-y-1">
      <p
        className={cn(
          'whitespace-pre-wrap break-words text-foreground',
          postType === 'TEXT'
            ? 'text-[15px] leading-[1.6]'
            : 'text-[14.5px] leading-[1.55]',
        )}
      >
        {display}
      </p>
      {showToggle ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      ) : null}
    </div>
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

  function buildLink() {
    if (typeof window === 'undefined') return ''
    const author = normalizeAuthor(post)
    const username = getUsername(author)
    return username
      ? `${window.location.origin}/profile/${username}`
      : `${window.location.origin}/`
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(buildLink())
      toast.success('Link copied to clipboard.')
    } catch {
      toast.error('Could not copy link.')
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
      toast.error(extractApiMessage(error, 'Could not share post.'))
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
      <div className="inline-flex items-center">
        <button
          type="button"
          onClick={openDialog}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12.5px] font-semibold text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground active:scale-95 disabled:opacity-50"
          aria-label="Share post"
        >
          <Share2 className="size-[17px]" strokeWidth={1.75} />
          <span>Share</span>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="More share options"
            >
              <MoreHorizontal className="size-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
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
      </div>

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
  const username = getUsername(author)
  // Click → original author's profile. The site has no /post/:id route,
  // so linking there 404s; the profile is the canonical destination.
  const profileHref = username ? `/profile/${username}` : '/'
  return (
    <Link
      to={profileHref}
      className="block overflow-hidden rounded-2xl border border-border bg-muted/30 transition-all duration-200 hover:border-foreground/20 hover:bg-muted/60 hover:shadow-soft"
    >
      <div className="flex items-center gap-2 px-3.5 pt-3">
        <UserAvatar user={author} className="size-7" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-xs font-semibold">
            {getFullName(author) || username}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {username ? `@${username} · ` : ''}
            {displayTime(post)}
          </p>
        </div>
      </div>
      {post.textContent ? (
        <p className="line-clamp-3 px-3.5 py-2 text-sm text-foreground">
          {post.textContent}
        </p>
      ) : null}
      {post.mediaList?.length ? (
        <div className="px-2 pb-2">
          <MediaGrid media={post.mediaList.slice(0, 1)} />
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

  useEffect(() => {
    setCommentCount(post.commentCount ?? 0)
  }, [post.commentCount])

  const author = normalizeAuthor(post)
  const authorUsername = getUsername(author)
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

  async function handlePickReaction(type) {
    if (working || !isAuthenticated) {
      if (!isAuthenticated) toast.info('Sign in to react.')
      return
    }
    // Optimistic: paint the reacted state immediately. The backend
    // currently returns the post without `myReaction` populated (it
    // calls toResponse(post) instead of toResponse(post, myReaction)),
    // so we always trust our local intent over the server response.
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

  // Only honor real data from the backend. The summary will cap the
  // stack at `min(types.length, reactionCount)` so two reactions can
  // never render three emojis. If we don't have a breakdown, fall back
  // to the user's own reaction (if they reacted) or just the default
  // Like — no fabricated extras.
  const topReactions =
    post.topReactionTypes ?? (post.myReaction ? [post.myReaction] : ['LIKE'])

  const displayName = getFullName(author) || author.username

  return (
    <article
      className={cn(
        'group/post relative overflow-hidden rounded-2xl border border-border bg-card transition-all duration-200',
        'hover:border-foreground/15 hover:shadow-soft',
      )}
    >
      {/* ── Repost banner — when this card IS a repost ─────── */}
      {(post.isRepost || postType === 'REPOST') && post.sharedPost ? (
        <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-1.5 text-[11.5px] text-muted-foreground sm:px-5">
          <Repeat2 className="size-3.5" />
          <Link
            to={`/profile/${authorUsername}`}
            className="font-semibold text-foreground hover:underline"
          >
            {displayName}
          </Link>
          <span>reposted</span>
        </div>
      ) : null}

      {/* ── Header ───────────────────────────────────────────── */}
      <header className="flex items-start gap-3 px-4 pt-4 sm:px-5">
        <Link
          to={`/profile/${authorUsername}`}
          className="shrink-0 transition-transform hover:scale-105"
        >
          <UserAvatar
            user={author}
            className="size-10 ring-2 ring-background"
          />
        </Link>

        <div className="min-w-0 flex-1 leading-tight">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <Link
              to={`/profile/${authorUsername}`}
              className="truncate text-[14.5px] font-semibold tracking-tight hover:underline"
            >
              {displayName}
            </Link>
            {author.role ? <RoleBadge role={author.role} size="xs" /> : null}
            {typeMeta ? (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                  typeMeta.accent,
                )}
              >
                {TypeIcon ? <TypeIcon className="size-3" /> : null}
                {typeMeta.label}
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            {authorUsername ? <span>@{authorUsername}</span> : null}
            <span aria-hidden>·</span>
            <span title={post.formattedDate || ''}>{displayTime(post)}</span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1" title={visLabel}>
              <VisIcon className="size-3" />
            </span>
          </div>
        </div>

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
      <div className="space-y-3 px-4 pt-3 sm:px-5">
        <PostText text={post.textContent} postType={postType} />

        {postType === 'VOICE_POST' ? (
          <AudioPlayer
            src={voiceMediaUrl}
            title={post.audioTrackName || 'Voice note'}
            subtitle="Voice"
            trackKind="voice"
            variant="rich"
            showDownload
          />
        ) : postType === 'REEL' ? (
          <ReelPlayer
            media={post.mediaList}
            audioTrackName={post.audioTrackName}
          />
        ) : (
          <MediaGrid media={post.mediaList} />
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

        {post.locationName ? (
          <p className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-1 text-xs font-medium text-muted-foreground">
            <MapPin className="size-3" />
            {post.locationName}
          </p>
        ) : null}
      </div>

      {/* ── Top reaction summary (only when there are reactions) ── */}
      {(post.reactionCount ?? 0) > 0 ? (
        <div className="mt-3 px-4 sm:px-5">
          <ReactionSummary totalCount={post.reactionCount} topTypes={topReactions} />
        </div>
      ) : null}

      {/* ── Action bar — Threads / X style with inline counts ─── */}
      <div className="mt-2 flex items-center gap-1 border-t border-border px-2 py-1.5 sm:px-3">
        <ReactionPicker
          current={post.myReaction}
          onSelect={handlePickReaction}
          onClear={handleClearReaction}
          disabled={working}
          trigger={({ toggleDefault, current }) => (
            <button
              type="button"
              onClick={toggleDefault}
              className={cn(
                'group/like inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12.5px] font-semibold transition-all duration-200 active:scale-95',
                current
                  ? cn(
                      current.color,
                      current.bg,
                      'ring-1',
                      current.ring,
                      'hover:brightness-95',
                    )
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <span className="text-[17px] leading-none transition-transform group-hover/like:scale-110">
                {current?.emoji ?? '👍'}
              </span>
              {(post.reactionCount ?? 0) > 0 ? (
                <span className="tabular-nums">{formatNumber(post.reactionCount)}</span>
              ) : (
                <span>{current?.label ?? 'Like'}</span>
              )}
            </button>
          )}
        />

        <button
          type="button"
          onClick={() => setShowComments((value) => !value)}
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <MessageCircle className="size-[17px]" strokeWidth={1.75} />
          {commentCount > 0 ? (
            <span className="tabular-nums">{formatNumber(commentCount)}</span>
          ) : (
            <span>Reply</span>
          )}
        </button>

        <div className="ml-auto flex items-center">
          {(post.shareCount ?? 0) > 0 ? (
            <span className="hidden px-2 text-[11px] text-muted-foreground tabular-nums sm:inline">
              {formatNumber(post.shareCount)}{' '}
              {post.shareCount === 1 ? 'share' : 'shares'}
            </span>
          ) : null}
          <ShareMenu
            post={post}
            onShared={(updated) => onChange?.(updated)}
            onRepostCreated={onRepostCreated}
          />
        </div>
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
            <div className="border-t border-border px-4 pb-4 pt-3 sm:px-5">
              <PostComments
                postId={post.id}
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
