import {
  Angry,
  Frown,
  HandHeart,
  HeartHandshake,
  Heart,
  HelpCircle,
  Laugh,
  Lightbulb,
  PartyPopper,
  Smile,
  ThumbsUp,
} from 'lucide-react'

const POST_REACTION_MAP = {
  LIKE: {
    label: 'Like',
    icon: ThumbsUp,
    color: 'text-sky-500',
    bg: 'bg-sky-500/15',
    ring: 'ring-sky-500/30',
    emoji: '👍',
  },
  LOVE: {
    label: 'Love',
    icon: Heart,
    color: 'text-rose-500',
    bg: 'bg-rose-500/15',
    ring: 'ring-rose-500/30',
    emoji: '❤️',
  },
  HAHA: {
    label: 'Haha',
    icon: Laugh,
    color: 'text-amber-500',
    bg: 'bg-amber-500/15',
    ring: 'ring-amber-500/30',
    emoji: '😂',
  },
  WOW: {
    label: 'Wow',
    icon: Smile,
    color: 'text-orange-500',
    bg: 'bg-orange-500/15',
    ring: 'ring-orange-500/30',
    emoji: '😮',
  },
  SAD: {
    label: 'Sad',
    icon: Frown,
    color: 'text-indigo-500',
    bg: 'bg-indigo-500/15',
    ring: 'ring-indigo-500/30',
    emoji: '😢',
  },
  ANGRY: {
    label: 'Angry',
    icon: Angry,
    color: 'text-red-600',
    bg: 'bg-red-600/15',
    ring: 'ring-red-600/30',
    emoji: '😠',
  },
  CARE: {
    label: 'Care',
    icon: HeartHandshake,
    color: 'text-pink-500',
    bg: 'bg-pink-500/15',
    ring: 'ring-pink-500/30',
    emoji: '🤗',
  },
  INSIGHTFUL: {
    label: 'Insightful',
    icon: Lightbulb,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/15',
    ring: 'ring-emerald-500/30',
    emoji: '💡',
  },
}

const RESEARCH_REACTION_MAP = {
  LIKE: POST_REACTION_MAP.LIKE,
  LOVE: POST_REACTION_MAP.LOVE,
  INSIGHTFUL: POST_REACTION_MAP.INSIGHTFUL,
  CELEBRATE: {
    label: 'Celebrate',
    icon: PartyPopper,
    color: 'text-fuchsia-500',
    bg: 'bg-fuchsia-500/15',
    ring: 'ring-fuchsia-500/30',
    emoji: '🎉',
  },
  CURIOUS: {
    label: 'Curious',
    icon: HelpCircle,
    color: 'text-amber-500',
    bg: 'bg-amber-500/15',
    ring: 'ring-amber-500/30',
    emoji: '🤔',
  },
  SUPPORT: {
    label: 'Support',
    icon: HandHeart,
    color: 'text-violet-500',
    bg: 'bg-violet-500/15',
    ring: 'ring-violet-500/30',
    emoji: '🙌',
  },
}

export const POST_REACTIONS = Object.keys(POST_REACTION_MAP)
export const RESEARCH_REACTIONS = Object.keys(RESEARCH_REACTION_MAP)

export function getPostReaction(type) {
  return POST_REACTION_MAP[type] ?? POST_REACTION_MAP.LIKE
}

export function getResearchReaction(type) {
  return RESEARCH_REACTION_MAP[type] ?? RESEARCH_REACTION_MAP.LIKE
}

export function getPostReactionList() {
  return POST_REACTIONS.map((type) => ({ type, ...POST_REACTION_MAP[type] }))
}

export function getResearchReactionList() {
  return RESEARCH_REACTIONS.map((type) => ({ type, ...RESEARCH_REACTION_MAP[type] }))
}
