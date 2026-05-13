import { api } from '@/api/client'
import { API_URL } from '@/config/env'
import { idempotencyHeaders, newIdempotencyKey } from '@/lib/idempotency'

// ══════════════════════════════════════════════════════════════
//  QUESTIONS  —  /api/v1/questions
// ══════════════════════════════════════════════════════════════

// ── Feeds & read ──────────────────────────────────────────────

export async function getQuestions({ page = 0, size = 20 } = {}) {
  const response = await api.get('/api/v1/questions', { params: { page, size } })
  return response.data
}

export async function getQuestionsFollowing({ page = 0, size = 20 } = {}) {
  const response = await api.get('/api/v1/questions/feed/following', {
    params: { page, size },
  })
  return response.data
}

/**
 * Cursor-paginated public Q&A feed. Same shape as the posts cursor feed —
 * preferred for infinite scroll because performance stays flat as the
 * reader paginates. Server caps `limit` at 50.
 *
 * Response: { items: QuestionResponse[], nextCursor: string|null, hasMore: boolean }
 */
export async function getQuestionsCursor({ cursor, limit = 20 } = {}) {
  const params = { limit }
  if (cursor) params.cursor = cursor
  const response = await api.get('/api/v1/questions/feed/cursor', { params })
  return response.data
}

export async function getMyQuestions({ page = 0, size = 20 } = {}) {
  const response = await api.get('/api/v1/questions/me', {
    params: { page, size },
  })
  return response.data
}

export async function getQuestion(questionId) {
  const response = await api.get(`/api/v1/questions/${questionId}`)
  return response.data
}

// ── Create / Edit / Delete question ───────────────────────────

/**
 * POST /api/v1/questions
 * Body: { title, body, answersLocked?, maxAnswers? }
 */
export async function createQuestion(payload) {
  const response = await api.post('/api/v1/questions', payload)
  return response.data
}

/**
 * PATCH /api/v1/questions/{questionId}
 * Body: { title?, body?, answersLocked?, maxAnswers? } — partial.
 */
export async function editQuestion(questionId, payload) {
  const response = await api.patch(`/api/v1/questions/${questionId}`, payload)
  return response.data
}

export async function deleteQuestion(questionId) {
  await api.delete(`/api/v1/questions/${questionId}`)
}

// ── Answer controls (question owner) ──────────────────────────

export async function lockAnswers(questionId) {
  const response = await api.post(`/api/v1/questions/${questionId}/lock-answers`)
  return response.data
}

export async function unlockAnswers(questionId) {
  const response = await api.delete(`/api/v1/questions/${questionId}/lock-answers`)
  return response.data
}

/** PATCH ?maxAnswers=N — pass null/undefined to clear the limit. */
export async function setAnswerLimit(questionId, maxAnswers) {
  const response = await api.patch(
    `/api/v1/questions/${questionId}/answer-limit`,
    null,
    { params: maxAnswers != null ? { maxAnswers } : {} },
  )
  return response.data
}

// ══════════════════════════════════════════════════════════════
//  ANSWERS  —  /api/v1/questions/{questionId}/answers
// ══════════════════════════════════════════════════════════════

export async function getAnswers(questionId, { page = 0, size = 20 } = {}) {
  const response = await api.get(
    `/api/v1/questions/${questionId}/answers`,
    { params: { page, size } },
  )
  return response.data
}

/**
 * POST /api/v1/questions/{questionId}/answers
 * Body: { body, parentAnswerId?, mediaUrl?, mediaType?, mediaThumbnailUrl?,
 *         voiceUrl?, voiceDurationSeconds?, links?, sources? }
 *
 * `parentAnswerId` — optional. When set, this answer is a *reanswer* (reply)
 *                    threaded under the given top-level answer. Reanswers do
 *                    not count toward the question's max-answers cap, can't
 *                    themselves be replied to (single-level nesting), and
 *                    can't be marked as a "best" answer.
 * `links` — comma-separated list of URLs.
 * `sources` — array of { sourceType, title, citationText?, url?, doi?, isbn? }
 *             where sourceType ∈ URL | DOI | ISBN | MEDIA_FILE | MANUAL.
 *
 * Multiple file attachments are uploaded in a follow-up call to
 * `uploadAnswerAttachment` once the answer is created.
 */
export async function createAnswer(questionId, payload) {
  const response = await api.post(
    `/api/v1/questions/${questionId}/answers`,
    payload,
    idempotencyHeaders(newIdempotencyKey()),
  )
  return response.data
}

/**
 * POST /api/v1/questions/{questionId}/answers/upload — multipart.
 * Parts: `data` (CreateAnswerRequest JSON) + optional `media` (single
 *        image/video) + optional `voice` (audio clip).
 *
 * Mirrors `createPostCommentWithMedia` so the same composer affordance
 * (one inline file picker) works for both surfaces. Sources, link list,
 * and bulk file attachments remain on the JSON `data` and the existing
 * `uploadAnswerAttachment` round-trips.
 */
export async function createAnswerWithMedia(questionId, { data, media, voice }) {
  const form = new FormData()
  form.append(
    'data',
    new Blob([JSON.stringify(data)], { type: 'application/json' }),
  )
  if (media) form.append('media', media)
  if (voice) form.append('voice', voice)
  const response = await api.post(
    `/api/v1/questions/${questionId}/answers/upload`,
    form,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Idempotency-Key': newIdempotencyKey(),
      },
    },
  )
  return response.data
}

/**
 * POST /api/v1/questions/{questionId}/answers/{answerId}/reanswers/upload
 *   (alias: /replies/upload)
 *
 * Reanswer (reply) variant — same multipart shape as the top-level
 * upload above. Server handles `parentAnswerId` from the path so the
 * JSON body doesn't need to repeat it.
 */
export async function createReanswerWithMedia(
  questionId,
  parentAnswerId,
  { data, media, voice },
) {
  const form = new FormData()
  form.append(
    'data',
    new Blob([JSON.stringify(data)], { type: 'application/json' }),
  )
  if (media) form.append('media', media)
  if (voice) form.append('voice', voice)
  const response = await api.post(
    `/api/v1/questions/${questionId}/answers/${parentAnswerId}/reanswers/upload`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return response.data
}

/**
 * GET /api/v1/questions/{questionId}/answers/{answerId}/reanswers
 *   (alias `/replies` is still accepted by older backends — we try the
 *    canonical path first and silently fall back if it 404s.)
 *
 * Returns the reanswers (replies) hanging under any answer (top-level
 * OR a nested reanswer — the structure is recursive), ordered oldest-
 * first. Public — no auth required to read. Block-aware: a viewer in
 * a block edge with the author never sees the row.
 *
 * The backend's `getReanswers(viewerId, Pageable)` overload may
 * serialize either as a bare List (legacy) or a Spring Page envelope.
 * Callers want an array, so we unwrap defensively.
 */
export async function getAnswerReplies(
  questionId,
  answerId,
  { page = 0, size = 50 } = {},
) {
  async function fetchAt(path) {
    const response = await api.get(path, { params: { page, size } })
    const data = response.data
    if (Array.isArray(data)) return data
    if (Array.isArray(data?.content)) return data.content
    return []
  }

  try {
    return await fetchAt(
      `/api/v1/questions/${questionId}/answers/${answerId}/reanswers`,
    )
  } catch (error) {
    if (error?.response?.status === 404) {
      return await fetchAt(
        `/api/v1/questions/${questionId}/answers/${answerId}/replies`,
      )
    }
    throw error
  }
}

/**
 * PATCH /api/v1/questions/{questionId}/answers/{answerId}
 * Body: { body }  (only the body can be edited.)
 */
export async function editAnswer(questionId, answerId, payload) {
  const response = await api.patch(
    `/api/v1/questions/${questionId}/answers/${answerId}`,
    payload,
  )
  return response.data
}

export async function deleteAnswer(questionId, answerId) {
  await api.delete(`/api/v1/questions/${questionId}/answers/${answerId}`)
}

// ── Accept / Unaccept (legacy single-vote path) ───────────────
// Kept for the question-author / admin "accept" flow — the backend
// still allows multiple answers to be accepted per question and does
// NOT auto-unaccept others when a new accept lands.

export async function acceptAnswer(questionId, answerId) {
  const response = await api.post(
    `/api/v1/questions/${questionId}/answers/${answerId}/accept`,
  )
  return response.data
}

export async function unacceptAnswer(questionId, answerId) {
  const response = await api.delete(
    `/api/v1/questions/${questionId}/answers/${answerId}/accept`,
  )
  return response.data
}

// ── Multi-scholar best-answer voting ──────────────────────────
//
// Any scholar (or admin) can vote an answer as "best". Votes are kept
// in `BestAnswerVote(answerId, voterId)` — one vote per (answer,
// scholar) pair, idempotent. The denormalised `bestAnswerVoteCount`
// on the answer is updated atomically; listings render the badge
// without an aggregate query.
//
// Reanswers (`parentAnswerId != null`) cannot be voted — the server
// rejects with 400. The viewer's own vote ships back as `votedByMe`
// on the answer DTO so the toggle stays honest across reloads.

export async function voteBestAnswer(questionId, answerId) {
  const response = await api.post(
    `/api/v1/questions/${questionId}/answers/${answerId}/best`,
  )
  return response.data
}

export async function unvoteBestAnswer(questionId, answerId) {
  const response = await api.delete(
    `/api/v1/questions/${questionId}/answers/${answerId}/best`,
  )
  return response.data
}

// ── Reactions on answers / reanswers ─────────────────────────
//
// Single LIKE (Instagram heart). Backend defaults an empty body to
// LIKE and treats repeat /react calls as idempotent. SocialGuard
// still rejects across block edges; notifications are still skipped
// when the recipient has restricted the reactor.

/** POST .../react — empty body; backend defaults to LIKE. */
// eslint-disable-next-line no-unused-vars
export async function reactToAnswer(questionId, answerId, reactionType) {
  const response = await api.post(
    `/api/v1/questions/${questionId}/answers/${answerId}/react`,
    null,
    idempotencyHeaders(newIdempotencyKey()),
  )
  return response.data
}

export async function removeAnswerReaction(questionId, answerId) {
  await api.delete(
    `/api/v1/questions/${questionId}/answers/${answerId}/react`,
    idempotencyHeaders(newIdempotencyKey()),
  )
}

// ══════════════════════════════════════════════════════════════
//  FEEDBACK on answers
//  Only the question author (or admin) may add / edit / delete.
// ══════════════════════════════════════════════════════════════

export async function getAnswerFeedback(questionId, answerId) {
  const response = await api.get(
    `/api/v1/questions/${questionId}/answers/${answerId}/feedback`,
  )
  const data = response.data
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.content)) return data.content
  return []
}

/**
 * POST /api/v1/questions/{questionId}/answers/{answerId}/feedback
 * Body: { feedbackType, body? }
 *   feedbackType ∈ EXCELLENT, HELPFUL, NEEDS_IMPROVEMENT, INCORRECT, OFF_TOPIC
 */
export async function addAnswerFeedback(questionId, answerId, payload) {
  const response = await api.post(
    `/api/v1/questions/${questionId}/answers/${answerId}/feedback`,
    payload,
  )
  return response.data
}

/**
 * PATCH .../feedback/{feedbackId} — author of the feedback only.
 * Body: { feedbackType?, body? }
 */
export async function editAnswerFeedback(questionId, answerId, feedbackId, payload) {
  const response = await api.patch(
    `/api/v1/questions/${questionId}/answers/${answerId}/feedback/${feedbackId}`,
    payload,
  )
  return response.data
}

export async function deleteAnswerFeedback(questionId, answerId, feedbackId) {
  await api.delete(
    `/api/v1/questions/${questionId}/answers/${answerId}/feedback/${feedbackId}`,
  )
}

// ══════════════════════════════════════════════════════════════
//  ATTACHMENTS  —  multipart file uploads on an answer
//  PDF, Word, ZIP, video, audio, images, etc. are all accepted;
//  the server resolves MediaType from the MIME type.
// ══════════════════════════════════════════════════════════════

export async function getAnswerAttachments(questionId, answerId) {
  const response = await api.get(
    `/api/v1/questions/${questionId}/answers/${answerId}/attachments`,
  )
  return response.data
}

/**
 * POST .../attachments  — multipart/form-data
 * @param {File}   file
 * @param {object} [opts] — { caption?, displayOrder? }
 */
export async function uploadAnswerAttachment(
  questionId,
  answerId,
  file,
  { caption, displayOrder } = {},
) {
  const form = new FormData()
  form.append('file', file)
  const params = {}
  if (caption != null && caption !== '') params.caption = caption
  if (displayOrder != null) params.displayOrder = displayOrder
  const response = await api.post(
    `/api/v1/questions/${questionId}/answers/${answerId}/attachments`,
    form,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      params,
    },
  )
  return response.data
}

export async function deleteAnswerAttachment(questionId, answerId, attachmentId) {
  await api.delete(
    `/api/v1/questions/${questionId}/answers/${answerId}/attachments/${attachmentId}`,
  )
}

// ══════════════════════════════════════════════════════════════
//  SOURCES / REFERENCES on an answer
//  Citation references (URL / DOI / ISBN / MEDIA_FILE / MANUAL).
// ══════════════════════════════════════════════════════════════

export async function getAnswerSources(questionId, answerId) {
  const response = await api.get(
    `/api/v1/questions/${questionId}/answers/${answerId}/sources`,
  )
  return response.data
}

/**
 * POST .../sources
 * Body: { sourceType, title, citationText?, url?, doi?, isbn? }
 *   sourceType ∈ URL | DOI | ISBN | MEDIA_FILE | MANUAL
 */
export async function addAnswerSource(questionId, answerId, payload) {
  const response = await api.post(
    `/api/v1/questions/${questionId}/answers/${answerId}/sources`,
    payload,
  )
  return response.data
}

export async function deleteAnswerSource(questionId, answerId, sourceId) {
  await api.delete(
    `/api/v1/questions/${questionId}/answers/${answerId}/sources/${sourceId}`,
  )
}

// ══════════════════════════════════════════════════════════════
//  REALTIME  —  /api/v1/questions/{questionId}/stream  (SSE)
// ══════════════════════════════════════════════════════════════
//
// Mirrors the per-post stream. Emits QnaRealtimeEventType events:
// ANSWER_CREATED, REANSWER_CREATED, ANSWER_EDITED, ANSWER_DELETED,
// ANSWER_REACTION_ADDED/CHANGED/REMOVED, ANSWER_ACCEPTED/UNACCEPTED,
// ANSWER_FEEDBACK_ADDED/EDITED/DELETED,
// QUESTION_UPDATED/DELETED/LOCKED/UNLOCKED, plus the standard
// `connected` / `heartbeat` envelope events.
export function questionStreamUrl(questionId, token) {
  const url = new URL(`/api/v1/questions/${questionId}/stream`, API_URL)
  if (token) url.searchParams.set('token', token)
  return url.toString()
}
