import { api } from '@/api/client'

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
  )
  return response.data
}

/**
 * GET /api/v1/questions/{questionId}/answers/{answerId}/replies
 * Returns the reanswers (replies) hanging under a top-level answer,
 * ordered oldest-first. Public — no auth required to read.
 */
export async function getAnswerReplies(questionId, answerId) {
  const response = await api.get(
    `/api/v1/questions/${questionId}/answers/${answerId}/replies`,
  )
  return response.data
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

// ── Accept / Unaccept ─────────────────────────────────────────
// Multiple answers can be accepted per question — the backend no
// longer un-accepts other answers when one is accepted.

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

// ══════════════════════════════════════════════════════════════
//  FEEDBACK on answers
//  Only the question author (or admin) may add / edit / delete.
// ══════════════════════════════════════════════════════════════

export async function getAnswerFeedback(questionId, answerId) {
  const response = await api.get(
    `/api/v1/questions/${questionId}/answers/${answerId}/feedback`,
  )
  return response.data
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
