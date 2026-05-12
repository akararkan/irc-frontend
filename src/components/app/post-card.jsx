import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  Bookmark,
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
  if (!text) return null

  const length = text.length
  const isVeryShort = postType === 'TEXT' && length <= SHORT_TEXT_LIMIT
  const showToggle = postType === 'TEXT' && length > LONG_TEXT_LIMIT
  const display =
    showToggle && !expanded ? `${text.slice(0, LONG_TEXT_LIMIT).trimEnd()}…` : text

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

  return (
    <div className="space-y-1">
      <p
        dir="auto"
        className={cn(
          'whitespace-pre-wrap break-words text-pretty text-ink',
          postType === 'TEXT'
            ? 'font-display text-[17px] font-normal leading-[1.55] tracking-[-0.005em]'
            : 'text-[15px] leading-[1.65]',
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={busy}
            className="rx-bare disabled:opacity-50"
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
      // Single-LIKE reactions — backend emits postReactionCount and the
      // actor; we just sync the counter.
      REACTION_ADDED: (payload) => {
        if (!payload) return
        onChange?.({
          ...post,
          reactionCount: payload.postReactionCount ?? post.reactionCount,
        })
      },
      REACTION_REMOVED: (payload) => {
        if (!payload) return
        onChange?.({
          ...post,
          reactionCount: payload.postReactionCount ?? post.reactionCount,
        })
      },
      SHARE_COUNT_UPDATED: (payload) => {
        const next = payload?.postShareCount ?? (post.shareCount ?? 0) + 1
        onChange?.({ ...post, shareCount: next })
      },
      SAVE_COUNT_UPDATED: (payload) => {
        if (payload?.postSaveCount == null) return
        onChange?.({ ...post, saveCount: payload.postSaveCount })
      },
      VIEW_COUNT_UPDATED: (payload) => {
        if (payload?.postViewCount == null) return
        onChange?.({ ...post, viewCount: payload.postViewCount })
      },
      COMMENT_CREATED: (payload) => {
        const next = payload?.postCommentCount ?? (post.commentCount ?? 0) + 1
        onChange?.({ ...post, commentCount: next })
        commentsRef.current?.applyRealtimeEvent('COMMENT_CREATED', payload)
      },
      COMMENT_EDITED: (payload) => {
        commentsRef.current?.applyRealtimeEvent('COMMENT_EDITED', payload)
      },
      COMMENT_DELETED: (payload) => {
        commentsRef.current?.applyRealtimeEvent('COMMENT_DELETED', payload)
        const next =
          payload?.postCommentCount ?? Math.max(0, (post.commentCount ?? 0) - 1)
        onChange?.({ ...post, commentCount: next })
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

  async function handlePickReaction(type) {
    if (working || !isAuthenticated) {
      if (!isAuthenticated) toast.info('Sign in to react.')
      return
    }
    // Optimistic: paint the reacted state immediately.
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
      // Fire-and-forget on success — we don't merge the response.
      // PostResponse's `reactionCount` reads through the Hibernate
      // L1 cache and lags the increment by one, so spreading it back
      // over our optimistic +1 produces a 0→1→0→1 flicker. The
      // REACTION_ADDED SSE event arrives a tick later with the
      // authoritative count and reconciles cleanly.
      await reactToPost(post.id, type)
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

  // Instagram-style bookmark — wired to /api/v1/posts/{id}/save. The
  // optimistic flip lands first; the SSE SAVE_COUNT_UPDATED echo
  // reconciles the count once the backend commits.
  const [savingBookmark, setSavingBookmark] = useState(false)
  const isSaved = Boolean(post.isSaved)

  async function handleToggleSave() {
    if (savingBookmark) return
    if (!isAuthenticated) {
      toast.info('Sign in to save this post.')
      return
    }
    const previous = post
    onChange?.({
      ...post,
      isSaved: !isSaved,
      saveCount: isSaved
        ? Math.max(0, (post.saveCount ?? 0) - 1)
        : (post.saveCount ?? 0) + 1,
    })
    setSavingBookmark(true)
    try {
      if (isSaved) {
        await unsavePost(post.id)
      } else {
        await savePost(post.id)
        toast.success('Saved to your library.')
      }
    } catch (error) {
      onChange?.(previous)
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
        'group/post card-hover relative isolate overflow-hidden rounded-xl border-[0.5px] border-border bg-paper',
      )}
    >
      {/* ── Repost banner — when this card IS a repost ─────── */}
      {(post.isRepost || postType === 'REPOST') && post.sharedPost ? (
        <div className="flex items-center gap-2 border-b border-border bg-secondary px-4 py-2 text-[12px] text-ink-3 sm:px-6">
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
      <header className="flex items-start gap-3 px-4 pt-4 sm:px-6 sm:pt-5">
        <Link
          to={`/profile/${authorRoute}`}
          className="shrink-0 transition-opacity hover:opacity-90"
        >
          <UserAvatar user={author} className="size-10" />
        </Link>

        <div className="min-w-0 flex-1 leading-tight">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <Link
              to={`/profile/${authorRoute}`}
              className="truncate text-[14px] font-medium tracking-tight text-ink hover:underline"
            >
              {displayName}
            </Link>
            {authorHandle ? (
              <span className="text-[13px] text-ink-3">@{authorHandle}</span>
            ) : null}
            {author.role ? <RoleBadge role={author.role} size="xs" /> : null}
            {typeMeta ? (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider',
                  typeMeta.accent,
                )}
              >
                {TypeIcon ? <TypeIcon className="size-3" strokeWidth={1.5} /> : null}
                {typeMeta.label}
              </span>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[12px] text-ink-3">
            <Link
              to={`/posts/${post.id}`}
              className="transition-colors hover:text-ink"
              title={post.formattedDate || 'Open post'}
            >
              <RelativeTime entity={post} />
            </Link>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1" title={visLabel}>
              <VisIcon className="size-3" strokeWidth={1.5} />
              <span>{visLabel}</span>
            </span>
            {post.locationName ? (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3" strokeWidth={1.5} />
                  <span className="truncate">{post.locationName}</span>
                </span>
              </>
            ) : null}
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
      <div className="space-y-3 px-4 pt-3 sm:px-6">
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
      </div>

      {/* ── Action bar — pill reactions on the left, ghost icon
           counters on the right. Matches the design spec card. ─── */}
      <div className="mx-4 mt-4 flex flex-wrap items-center gap-1.5 border-t-[0.5px] border-border px-0 py-2.5 sm:mx-6">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Single-LIKE Instagram heart toggle. One tap likes, another
              tap unlikes; the count animates up/down on either side. */}
          <motion.button
            type="button"
            onClick={() =>
              post.myReaction ? handleClearReaction() : handlePickReaction('LIKE')
            }
            disabled={working}
            whileTap={{ scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 480, damping: 26 }}
            className={cn('rx', post.myReaction && 'is-on')}
            aria-pressed={Boolean(post.myReaction)}
            aria-label={post.myReaction ? 'Unlike' : 'Like'}
          >
            <span className="text-[14px] leading-none">
              {post.myReaction ? '♥' : '♡'}
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
              <span>Like</span>
            )}
          </motion.button>
        </div>

        <div className="ml-auto flex items-center gap-0.5">
          <motion.button
            type="button"
            onClick={() => setShowComments((value) => !value)}
            whileTap={{ scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 480, damping: 26 }}
            className={cn('rx-bare', showComments && 'is-on')}
            aria-label="Comments"
          >
            <MessageCircle className="size-[14px]" strokeWidth={1.5} />
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
            ) : null}
          </motion.button>

          {(post.shareCount ?? 0) > 0 ? (
            <span className="rx-bare pointer-events-none">
              <Repeat2 className="size-[14px]" strokeWidth={1.5} />
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={post.shareCount}
                  initial={{ y: 5, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -5, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 460, damping: 30 }}
                  className="inline-block tabular-nums"
                >
                  {formatNumber(post.shareCount)}
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
            disabled={savingBookmark}
            className={cn('rx-bare', isSaved && 'is-on')}
            aria-pressed={isSaved}
            aria-label={isSaved ? 'Remove bookmark' : 'Bookmark'}
            title={isSaved ? 'Remove bookmark' : 'Save'}
          >
            <Bookmark
              className={cn('size-[14px]', isSaved && 'fill-current')}
              strokeWidth={1.5}
            />
            {(post.saveCount ?? 0) > 0 ? (
              <span className="tabular-nums">{formatNumber(post.saveCount)}</span>
            ) : null}
          </button>
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
            <div className="border-t-[0.5px] border-border px-4 pb-4 pt-3 sm:px-6 sm:pb-5">
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
