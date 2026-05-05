import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  Activity as ActivityIcon,
  Clapperboard,
  Loader2,
  MessageCircle,
  Play,
  Repeat2,
  Sparkles,
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
  getUsername,
  resolveMediaUrl,
} from '@/lib/format'
import { getPostReaction } from '@/lib/reactions'
import {
  clearAllActivity,
  deleteActivity,
  getMyActivity,
} from '@/features/activity/activity.api'

// ─── Filter chips ───────────────────────────────────────────────────
const FILTERS = [
  { value: 'ALL', label: 'All', icon: ActivityIcon },
  { value: 'POST_REACTION', label: 'Reactions', icon: ThumbsUp },
  { value: 'POST_COMMENT', label: 'Comments', icon: MessageCircle },
  { value: 'POST_COMMENT_REACTION', label: 'Comment reactions', icon: Sparkles },
  { value: 'POST_SHARE', label: 'Shares', icon: Repeat2 },
  { value: 'REEL_WATCH', label: 'Watched reels', icon: Clapperboard },
]

// ─── Per-type metadata for the activity-row icon ────────────────────
const TYPE_META = {
  POST_REACTION: {
    icon: ThumbsUp,
    tone: 'text-sky-600 bg-sky-500/10 ring-sky-500/30',
    verb: (item) => {
      const r = item.reactionType ? getPostReaction(item.reactionType) : null
      return r ? `Reacted ${r.emoji} ${r.label}` : 'Reacted'
    },
  },
  POST_COMMENT: {
    icon: MessageCircle,
    tone: 'text-violet-600 bg-violet-500/10 ring-violet-500/30',
    verb: () => 'Commented',
  },
  POST_COMMENT_REACTION: {
    icon: Sparkles,
    tone: 'text-amber-600 bg-amber-500/10 ring-amber-500/30',
    verb: (item) => {
      const r = item.reactionType ? getPostReaction(item.reactionType) : null
      return r ? `Reacted ${r.emoji} on a comment` : 'Reacted on a comment'
    },
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
}

function formatDuration(totalSeconds) {
  if (!totalSeconds || totalSeconds < 1) return '0s'
  const m = Math.floor(totalSeconds / 60)
  const s = Math.floor(totalSeconds % 60)
  if (m === 0) return `${s}s`
  return `${m}m ${s}s`
}

// ─── Activity row ───────────────────────────────────────────────────
function ActivityRow({ item, onDelete }) {
  const meta = TYPE_META[item.activityType] ?? TYPE_META.POST_COMMENT
  const Icon = meta.icon
  const author = item.post?.author
  const profileHref = author?.username ? `/profile/${author.username}` : null

  // The post / comment text preview is what to show under the verb.
  const preview = item.comment?.textPreview || item.post?.textPreview || ''
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
                    {getFullName(author) || getUsername(author)}
                  </span>
                </Link>
              ) : (
                <span className="text-muted-foreground">
                  {getFullName(author) || getUsername(author)}
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
          <p className="mt-1 line-clamp-2 text-[13px] text-foreground/85">
            {preview}
          </p>
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
