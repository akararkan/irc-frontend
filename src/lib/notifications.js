import {
  AtSign,
  Award,
  Bell,
  BookOpen,
  CornerDownRight,
  Globe,
  Heart,
  Lock,
  MessageCircle,
  MessageCircleQuestion,
  Pencil,
  Repeat2,
  Settings,
  Share2,
  Sparkles,
  Unlock,
  UserPlus,
  Users,
} from 'lucide-react'

import { getHandle } from '@/lib/format'

const KNOWN_FRONTEND_PREFIXES = [
  '/posts/',
  '/questions/',
  '/research/',
  '/profile/',
  '/reels',
]

function looksLikeKnownRoute(path) {
  if (typeof path !== 'string' || !path.startsWith('/')) return false
  return KNOWN_FRONTEND_PREFIXES.some((prefix) =>
    path === prefix || path.startsWith(prefix),
  )
}

/**
 * Map a notification to a frontend route.
 *
 * Order of preference:
 *   1. Server-supplied `deepLink` if it lands on a route prefix the
 *      frontend actually has — the backend now produces these for posts,
 *      questions, research, etc.
 *   2. `resourceType` + `resourceId` mapping (legacy fallback). Posts
 *      currently route to the actor's profile because no `/posts/:id`
 *      page exists yet on the FE.
 *   3. Actor profile.
 */
export function notificationHref(notification) {
  if (!notification) return null
  const deep = notification.deepLink
  if (typeof deep === 'string' && looksLikeKnownRoute(deep)) {
    return deep
  }

  const { resourceType, resourceId, actorUsername, lastActorUsername } =
    notification
  const username = lastActorUsername ?? actorUsername

  if (!resourceType || !resourceId) {
    return username ? `/profile/${username}` : null
  }
  switch (resourceType) {
    case 'Research':
    case 'ResearchComment':
      return `/research/${resourceId}`
    case 'Question':
    case 'QuestionAnswer':
      return `/questions/${resourceId}`
    case 'Post':
    case 'PostComment':
      return resourceId ? `/posts/${resourceId}` : null
    case 'User':
      return username ? `/profile/${username}` : null
    default:
      return username ? `/profile/${username}` : null
  }
}

/**
 * Pick the best display name for the row's primary actor. Aggregated
 * rows put the *latest* contributor up front (`lastActorUsername`); for
 * a single-actor row the original `actorUsername` is the same.
 */
export function pickPrimaryActor(notification) {
  if (!notification) return null
  const username = notification.lastActorUsername ?? notification.actorUsername
  const id = notification.lastActorId ?? notification.actorId
  if (!id && !username) return null
  return {
    id: id ?? null,
    username: username ?? null,
    fullName: notification.actorFullName ?? null,
    profileImage: notification.actorProfileImage ?? null,
  }
}

/**
 * "{firstName}" — falls back to a display-safe handle (email-shaped
 * usernames are reduced to their local-part so we never leak an
 * address in a notification), then "Someone".
 */
export function actorDisplayName(actor) {
  if (!actor) return 'Someone'
  if (actor.fullName) return actor.fullName.split(/\s+/)[0]
  const handle = getHandle(actor)
  if (handle) return handle
  return 'Someone'
}

// Per-type visual metadata. Two callers (the bell panel preview and the
// notifications page row) share the same icon + accent, so an editorial
// reaction looks the same wherever it appears.
const TYPE_META = {
  USER_MENTIONED: {
    icon: AtSign,
    accent: 'bg-brand/10 text-brand',
    verb: 'mentioned you',
  },
  USER_FOLLOWED: {
    icon: UserPlus,
    accent: 'bg-sky-500/10 text-sky-600 dark:text-sky-300',
    verb: 'followed you',
  },
  NEW_FOLLOWER: {
    icon: UserPlus,
    accent: 'bg-sky-500/10 text-sky-600 dark:text-sky-300',
    verb: 'followed you',
  },
  UNBLOCKED: {
    icon: UserPlus,
    accent: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-300',
    verb: 'unblocked you',
  },
  POST_REACTED: {
    icon: Heart,
    accent: 'bg-rose-500/10 text-rose-600 dark:text-rose-300',
    verb: 'reacted to your post',
  },
  POST_COMMENTED: {
    icon: MessageCircle,
    accent: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
    verb: 'commented on your post',
  },
  POST_COMMENT_REPLIED: {
    icon: CornerDownRight,
    accent: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
    verb: 'replied to your comment',
  },
  POST_COMMENT_REACTED: {
    icon: Heart,
    accent: 'bg-rose-500/10 text-rose-600 dark:text-rose-300',
    verb: 'reacted to your comment',
  },
  POST_SHARED: {
    icon: Repeat2,
    accent: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
    verb: 'shared your post',
  },
  ANSWER_REACTED: {
    icon: Heart,
    accent: 'bg-rose-500/10 text-rose-600 dark:text-rose-300',
    verb: 'reacted to your answer',
  },
  ANSWER_REPLIED: {
    icon: CornerDownRight,
    accent: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
    verb: 'replied to your answer',
  },
  ANSWER_ACCEPTED: {
    icon: Award,
    accent: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
    verb: 'marked your answer as best',
  },
  ANSWER_FEEDBACK_RECEIVED: {
    icon: MessageCircle,
    accent: 'bg-sky-500/10 text-sky-600 dark:text-sky-300',
    verb: 'gave feedback on your answer',
  },
  ANSWER_FEEDBACK_ADDED: {
    icon: MessageCircle,
    accent: 'bg-sky-500/10 text-sky-600 dark:text-sky-300',
    verb: 'gave feedback on your answer',
  },
  QUESTION_ANSWERED: {
    icon: MessageCircleQuestion,
    accent: 'bg-sky-500/10 text-sky-600 dark:text-sky-300',
    verb: 'answered your question',
  },
  QUESTION_LOCKED: {
    icon: Lock,
    accent: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-300',
    verb: 'locked the answers',
  },
  QUESTION_UNLOCKED: {
    icon: Unlock,
    accent: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-300',
    verb: 'reopened the answers',
  },
  PUBLICATION_LIKED: {
    icon: Heart,
    accent: 'bg-rose-500/10 text-rose-600 dark:text-rose-300',
    verb: 'reacted to your research',
  },
  PUBLICATION_COMMENTED: {
    icon: MessageCircle,
    accent: 'bg-violet-500/10 text-violet-600 dark:text-violet-300',
    verb: 'commented on your research',
  },
  RESEARCH_COMMENTED: {
    icon: MessageCircle,
    accent: 'bg-violet-500/10 text-violet-600 dark:text-violet-300',
    verb: 'commented on your research',
  },
  RESEARCH_REACTED: {
    icon: Heart,
    accent: 'bg-rose-500/10 text-rose-600 dark:text-rose-300',
    verb: 'reacted to your research',
  },
  RESEARCH_PUBLISHED: {
    icon: Pencil,
    accent: 'bg-violet-500/10 text-violet-600 dark:text-violet-300',
    verb: 'published new research',
  },
}

const DEFAULT_META = {
  icon: Bell,
  accent: 'bg-muted text-foreground',
  verb: 'sent you an update',
}

export function getNotificationTypeMeta(type) {
  return TYPE_META[type] ?? DEFAULT_META
}

// ─── Categories ───────────────────────────────────────────────────────
//
// Mirrors `NotificationCategory` on the backend — one tab per category.
// The "All" option is rendered separately on the page; this list is the
// concrete categories the API will accept as a `category` filter.
export const NOTIFICATION_CATEGORIES = [
  {
    value: 'POSTS',
    label: 'Posts',
    icon: Sparkles,
    accent:
      'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  {
    value: 'QNA',
    label: 'Q&A',
    icon: MessageCircleQuestion,
    accent: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  },
  {
    value: 'RESEARCH',
    label: 'Research',
    icon: BookOpen,
    accent:
      'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300',
  },
  {
    value: 'MENTIONS',
    label: 'Mentions',
    icon: AtSign,
    accent: 'border-brand/40 bg-brand/10 text-brand',
  },
  {
    value: 'SOCIAL',
    label: 'Social',
    icon: Users,
    accent:
      'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  {
    value: 'SYSTEM',
    label: 'System',
    icon: Settings,
    accent:
      'border-zinc-500/40 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300',
  },
]

const CATEGORY_LOOKUP = Object.fromEntries(
  NOTIFICATION_CATEGORIES.map((entry) => [entry.value, entry]),
)

const CATEGORY_FALLBACK = {
  value: 'OTHER',
  label: 'Other',
  icon: Globe,
  accent: 'border-border bg-muted text-foreground',
}

export function getNotificationCategoryMeta(category) {
  if (!category) return CATEGORY_FALLBACK
  return CATEGORY_LOOKUP[category] ?? CATEGORY_FALLBACK
}
