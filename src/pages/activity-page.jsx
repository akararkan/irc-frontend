import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  Activity as ActivityIcon,
  Award,
  Clapperboard,
  HelpCircle,
  Loader2,
  MessageCircle,
  MessageCircleQuestion,
  MessageSquareReply,
  Play,
  Repeat2,
  Sparkles,
  Star,
  ThumbsUp,
  Trash2,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/app/empty-state'
import { PageHeader } from '@/components/app/page-header'
import { UserAvatar } from '@/components/app/user-avatar'
import { useAuth } from '@/features/auth/auth-context'
import { useToast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import { extractApiMessage } from '@/lib/api-error'
import { RelativeTime } from '@/components/app/relative-time'
import {
  getFullName,
  getHandle,
  getRawUsername,
  resolveMediaUrl,
} from '@/lib/format'
import {
  clearAllActivity,
  deleteActivity,
  getMyActivity,
} from '@/features/activity/activity.api'
import { useMyActivityStream } from '@/hooks/use-my-activity-stream'

// ─── Filter chips ───────────────────────────────────────────────────
const FILTERS = [
  { value: 'ALL', label: 'All', icon: ActivityIcon },
  { value: 'POST_REACTION', label: 'Reactions', icon: ThumbsUp },
  { value: 'POST_COMMENT', label: 'Comments', icon: MessageCircle },
  { value: 'POST_COMMENT_REACTION', label: 'Comment reactions', icon: Sparkles },
  { value: 'POST_SHARE', label: 'Shares', icon: Repeat2 },
  { value: 'REEL_WATCH', label: 'Watched reels', icon: Clapperboard },
  // ── Q&A ──
  { value: 'QNA_QUESTION_CREATED', label: 'Questions', icon: HelpCircle },
  { value: 'QNA_ANSWER_CREATED', label: 'Answers', icon: MessageCircleQuestion },
  { value: 'QNA_REANSWER_CREATED', label: 'Reanswers', icon: MessageSquareReply },
  { value: 'QNA_ANSWER_REACTION', label: 'Answer reactions', icon: Sparkles },
  { value: 'QNA_BEST_ANSWER_VOTE', label: 'Best-answer votes', icon: Award },
  { value: 'QNA_ANSWER_FEEDBACK', label: 'Answer feedback', icon: Star },
]

// ─── Per-type metadata for the activity-row icon ────────────────────
const TYPE_META = {
  POST_REACTION: {
    icon: ThumbsUp,
    tone: 'text-sky-600 bg-sky-500/10 ring-sky-500/30',
    verb: () => 'Liked a post',
  },
  POST_COMMENT: {
    icon: MessageCircle,
    tone: 'text-violet-600 bg-violet-500/10 ring-violet-500/30',
    verb: () => 'Commented',
  },
  POST_COMMENT_REACTION: {
    icon: Sparkles,
    tone: 'text-amber-600 bg-amber-500/10 ring-amber-500/30',
    verb: () => 'Liked a comment',
  },
  POST_SHARE: {
    icon: Repeat2,
    tone: 'text-emerald-600 bg-emerald-500/10 ring-emerald-500/30',
    verb: () => 'Shared',
  },
  REEL_WATCH: {
    icon: Clapperboard,
    tone: 'text-rose-600 bg-rose-500/10 ring-rose-500/30',
    verb: (item) =>
      item.watchedSeconds != null
        ? `Watched ${formatDuration(item.watchedSeconds)}`
        : 'Watched a reel',
  },
  // ── Q&A ──
  // Backend sends `actionNote: 'vote' | 'unvote'` for best-answer
  // votes and a QnaReactionType in `qnaReactionType` (mapped to the
  // shared 8-emoji palette). The summary lives on either `question`
  // or `answer` depending on the type.
  QNA_QUESTION_CREATED: {
    icon: HelpCircle,
    tone: 'text-sky-600 bg-sky-500/10 ring-sky-500/30',
    verb: () => 'Asked a question',
  },
  QNA_ANSWER_CREATED: {
    icon: MessageCircleQuestion,
    tone: 'text-violet-600 bg-violet-500/10 ring-violet-500/30',
    verb: () => 'Posted an answer',
  },
  QNA_REANSWER_CREATED: {
    icon: MessageSquareReply,
    tone: 'text-violet-600 bg-violet-500/10 ring-violet-500/30',
    verb: () => 'Replied to an answer',
  },
  QNA_ANSWER_REACTION: {
    icon: Sparkles,
    tone: 'text-amber-600 bg-amber-500/10 ring-amber-500/30',
    verb: () => 'Liked an answer',
  },
  QNA_BEST_ANSWER_VOTE: {
    icon: Award,
    tone: 'text-emerald-600 bg-emerald-500/10 ring-emerald-500/30',
    verb: (item) =>
      item.actionNote === 'unvote'
        ? 'Withdrew a "best answer" vote'
        : 'Voted an answer as best',
  },
  QNA_ANSWER_FEEDBACK: {
    icon: Star,
    tone: 'text-amber-600 bg-amber-500/10 ring-amber-500/30',
    verb: () => 'Gave feedback on an answer',
  },
}

function formatDuration(totalSeconds) {
  if (!totalSeconds || totalSeconds < 1) return '0s'
  const m = Math.floor(totalSeconds / 60)
  const s = Math.floor(totalSeconds % 60)
  if (m === 0) return `${s}s`
  return `${m}m ${s}s`
}

// Type prefixes that target Q&A entities — the activity row pulls
// summaries from `item.question` / `item.answer` instead of `item.post`.
const QNA_TYPES = new Set([
  'QNA_QUESTION_CREATED',
  'QNA_ANSWER_CREATED',
  'QNA_REANSWER_CREATED',
  'QNA_ANSWER_REACTION',
  'QNA_BEST_ANSWER_VOTE',
  'QNA_ANSWER_FEEDBACK',
])

// ─── Activity row ───────────────────────────────────────────────────
function ActivityRow({ item, onDelete }) {
  const meta = TYPE_META[item.activityType] ?? TYPE_META.POST_COMMENT
  const Icon = meta.icon
  const isQna = QNA_TYPES.has(item.activityType)

  // For Q&A activity the actor sits on `question.author` or
  // `answer.author`. For post activity we fall back to `post.author`.
  const author = isQna
    ? item.question?.author ?? item.answer?.author ?? null
    : item.post?.author ?? null
  const profileHref = author?.username
    ? `/profile/${getRawUsername(author)}`
    : null

  // The preview shown under the verb. Q&A: question title or answer
  // body excerpt. Post: text preview from the post or the comment that
  // was acted on.
  const preview = isQna
    ? item.question?.title ||
      item.answer?.bodyPreview ||
      item.answer?.body ||
      ''
    : item.comment?.textPreview || item.post?.textPreview || ''

  // Permalink — Q&A items deep-link straight to the question detail
  // page; the answer ID is hash-anchored so the row scrolls into view.
  const linkHref = isQna
    ? item.question?.id
      ? `/questions/${item.question.id}${item.answer?.id ? `#answer-${item.answer.id}` : ''}`
      : null
    : null

  const thumbnail = resolveMediaUrl(item.post?.thumbnailUrl)

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      className="group/row flex items-start gap-3 rounded-2xl border border-border bg-card p-3 transition-colors hover:border-foreground/15 hover:shadow-soft sm:p-4"
    >
      {/* Activity-type emblem */}
      <span
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-full ring-1',
          meta.tone,
        )}
        aria-hidden
      >
        <Icon className="size-4" />
      </span>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] leading-tight">
          <span className="font-semibold text-foreground">
            {meta.verb(item)}
          </span>
          {author ? (
            <>
              <span className="text-muted-foreground">·</span>
              {profileHref ? (
                <Link
                  to={profileHref}
                  className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground hover:underline"
                >
                  <UserAvatar user={author} className="size-4" />
                  <span className="font-medium">
                    {getFullName(author) || getHandle(author)}
                  </span>
                </Link>
              ) : (
                <span className="text-muted-foreground">
                  {getFullName(author) || getHandle(author)}
                </span>
              )}
            </>
          ) : null}
          <span className="text-muted-foreground">·</span>
          <RelativeTime
            value={item.createdAt}
            className="text-[11.5px] text-muted-foreground"
          />
        </div>

        {preview ? (
          linkHref ? (
            <Link
              to={linkHref}
              className="mt-1 line-clamp-2 text-[13px] text-foreground/85 transition-colors hover:text-foreground hover:underline"
            >
              {preview}
            </Link>
          ) : (
            <p className="mt-1 line-clamp-2 text-[13px] text-foreground/85">
              {preview}
            </p>
          )
        ) : null}
      </div>

      {/* Thumbnail (if any) — lets the user recognize the reel/post visually */}
      {thumbnail ? (
        <span className="relative hidden size-14 shrink-0 overflow-hidden rounded-xl border border-border bg-muted sm:block">
          <img
            src={thumbnail}
            alt=""
            loading="lazy"
            className="size-full object-cover"
          />
          {item.activityType === 'REEL_WATCH' ? (
            <span className="absolute inset-0 grid place-items-center bg-black/30">
              <Play className="size-4 text-white drop-shadow" fill="currentColor" />
            </span>
          ) : null}
        </span>
      ) : null}

      <button
        type="button"
        onClick={() => onDelete(item.id)}
        className="ml-1 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover/row:opacity-100 focus-visible:opacity-100"
        title="Remove from activity"
        aria-label="Remove from activity"
      >
        <Trash2 className="size-3.5" />
      </button>
    </motion.li>
  )
}

// ─── Reusable panel — used standalone at /activity AND inside Settings
export function ActivityPanel({ embedded = false }) {
  const { isAuthenticated } = useAuth()
  const toast = useToast()

  const [filter, setFilter] = useState('ALL')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [clearing, setClearing] = useState(false)

  // All tabs (including Watched reels) read from the unified activity
  // endpoint. The backend cascades deletes for everything *except*
  // REEL_WATCH: reactions/comments/comment-reactions/shares are undone
  // when their activity row is removed, while reel watches stay in the
  // ReelView history and only the activity entry disappears.
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const opts = { page: 0, size: 30 }
      if (filter !== 'ALL') opts.type = filter
      const data = await getMyActivity(opts)
      setItems(data?.content ?? [])
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not load activity.'))
    } finally {
      setLoading(false)
    }
  }, [filter, toast])

  useEffect(() => {
    if (isAuthenticated) load()
  }, [isAuthenticated, load])

  // Live updates — when the backend records a new activity (any tab,
  // any device) it broadcasts on the per-user channel. Keep the panel
  // in sync without polling: insert new rows at the top, drop deleted
  // ones, wipe everything on a clear-all from another device.
  useMyActivityStream(
    {
      onEvent: (type, payload) => {
        if (type === 'ACTIVITY_DELETED') {
          const id = payload?.id ?? payload?.activityId
          if (!id) return
          setItems((current) => current.filter((item) => item.id !== id))
          return
        }
        if (type === 'ACTIVITY_CLEARED') {
          if (payload?.type && filter !== 'ALL' && payload.type !== filter) return
          setItems([])
          return
        }
        // Append-style events — the payload is the full activity row.
        if (!payload || !payload.id) return
        if (filter !== 'ALL' && payload.activityType !== filter) return
        setItems((current) =>
          current.some((item) => item.id === payload.id)
            ? current.map((item) =>
                item.id === payload.id ? { ...item, ...payload } : item,
              )
            : [payload, ...current],
        )
      },
    },
    { enabled: isAuthenticated },
  )

  async function handleDelete(activityId) {
    const previous = items
    setItems((current) => current.filter((item) => item.id !== activityId))
    try {
      await deleteActivity(activityId)
    } catch (error) {
      setItems(previous)
      toast.error(extractApiMessage(error, 'Could not remove entry.'))
    }
  }

  async function handleClearAll() {
    if (clearing) return
    const isFiltered = filter !== 'ALL'
    const tabLabel =
      FILTERS.find((f) => f.value === filter)?.label?.toLowerCase() ?? 'activity'
    const label = isFiltered ? `${tabLabel} entries` : 'activity'
    if (!confirm(`Clear all ${label}? This cannot be undone.`)) return
    setClearing(true)
    try {
      if (isFiltered) {
        await clearAllActivity({ type: filter })
        toast.success(
          `${tabLabel.charAt(0).toUpperCase()}${tabLabel.slice(1)} cleared.`,
        )
      } else {
        await clearAllActivity()
        toast.success('Activity cleared.')
      }
      setItems([])
    } catch (error) {
      toast.error(extractApiMessage(error, `Could not clear ${label}.`))
    } finally {
      setClearing(false)
    }
  }

  const isEmpty = items.length === 0

  if (!isAuthenticated) {
    return (
      <EmptyState
        icon={ActivityIcon}
        title="Sign in to see your activity"
        description="Your reactions, comments, shares, and watched reels are tracked privately for you."
        action={
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline" className="rounded-full">
              <Link to="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm" className="rounded-full">
              <Link to="/signup">Create account</Link>
            </Button>
          </div>
        }
      />
    )
  }

  const clearLabel =
    filter === 'ALL'
      ? 'Clear all'
      : `Clear ${(FILTERS.find((f) => f.value === filter)?.label ?? '').toLowerCase()}`

  return (
    <div className={embedded ? 'space-y-4' : 'space-y-6'}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        {embedded ? (
          <div>
            <p className="text-[13px] font-semibold text-foreground">Your activity</p>
            <p className="text-[12.5px] text-muted-foreground">
              Reactions, comments, shares, and reels you've watched — visible only to you.
            </p>
          </div>
        ) : (
          <span aria-hidden />
        )}
        {!isEmpty && !loading ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-full"
            onClick={handleClearAll}
            disabled={clearing}
          >
            {clearing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Trash2 className="size-3.5" />
            )}
            {clearLabel}
          </Button>
        ) : null}
      </div>

      {/* Filter chips — horizontal scroll on small screens */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {FILTERS.map((option) => {
          const Icon = option.icon
          const active = filter === option.value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-all duration-200 active:scale-95',
                active
                  ? 'border-foreground bg-foreground text-background shadow-soft'
                  : 'border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground',
              )}
            >
              <Icon className="size-3.5" />
              {option.label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      ) : isEmpty ? (
        <EmptyState
          icon={ActivityIcon}
          title="Nothing here yet"
          description={
            filter === 'REEL_WATCH'
              ? 'Reels you watch will show up here.'
              : 'As you react, comment, share, or watch reels, your activity lands here.'
          }
        />
      ) : (
        <ul className="space-y-3">
          <AnimatePresence initial={false}>
            {items.map((item) => (
              <ActivityRow
                key={item.id}
                item={item}
                onDelete={handleDelete}
              />
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  )
}

// ─── Standalone page (kept so /activity deep links keep working) ────
export function ActivityPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Your activity"
        title="Activity"
        description="Everything you've reacted to, commented on, shared, or watched — only visible to you."
      />
      <ActivityPanel />
    </div>
  )
}
