import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
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
import { RoleBadge } from '@/components/app/role-badge'
import { UserAvatar } from '@/components/app/user-avatar'
import { useAuth } from '@/features/auth/auth-context'
import {
  createPostComment,
  createPostCommentWithMedia,
  deletePostComment,
  editPostComment,
  getPostCommentReplies,
  getPostComments,
  getPostCommentsCursor,
  reactToComment,
  removeCommentReaction,
} from '@/features/posts/posts.api'
import { useToast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import { extractApiMessage, friendlyApiMessage } from '@/lib/api-error'
import { useCooldown } from '@/lib/rate-limit-cooldown'
import { formatNumber, getFullName, getHandle, getRawUsername, resolveMediaUrl } from '@/lib/format'
import { RelativeTime } from '@/components/app/relative-time'

function normalizeAuthor(comment) {
  if (comment.author) {
    return {
      id: comment.author.id,
      username: comment.author.username,
      fullName: comment.author.fullName,
      profileImage: comment.author.avatarUrl,
      role: comment.author.role,
    }
  }
  return {
    username: comment.authorUsername,
    profileImage: comment.authorProfileImage,
    fullName: comment.authorFullName,
  }
}

/* ── Composer ────────────────────────────────────────────────── */
function CommentComposer({
  postId,
  parentId = null,
  replyToUsername = null,
  onAdded,
  autoFocus = false,
  compact = false,
}) {
  const { user, isAuthenticated } = useAuth()
  const toast = useToast()
  const textareaRef = useRef(null)
  const commentCooldown = useCooldown('comment')
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

  async function handleSubmit(event) {
    event.preventDefault()
    const value = text.trim()
    if ((!value && !file) || submitting) return
    setSubmitting(true)
    try {
      const data = { parentId, textContent: value }
      const created = file
        ? await createPostCommentWithMedia(postId, { data, media: file })
        : await createPostComment(postId, data)
      onAdded?.(created)
      setText('')
      setFile(null)
    } catch (error) {
      toast.error(friendlyApiMessage(error, 'Could not post comment.'))
    } finally {
      setSubmitting(false)
    }
  }

  function insertMention() {
    setText((current) => (current.endsWith(' ') || !current ? `${current}@` : `${current} @`))
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-start gap-2.5">
      <UserAvatar
        user={user}
        className={cn('shrink-0 rounded-full', compact ? 'size-7' : 'size-8')}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-1 rounded-full border border-border bg-paper py-1 pl-3.5 pr-1 transition-colors focus-within:border-brand/45">
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
            disabled={(!text.trim() && !file) || submitting || commentCooldown > 0}
            title={
              commentCooldown > 0 ? `Rate limit — try again in ${commentCooldown}s` : undefined
            }
            className="h-7 rounded-full bg-brand px-3.5 text-[12px] font-medium text-brand-foreground hover:bg-brand/90"
          >
            {submitting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : commentCooldown > 0 ? (
              <span>Wait {commentCooldown}s</span>
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
  postId,
  comment,
  onChange,
  onRemove,
  depth = 0,
  postAuthorId,
  postAuthorUsername,
  onSiblingReplyAdded,
  registerReplyPatcher,
}) {
  const { user: currentUser, isAuthenticated } = useAuth()
  const currentUserId = currentUser?.id ?? null
  const toast = useToast()
  const [working, setWorking] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(comment.textContent ?? '')
  const [showReplyBox, setShowReplyBox] = useState(false)

  const [replies, setReplies] = useState([])
  const [repliesLoaded, setRepliesLoaded] = useState(false)
  const [repliesOpen, setRepliesOpen] = useState(false)
  const [loadingReplies, setLoadingReplies] = useState(false)

  useEffect(() => {
    if (depth !== 0 || !registerReplyPatcher) return undefined
    return registerReplyPatcher(
      comment.id,
      ({ commentId, reactionCount, reactionType, actorId, added }) => {
        setReplies((current) =>
          current.map((reply) => {
            if (reply.id !== commentId) return reply
            const actorIsMe = currentUserId != null && actorId === currentUserId
            return {
              ...reply,
              reactionCount: actorIsMe
                ? reply.reactionCount
                : (reactionCount ?? reply.reactionCount),
              myReaction: actorIsMe
                ? added
                  ? (reactionType ?? 'LIKE')
                  : null
                : reply.myReaction,
            }
          }),
        )
      },
    )
  }, [comment.id, depth, registerReplyPatcher, currentUserId])

  const author = normalizeAuthor(comment)
  const commentAuthorId = comment.author?.id ?? comment.authorId
  const isMine =
    currentUser &&
    (commentAuthorId === currentUser.id ||
      (author.username && currentUser.username && author.username === currentUser.username))
  const isPostAuthor = Boolean(
    (postAuthorId && commentAuthorId && postAuthorId === commentAuthorId) ||
      (postAuthorUsername && author.username && postAuthorUsername === author.username),
  )

  async function handleReact(type) {
    if (working || !isAuthenticated) {
      if (!isAuthenticated) toast.info('Sign in to react.')
      return
    }
    const previous = comment
    const wasReacting = Boolean(comment.myReaction)
    onChange?.({
      ...comment,
      myReaction: type,
      reactionCount: wasReacting
        ? comment.reactionCount
        : (comment.reactionCount ?? 0) + 1,
    })
    setWorking(true)
    try {
      await reactToComment(postId, comment.id, type)
    } catch (error) {
      onChange?.(previous)
      toast.error(friendlyApiMessage(error, 'Could not react.'))
    } finally {
      setWorking(false)
    }
  }

  async function handleClearReaction() {
    if (working || !comment.myReaction) return
    const previous = comment
    onChange?.({
      ...comment,
      myReaction: null,
      reactionCount: Math.max(0, (comment.reactionCount ?? 0) - 1),
    })
    setWorking(true)
    try {
      await removeCommentReaction(postId, comment.id)
    } catch (error) {
      onChange?.(previous)
      toast.error(friendlyApiMessage(error, 'Could not remove reaction.'))
    } finally {
      setWorking(false)
    }
  }

  async function handleSaveEdit() {
    const value = editText.trim()
    if (!value || value === comment.textContent || working) {
      setEditing(false)
      setEditText(comment.textContent ?? '')
      return
    }
    setWorking(true)
    try {
      const updated = await editPostComment(postId, comment.id, { textContent: value })
      onChange?.(updated ?? { ...comment, textContent: value, edited: true })
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
      await deletePostComment(postId, comment.id)
      onRemove?.(comment.id)
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not delete comment.'))
    } finally {
      setWorking(false)
    }
  }

  async function toggleReplies() {
    if (repliesOpen) {
      setRepliesOpen(false)
      return
    }
    if (!repliesLoaded) {
      setLoadingReplies(true)
      try {
        const page = await getPostCommentReplies(postId, comment.id, { page: 0, size: 20 })
        setReplies(page?.content ?? [])
        setRepliesLoaded(true)
      } catch (error) {
        toast.error(extractApiMessage(error, 'Could not load replies.'))
        return
      } finally {
        setLoadingReplies(false)
      }
    }
    setRepliesOpen(true)
  }

  function handleReplyAdded(newReply) {
    if (depth === 0) {
      setReplies((current) => [...current, newReply])
      setRepliesLoaded(true)
      setRepliesOpen(true)
      onChange?.({ ...comment, replyCount: (comment.replyCount ?? 0) + 1 })
    } else {
      onSiblingReplyAdded?.(newReply)
    }
    setShowReplyBox(false)
  }

  function handleReplyChange(updated) {
    setReplies((current) =>
      current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
    )
  }

  function handleReplyRemove(id) {
    setReplies((current) => current.filter((item) => item.id !== id))
    onChange?.({ ...comment, replyCount: Math.max(0, (comment.replyCount ?? 0) - 1) })
  }

  if (comment.deleted) {
    return (
      <motion.div
        layout="position"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        className="flex items-start gap-2.5"
      >
        <div className={cn('shrink-0', depth === 0 ? 'size-8' : 'size-7')} />
        <p className="flex-1 rounded-2xl bg-secondary/60 px-3.5 py-2 text-[12px] italic text-ink-3">
          This comment was deleted.
        </p>
      </motion.div>
    )
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
        to={`/profile/${getRawUsername(author)}`}
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
              to={`/profile/${getRawUsername(author)}`}
              className="group/author flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0"
            >
              <span className="text-[12.5px] font-medium text-ink group-hover/author:underline">
                {getFullName(author) || getHandle(author) || 'Unknown user'}
              </span>
              {author.role ? <RoleBadge role={author.role} size="xs" /> : null}
              {isPostAuthor ? (
                <span
                  title="Original post author"
                  className="inline-flex items-center rounded-full bg-brand-soft px-1.5 py-[1px] font-mono text-[9px] font-medium uppercase tracking-[0.06em] text-brand"
                >
                  Author
                </span>
              ) : null}
              <span className="font-mono text-[9.5px] text-ink-4">
                <RelativeTime entity={comment} title={comment.formattedDate || undefined} />
                {comment.edited ? ' · edited' : ''}
              </span>
            </Link>
            {isMine && !editing ? (
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
                  <DropdownMenuItem
                    onSelect={() => {
                      setEditing(true)
                      setEditText(comment.textContent ?? '')
                    }}
                  >
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

          {editing ? (
            <div className="mt-1.5 space-y-1.5">
              <MentionTextarea
                value={editText}
                onChange={setEditText}
                rows={2}
                maxLength={2000}
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
                    setEditText(comment.textContent ?? '')
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 rounded-lg bg-brand text-brand-foreground hover:bg-brand/90"
                  onClick={handleSaveEdit}
                  disabled={working || !editText.trim()}
                >
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <>
              {comment.textContent ? (
                <p
                  dir="auto"
                  className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-[1.55] text-ink-2"
                >
                  <MentionText text={comment.textContent} />
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
              onClick={() =>
                comment.myReaction ? handleClearReaction() : handleReact('LIKE')
              }
              disabled={working}
              aria-pressed={Boolean(comment.myReaction)}
              aria-label={comment.myReaction ? 'Unlike' : 'Like'}
              className={cn(
                'inline-flex items-center gap-1 font-medium transition-colors active:scale-95',
                comment.myReaction ? 'text-rose-600' : 'text-ink-3 hover:text-ink',
              )}
            >
              <Heart
                className={cn('size-[14px]', comment.myReaction && 'fill-current')}
                strokeWidth={1.7}
              />
              <span className="tabular-nums">
                {comment.reactionCount > 0 ? formatNumber(comment.reactionCount) : 'Like'}
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
              postId={postId}
              parentId={depth === 0 ? comment.id : comment.parentId ?? comment.parent?.id}
              replyToUsername={author.username}
              onAdded={handleReplyAdded}
              autoFocus
              compact
            />
          </div>
        ) : null}

        {depth === 0 && (comment.replyCount ?? 0) > 0 ? (
          <button
            type="button"
            onClick={toggleReplies}
            disabled={loadingReplies}
            className="mt-2 inline-flex items-center gap-1 pl-1.5 text-[12px] font-medium text-brand transition-colors hover:underline"
          >
            <ChevronDown
              className={cn('size-3.5 transition-transform', repliesOpen && 'rotate-180')}
            />
            {loadingReplies
              ? 'Loading replies…'
              : repliesOpen
                ? 'Hide replies'
                : `View ${comment.replyCount} ${comment.replyCount === 1 ? 'reply' : 'replies'}`}
          </button>
        ) : null}

        <AnimatePresence initial={false}>
          {depth === 0 && repliesOpen ? (
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
                  {replies.map((reply) => (
                    <CommentItem
                      key={reply.id}
                      postId={postId}
                      comment={reply}
                      onChange={handleReplyChange}
                      onRemove={handleReplyRemove}
                      depth={1}
                      postAuthorId={postAuthorId}
                      postAuthorUsername={postAuthorUsername}
                      onSiblingReplyAdded={(newReply) => {
                        setReplies((current) => [...current, newReply])
                        onChange?.({
                          ...comment,
                          replyCount: (comment.replyCount ?? 0) + 1,
                        })
                      }}
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

/* ─── PostComments ───────────────────────────────────────────── */
export const PostComments = forwardRef(function PostComments(
  { postId, initialCount = 0, onCountChange, postAuthorId, postAuthorUsername },
  ref,
) {
  const { isAuthenticated, user: currentUser } = useAuth()
  const currentUserId = currentUser?.id ?? null
  const toast = useToast()
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [count, setCount] = useState(initialCount)

  const replyPatchersRef = useRef(new Map())
  const registerReplyPatcher = useCallback((parentCommentId, patcher) => {
    if (!parentCommentId || typeof patcher !== 'function') return () => {}
    replyPatchersRef.current.set(parentCommentId, patcher)
    return () => {
      const current = replyPatchersRef.current.get(parentCommentId)
      if (current === patcher) replyPatchersRef.current.delete(parentCommentId)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        let items = null
        try {
          const data = await getPostCommentsCursor(postId, { limit: 20 })
          items = data?.items ?? []
        } catch {
          const legacy = await getPostComments(postId, { page: 0, size: 20 })
          items = legacy?.content ?? []
        }
        if (!cancelled) setComments(items)
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
  }, [postId, toast])

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
        const commentId = payload.commentId ?? payload.id
        const parentCommentId = payload.parentCommentId ?? payload.parentId ?? null
        switch (type) {
          case 'COMMENT_CREATED': {
            if (!commentId || parentCommentId) return
            const synthetic = {
              id: commentId,
              postId: payload.postId,
              parentId: null,
              author: {
                id: payload.actorId,
                username: payload.actorUsername,
                fullName: payload.actorFullName ?? null,
                avatarUrl: payload.actorAvatarUrl,
              },
              authorId: payload.actorId,
              authorUsername: payload.actorUsername,
              authorFullName: payload.actorFullName ?? null,
              authorProfileImage: payload.actorAvatarUrl,
              textContent: payload.textContent ?? '',
              mediaUrl: payload.mediaUrl,
              mediaType: payload.mediaType,
              mediaThumbnailUrl: payload.mediaThumbnailUrl,
              reactionCount: 0,
              replyCount: 0,
              edited: false,
              createdAt: payload.timestamp ?? new Date().toISOString(),
            }
            setComments((current) =>
              current.some((item) => item.id === commentId)
                ? current
                : [...current, synthetic],
            )
            setCount((value) => {
              const next = payload.postCommentCount ?? value + 1
              onCountChange?.(next)
              return next
            })
            break
          }
          case 'COMMENT_EDITED': {
            if (!commentId) return
            setComments((current) =>
              current.map((item) =>
                item.id === commentId
                  ? {
                      ...item,
                      textContent: payload.textContent ?? item.textContent,
                      mediaUrl: payload.mediaUrl ?? item.mediaUrl,
                      mediaType: payload.mediaType ?? item.mediaType,
                      mediaThumbnailUrl:
                        payload.mediaThumbnailUrl ?? item.mediaThumbnailUrl,
                      edited: true,
                    }
                  : item,
              ),
            )
            break
          }
          case 'COMMENT_DELETED': {
            if (!commentId) return
            setComments((current) => current.filter((item) => item.id !== commentId))
            setCount((value) => {
              const next = payload.postCommentCount ?? Math.max(0, value - 1)
              onCountChange?.(next)
              return next
            })
            break
          }
          case 'REPLY_CREATED': {
            if (!commentId || !parentCommentId) return
            setComments((current) =>
              current.map((item) =>
                item.id === parentCommentId
                  ? {
                      ...item,
                      replyCount:
                        payload.commentReplyCount ?? (item.replyCount ?? 0) + 1,
                    }
                  : item,
              ),
            )
            break
          }
          case 'COMMENT_REACTION_ADDED':
          case 'COMMENT_REACTION_REMOVED': {
            if (!commentId) return
            const actorIsMe =
              type === 'COMMENT_REACTION_ADDED' &&
              currentUserId != null &&
              payload.actorId === currentUserId
            const actorIsMeRemove =
              type === 'COMMENT_REACTION_REMOVED' &&
              currentUserId != null &&
              payload.actorId === currentUserId
            const ownActor = actorIsMe || actorIsMeRemove
            setComments((current) =>
              current.map((item) =>
                item.id === commentId
                  ? {
                      ...item,
                      reactionCount: ownActor
                        ? item.reactionCount
                        : (payload.commentReactionCount ?? item.reactionCount),
                      myReaction: actorIsMe
                        ? payload.reactionType ?? 'LIKE'
                        : actorIsMeRemove
                          ? null
                          : item.myReaction,
                    }
                  : item,
              ),
            )
            for (const patcher of replyPatchersRef.current.values()) {
              patcher({
                commentId,
                reactionCount: payload.commentReactionCount,
                reactionType: payload.reactionType,
                actorId: payload.actorId,
                added: type === 'COMMENT_REACTION_ADDED',
              })
            }
            break
          }
          default:
        }
      },
    }),
    [onCountChange, currentUserId],
  )

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex items-center justify-center py-4 text-ink-3">
          <Loader2 className="size-4 animate-spin" />
        </div>
      ) : comments.length === 0 ? (
        <p className="py-2 text-center text-[13px] text-ink-3">
          No comments yet. Be the first to comment.
        </p>
      ) : (
        <div className="space-y-3.5">
          <AnimatePresence initial={false}>
            {comments.map((comment) => (
              <CommentItem
                key={comment.id}
                postId={postId}
                comment={comment}
                onChange={updateComment}
                onRemove={handleRemove}
                postAuthorId={postAuthorId}
                postAuthorUsername={postAuthorUsername}
                registerReplyPatcher={registerReplyPatcher}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {isAuthenticated ? (
        <CommentComposer postId={postId} onAdded={handleAdded} />
      ) : (
        <p className="text-center text-[12px] text-ink-3">
          <Link to="/login" className="font-medium text-brand hover:underline">
            Sign in
          </Link>{' '}
          to comment.
        </p>
      )}
    </div>
  )
})
