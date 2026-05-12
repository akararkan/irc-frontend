import { Heart } from 'lucide-react'

// Backend was collapsed to a single LIKE reaction per entity
// (Instagram-style heart): posts, post comments, QnA answers,
// research, research comments all accept only LIKE and treat repeat
// /react calls as idempotent toggles. The frontend mirrors that — one
// heart, no palette, no emoji breakdowns.
//
// The resolver helpers (`getPostReaction`, `getQnaReaction`,
// `getResearchReaction`) and list helpers are kept so existing call
// sites keep compiling; they all return the same heart record.
const LIKE = {
  type: 'LIKE',
  label: 'Like',
  icon: Heart,
  color: 'text-rose-600',
  bg: 'bg-rose-500/15',
  ring: 'ring-rose-500/30',
  emoji: '♥',
}

export const POST_REACTIONS = ['LIKE']
export const QNA_REACTIONS = ['LIKE']
export const RESEARCH_REACTIONS = ['LIKE']

export function getPostReaction() {
  return LIKE
}

export function getResearchReaction() {
  return LIKE
}

export function getQnaReaction() {
  return LIKE
}

export function getPostReactionList() {
  return [LIKE]
}

export function getResearchReactionList() {
  return [LIKE]
}

export function getQnaReactionList() {
  return [LIKE]
}
