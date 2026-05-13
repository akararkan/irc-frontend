import { setCounter } from '@/lib/counter-store'
import {
  getCurrentUserId,
  setReacted,
  setSaved,
} from '@/lib/my-reaction-store'

/**
 * Translate a backend SSE counter payload into store writes. Field
 * names are exactly as the backend emits them on the per-entity
 * post / research / question streams.
 *
 * The function is pure of intent: it never looks at the event type,
 * only at the payload's counter fields. So one call drains every
 * counter a single event might carry — REPLY_CREATED, for example,
 * publishes both `postCommentCount` (post-level) and `commentReplyCount`
 * (parent-comment-level) in the same payload, and both land in the
 * store in one pass.
 *
 * Unknown / missing fields are silently ignored.
 */
export function applyCounterEvent(kind, entityId, payload) {
  if (!payload || typeof payload !== 'object') return
  const id = payload.id ?? payload.postId ?? payload.researchId ?? payload.questionId ?? entityId
  if (!id) return

  // ── Per-viewer reconciliation ─────────────────────────────────
  // The backend stamps every reaction / save broadcast with an
  // `actorId`. When that matches the current viewer, mirror the
  // change into the my-reaction store so the heart / bookmark on
  // every page reflects the action even if it was performed in
  // another tab or device.
  const me = getCurrentUserId()
  const actorIsMe = me != null && payload.actorId != null && payload.actorId === me
  if (actorIsMe) {
    const type = payload.reactionType ?? null
    switch (payload.eventType) {
      case 'REACTION_ADDED':
        if (kind === 'post') setReacted('post', id, true, type)
        else if (kind === 'research') setReacted('research', id, true, type)
        break
      case 'REACTION_REMOVED':
        if (kind === 'post') setReacted('post', id, false)
        else if (kind === 'research') setReacted('research', id, false)
        break
      case 'COMMENT_REACTION_ADDED':
        if (payload.commentId) {
          setReacted(
            kind === 'research' ? 'researchComment' : 'postComment',
            payload.commentId,
            true,
            type,
          )
        }
        break
      case 'COMMENT_REACTION_REMOVED':
        if (payload.commentId) {
          setReacted(
            kind === 'research' ? 'researchComment' : 'postComment',
            payload.commentId,
            false,
          )
        }
        break
      case 'ANSWER_REACTION_ADDED':
        if (payload.answerId) setReacted('answer', payload.answerId, true, type)
        break
      case 'ANSWER_REACTION_REMOVED':
        if (payload.answerId) setReacted('answer', payload.answerId, false)
        break
      case 'SAVE_COUNT_UPDATED':
        // The save event carries the actor's new state; for posts it's
        // a one-bit toggle so we can infer from `saved`/`isSaved` if
        // present, otherwise the payload's actorId-and-no-flag form
        // means the actor flipped the bit and we toggle locally below.
        if (kind === 'post') {
          if (payload.isSaved !== undefined) setSaved('post', id, Boolean(payload.isSaved))
          else if (payload.saved !== undefined) setSaved('post', id, Boolean(payload.saved))
        } else if (kind === 'research') {
          if (payload.saved !== undefined) setSaved('research', id, Boolean(payload.saved))
          else if (payload.isSaved !== undefined) setSaved('research', id, Boolean(payload.isSaved))
        }
        break
      default:
        break
    }
  }

  // ── Post (and reel) ────────────────────────────────────────────
  if (kind === 'post' || payload.postReactionCount !== undefined ||
      payload.postCommentCount !== undefined ||
      payload.postShareCount !== undefined ||
      payload.postViewCount !== undefined ||
      payload.postSaveCount !== undefined) {
    if (payload.postReactionCount !== undefined)
      setCounter('post', id, 'rx', payload.postReactionCount)
    if (payload.postCommentCount !== undefined)
      setCounter('post', id, 'cm', payload.postCommentCount)
    if (payload.postShareCount !== undefined)
      setCounter('post', id, 'sh', payload.postShareCount)
    if (payload.postViewCount !== undefined)
      setCounter('post', id, 'vw', payload.postViewCount)
    if (payload.postSaveCount !== undefined)
      setCounter('post', id, 'sv', payload.postSaveCount)
  }

  // ── Post comment / reply ───────────────────────────────────────
  if (payload.commentId != null) {
    if (payload.commentReactionCount !== undefined)
      setCounter('postComment', payload.commentId, 'rx', payload.commentReactionCount)
    if (payload.commentReplyCount !== undefined)
      setCounter('postComment', payload.commentId, 'rp', payload.commentReplyCount)
  }
  // REPLY_CREATED carries `parentCommentId` instead of `commentId` for the parent.
  if (payload.parentCommentId != null && payload.commentReplyCount !== undefined) {
    setCounter('postComment', payload.parentCommentId, 'rp', payload.commentReplyCount)
  }

  // ── Research ───────────────────────────────────────────────────
  if (kind === 'research') {
    if (payload.reactionCount !== undefined)
      setCounter('research', id, 'rx', payload.reactionCount)
    if (payload.commentCount !== undefined)
      setCounter('research', id, 'cm', payload.commentCount)
    if (payload.viewCount !== undefined)
      setCounter('research', id, 'vw', payload.viewCount)
    if (payload.downloadCount !== undefined)
      setCounter('research', id, 'dl', payload.downloadCount)
    if (payload.shareCount !== undefined)
      setCounter('research', id, 'sh', payload.shareCount)
    if (payload.saveCount !== undefined)
      setCounter('research', id, 'sv', payload.saveCount)
    if (payload.citationCount !== undefined)
      setCounter('research', id, 'ct', payload.citationCount)
  }

  // ── Research comment ───────────────────────────────────────────
  if (kind === 'research' && payload.commentId != null) {
    if (payload.commentReactionCount !== undefined)
      setCounter('researchComment', payload.commentId, 'rx', payload.commentReactionCount)
  }

  // ── Question (QnA) ─────────────────────────────────────────────
  if (kind === 'question') {
    // The backend sometimes prefixes question counters (`questionViewCount`)
    // and sometimes not (`answerCount` is question-scoped despite no prefix
    // because the only thing that "answers" is a question). We read both.
    if (payload.questionViewCount !== undefined)
      setCounter('question', id, 'vw', payload.questionViewCount)
    if (payload.viewCount !== undefined && payload.answerId == null)
      setCounter('question', id, 'vw', payload.viewCount)
    if (payload.questionAnswerCount !== undefined)
      setCounter('question', id, 'an', payload.questionAnswerCount)
    if (payload.answerCount !== undefined)
      setCounter('question', id, 'an', payload.answerCount)
    if (payload.questionVoteCount !== undefined)
      setCounter('question', id, 'bv', payload.questionVoteCount)
    if (payload.bestAnswerVoteCount !== undefined)
      setCounter('question', id, 'bv', payload.bestAnswerVoteCount)
  }

  // ── Answer (QnA child of question) ─────────────────────────────
  if (payload.answerId != null) {
    if (payload.answerReactionCount !== undefined)
      setCounter('answer', payload.answerId, 'rx', payload.answerReactionCount)
    if (payload.reactionCount !== undefined && kind !== 'research')
      setCounter('answer', payload.answerId, 'rx', payload.reactionCount)
    if (payload.answerReplyCount !== undefined)
      setCounter('answer', payload.answerId, 'rp', payload.answerReplyCount)
  }
}
