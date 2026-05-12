import { api } from '@/api/client'
import { API_URL } from '@/config/env'

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
  await api.post(`/api/v1/researches/${researchId}/react`)
}

export async function removeResearchReaction(researchId) {
  await api.delete(`/api/v1/researches/${researchId}/react`)
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
  const response = await api.post(`/api/v1/researches/${researchId}/comments`, payload)
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
    { headers: { 'Content-Type': 'multipart/form-data' } },
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
  )
}

export async function removeResearchCommentReaction(researchId, commentId) {
  await api.delete(
    `/api/v1/researches/${researchId}/comments/${commentId}/reactions`,
  )
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

export async function saveResearch(researchId, collection) {
  await api.post(
    `/api/v1/researches/${researchId}/save`,
    null,
    collection ? { params: { collection } } : undefined,
  )
}

export async function unsaveResearch(researchId) {
  await api.delete(`/api/v1/researches/${researchId}/save`)
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
