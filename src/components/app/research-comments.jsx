import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  AtSign,
  ChevronDown,
  Heart,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Trash2,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MentionText } from '@/components/app/mention-text'
import { MentionTextarea } from '@/components/app/mention-textarea'
import { RelativeTime } from '@/components/app/relative-time'
import { UserAvatar } from '@/components/app/user-avatar'
import {
  addResearchComment,
  addResearchCommentWithMedia,
  deleteResearchComment,
  editResearchComment,
  getResearchComments,
  reactToResearchComment,
  removeResearchCommentReaction,
} from '@/features/research/research.api'
import { useAuth } from '@/features/auth/auth-context'
import { useToast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import { extractApiMessage, friendlyApiMessage } from '@/lib/api-error'
import { formatNumber, getFullName, getHandle, resolveMediaUrl } from '@/lib/format'

function normalizeAuthor(comment) {
  return {
    id: comment.userId,
    username: comment.userUsername,
    profileImage: comment.userProfileImage,
    fullName: comment.userFullName,
  }
}

/* ── Composer ────────────────────────────────────────────────── */
function CommentComposer({
  researchId,
  parentId = null,
  replyToUsername = null,
  onAdded,
  autoFocus = false,
  compact = false,
}) {
  const { user, isAuthenticated } = useAuth()
  const toast = useToast()
  const textareaRef = useRef(null)

  const isSelfReply =
    Boolean(replyToUsername) &&
    Boolean(user?.username) &&
    user.username.toLowerCase() === replyToUsername.toLowerCase()
  const replyHandle = getHandle({ username: replyToUsername })
  const initialText = parentId && replyHandle && !isSelfReply ? `@${replyHandle} ` : ''

  const [text, setText] = useState(initialText)
  const [file, setFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!autoFocus || !initialText) return
    const id = requestAnimationFrame(() => {
      const el = textareaRef.current
      if (!el) return
      const end = initialText.length
      try {
        el.setSelectionRange(end, end)
      } catch {
        /* non-fatal */
      }
    })
    return () => cancelAnimationFrame(id)
  }, [])

  if (!isAuthenticated) return null

  function insertMention() {
    setText((current) => (current.endsWith(' ') || !current ? `${current}@` : `${current} @`))
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const value = text.trim()
    if ((!value && !file) || submitting) return
    setSubmitting(true)
    try {
      const payload = { content: value, parentId: parentId ?? undefined }
      const created = file
        ? await addResearchCommentWithMedia(researchId, { data: payload, media: file })
        : await addResearchComment(researchId, payload)
      onAdded?.(created)
      setText('')
      setFile(null)
    } catch (error) {
      toast.error(friendlyApiMessage(error, 'Could not post comment.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-start gap-2.5">
      <UserAvatar
        user={user}
        className={cn('shrink-0 rounded-full', compact ? 'size-7' : 'size-8')}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-1 rounded-full border border-border bg-paper py-1 pl-3.5 pr-1 transition-colors focus-within:border-[#0891B2]/45">
          <MentionTextarea
            ref={textareaRef}
            value={text}
            onChange={setText}
            placeholder={parentId ? 'Write a reply…' : 'Add to the conversation…'}
            rows={1}
            autoFocus={autoFocus}
            wrapperClassName="flex-1"
            className="min-h-7 flex-1 resize-none border-0 bg-transparent px-0 py-1 text-[13.5px] shadow-none focus-visible:ring-0"
          />
          <label
            className={cn(
              'grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-ink-3 transition-colors hover:bg-secondary hover:text-ink',
              file && 'bg-secondary text-ink',
            )}
            title="Attach image or video"
          >
            <ImageIcon className="size-4" strokeWidth={1.7} />
            <input
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(event) => {
                const picked = event.target.files?.[0]
                if (picked) setFile(picked)
                event.target.value = ''
              }}
            />
          </label>
          <button
            type="button"
            onClick={insertMention}
            className="grid size-8 shrink-0 place-items-center rounded-full text-ink-3 transition-colors hover:bg-secondary hover:text-ink"
            title="Mention someone"
          >
            <AtSign className="size-4" strokeWidth={1.7} />
          </button>
          <Button
            type="submit"
            disabled={(!text.trim() && !file) || submitting}
            className="h-7 rounded-full bg-[#0891B2] px-3.5 text-[12px] font-medium text-white hover:bg-[#0E7490]"
          >
            {submitting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <span>{parentId ? 'Reply' : 'Comment'}</span>
            )}
          </Button>
        </div>
        {file ? (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/50 px-2.5 py-1.5 text-[12px]">
            <span className="truncate">{file.name}</span>
            <button
              type="button"
              onClick={() => setFile(null)}
              className="text-ink-3 hover:text-ink"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : null}
      </div>
    </form>
  )
}

function CommentMedia({ comment }) {
  const url = resolveMediaUrl(comment.mediaUrl)
  if (!url) return null
  const type = comment.mediaType?.toUpperCase()
  if (type === 'VIDEO') {
    return (
      <video
        src={url}
        controls
        playsInline
        className="mt-2 max-h-80 w-full overflow-hidden rounded-xl bg-black"
      />
    )
  }
  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      className="mt-2 max-h-80 w-full overflow-hidden rounded-xl object-cover"
    />
  )
}

/* ── Comment item ────────────────────────────────────────────── */
function CommentItem({
  researchId,
  comment,
  onChange,
  onRemove,
  depth = 0,
  researcherId,
  onSiblingReplyAdded,
}) {
  const { user: currentUser, isAuthenticated } = useAuth()
  const toast = useToast()
  const [working, setWorking] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(comment.content ?? '')
  const [showReplyBox, setShowReplyBox] = useState(false)
  const [repliesOpen, setRepliesOpen] = useState(false)

  const author = normalizeAuthor(comment)
  const isMine =
    currentUser &&
    (comment.userId === currentUser.id ||
      (author.username && currentUser.username && author.username === currentUser.username))
  const isResearchAuthor = Boolean(
    researcherId && comment.userId && researcherId === comment.userId,
  )
  const isResearchOwner = Boolean(
    currentUser?.id && researcherId && currentUser.id === researcherId,
  )
  const canDelete = isMine || isResearchOwner

  const myReaction = comment.myReaction ?? null
  const reactionCount = Number(comment.likeCount ?? 0)

  async function handlePickReaction(type) {
    if (!isAuthenticated) {
      toast.info('Sign in to react.')
      return
    }
    if (working) return
    const previousReaction = myReaction
    const previousCount = reactionCount
    const next = previousReaction ? previousCount : previousCount + 1
    onChange?.({ ...comment, myReaction: type, likeCount: next })
    setWorking(true)
    try {
      await reactToResearchComment(researchId, comment.id, type)
    } catch (error) {
      onChange?.({ ...comment, myReaction: previousReaction, likeCount: previousCount })
      toast.error(friendlyApiMessage(error, 'Could not update reaction.'))
    } finally {
      setWorking(false)
    }
  }

  async function handleClearReaction() {
    if (!isAuthenticated || working || !myReaction) return
    const previousReaction = myReaction
    const previousCount = reactionCount
    onChange?.({
      ...comment,
      myReaction: null,
      likeCount: Math.max(0, previousCount - 1),
    })
    setWorking(true)
    try {
      const updated = await removeResearchCommentReaction(researchId, comment.id)
      if (updated?.id) onChange?.({ ...comment, ...updated })
    } catch (error) {
      onChange?.({ ...comment, myReaction: previousReaction, likeCount: previousCount })
      toast.error(friendlyApiMessage(error, 'Could not remove reaction.'))
    } finally {
      setWorking(false)
    }
  }

  async function handleSaveEdit() {
    const value = editText.trim()
    if (!value || value === comment.content || working) {
      setEditing(false)
      setEditText(comment.content ?? '')
      return
    }
    setWorking(true)
    try {
      const updated = await editResearchComment(researchId, comment.id, { content: value })
      onChange?.(updated ?? { ...comment, content: value, isEdited: true })
      setEditing(false)
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not edit comment.'))
    } finally {
      setWorking(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this comment?')) return
    setWorking(true)
    try {
      await deleteResearchComment(researchId, comment.id)
      onRemove?.(comment.id)
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not delete comment.'))
    } finally {
      setWorking(false)
    }
  }

  function handleReplyAdded(newReply) {
    if (depth === 0) {
      onChange?.({
        ...comment,
        replyCount: (comment.replyCount ?? 0) + 1,
        replies: [...(comment.replies ?? []), newReply],
      })
      setRepliesOpen(true)
    } else {
      onSiblingReplyAdded?.(newReply)
    }
    setShowReplyBox(false)
  }

  function handleReplyChange(updated) {
    onChange?.({
      ...comment,
      replies: (comment.replies ?? []).map((item) =>
        item.id === updated.id ? { ...item, ...updated } : item,
      ),
    })
  }

  function handleReplyRemove(id) {
    onChange?.({
      ...comment,
      replyCount: Math.max(0, (comment.replyCount ?? 0) - 1),
      replies: (comment.replies ?? []).filter((item) => item.id !== id),
    })
  }

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 360, damping: 28 }}
      className="group/comment flex items-start gap-2.5"
    >
      <Link
        to={author.username ? `/profile/${author.username}` : '#'}
        className="shrink-0 transition-opacity hover:opacity-90"
      >
        <UserAvatar
          user={author}
          className={cn('rounded-full', depth === 0 ? 'size-8' : 'size-7')}
        />
      </Link>
      <div className="min-w-0 flex-1">
        {/* Bubble */}
        <div className="rounded-2xl rounded-tl-md bg-secondary/70 px-3.5 py-2">
          <div className="flex items-start justify-between gap-2">
            <Link
              to={author.username ? `/profile/${author.username}` : '#'}
              className="group/author flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0"
            >
              <span className="text-[12.5px] font-medium text-ink group-hover/author:underline">
                {getFullName(author) || getHandle(author) || 'Unknown user'}
              </span>
              {isResearchAuthor ? (
                <span
                  title="Original research author"
                  className="inline-flex items-center rounded-full bg-[#CFFAFE] px-1.5 py-[1px] font-mono text-[9px] font-medium uppercase tracking-[0.06em] text-[#0E7490]"
                >
                  Author
                </span>
              ) : null}
              <span className="font-mono text-[9.5px] text-ink-4">
                <RelativeTime entity={comment} title={comment.formattedDate || undefined} />
                {comment.isEdited ? ' · edited' : ''}
              </span>
            </Link>
            {canDelete && !editing ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="-mr-1 -mt-0.5 rounded-full p-1 text-ink-3 transition-colors hover:bg-paper hover:text-ink"
                    aria-label="More"
                  >
                    <MoreHorizontal className="size-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl">
                  {isMine ? (
                    <DropdownMenuItem
                      onSelect={() => {
                        setEditing(true)
                        setEditText(comment.content ?? '')
                      }}
                    >
                      <Pencil className="mr-2 size-4" />
                      Edit
                    </DropdownMenuItem>
                  ) : null}
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

          {editing ? (
            <div className="mt-1.5 space-y-1.5">
              <MentionTextarea
                value={editText}
                onChange={setEditText}
                rows={2}
                maxLength={5000}
                className="resize-none rounded-xl border border-border bg-paper px-2.5 py-1.5 text-[13px]"
                autoFocus
              />
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 rounded-lg"
                  onClick={() => {
                    setEditing(false)
                    setEditText(comment.content ?? '')
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 rounded-lg bg-[#0891B2] text-white hover:bg-[#0E7490]"
                  onClick={handleSaveEdit}
                  disabled={working || !editText.trim()}
                >
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <>
              {comment.content ? (
                <p
                  dir="auto"
                  className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-[1.55] text-ink-2"
                >
                  <MentionText text={comment.content} />
                </p>
              ) : null}
              <CommentMedia comment={comment} />
            </>
          )}
        </div>

        {/* Inline actions */}
        <div className="mt-1.5 flex items-center gap-4 pl-1.5 text-[11.5px]">
          {isAuthenticated ? (
            <button
              type="button"
              onClick={() => (myReaction ? handleClearReaction() : handlePickReaction('LIKE'))}
              disabled={working}
              aria-pressed={Boolean(myReaction)}
              aria-label={myReaction ? 'Unlike' : 'Like'}
              className={cn(
                'inline-flex items-center gap-1 font-medium transition-colors active:scale-95',
                myReaction ? 'text-rose-600' : 'text-ink-3 hover:text-ink',
              )}
            >
              <Heart
                className={cn('size-[14px]', myReaction && 'fill-current')}
                strokeWidth={1.7}
              />
              <span className="tabular-nums">
                {reactionCount > 0 ? formatNumber(reactionCount) : 'Like'}
              </span>
            </button>
          ) : null}

          {isAuthenticated ? (
            <button
              type="button"
              onClick={() => setShowReplyBox((v) => !v)}
              className="inline-flex items-center gap-1 font-medium text-ink-3 transition-colors hover:text-ink"
            >
              <MessageCircle className="size-[14px]" strokeWidth={1.7} />
              Reply
            </button>
          ) : null}
        </div>

        {showReplyBox ? (
          <div className="mt-2.5">
            <CommentComposer
              researchId={researchId}
              parentId={depth === 0 ? comment.id : comment.parentId}
              replyToUsername={author.username}
              onAdded={handleReplyAdded}
              autoFocus
              compact
            />
          </div>
        ) : null}

        {depth === 0 && (comment.replies?.length ?? 0) > 0 ? (
          <button
            type="button"
            onClick={() => setRepliesOpen((v) => !v)}
            className="mt-2 inline-flex items-center gap-1 pl-1.5 text-[12px] font-medium text-[#0891B2] transition-colors hover:underline"
          >
            <ChevronDown
              className={cn('size-3.5 transition-transform', repliesOpen && 'rotate-180')}
            />
            {repliesOpen
              ? 'Hide replies'
              : `View ${comment.replies.length} ${comment.replies.length === 1 ? 'reply' : 'replies'}`}
          </button>
        ) : null}

        <AnimatePresence initial={false}>
          {depth === 0 && repliesOpen && (comment.replies?.length ?? 0) > 0 ? (
            <motion.div
              key="replies"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 30 }}
              className="overflow-hidden"
            >
              <div className="ml-1 mt-3 space-y-3.5 border-l-2 border-border pl-4">
                <AnimatePresence initial={false}>
                  {(comment.replies ?? []).map((reply) => (
                    <CommentItem
                      key={reply.id}
                      researchId={researchId}
                      comment={reply}
                      onChange={handleReplyChange}
                      onRemove={handleReplyRemove}
                      depth={1}
                      researcherId={researcherId}
                      onSiblingReplyAdded={(newReply) =>
                        onChange?.({
                          ...comment,
                          replyCount: (comment.replyCount ?? 0) + 1,
                          replies: [...(comment.replies ?? []), newReply],
                        })
                      }
                    />
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

/* ─── ResearchComments ───────────────────────────────────────── */
export const ResearchComments = forwardRef(function ResearchComments(
  { researchId, researcherId, initialCount = 0, onCountChange },
  ref,
) {
  const { user: currentUser, isAuthenticated } = useAuth()
  const toast = useToast()
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [count, setCount] = useState(initialCount)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const data = await getResearchComments(researchId, { page: 0, size: 30 })
        if (!cancelled) setComments(data?.content ?? [])
      } catch (error) {
        if (!cancelled) toast.error(extractApiMessage(error, 'Could not load comments.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [researchId, toast])

  function updateComment(updated) {
    setComments((current) =>
      current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
    )
  }

  function handleAdded(created) {
    setComments((current) => {
      const idx = current.findIndex((item) => item.id === created.id)
      if (idx === -1) return [...current, created]
      const next = current.slice()
      next[idx] = { ...current[idx], ...created }
      return next
    })
    const next = count + 1
    setCount(next)
    onCountChange?.(next)
  }

  function handleRemove(id) {
    setComments((current) => current.filter((item) => item.id !== id))
    const next = Math.max(0, count - 1)
    setCount(next)
    onCountChange?.(next)
  }

  useImperativeHandle(
    ref,
    () => ({
      applyRealtimeEvent(type, payload) {
        if (!payload) return

        function patchComment(id, patch) {
          setComments((current) =>
            current.map((item) => {
              if (item.id === id) return { ...item, ...patch }
              const replies = Array.isArray(item.replies) ? item.replies : []
              if (!replies.some((r) => r.id === id)) return item
              return {
                ...item,
                replies: replies.map((r) => (r.id === id ? { ...r, ...patch } : r)),
              }
            }),
          )
        }

        switch (type) {
          case 'COMMENT_CREATED': {
            const id = payload.commentId ?? payload.id
            const parentId = payload.parentCommentId ?? payload.parentId
            if (!id || parentId) return
            const synthetic = {
              id,
              userId: payload.actorId,
              userUsername: payload.actorUsername,
              userFullName: payload.actorFullName ?? null,
              userProfileImage: payload.actorAvatarUrl,
              content: payload.body ?? '',
              mediaUrl: payload.mediaUrl,
              mediaType: payload.mediaType,
              mediaThumbnailUrl: payload.mediaThumbnailUrl,
              likeCount: 0,
              replyCount: 0,
              isEdited: false,
              replies: [],
              parentId: null,
              createdAt: payload.timestamp ?? new Date().toISOString(),
            }
            setComments((current) =>
              current.some((item) => item.id === id) ? current : [...current, synthetic],
            )
            setCount((value) => {
              const next = payload.commentCount ?? value + 1
              onCountChange?.(next)
              return next
            })
            break
          }
          case 'COMMENT_EDITED': {
            const id = payload.commentId ?? payload.id
            if (!id) return
            patchComment(id, {
              content: payload.body ?? '',
              mediaUrl: payload.mediaUrl,
              mediaType: payload.mediaType,
              mediaThumbnailUrl: payload.mediaThumbnailUrl,
              isEdited: true,
              editedAt: payload.timestamp ?? new Date().toISOString(),
            })
            break
          }
          case 'COMMENT_DELETED': {
            const id = payload.commentId ?? payload.id
            if (!id) return
            setComments((current) => current.filter((item) => item.id !== id))
            setCount((value) => {
              const next = payload.commentCount ?? Math.max(0, value - 1)
              onCountChange?.(next)
              return next
            })
            break
          }
          case 'REPLY_CREATED': {
            const id = payload.commentId ?? payload.id
            const parentId = payload.parentCommentId ?? payload.parentId
            if (!id || !parentId) return
            const synthetic = {
              id,
              userId: payload.actorId,
              userUsername: payload.actorUsername,
              userFullName: payload.actorFullName ?? null,
              userProfileImage: payload.actorAvatarUrl,
              content: payload.body ?? '',
              mediaUrl: payload.mediaUrl,
              mediaType: payload.mediaType,
              mediaThumbnailUrl: payload.mediaThumbnailUrl,
              likeCount: 0,
              replyCount: 0,
              isEdited: false,
              parentId,
              replies: [],
              createdAt: payload.timestamp ?? new Date().toISOString(),
            }
            setComments((current) =>
              current.map((item) => {
                if (item.id !== parentId) return item
                const existing = Array.isArray(item.replies) ? item.replies : []
                if (existing.some((r) => r.id === id)) return item
                return {
                  ...item,
                  replies: [...existing, synthetic],
                  replyCount: payload.commentReplyCount ?? (item.replyCount ?? 0) + 1,
                }
              }),
            )
            break
          }
          case 'COMMENT_REACTION_ADDED':
          case 'COMMENT_REACTION_REMOVED': {
            const id = payload.commentId ?? payload.id
            if (id == null) return
            const nextCount = payload.commentReactionCount ?? payload.commentLikeCount
            const isOwnActor = currentUser?.id && payload.actorId === currentUser.id
            const patch = {}
            if (nextCount != null && !isOwnActor) patch.likeCount = nextCount
            if (isOwnActor) {
              patch.myReaction =
                type === 'COMMENT_REACTION_REMOVED'
                  ? null
                  : payload.reactionType ?? null
            }
            if (Object.keys(patch).length === 0) return
            patchComment(id, patch)
            break
          }
          default:
        }
      },
    }),
    [onCountChange, currentUser?.id],
  )

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex items-center justify-center py-4 text-ink-3">
          <Loader2 className="size-4 animate-spin" />
        </div>
      ) : comments.length === 0 ? (
        <p className="py-2 text-center text-[13px] text-ink-3">
          No comments yet. Be the first to share your thoughts.
        </p>
      ) : (
        <div className="space-y-3.5">
          <AnimatePresence initial={false}>
            {comments.map((comment) => (
              <CommentItem
                key={comment.id}
                researchId={researchId}
                comment={comment}
                onChange={updateComment}
                onRemove={handleRemove}
                researcherId={researcherId}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {isAuthenticated ? (
        <CommentComposer researchId={researchId} onAdded={handleAdded} />
      ) : (
        <p className="text-center text-[12px] text-ink-3">
          <Link to="/login" className="font-medium text-[#0891B2] hover:underline">
            Sign in
          </Link>{' '}
          to comment.
        </p>
      )}
    </div>
  )
})
