import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  Clapperboard,
  Copy,
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
import { PostComments } from '@/components/app/post-comments'
import { ReactionPicker } from '@/components/app/reaction-picker'
import { ReactionSummary } from '@/components/app/reaction-summary'
import { RoleBadge } from '@/components/app/role-badge'
import { UserAvatar } from '@/components/app/user-avatar'
import {
  copyPostShareLink,
  deletePost,
  reactToPost,
  removePostReaction,
  repostPost,
  undoRepost,
} from '@/features/posts/posts.api'
import { useInView } from '@/hooks/use-in-view'
import { usePostStream } from '@/hooks/use-post-stream'
import { useAuth } from '@/features/auth/auth-context'
import { useToast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import { extractApiMessage, friendlyApiMessage } from '@/lib/api-error'
import {
  formatNumber,
  getFullName,
  getHandle,
  getRawUsername,
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
      'bg-[color-mix(in_oklch,var(--accent-violet)_12%,transparent)] text-accent-violet',
  },
  REEL: {
    label: 'Reel',
    icon: Clapperboard,
    accent:
      'bg-[color-mix(in_oklch,var(--accent-rust)_12%,transparent)] text-accent-rust',
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
    if (isVideo) {
      // Cap a single in-feed video so it never dominates the card. Most
      // casual videos look right at ~480px tall on desktop and are still
      // tappable on mobile.
      return (
        <div className="mx-auto max-w-[480px] overflow-hidden rounded-2xl border border-border bg-black">
          <MediaItem
            item={sole}
            className="max-h-[420px] w-full object-contain sm:max-h-[480px]"
          />
        </div>
      )
    }
    return (
      <div className="overflow-hidden rounded-2xl border border-border">
        <MediaItem item={sole} className="max-h-[560px] w-full object-cover" />
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

  return (
    <div className="mx-auto w-full max-w-[320px] sm:max-w-[340px]">
      <div className="relative isolate aspect-[9/16] overflow-hidden rounded-3xl bg-black ring-1 ring-border">
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
          className="absolute inset-0 h-full w-full cursor-pointer bg-black object-cover"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/55 to-transparent"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/65 to-transparent"
        />
        <span className="pointer-events-none absolute left-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-black">
          <Clapperboard className="size-2.5" />
          Reel
        </span>
        <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5">
          {postId ? (
            <Link
              to={`/reels?id=${postId}`}
              title="Open in Reels"
              aria-label="Open in Reels"
              className="grid size-8 place-items-center rounded-full bg-black/55 text-white backdrop-blur transition-colors hover:bg-black/75"
            >
              <Maximize2 className="size-3.5" />
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            className="grid size-8 place-items-center rounded-full bg-black/55 text-white backdrop-blur transition-colors hover:bg-black/75"
            title={muted ? 'Unmute' : 'Mute'}
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
          </button>
        </div>
        {audioTrackName ? (
          <span className="pointer-events-none absolute bottom-3 left-2.5 inline-flex max-w-[calc(100%-1.25rem)] items-center gap-1.5 truncate rounded-full bg-black/55 px-2 py-0.5 text-[10.5px] font-medium text-white backdrop-blur">
            <span className="size-1.5 animate-pulse rounded-full bg-white" />
            ♪ {audioTrackName}
          </span>
        ) : null}
        <div className="pointer-events-none absolute inset-x-2.5 bottom-1.5 h-[3px] overflow-hidden rounded-full bg-white/25">
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
              <span className="grid size-14 place-items-center rounded-full bg-white/95 text-black shadow-2xl backdrop-blur">
                <Play className="size-6 translate-x-[1px] fill-black" />
              </span>
            </motion.button>
          ) : null}
        </AnimatePresence>
      </div>
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
      <p className="font-display text-pretty text-[19px] font-normal leading-[1.45] tracking-[-0.005em] text-ink sm:text-[21px]">
        <MentionText text={text} />
      </p>
    )
  }

  return (
    <div className="space-y-1">
      <p
        className={cn(
          'whitespace-pre-wrap break-words text-pretty text-ink',
          postType === 'TEXT'
            ? 'font-display text-[17px] font-normal leading-[1.5] tracking-[-0.005em]'
            : 'text-[14.5px] leading-[1.55]',
        )}
      >
        <MentionText text={display} />
      </p>
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
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/posts/${post.id}`
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
            {username ? `${username} · ` : ''}
            <RelativeTime entity={post} />
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
  const commentsRef = useRef(null)

  useEffect(() => {
    setCommentCount(post.commentCount ?? 0)
  }, [post.commentCount])

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

  usePostStream(
    post.id,
    {
      POST_UPDATED: (payload) => {
        if (!payload?.id) return
        // Preserve viewer-specific fields the broadcast payload omits.
        onChange?.({ ...post, ...payload, myReaction: post.myReaction })
      },
      POST_DELETED: () => {
        onDelete?.(post.id)
      },
      POST_REACTED: (payload) => {
        if (!payload) return
        onChange?.({
          ...post,
          reactionCount: payload.reactionCount ?? post.reactionCount,
          topReactionTypes: payload.topReactionTypes ?? post.topReactionTypes,
        })
      },
      POST_REACTION_REMOVED: (payload) => {
        if (!payload) return
        onChange?.({
          ...post,
          reactionCount: payload.reactionCount ?? post.reactionCount,
          topReactionTypes: payload.topReactionTypes ?? post.topReactionTypes,
        })
      },
      POST_SHARED: (payload) => {
        const next = payload?.shareCount ?? (post.shareCount ?? 0) + 1
        onChange?.({ ...post, shareCount: next })
      },
      POST_VIEWED: (payload) => {
        if (payload?.viewCount == null) return
        onChange?.({ ...post, viewCount: payload.viewCount })
      },
      POST_COMMENTED: (payload) => {
        const next = payload?.commentCount ?? (post.commentCount ?? 0) + 1
        onChange?.({ ...post, commentCount: next })
        commentsRef.current?.applyRealtimeEvent('POST_COMMENTED', payload)
      },
      POST_COMMENT_UPDATED: (payload) => {
        commentsRef.current?.applyRealtimeEvent('POST_COMMENT_UPDATED', payload)
      },
      POST_COMMENT_DELETED: (payload) => {
        commentsRef.current?.applyRealtimeEvent('POST_COMMENT_DELETED', payload)
        const next =
          payload?.commentCount ?? Math.max(0, (post.commentCount ?? 0) - 1)
        onChange?.({ ...post, commentCount: next })
      },
      POST_COMMENT_REACTED: (payload) => {
        commentsRef.current?.applyRealtimeEvent('POST_COMMENT_REACTED', payload)
      },
      POST_COMMENT_REACTION_REMOVED: (payload) => {
        commentsRef.current?.applyRealtimeEvent(
          'POST_COMMENT_REACTION_REMOVED',
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
      toast.error(friendlyApiMessage(error, 'Could not react.'))
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

  // Only honor real data from the backend. The summary will cap the
  // stack at `min(types.length, reactionCount)` so two reactions can
  // never render three emojis. If we don't have a breakdown, fall back
  // to the user's own reaction (if they reacted) or just the default
  // Like — no fabricated extras.
  const topReactions =
    post.topReactionTypes ?? (post.myReaction ? [post.myReaction] : ['LIKE'])

  const displayName = getFullName(author) || authorHandle || 'Unknown'

  // The expert / scholar / researcher hint paints the avatar ring in
  // a subtle accent so an authoritative voice reads at a glance — same
  // pattern the AnswerCard uses for "scholar's answer".
  const accentRing =
    author.role === 'SCHOLAR'
      ? 'ring-amber-400/45'
      : author.role === 'RESEARCHER'
        ? 'ring-violet-400/40'
        : isMine
          ? 'ring-brand/35'
          : 'ring-paper'

  return (
    <article
      ref={setLiveRef}
      className={cn(
        'group/post relative isolate overflow-hidden rounded-2xl border border-border bg-paper transition-all duration-200',
        'hover:-translate-y-px hover:border-brand/25 hover:shadow-soft',
      )}
    >
      {/* Left-edge accent rail — fades in on hover. Brand by default;
          gold when the post is from a scholar. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-3 left-0 w-[3px] rounded-full opacity-0 transition-opacity duration-200 group-hover/post:opacity-100"
        style={{
          background:
            author.role === 'SCHOLAR'
              ? 'linear-gradient(180deg, var(--gold), var(--gold-2))'
              : 'linear-gradient(180deg, var(--brand), var(--brand-muted))',
        }}
      />
      {/* ── Repost banner — when this card IS a repost ─────── */}
      {(post.isRepost || postType === 'REPOST') && post.sharedPost ? (
        <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-1.5 text-[11.5px] text-ink-3 sm:px-5">
          <Repeat2 className="size-3.5" />
          <Link
            to={`/profile/${authorRoute}`}
            className="font-semibold text-ink hover:underline"
          >
            {displayName}
          </Link>
          <span>reposted</span>
        </div>
      ) : null}

      {/* ── Header ───────────────────────────────────────────── */}
      <header className="flex items-start gap-3 px-4 pt-4 sm:px-5">
        <Link
          to={`/profile/${authorRoute}`}
          className="shrink-0 transition-transform hover:scale-[1.04]"
        >
          <UserAvatar
            user={author}
            className={cn(
              'size-11 ring-2 ring-background transition-shadow',
              accentRing,
            )}
          />
        </Link>

        <div className="min-w-0 flex-1 leading-tight">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <Link
              to={`/profile/${authorRoute}`}
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
          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-ink-3">
            {authorHandle ? (
              <span className="font-mono text-[11px]">@{authorHandle}</span>
            ) : null}
            <span aria-hidden className="text-ink-4">·</span>
            <Link
              to={`/posts/${post.id}`}
              className="transition-colors hover:text-ink hover:underline"
              title={post.formattedDate || 'Open post'}
            >
              <RelativeTime entity={post} />
            </Link>
            <span aria-hidden className="text-ink-4">·</span>
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
            postId={post.id}
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
          <p className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-1 text-xs font-medium text-ink-3">
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

      {/* ── Action bar — Threads / X style with inline counts.
           Each button gets a subtle motion-press, a colored hover halo
           that hints at the action's tone (rose for reactions, violet
           for comments, emerald for shares), and an animated count
           that pulses in/out on every SSE-driven change. ─── */}
      <div className="mx-4 mt-2.5 flex items-center gap-1 border-t border-dashed border-border px-0 py-1.5 sm:mx-5">
        <ReactionPicker
          current={post.myReaction}
          onSelect={handlePickReaction}
          onClear={handleClearReaction}
          disabled={working}
          trigger={({ toggleDefault, current }) => (
            <motion.button
              type="button"
              onClick={toggleDefault}
              whileTap={{ scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 480, damping: 26 }}
              className={cn(
                'group/like inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors duration-200',
                current
                  ? cn(
                      current.color,
                      current.bg,
                      'ring-1',
                      current.ring,
                      'hover:brightness-95',
                    )
                  : 'text-ink-3 hover:bg-rose-500/10 hover:text-rose-600',
              )}
            >
              <span
                className="text-[17px] leading-none transition-transform group-hover/like:-translate-y-0.5 group-hover/like:scale-115"
                style={{
                  filter: current
                    ? 'drop-shadow(0 1px 2px color-mix(in oklch, currentColor 30%, transparent))'
                    : undefined,
                }}
              >
                {current?.emoji ?? '👍'}
              </span>
              {(post.reactionCount ?? 0) > 0 ? (
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={post.reactionCount}
                    initial={{ y: 6, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -6, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 460, damping: 30 }}
                    className="inline-block tabular-nums"
                  >
                    {formatNumber(post.reactionCount)}
                  </motion.span>
                </AnimatePresence>
              ) : (
                <span>{current?.label ?? 'Like'}</span>
              )}
            </motion.button>
          )}
        />

        <motion.button
          type="button"
          onClick={() => setShowComments((value) => !value)}
          whileTap={{ scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 480, damping: 26 }}
          className={cn(
            'group/reply inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors',
            showComments
              ? 'bg-violet-500/12 text-violet-700 ring-1 ring-violet-500/25 dark:text-violet-300'
              : 'text-ink-3 hover:bg-violet-500/10 hover:text-violet-700 dark:hover:text-violet-300',
          )}
        >
          <MessageCircle
            className="size-[17px] transition-transform group-hover/reply:-translate-y-0.5"
            strokeWidth={1.85}
          />
          {commentCount > 0 ? (
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={commentCount}
                initial={{ y: 6, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -6, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 460, damping: 30 }}
                className="inline-block tabular-nums"
              >
                {formatNumber(commentCount)}
              </motion.span>
            </AnimatePresence>
          ) : (
            <span>Reply</span>
          )}
        </motion.button>

        <div className="ml-auto flex items-center">
          {(post.shareCount ?? 0) > 0 ? (
            <span className="hidden px-2 font-mono text-[11px] tabular-nums text-ink-3 sm:inline">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={post.shareCount}
                  initial={{ y: 5, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -5, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 460, damping: 30 }}
                  className="inline-block"
                >
                  {formatNumber(post.shareCount)}
                </motion.span>
              </AnimatePresence>
              {' '}
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
                ref={commentsRef}
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
