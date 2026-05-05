import { questionStreamUrl } from '@/features/qna/qna.api'
import { useSseStream } from '@/hooks/use-sse-stream'

// QnaRealtimeEventType values broadcast on `/api/v1/questions/{id}/stream`.
// Mirrors the post-stream contract: each one becomes a named SSE listener.
//
// Append new types here when the backend grows them — the existing
// handler-routing logic picks them up automatically.
export const QUESTION_REALTIME_EVENTS = [
  'QUESTION_UPDATED',
  'QUESTION_DELETED',
  'QUESTION_LOCKED',
  'QUESTION_UNLOCKED',
  'ANSWER_CREATED',
  'REANSWER_CREATED',
  'ANSWER_EDITED',
  'ANSWER_DELETED',
  'ANSWER_ACCEPTED',
  'ANSWER_UNACCEPTED',
  'ANSWER_REACTION_ADDED',
  'ANSWER_REACTION_CHANGED',
  'ANSWER_REACTION_REMOVED',
  'ANSWER_FEEDBACK_ADDED',
  'ANSWER_FEEDBACK_EDITED',
  'ANSWER_FEEDBACK_DELETED',
]

/**
 * Subscribe to a question's realtime SSE stream.
 *
 * `handlers` map QnaRealtimeEventType → callback, plus an optional
 * catch-all `onEvent(type, payload)`. `enabled: false` stands the
 * connection down without unmounting the host component.
 */
export function useQuestionStream(questionId, handlers, { enabled = true } = {}) {
  return useSseStream(questionId, handlers, {
    urlBuilder: questionStreamUrl,
    eventNames: QUESTION_REALTIME_EVENTS,
    enabled,
  })
}
