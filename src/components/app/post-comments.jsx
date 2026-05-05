import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  ChevronDown,
  Image as ImageIcon,
  Loader2,
  MoreHorizontal,
  Pencil,
  Send,
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
import { Textarea } from '@/components/ui/textarea'
import { MentionText } from '@/components/app/mention-text'
import { MentionTextarea } from '@/components/app/mention-textarea'
import { UserAvatar } from '@/components/app/user-avatar'
import { ReactionPicker } from '@/components/app/reaction-picker'
import { useAuth } from '@/features/auth/auth-context'
import {
  createPostComment,
  createPostCommentWithMedia,
  deletePostComment,
  editPostComment,
  getPostCommentReplies,
  getPostComments,
  reactToComment,
  removeCommentReaction,
} from '@/features/posts/posts.api'
import { useToast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import { extractApiMessage, friendlyApiMessage } from '@/lib/api-error'
import { getFullName, resolveMediaUrl } from '@/lib/format'
import { RelativeTime } from '@/components/app/relative-time'
import { getPostReaction } from '@/lib/reactions'

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

function CommentComposer({
  postId,
  parentId = null,
  /**
   * When this composer is mounted as a reply (`parentId` set), the parent
   * comment's author username is prefilled as `@username ` so the existing
   * MentionService.scanAndPublish pipeline notifies them — same UX as
   * Instagram / Twitter / Facebook reply boxes. Skipped when replying to
   * yourself (no point pinging yourself).
   */
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
  const initialText =
    parentId && replyToUsername && !isSelfReply ? `@${replyToUsername} ` : ''
  const [text, setText] = useState(initialText)
  const [file, setFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // After autoFocus lands the cursor, push it past the prefilled mention so
  // the user can start typing their reply immediately. Browser default
  // varies between text-start and text-end on autoFocus; force-end to be
  // consistent and feel intentional.
  useEffect(() => {
    if (!autoFocus || !initialText) return
    const id = requestAnimationFrame(() => {
      const el = textareaRef.current
      if (!el) return
      const end = initialText.length
      try {
        el.setSelectionRange(end, end)
      } catch {
        // Some inputs disallow setSelectionRange — non-fatal.
      }
    })
    return () => cancelAnimationFrame(id)
    // initialText is stable (computed from props at mount); intentionally
    // run-once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  return (
    <form onSubmit={handleSubmit} className="flex items-start gap-2">
      <UserAvatar user={user} className={cn('shrink-0', compact ? 'size-7' : 'size-8')} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div
          className={cn(
            'flex items-end gap-1 rounded-full bg-muted px-1 py-1 ring-1 ring-transparent transition-all focus-within:bg-background focus-within:ring-border focus-within:shadow-sm',
          )}
        >
          <MentionTextarea
            ref={textareaRef}
            value={text}
            onChange={setText}
            placeholder={parentId ? 'Write a reply…' : 'Write a comment…'}
            rows={1}
            autoFocus={autoFocus}
            wrapperClassName="flex-1"
            className="min-h-8 flex-1 resize-none rounded-full border-0 bg-transparent px-3 py-1.5 text-sm shadow-none focus-visible:ring-0"
          />
          <label
            className={cn(
              'grid size-8 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
              file && 'bg-accent text-foreground',
            )}
            title="Attach image or video"
          >
            <ImageIcon className="size-4" />
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
          <Button
            type="submit"
            size="icon-sm"
            disabled={(!text.trim() && !file) || submitting}
            className="size-8 rounded-full"
          >
            {submitting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Send className="size-3.5" />
            )}
          </Button>
        </div>
        {file ? (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-2.5 py-1.5 text-xs">
            <span className="truncate">{file.name}</span>
            <button
              type="button"
              onClick={() => setFile(null)}
              className="text-muted-foreground hover:text-foreground"
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

function CommentItem({ postId, comment, onChange, onRemove, depth = 0 }) {
  const { user: currentUser, isAuthenticated } = useAuth()
  const toast = useToast()
  const [working, setWorking] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(comment.textContent ?? '')
  const [showReplyBox, setShowReplyBox] = useState(false)

  const [replies, setReplies] = useState([])
  const [repliesLoaded, setRepliesLoaded] = useState(false)
  const [repliesOpen, setRepliesOpen] = useState(false)
  const [loadingReplies, setLoadingReplies] = useState(false)

  const author = normalizeAuthor(comment)
  const isMine =
    currentUser &&
    (comment.author?.id === currentUser.id ||
      (author.username && currentUser.username && author.username === currentUser.username))

  const reactionInfo = comment.myReaction ? getPostReaction(comment.myReaction) : null

  async function handleReact(type) {
    if (working || !isAuthenticated) {
      if (!isAuthenticated) toast.info('Sign in to react.')
      return
    }
    // Optimistic + always trust local intent for myReaction (backend
    // returns CommentResponse without populating myReaction on react).
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
      const updated = await reactToComment(postId, comment.id, type)
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
    setReplies((current) => [...current, newReply])
    setRepliesLoaded(true)
    setRepliesOpen(true)
    setShowReplyBox(false)
    onChange?.({ ...comment, replyCount: (comment.replyCount ?? 0) + 1 })
  }

  function handleReplyChange(updated) {
    setReplies((current) =>
      current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
    )
  }

  function handleReplyRemove(id) {
    setReplies((current) => current.filter((item) => item.id !== id))
    onChange?.({
      ...comment,
      replyCount: Math.max(0, (comment.replyCount ?? 0) - 1),
    })
  }

  if (comment.deleted) {
    return (
      <motion.div
        layout="position"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        className="flex items-start gap-2"
      >
        <div className={cn('shrink-0', depth === 0 ? 'size-8' : 'size-7')} />
        <p className="flex-1 rounded-2xl bg-muted/40 px-3.5 py-2 text-xs italic text-muted-foreground">
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
      className="group/comment flex items-start gap-2"
    >
      <Link to={`/profile/${author.username ?? ''}`} className="shrink-0 transition-transform hover:scale-105">
        <UserAvatar user={author} className={depth === 0 ? 'size-8' : 'size-7'} />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="relative inline-flex max-w-full flex-col">
          <div className="rounded-[18px] rounded-tl-[6px] bg-muted px-3.5 py-2 shadow-sm transition-colors group-hover/comment:bg-muted/80">
            <div className="flex items-start justify-between gap-2">
              <Link
                to={`/profile/${author.username ?? ''}`}
                className="block truncate text-[13px] font-semibold hover:underline"
              >
                {getFullName(author) || author.username}
              </Link>
              {isMine && !editing ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="-mr-1 -mt-1 rounded-full p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/comment:opacity-100"
                    >
                      <MoreHorizontal className="size-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
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
              <div className="mt-1 space-y-1.5">
                <MentionTextarea
                  value={editText}
                  onChange={setEditText}
                  rows={2}
                  maxLength={2000}
                  className="resize-none rounded-xl border border-border bg-background px-2.5 py-1.5 text-sm"
                  autoFocus
                />
                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 rounded-full"
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
                    className="h-7 rounded-full"
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
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-[14px] leading-[1.45]">
                    <MentionText text={comment.textContent} />
                  </p>
                ) : null}
                <CommentMedia comment={comment} />
              </>
            )}
          </div>

          <AnimatePresence>
            {(comment.reactionCount ?? 0) > 0 ? (
              <motion.span
                key={`reaction-${comment.reactionCount}`}
                initial={{ opacity: 0, scale: 0.5, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ type: 'spring', stiffness: 460, damping: 22 }}
                className="absolute -bottom-2 right-2 inline-flex items-center gap-0.5 rounded-full border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium shadow-sm"
              >
                <span className="text-[12px] leading-none">
                  {reactionInfo?.emoji ?? '👍'}
                </span>
                <span className="text-muted-foreground">{comment.reactionCount}</span>
              </motion.span>
            ) : null}
          </AnimatePresence>
        </div>

        <div className="mt-2 flex items-center gap-4 pl-3 text-[11px] font-medium text-muted-foreground">
          {isAuthenticated ? (
            <ReactionPicker
              current={comment.myReaction}
              onSelect={handleReact}
              onClear={handleClearReaction}
              disabled={working}
              trigger={({ toggleDefault, current }) => (
                <button
                  type="button"
                  onClick={toggleDefault}
                  disabled={working}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold transition-all duration-200 active:scale-95',
                    current
                      ? cn(current.color, current.bg, 'ring-1', current.ring)
                      : 'hover:text-foreground',
                  )}
                >
                  {current ? (
                    <span className="text-[12px] leading-none">{current.emoji}</span>
                  ) : null}
                  <span>{current?.label ?? 'Like'}</span>
                </button>
              )}
            />
          ) : null}

          {depth === 0 && isAuthenticated ? (
            <button
              type="button"
              onClick={() => setShowReplyBox((v) => !v)}
              className="transition-colors hover:text-foreground"
            >
              Reply
            </button>
          ) : null}

          <RelativeTime entity={comment} title={comment.formattedDate || undefined} />
          {comment.edited ? <span className="italic">(edited)</span> : null}
        </div>

        {depth === 0 && showReplyBox ? (
          <div className="mt-2">
            <CommentComposer
              postId={postId}
              parentId={comment.id}
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
            className="ml-3 mt-2 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ChevronDown
              className={cn(
                'size-3 transition-transform',
                repliesOpen && 'rotate-180',
              )}
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
              <div className="relative mt-3 space-y-3 pl-5">
                <span
                  aria-hidden
                  className="absolute bottom-2 left-[10px] top-0 w-px bg-border"
                />
                <AnimatePresence initial={false}>
                  {replies.map((reply) => (
                    <CommentItem
                      key={reply.id}
                      postId={postId}
                      comment={reply}
                      onChange={handleReplyChange}
                      onRemove={handleReplyRemove}
                      depth={1}
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

export const PostComments = forwardRef(function PostComments(
  { postId, initialCount = 0, onCountChange },
  ref,
) {
  const { isAuthenticated } = useAuth()
  const toast = useToast()
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [count, setCount] = useState(initialCount)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const data = await getPostComments(postId, { page: 0, size: 20 })
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
  }, [postId, toast])

  function updateComment(updated) {
    setComments((current) =>
      current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
    )
  }

  function handleAdded(created) {
    setComments((current) => [...current, created])
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

  // Imperative API used by PostCard to forward per-post SSE events
  // (POST_COMMENTED / POST_COMMENT_UPDATED / POST_COMMENT_DELETED /
  // POST_COMMENT_REACTED). Keeping a single SSE connection at the
  // post-card level avoids opening one EventSource per child.
  useImperativeHandle(
    ref,
    () => ({
      applyRealtimeEvent(type, payload) {
        if (!payload) return
        const commentId = payload.id ?? payload.commentId
        switch (type) {
          case 'POST_COMMENTED': {
            if (!commentId) return
            // The reply belongs to a parent thread — let CommentItem
            // handle it lazily on expand. Top-level comments slot in.
            if (payload.parentId) return
            setComments((current) =>
              current.some((item) => item.id === commentId)
                ? current.map((item) =>
                    item.id === commentId ? { ...item, ...payload } : item,
                  )
                : [...current, payload],
            )
            setCount((value) => {
              const next = value + 1
              onCountChange?.(next)
              return next
            })
            break
          }
          case 'POST_COMMENT_UPDATED': {
            if (!commentId) return
            setComments((current) =>
              current.map((item) =>
                item.id === commentId ? { ...item, ...payload } : item,
              ),
            )
            break
          }
          case 'POST_COMMENT_DELETED': {
            if (!commentId) return
            setComments((current) => current.filter((item) => item.id !== commentId))
            setCount((value) => {
              const next = Math.max(0, value - 1)
              onCountChange?.(next)
              return next
            })
            break
          }
          case 'POST_COMMENT_REACTED':
          case 'POST_COMMENT_REACTION_REMOVED': {
            if (!commentId) return
            setComments((current) =>
              current.map((item) =>
                item.id === commentId
                  ? {
                      ...item,
                      reactionCount:
                        payload.reactionCount ?? item.reactionCount,
                      topReactionTypes:
                        payload.topReactionTypes ?? item.topReactionTypes,
                    }
                  : item,
              ),
            )
            break
          }
          default:
        }
      },
    }),
    [onCountChange],
  )

  return (
    <div className="space-y-4 border-t pt-4">
      {loading ? (
        <div className="flex items-center justify-center py-4 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
        </div>
      ) : comments.length === 0 ? (
        <p className="py-2 text-center text-sm text-muted-foreground">
          No comments yet. Be the first to comment.
        </p>
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {comments.map((comment) => (
              <CommentItem
                key={comment.id}
                postId={postId}
                comment={comment}
                onChange={updateComment}
                onRemove={handleRemove}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {isAuthenticated ? (
        <CommentComposer postId={postId} onAdded={handleAdded} />
      ) : (
        <p className="text-center text-xs text-muted-foreground">
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>{' '}
          to comment.
        </p>
      )}
    </div>
  )
})
