import {
  BookOpen,
  Clapperboard,
  CornerDownRight,
  MessageCircle,
  MessageCircleQuestion,
  Newspaper,
  Search,
  User,
} from 'lucide-react'

const TYPE_META = {
  POST: {
    label: 'Post',
    plural: 'Posts',
    icon: Newspaper,
    accent:
      'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
  },
  REEL: {
    label: 'Reel',
    plural: 'Reels',
    icon: Clapperboard,
    accent:
      'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30',
  },
  RESEARCH: {
    label: 'Research',
    plural: 'Research',
    icon: BookOpen,
    accent:
      'bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30',
  },
  QUESTION: {
    label: 'Question',
    plural: 'Questions',
    icon: MessageCircleQuestion,
    accent: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30',
  },
  ANSWER: {
    label: 'Answer',
    plural: 'Answers',
    icon: CornerDownRight,
    accent:
      'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  },
  USER: {
    label: 'Person',
    plural: 'People',
    icon: User,
    accent: 'bg-brand/10 text-brand border-brand/30',
  },
  HASHTAG: {
    label: 'Tag',
    plural: 'Tags',
    icon: Search,
    accent: 'bg-muted text-muted-foreground border-border',
  },
}

const DEFAULT_META = {
  label: 'Result',
  plural: 'Results',
  icon: Search,
  accent: 'bg-muted text-muted-foreground border-border',
}

export function getSearchTypeMeta(type) {
  return TYPE_META[type] ?? DEFAULT_META
}

const FRONT_END_PREFIXES = [
  '/posts/',
  '/questions/',
  '/research/',
  '/profile/',
  '/reels',
]

function looksLikeKnownRoute(path) {
  if (typeof path !== 'string' || !path.startsWith('/')) return false
  return FRONT_END_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(prefix),
  )
}

/**
 * Resolve a frontend route for a SearchHit.
 *
 * The backend supplies a `deepLink` for every hit; we trust it when it
 * lands on a known FE route prefix, otherwise fall back to (type, id).
 * Posts have no detail route on the FE yet — they degrade to the
 * author's profile so the user has somewhere to go.
 */
export function searchHitHref(hit) {
  if (!hit) return null
  if (typeof hit.deepLink === 'string' && looksLikeKnownRoute(hit.deepLink)) {
    return hit.deepLink
  }

  const id = hit.id ?? hit.resourceId
  const username = hit.authorUsername ?? hit.username

  switch (hit.type) {
    case 'USER':
      return username ? `/profile/${username}` : null
    case 'QUESTION':
    case 'ANSWER':
      return id ? `/questions/${id}` : null
    case 'RESEARCH':
      return id ? `/research/${id}` : null
    case 'REEL':
      return id ? `/reels?id=${id}` : '/reels'
    case 'POST':
      return id ? `/posts/${id}` : null
    case 'HASHTAG': {
      const cleaned = String(hit.tag ?? hit.title ?? '').replace(/^#+/, '')
      return cleaned ? `/search?q=%23${encodeURIComponent(cleaned)}` : null
    }
    default:
      return username ? `/profile/${username}` : null
  }
}
