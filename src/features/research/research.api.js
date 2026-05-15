import { api } from '@/api/client'
import { API_URL } from '@/config/env'
import { idempotencyHeaders, newIdempotencyKey } from '@/lib/idempotency'

// ── Create / Update / Lifecycle ─────────────────────────────────

/**
 * Single multipart call: JSON "data" part + binary "files[]" parts.
 * Backend matches mediaFiles[i] metadata to files[i] by index.
 */
export async function createResearch({ data, files = [] }) {
  const form = new FormData()
  form.append('data', new Blob([JSON.stringify(data)], { type: 'application/json' }))
  for (const file of files) form.append('files[]', file)
  const response = await api.post('/api/v1/researches', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data
}

export async function updateResearch(id, payload) {
  const response = await api.patch(`/api/v1/researches/${id}`, payload)
  return response.data
}

export async function publishResearch(id) {
  const response = await api.post(`/api/v1/researches/${id}/publish`)
  return response.data
}

export async function unpublishResearch(id) {
  const response = await api.post(`/api/v1/researches/${id}/unpublish`)
  return response.data
}

export async function archiveResearch(id) {
  const response = await api.post(`/api/v1/researches/${id}/archive`)
  return response.data
}

export async function retractResearch(id) {
  const response = await api.post(`/api/v1/researches/${id}/retract`)
  return response.data
}

export async function deleteResearch(id) {
  await api.delete(`/api/v1/researches/${id}`)
}

// ── Cover & video promo ────────────────────────────────────────

export async function uploadResearchCover(id, file) {
  const form = new FormData()
  form.append('image', file)
  const response = await api.post(`/api/v1/researches/${id}/cover-image`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data
}

export async function removeResearchCover(id) {
  const response = await api.delete(`/api/v1/researches/${id}/cover-image`)
  return response.data
}

export async function uploadResearchVideoPromo(id, file) {
  const form = new FormData()
  form.append('video', file)
  const response = await api.post(`/api/v1/researches/${id}/video-promo`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data
}

export async function removeResearchVideoPromo(id) {
  const response = await api.delete(`/api/v1/researches/${id}/video-promo`)
  return response.data
}

// ── Media files (post-creation) ────────────────────────────────

export async function addResearchMedia(id, file, { caption, altText, displayOrder } = {}) {
  const form = new FormData()
  form.append('file', file)
  const params = {}
  if (caption != null) params.caption = caption
  if (altText != null) params.altText = altText
  if (displayOrder != null) params.displayOrder = displayOrder
  const response = await api.post(`/api/v1/researches/${id}/media`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    params,
  })
  return response.data
}

export async function updateResearchMedia(id, mediaId, payload) {
  const response = await api.patch(`/api/v1/researches/${id}/media/${mediaId}`, payload)
  return response.data
}

export async function removeResearchMedia(id, mediaId) {
  await api.delete(`/api/v1/researches/${id}/media/${mediaId}`)
}

// ── Sources ────────────────────────────────────────────────────

export async function uploadResearchSourceFile(id, sourceId, file) {
  const form = new FormData()
  form.append('file', file)
  const response = await api.post(
    `/api/v1/researches/${id}/sources/${sourceId}/file`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return response.data
}

// ── Feeds & search ─────────────────────────────────────────────

export async function getResearchFeed({ page = 0, size = 20, sort = 'publishedAt,desc' } = {}) {
  const response = await api.get('/api/v1/researches/feed', {
    params: { page, size, sort },
  })
  return response.data
}

export async function getResearchFollowingFeed({ page = 0, size = 20 } = {}) {
  const response = await api.get('/api/v1/researches/feed/following', {
    params: { page, size },
  })
  return response.data
}

export async function getResearch(id) {
  const response = await api.get(`/api/v1/researches/${id}`)
  return response.data
}

export async function getResearchBySlug(slug) {
  const response = await api.get(`/api/v1/researches/slug/${encodeURIComponent(slug)}`)
  return response.data
}

export async function getResearchByShareToken(shareToken) {
  const response = await api.get(`/api/v1/researches/share/${encodeURIComponent(shareToken)}`)
  return response.data
}

export async function getResearcherPublications(researcherId, { page = 0, size = 20 } = {}) {
  const response = await api.get(`/api/v1/researches/researcher/${researcherId}`, {
    params: { page, size },
  })
  return response.data
}

export async function searchResearch({ q = '', page = 0, size = 20 } = {}) {
  const response = await api.get('/api/v1/researches/search', { params: { q, page, size } })
  return response.data
}

export async function fullTextSearchResearch({ q = '', page = 0, size = 20 } = {}) {
  const response = await api.get('/api/v1/researches/search/fts', {
    params: { q, page, size },
  })
  return response.data
}

export async function searchResearchByTags({ tags = [], page = 0, size = 20 } = {}) {
  const response = await api.get('/api/v1/researches/search/tags', {
    params: { tags: tags.join(','), page, size },
  })
  return response.data
}

export async function getTrendingTags({ limit = 20 } = {}) {
  const response = await api.get('/api/v1/researches/tags/trending', { params: { limit } })
  return response.data
}

// ── Researcher dashboard ───────────────────────────────────────

export async function getMyDrafts({ page = 0, size = 20 } = {}) {
  const response = await api.get('/api/v1/researches/me/drafts', { params: { page, size } })
  return response.data
}

export async function getMyAllResearch({ page = 0, size = 20 } = {}) {
  const response = await api.get('/api/v1/researches/me/all', { params: { page, size } })
  return response.data
}

// ── Reactions ──────────────────────────────────────────────────
//
// Single LIKE (Instagram heart). Backend accepts an empty body and
// defaults it to LIKE; repeat /react calls are idempotent.

// eslint-disable-next-line no-unused-vars
export async function reactToResearch(researchId, reactionType) {
  await api.post(
    `/api/v1/researches/${researchId}/react`,
    null,
    idempotencyHeaders(newIdempotencyKey()),
  )
}

// Backend returns 200 with the updated ResearchResponse body
// (authoritative reactionCount + currentUserReacted:false). Surfacing
// it here lets callers reconcile their optimistic state against the
// server number on resolve instead of waiting for the SSE echo.
export async function removeResearchReaction(researchId) {
  const response = await api.delete(
    `/api/v1/researches/${researchId}/react`,
    idempotencyHeaders(newIdempotencyKey()),
  )
  return response.data
}

export async function getResearchReactionBreakdown(researchId) {
  const response = await api.get(`/api/v1/researches/${researchId}/reactions`)
  return response.data
}

// ── Comments ───────────────────────────────────────────────────

export async function getResearchComments(researchId, { page = 0, size = 20 } = {}) {
  const response = await api.get(`/api/v1/researches/${researchId}/comments`, {
    params: { page, size },
  })
  return response.data
}

export async function addResearchComment(researchId, payload) {
  const response = await api.post(
    `/api/v1/researches/${researchId}/comments`,
    payload,
    idempotencyHeaders(newIdempotencyKey()),
  )
  return response.data
}

export async function addResearchCommentWithMedia(researchId, { data, media, voice }) {
  const form = new FormData()
  form.append('data', new Blob([JSON.stringify(data ?? {})], { type: 'application/json' }))
  if (media) form.append('media', media)
  if (voice) form.append('voice', voice)
  const response = await api.post(
    `/api/v1/researches/${researchId}/comments/upload`,
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

export async function editResearchComment(researchId, commentId, payload) {
  const response = await api.patch(
    `/api/v1/researches/${researchId}/comments/${commentId}`,
    payload,
  )
  return response.data
}

export async function deleteResearchComment(researchId, commentId) {
  await api.delete(`/api/v1/researches/${researchId}/comments/${commentId}`)
}

/**
 * Single LIKE (Instagram heart). Backend accepts an empty body and
 * defaults to LIKE; repeat calls are idempotent.
 */
// eslint-disable-next-line no-unused-vars
export async function reactToResearchComment(researchId, commentId, reactionType) {
  await api.post(
    `/api/v1/researches/${researchId}/comments/${commentId}/reactions`,
    null,
    idempotencyHeaders(newIdempotencyKey()),
  )
}

// Backend returns 200 with the updated CommentResponse — myReaction is
// null and likeCount has the post-decrement value.
export async function removeResearchCommentReaction(researchId, commentId) {
  const response = await api.delete(
    `/api/v1/researches/${researchId}/comments/${commentId}/reactions`,
    idempotencyHeaders(newIdempotencyKey()),
  )
  return response.data
}

// Back-compat facades — the backend keeps these idempotent endpoints
// for callers that haven't migrated yet. Treat as `react(LIKE)` and
// `removeReaction()` so existing call-sites keep working.
/** @deprecated use `reactToResearchComment(researchId, commentId, 'LIKE')` */
export function likeResearchComment(researchId, commentId) {
  return reactToResearchComment(researchId, commentId, 'LIKE')
}

/** @deprecated use `removeResearchCommentReaction(researchId, commentId)` */
export function unlikeResearchComment(researchId, commentId) {
  return removeResearchCommentReaction(researchId, commentId)
}

// ── Saves / bookmarks ──────────────────────────────────────────

// Backend is now idempotent (was throwing on duplicate save) and
// returns the updated ResearchResponse with authoritative saveCount +
// currentUserSaved. Surface it so the call site reconciles instead of
// relying purely on local optimistic math.
export async function saveResearch(researchId, collection) {
  const key = newIdempotencyKey()
  const response = await api.post(
    `/api/v1/researches/${researchId}/save`,
    null,
    {
      headers: { 'Idempotency-Key': key },
      ...(collection ? { params: { collection } } : {}),
    },
  )
  return response.data
}

// DELETE returns 200 with the updated ResearchResponse.
export async function unsaveResearch(researchId) {
  const response = await api.delete(
    `/api/v1/researches/${researchId}/save`,
    idempotencyHeaders(newIdempotencyKey()),
  )
  return response.data
}

export async function getSavedResearch({ page = 0, size = 20 } = {}) {
  const response = await api.get('/api/v1/researches/me/saved', { params: { page, size } })
  return response.data
}

export async function getSavedCollections() {
  const response = await api.get('/api/v1/researches/me/saved/collections')
  return response.data
}

export async function getSavedByCollection(name, { page = 0, size = 20 } = {}) {
  const response = await api.get('/api/v1/researches/me/saved/collection', {
    params: { name, page, size },
  })
  return response.data
}

// ── View / share / cite / download ─────────────────────────────

export async function recordResearchView(researchId) {
  await api.post(`/api/v1/researches/${researchId}/view`)
}

export async function getResearchShareLink(id) {
  const response = await api.get(`/api/v1/researches/${id}/share-link`)
  return response.data
}

export async function shareResearch(id) {
  const response = await api.post(`/api/v1/researches/${id}/share`)
  return response.data
}

export async function recordResearchCitation(id) {
  await api.post(`/api/v1/researches/${id}/cite`)
}

export async function requestResearchDownload(id, mediaId) {
  const response = await api.post(`/api/v1/researches/${id}/download`, null, {
    params: mediaId ? { mediaId } : undefined,
  })
  return response.data
}

// ══════════════════════════════════════════════════════════════
//  REALTIME  —  /api/v1/researches/{id}/stream  (SSE)
// ══════════════════════════════════════════════════════════════
//
// Mirrors the post + question streams. Emits ResearchRealtimeEventType:
// REACTION_ADDED/CHANGED/REMOVED, COMMENT_CREATED/DELETED, REPLY_CREATED,
// VIEW_COUNT_UPDATED, DOWNLOAD_COUNT_UPDATED, SAVE_COUNT_UPDATED,
// SHARE_COUNT_UPDATED, CITATION_COUNT_UPDATED, RESEARCH_UPDATED,
// RESEARCH_DELETED, RESEARCH_PUBLISHED, plus the standard
// `connected` / `heartbeat` envelope events.
export function researchStreamUrl(researchId, token) {
  const url = new URL(`/api/v1/researches/${researchId}/stream`, API_URL)
  if (token) url.searchParams.set('token', token)
  return url.toString()
}
