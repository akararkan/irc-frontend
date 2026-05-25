import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  Activity as ActivityIcon,
  AtSign,
  Award,
  Bookmark,
  BookOpenText,
  CheckSquare,
  Clapperboard,
  Compass,
  Eye,
  FlaskConical,
  Hash,
  Heart,
  HelpCircle,
  Loader2,
  MessageCircle,
  MessageCircleQuestion,
  MessageSquareReply,
  Music,
  PenLine,
  Play,
  Repeat2,
  Search,
  Star,
  ThumbsUp,
  Trash2,
  User as UserIcon,
  UserPlus,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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

// ─── Category groups ───────────────────────────────────────────────
//
// The backend tracks 28 activity types. Showing 28 chips would
// overwhelm the user, so we expose 8 category groups that each map
// to a multi-type query. The Q&A group keeps a sub-row so users can
// drill down into the most common sub-categories without leaving the
// page.

const POST_TYPES = [
  'POST_CREATED',
  'POST_REACTION',
  'POST_COMMENT',
  'POST_COMMENT_REACTION',
  'POST_SHARE',
  'POST_SAVED',
]
const REEL_TYPES = ['REEL_WATCH']
const QNA_TYPES_GROUP = [
  'QNA_QUESTION_CREATED',
  'QNA_ANSWER_CREATED',
  'QNA_REANSWER_CREATED',
  'QNA_ANSWER_REACTION',
  'QNA_BEST_ANSWER_VOTE',
  'QNA_ANSWER_FEEDBACK',
  'QNA_QUESTION_SAVED',
]
const RESEARCH_TYPES = [
  'RESEARCH_PUBLISHED',
  'RESEARCH_REACTION',
  'RESEARCH_COMMENT',
  'RESEARCH_COMMENT_REACTION',
  'RESEARCH_SAVED',
]
const STORY_TYPES = [
  'STORY_VIEWED',
  'STORY_REACTED',
  'STORY_REPLIED',
  'STORY_POLL_VOTED',
]
const SOCIAL_TYPES = [
  'USER_MENTIONED',
  'MENTION_LOOKUP',
  'PROFILE_VIEW',
  'FOLLOWED_USER',
]
const SEARCH_TYPES = ['GLOBAL_SEARCH', 'HASHTAG_SEARCH']
const SOUND_TYPES = ['SOUND_USED']

const CATEGORIES = [
  { value: 'ALL', label: 'All', icon: ActivityIcon, types: null },
  { value: 'POSTS', label: 'Posts', icon: PenLine, types: POST_TYPES },
  { value: 'REELS', label: 'Reels', icon: Clapperboard, types: REEL_TYPES },
  { value: 'QNA', label: 'Q&A', icon: HelpCircle, types: QNA_TYPES_GROUP },
  { value: 'RESEARCH', label: 'Research', icon: FlaskConical, types: RESEARCH_TYPES },
  { value: 'STORIES', label: 'Stories', icon: BookOpenText, types: STORY_TYPES },
  { value: 'SOCIAL', label: 'Social', icon: UserPlus, types: SOCIAL_TYPES },
  { value: 'SEARCH', label: 'Search', icon: Search, types: SEARCH_TYPES },
  { value: 'SOUNDS', label: 'Sounds', icon: Music, types: SOUND_TYPES },
]

// ─── Date-range presets ─────────────────────────────────────────────
const RANGE_PRESETS = [
  { value: 'ALL', label: 'All time' },
  { value: 'TODAY', label: 'Today' },
  { value: 'WEEK', label: 'Last 7 days' },
  { value: 'MONTH', label: 'Last 30 days' },
]

function resolveRange(preset) {
  const now = Date.now()
  switch (preset) {
    case 'TODAY': {
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      return { from: d.toISOString(), to: null }
    }
    case 'WEEK':
      return { from: new Date(now - 7 * 86_400_000).toISOString(), to: null }
    case 'MONTH':
      return { from: new Date(now - 30 * 86_400_000).toISOString(), to: null }
    case 'ALL':
    default:
      return { from: null, to: null }
  }
}

// ─── Per-type metadata for the activity-row icon + verb ─────────────
// `verb(item)` lets a type customise its sentence using the row data
// (e.g. REEL_WATCH includes the watched duration, GLOBAL_SEARCH
// includes the query string).

const TYPE_META = {
  POST_CREATED: {
    icon: PenLine,
    tone: 'text-sky-600 bg-sky-500/10 ring-sky-500/20 dark:text-sky-400',
    verb: () => 'Posted',
  },
  POST_REACTION: {
    icon: ThumbsUp,
    tone: 'text-sky-600 bg-sky-500/10 ring-sky-500/20 dark:text-sky-400',
    verb: () => 'Liked a post',
  },
  POST_COMMENT: {
    icon: MessageCircle,
    tone: 'text-violet-600 bg-violet-500/10 ring-violet-500/20 dark:text-violet-400',
    verb: () => 'Commented',
  },
  POST_COMMENT_REACTION: {
    icon: Heart,
    tone: 'text-amber-600 bg-amber-500/10 ring-amber-500/20 dark:text-amber-400',
    verb: () => 'Liked a comment',
  },
  POST_SHARE: {
    icon: Repeat2,
    tone: 'text-emerald-600 bg-emerald-500/10 ring-emerald-500/20 dark:text-emerald-400',
    verb: () => 'Shared',
  },
  POST_SAVED: {
    icon: Bookmark,
    tone: 'text-emerald-600 bg-emerald-500/10 ring-emerald-500/20 dark:text-emerald-400',
    verb: () => 'Saved a post',
  },
  REEL_WATCH: {
    icon: Clapperboard,
    tone: 'text-rose-600 bg-rose-500/10 ring-rose-500/20 dark:text-rose-400',
    verb: (item) =>
      item.watchedSeconds != null
        ? `Watched ${formatDuration(item.watchedSeconds)}`
        : 'Watched a reel',
  },
  // ── Q&A ──
  QNA_QUESTION_CREATED: {
    icon: HelpCircle,
    tone: 'text-sky-600 bg-sky-500/10 ring-sky-500/20 dark:text-sky-400',
    verb: () => 'Asked a question',
  },
  QNA_ANSWER_CREATED: {
    icon: MessageCircleQuestion,
    tone: 'text-violet-600 bg-violet-500/10 ring-violet-500/20 dark:text-violet-400',
    verb: () => 'Posted an answer',
  },
  QNA_REANSWER_CREATED: {
    icon: MessageSquareReply,
    tone: 'text-violet-600 bg-violet-500/10 ring-violet-500/20 dark:text-violet-400',
    verb: () => 'Replied to an answer',
  },
  QNA_ANSWER_REACTION: {
    icon: Heart,
    tone: 'text-amber-600 bg-amber-500/10 ring-amber-500/20 dark:text-amber-400',
    verb: () => 'Liked an answer',
  },
  QNA_BEST_ANSWER_VOTE: {
    icon: Award,
    tone: 'text-emerald-600 bg-emerald-500/10 ring-emerald-500/20 dark:text-emerald-400',
    verb: (item) =>
      item.actionNote === 'unvote'
        ? 'Withdrew a "best answer" vote'
        : 'Voted an answer as best',
  },
  QNA_ANSWER_FEEDBACK: {
    icon: Star,
    tone: 'text-amber-600 bg-amber-500/10 ring-amber-500/20 dark:text-amber-400',
    verb: () => 'Gave feedback on an answer',
  },
  QNA_QUESTION_SAVED: {
    icon: Bookmark,
    tone: 'text-emerald-600 bg-emerald-500/10 ring-emerald-500/20 dark:text-emerald-400',
    verb: () => 'Saved a question',
  },
  // ── Research ──
  RESEARCH_PUBLISHED: {
    icon: FlaskConical,
    tone: 'text-violet-600 bg-violet-500/10 ring-violet-500/20 dark:text-violet-400',
    verb: () => 'Published research',
  },
  RESEARCH_REACTION: {
    icon: ThumbsUp,
    tone: 'text-violet-600 bg-violet-500/10 ring-violet-500/20 dark:text-violet-400',
    verb: () => 'Liked a paper',
  },
  RESEARCH_COMMENT: {
    icon: MessageCircle,
    tone: 'text-violet-600 bg-violet-500/10 ring-violet-500/20 dark:text-violet-400',
    verb: () => 'Commented on a paper',
  },
  RESEARCH_COMMENT_REACTION: {
    icon: Heart,
    tone: 'text-amber-600 bg-amber-500/10 ring-amber-500/20 dark:text-amber-400',
    verb: () => 'Liked a paper comment',
  },
  RESEARCH_SAVED: {
    icon: Bookmark,
    tone: 'text-emerald-600 bg-emerald-500/10 ring-emerald-500/20 dark:text-emerald-400',
    verb: () => 'Saved a paper',
  },
  // ── Stories ──
  STORY_VIEWED: {
    icon: Eye,
    tone: 'text-sky-600 bg-sky-500/10 ring-sky-500/20 dark:text-sky-400',
    verb: () => 'Viewed a story',
  },
  STORY_REACTED: {
    icon: Heart,
    tone: 'text-amber-600 bg-amber-500/10 ring-amber-500/20 dark:text-amber-400',
    verb: () => 'Reacted to a story',
  },
  STORY_REPLIED: {
    icon: MessageCircle,
    tone: 'text-violet-600 bg-violet-500/10 ring-violet-500/20 dark:text-violet-400',
    verb: () => 'Replied to a story',
  },
  STORY_POLL_VOTED: {
    icon: CheckSquare,
    tone: 'text-emerald-600 bg-emerald-500/10 ring-emerald-500/20 dark:text-emerald-400',
    verb: () => 'Voted in a story poll',
  },
  // ── Social ──
  USER_MENTIONED: {
    icon: AtSign,
    tone: 'text-purple-600 bg-purple-500/10 ring-purple-500/20 dark:text-purple-400',
    verb: () => 'Mentioned you',
  },
  MENTION_LOOKUP: {
    icon: AtSign,
    tone: 'text-purple-600 bg-purple-500/10 ring-purple-500/20 dark:text-purple-400',
    verb: () => 'Mentioned',
  },
  PROFILE_VIEW: {
    icon: UserIcon,
    tone: 'text-zinc-600 bg-zinc-500/10 ring-zinc-500/20 dark:text-zinc-400',
    verb: () => 'Viewed a profile',
  },
  FOLLOWED_USER: {
    icon: UserPlus,
    tone: 'text-blue-600 bg-blue-500/10 ring-blue-500/20 dark:text-blue-400',
    verb: () => 'Followed',
  },
  // ── Search ──
  GLOBAL_SEARCH: {
    icon: Search,
    tone: 'text-zinc-600 bg-zinc-500/10 ring-zinc-500/20 dark:text-zinc-400',
    verb: (item) => (item.query ? `Searched "${item.query}"` : 'Searched'),
  },
  HASHTAG_SEARCH: {
    icon: Hash,
    tone: 'text-zinc-600 bg-zinc-500/10 ring-zinc-500/20 dark:text-zinc-400',
    verb: (item) => (item.query ? `Browsed #${item.query}` : 'Browsed a hashtag'),
  },
  // ── Sound ──
  SOUND_USED: {
    icon: Music,
    tone: 'text-amber-600 bg-amber-500/10 ring-amber-500/20 dark:text-amber-400',
    verb: () => 'Used a sound',
  },
}

const FALLBACK_META = {
  icon: ActivityIcon,
  tone: 'text-zinc-600 bg-zinc-500/10 ring-zinc-500/20 dark:text-zinc-400',
  verb: (item) => item.activityType ?? 'Activity',
}

function formatDuration(totalSeconds) {
  if (!totalSeconds || totalSeconds < 1) return '0s'
  const m = Math.floor(totalSeconds / 60)
  const s = Math.floor(totalSeconds % 60)
  if (m === 0) return `${s}s`
  return `${m}m ${s}s`
}

// Activity types whose subject lives on `item.question` / `item.answer`
const QNA_TYPES = new Set(QNA_TYPES_GROUP)
// Activity types whose subject lives on `item.research`
const RESEARCH_TYPES_SET = new Set(RESEARCH_TYPES)
// Activity types where the linked entity is the target user
const SOCIAL_USER_TYPES = new Set(['FOLLOWED_USER', 'PROFILE_VIEW', 'MENTION_LOOKUP'])

// ─── Activity row ───────────────────────────────────────────────────
function ActivityRow({ item, onDelete }) {
  const meta = TYPE_META[item.activityType] ?? FALLBACK_META
  const Icon = meta.icon
  const isQna = QNA_TYPES.has(item.activityType)
  const isResearch = RESEARCH_TYPES_SET.has(item.activityType)
  const isSocialUser = SOCIAL_USER_TYPES.has(item.activityType)

  // Pick the row's "subject author" from whichever entity this type
  // targets — preserves backward compatibility with the old fields.
  const author = isQna
    ? item.question?.author ?? item.answer?.author ?? null
    : isResearch
      ? item.research?.author ?? null
      : isSocialUser
        ? item.targetUser ?? null
        : item.post?.author ?? null
  const profileHref = author?.username
    ? `/profile/${getRawUsername(author)}`
    : null

  // Preview text shown below the verb.
  const preview = isQna
    ? item.question?.title ||
      item.answer?.bodyPreview ||
      item.answer?.body ||
      ''
    : isResearch
      ? item.research?.title || item.research?.abstractPreview || ''
      : item.comment?.textPreview || item.post?.textPreview || ''

  // Permalink — different entity per group.
  const linkHref = isQna
    ? item.question?.id
      ? `/questions/${item.question.id}${
          item.answer?.id ? `#answer-${item.answer.id}` : ''
        }`
      : null
    : isResearch && item.research?.id
      ? `/research/${item.research.id}`
      : isSocialUser && author?.username
        ? `/profile/${getRawUsername(author)}`
        : null

  const thumbnail = resolveMediaUrl(
    item.post?.thumbnailUrl ?? item.research?.coverImageUrl,
  )

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      className="group/row flex items-start gap-3 rounded-md border border-line bg-card p-3 shadow-sm transition-shadow hover:shadow-md sm:p-4"
    >
      <span
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-full ring-1',
          meta.tone,
        )}
        aria-hidden
      >
        <Icon className="size-4" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] leading-tight">
          {/* Title — prefer the server-supplied `label` field (added
              alongside the POST_SAVED / RESEARCH_SAVED / QNA_QUESTION_SAVED
              work). Falls back to the hardcoded verb so cached clients
              continue to render correctly. */}
          <span className="font-semibold text-foreground">
            {item.label || meta.verb(item)}
          </span>
          {item.subtitle ? (
            <>
              <span className="text-muted-foreground">·</span>
              <span className="text-[12px] text-muted-foreground">
                {item.subtitle}
              </span>
            </>
          ) : null}
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

      {thumbnail ? (
        <span className="relative hidden size-14 shrink-0 overflow-hidden rounded-lg border border-line bg-muted sm:block">
          <img
            src={thumbnail}
            alt=""
            loading="lazy"
            className="size-full object-cover"
          />
          {item.activityType === 'REEL_WATCH' ? (
            <span className="absolute inset-0 grid place-items-center bg-black/30">
              <Play
                className="size-4 text-white drop-shadow"
                fill="currentColor"
              />
            </span>
          ) : null}
        </span>
      ) : null}

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => onDelete(item.id)}
        className="ml-1 shrink-0 rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/row:opacity-100 focus-visible:opacity-100"
        title="Remove from activity"
        aria-label="Remove from activity"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </motion.li>
  )
}

// ─── Reusable panel ─────────────────────────────────────────────────
export function ActivityPanel({ embedded = false }) {
  const { isAuthenticated } = useAuth()
  const toast = useToast()

  const [category, setCategory] = useState('ALL')
  const [range, setRange] = useState('ALL')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [clearing, setClearing] = useState(false)

  const activeCategory = useMemo(
    () => CATEGORIES.find((c) => c.value === category) ?? CATEGORIES[0],
    [category],
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { from, to } = resolveRange(range)
      const opts = { page: 0, size: 30 }
      if (activeCategory.types) opts.types = activeCategory.types
      if (from) opts.from = from
      if (to) opts.to = to
      const data = await getMyActivity(opts)
      setItems(data?.content ?? [])
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not load activity.'))
    } finally {
      setLoading(false)
    }
  }, [activeCategory, range, toast])

  useEffect(() => {
    if (isAuthenticated) load()
  }, [isAuthenticated, load])

  // Live updates — keep panel in sync across tabs/devices without polling.
  useMyActivityStream(
    {
      onEvent: (eventType, payload) => {
        if (eventType === 'ACTIVITY_DELETED') {
          const id = payload?.id ?? payload?.activityId
          if (!id) return
          setItems((current) => current.filter((item) => item.id !== id))
          return
        }
        if (eventType === 'ACTIVITY_CLEARED') {
          // Server-side clear may be scoped to a type; if our current
          // category doesn't include it, ignore.
          if (
            payload?.type &&
            activeCategory.types &&
            !activeCategory.types.includes(payload.type)
          ) {
            return
          }
          setItems([])
          return
        }
        // Append-style — payload is the full activity row.
        if (!payload || !payload.id) return
        if (
          activeCategory.types &&
          !activeCategory.types.includes(payload.activityType)
        ) {
          return
        }
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
    const isFiltered = activeCategory.types != null
    const label = isFiltered
      ? `${activeCategory.label.toLowerCase()} entries`
      : 'activity'
    if (!confirm(`Clear all ${label}? This cannot be undone.`)) return
    setClearing(true)
    try {
      if (isFiltered) {
        await clearAllActivity({ types: activeCategory.types })
        toast.success(`${activeCategory.label} cleared.`)
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

  const clearLabel = activeCategory.types
    ? `Clear ${activeCategory.label.toLowerCase()}`
    : 'Clear all'

  return (
    <div className={embedded ? 'space-y-4' : 'space-y-5'}>
      {embedded ? (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold text-foreground">
              Your activity
            </p>
            <p className="text-[12.5px] text-muted-foreground">
              Reactions, comments, shares, and reels you've watched — visible
              only to you.
            </p>
          </div>
        </div>
      ) : null}

      {/* Filter toolbar — category chips + date-range chips */}
      <Card>
        <CardContent className="space-y-3 p-3 sm:p-4">
          {/* Category chips */}
          <div className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1">
            {CATEGORIES.map((option) => {
              const Icon = option.icon
              const active = category === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setCategory(option.value)}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors',
                    active
                      ? 'border-fg bg-brand text-accent-indigo-foreground shadow-sm'
                      : 'border-line bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  <Icon className="size-3.5" />
                  {option.label}
                </button>
              )
            })}
          </div>

          {/* Date-range chips */}
          <div className="scrollbar-none -mx-1 flex items-center gap-1.5 overflow-x-auto px-1">
            <Compass
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden
            />
            {RANGE_PRESETS.map((option) => {
              const active = range === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setRange(option.value)}
                  className={cn(
                    'inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-[11.5px] font-medium transition-colors',
                    active
                      ? 'border-foreground/20 bg-bg-soft text-foreground'
                      : 'border-transparent text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  {option.label}
                </button>
              )
            })}
            <span className="ml-auto flex shrink-0 items-center">
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
            </span>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-md" />
          <Skeleton className="h-20 w-full rounded-md" />
          <Skeleton className="h-20 w-full rounded-md" />
        </div>
      ) : isEmpty ? (
        <EmptyState
          icon={activeCategory.icon}
          title="Nothing here yet"
          description={
            activeCategory.value === 'REELS'
              ? 'Reels you watch will show up here.'
              : `As you ${
                  activeCategory.value === 'ALL' ? 'use IRC' : `interact with ${activeCategory.label.toLowerCase()}`
                }, your activity lands here.`
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

