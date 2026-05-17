import { api } from '@/api/client'
import { API_URL } from '@/config/env'

// ══════════════════════════════════════════════════════════════
//  STORIES  —  /api/v1/stories
// ══════════════════════════════════════════════════════════════

// ── Create ─────────────────────────────────────────────────────

/**
 * Create a text story with background and overlays.
 * payload: {
 *   textContent, visibility, backgroundType, backgroundValue,
 *   overlaysJson, soundId?, clipStartSeconds?, volume?
 * }
 */
export async function createTextStory(payload) {
  const response = await api.post('/api/v1/stories/text', payload)
  return response.data
}

/**
 * Create an image or video story — multipart.
 * Parts: `data` (CreateMediaStoryRequest JSON) + `media` (image or video file).
 * Server enforces ≤ 30 s for video and trims via ffmpeg if exceeded.
 * data: { storyType, visibility, textContent?, overlaysJson?, soundId?,
 *          clipStartSeconds?, volume?, durationSeconds? }
 */
export async function createMediaStory({ data, media }) {
  const form = new FormData()
  form.append('data', new Blob([JSON.stringify(data)], { type: 'application/json' }))
  if (media) form.append('media', media)
  const response = await api.post('/api/v1/stories/media', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data
}

/**
 * Share existing content as a story card.
 * payload: {
 *   linkedContentId, storyType (LINKED_POST | LINKED_REEL | LINKED_QNA | LINKED_RESEARCH),
 *   textContent?, visibility?
 * }
 */
export async function shareToStory(payload) {
  const response = await api.post('/api/v1/stories/share', payload)
  return response.data
}

// ── Read ────────────────────────────────────────────────────────

/**
 * Story tray — authors with active stories, grouped and sorted (unseen first).
 * Returns StoryTrayGroup[]: [{ author, hasUnseen, stories[] }]
 */
export async function getStoryTray() {
  const response = await api.get('/api/v1/stories/tray')
  return response.data
}

/**
 * All active (non-expired, non-deleted) stories for a specific user,
 * visibility-filtered for the viewer.
 */
export async function getStoriesByUser(userId) {
  const response = await api.get(`/api/v1/stories/user/${userId}`)
  return response.data
}

/**
 * SSE real-time stream for a single story — view counts, reactions, poll votes.
 * Returns a URL string (use with EventSource). Token appended as query param
 * because EventSource cannot send Authorization headers.
 */
export function storyStreamUrl(storyId, token) {
  const url = new URL(`/api/v1/stories/${storyId}/stream`, API_URL)
  if (token) url.searchParams.set('token', token)
  return url.toString()
}

/**
 * SSE stream for the viewer's story tray.
 * Fires new_story instantly when a followed user posts, and story_removed on
 * expiry / delete — no polling needed. Heartbeat every 25s.
 * Returns a URL string (connect with EventSource).
 */
export function storyTrayStreamUrl(token) {
  const url = new URL('/api/v1/stories/tray/stream', API_URL)
  if (token) url.searchParams.set('token', token)
  return url.toString()
}

/**
 * Segmented view count breakdown for the story author.
 * Returns { total, byCloseFriends, byFollowers, byPublic, byAuthor }.
 * 403 when called by a non-author.
 */
export async function getStoryViewBreakdown(storyId) {
  const response = await api.get(`/api/v1/stories/${storyId}/views/breakdown`)
  return response.data
}

// ── Interactions ────────────────────────────────────────────────

/** Record a view + watch duration. watchDurationMs: milliseconds watched. */
export async function recordStoryView(storyId, { watchDurationMs = 0 } = {}) {
  await api.post(`/api/v1/stories/${storyId}/view`, { watchDurationMs })
}

/** React with an emoji. At most one reaction per viewer per story. */
export async function reactToStory(storyId, emoji) {
  const response = await api.post(`/api/v1/stories/${storyId}/react`, { emoji })
  return response.data
}

/** Send a text reply to a story (creates a DM thread). */
export async function replyToStory(storyId, text) {
  const response = await api.post(`/api/v1/stories/${storyId}/reply`, { text })
  return response.data
}

/** Cast a poll vote. choice: "A" | "B" */
export async function voteOnStoryPoll(storyId, choice) {
  const response = await api.post(`/api/v1/stories/${storyId}/poll/vote`, { choice })
  return response.data
}

/** Delete own story (soft-delete, cleans R2 media). */
export async function deleteStory(storyId) {
  await api.delete(`/api/v1/stories/${storyId}`)
}

// ── Sound on stories ──────────────────────────────────────────────────

/** Attach or replace a sound on an existing story. payload: { soundId, clipStartSeconds, volume } */
export async function attachSoundToStory(storyId, payload) {
  const response = await api.patch(`/api/v1/stories/${storyId}/sound`, payload)
  return response.data
}

/** Remove sound from a story. */
export async function removeSoundFromStory(storyId) {
  await api.delete(`/api/v1/stories/${storyId}/sound`)
}

/**
 * Paginated list of viewers for own story.
 * Returns StoryViewerResponse[]: [{ viewer, watchDurationMs, reactionEmoji, replied, viewedAt }]
 */
export async function getStoryViewers(storyId, { page = 0, size = 20 } = {}) {
  const response = await api.get(`/api/v1/stories/${storyId}/viewers`, {
    params: { page, size },
  })
  return response.data
}

// ══════════════════════════════════════════════════════════════
//  HIGHLIGHTS  —  /api/v1/highlights
// ══════════════════════════════════════════════════════════════

/** Create a highlight collection. payload: { title, displayOrder? } */
export async function createHighlight(payload) {
  const response = await api.post('/api/v1/highlights', payload)
  return response.data
}

/** Update highlight title or display order. payload: { title?, displayOrder? } */
export async function updateHighlight(highlightId, payload) {
  const response = await api.patch(`/api/v1/highlights/${highlightId}`, payload)
  return response.data
}

/** Add a story to a highlight — story survives past expiry inside the highlight. */
export async function addStoryToHighlight(highlightId, storyId) {
  const response = await api.post(`/api/v1/highlights/${highlightId}/stories`, null, {
    params: { storyId },
  })
  return response.data
}

/** Remove a story from a highlight. */
export async function removeStoryFromHighlight(highlightId, storyId) {
  await api.delete(`/api/v1/highlights/${highlightId}/stories/${storyId}`)
}

/** Delete the highlight collection (stories remain, highlight FK cleared). */
export async function deleteHighlight(highlightId) {
  await api.delete(`/api/v1/highlights/${highlightId}`)
}

/** All highlights for a profile, ordered by displayOrder. Public. */
export async function getHighlightsByUser(userId) {
  const response = await api.get(`/api/v1/highlights/user/${userId}`)
  return response.data
}

/** Paginated stories inside a specific highlight. Public. */
export async function getHighlightStories(highlightId, { page = 0, size = 20 } = {}) {
  const response = await api.get(`/api/v1/highlights/${highlightId}/stories`, {
    params: { page, size },
  })
  return response.data
}
