import { api } from '@/api/client'

// ══════════════════════════════════════════════════════════════
//  STORIES & CLOSE-FRIENDS  —  /api/v1
// ══════════════════════════════════════════════════════════════

// ── Stories ────────────────────────────────────────────────────

/**
 * POST /api/v1/stories — create story (24-hr TTL, hourly expiry job).
 */
export async function createStory(payload) {
  const response = await api.post('/api/v1/stories', payload)
  return response.data
}

/** GET /api/v1/stories/by-author/{authorId} — a user's active stories. */
export async function getStoriesByAuthor(authorId) {
  const response = await api.get(`/api/v1/stories/by-author/${authorId}`)
  return response.data
}

/** DELETE /api/v1/stories/{storyId} — delete story. */
export async function deleteStory(storyId) {
  await api.delete(`/api/v1/stories/${storyId}`)
}

/** POST /api/v1/stories/{storyId}/views?userId= — record a view. */
export async function recordStoryView(storyId, userId) {
  const response = await api.post(`/api/v1/stories/${storyId}/views`, null, {
    params: userId ? { userId } : undefined,
  })
  return response.data
}

/** GET /api/v1/stories/{storyId}/views — viewer list (author-only). */
export async function listStoryViews(storyId) {
  const response = await api.get(`/api/v1/stories/${storyId}/views`)
  return response.data
}

// ── Close-friends list (story audience) ────────────────────────
// Owner is JWT-derived server-side. These wrappers accept both old
// `(ownerId, friendId)` and new `(friendId)` signatures.

export async function listCloseFriends(/* ownerId */) {
  const response = await api.get('/api/v1/close-friends')
  return response.data
}

export async function addCloseFriend(...args) {
  const friendId = args.length >= 2 ? args[1] : args[0]
  const response = await api.post('/api/v1/close-friends', null, {
    params: { friendId },
  })
  return response.data
}

export async function removeCloseFriend(...args) {
  const friendId = args.length >= 2 ? args[1] : args[0]
  await api.delete('/api/v1/close-friends', { params: { friendId } })
}

export async function isCloseFriend(...args) {
  const candidateId = args.length >= 2 ? args[1] : args[0]
  const response = await api.get('/api/v1/close-friends/is-member', {
    params: { candidateId },
  })
  return response.data
}

// ── Story polls ────────────────────────────────────────────────

/** POST /api/v1/stories/{storyId}/poll — attach 2-option poll (author only). */
export async function attachPollToStory(storyId, payload) {
  const response = await api.post(`/api/v1/stories/${storyId}/poll`, payload)
  return response.data
}

/** GET /api/v1/stories/{storyId}/poll */
export async function getStoryPoll(storyId) {
  const response = await api.get(`/api/v1/stories/${storyId}/poll`)
  return response.data
}

/** POST /api/v1/polls/{pollId}/vote?userId=&choice=A|B — cast vote. */
export async function voteOnPoll(pollId, userId, choice) {
  const response = await api.post(`/api/v1/polls/${pollId}/vote`, null, {
    params: { userId, choice },
  })
  return response.data
}

/** GET /api/v1/polls/{pollId}/vote/me?userId= — my vote. */
export async function getMyPollVote(pollId, userId) {
  const response = await api.get(`/api/v1/polls/${pollId}/vote/me`, {
    params: { userId },
  })
  return response.data
}

/** GET /api/v1/polls/{pollId}/results — tally. */
export async function getPollResults(pollId) {
  const response = await api.get(`/api/v1/polls/${pollId}/results`)
  return response.data
}

/** GET /api/v1/polls/{pollId}/voters/{choice} — voters per choice. */
export async function getPollVoters(pollId, choice) {
  const response = await api.get(`/api/v1/polls/${pollId}/voters/${choice}`)
  return response.data
}

// ══════════════════════════════════════════════════════════════
//  HIGHLIGHTS  —  /api/v1/highlights
// ══════════════════════════════════════════════════════════════

/** POST /api/v1/highlights — create highlight. */
export async function createHighlight(payload) {
  const response = await api.post('/api/v1/highlights', payload)
  return response.data
}

/** GET /api/v1/highlights/by-author/{authorId} — a user's highlights. */
export async function getHighlightsByAuthor(authorId) {
  const response = await api.get(`/api/v1/highlights/by-author/${authorId}`)
  return response.data
}

/** POST /api/v1/highlights/{highlightId}/stories/{storyId} — add story to highlight. */
export async function addStoryToHighlight(highlightId, storyId) {
  const response = await api.post(
    `/api/v1/highlights/${highlightId}/stories/${storyId}`,
  )
  return response.data
}

/** GET /api/v1/highlights/{highlightId}/stories — stories in a highlight. */
export async function getHighlightStories(highlightId) {
  const response = await api.get(`/api/v1/highlights/${highlightId}/stories`)
  return response.data
}

/** DELETE /api/v1/highlights/{highlightId}/stories/{storyId} — remove story from highlight. */
export async function removeStoryFromHighlight(highlightId, storyId) {
  await api.delete(`/api/v1/highlights/${highlightId}/stories/${storyId}`)
}

// ══════════════════════════════════════════════════════════════
//  COMPAT ALIASES (no new HTTP paths — JS-only name aliases).
// ══════════════════════════════════════════════════════════════

export const getStoriesByUser = getStoriesByAuthor
export const getHighlightsByUser = getHighlightsByAuthor

// The spec exposes only POST /api/v1/stories — text vs media is a
// field on the body. Existing callers can keep their function name.
export const createTextStory = createStory
export const createMediaStory = ({ data }) => createStory(data)

// Poll voting — old signature took (storyId, choice); new takes
// (pollId, userId, choice). Kept here for callers that still pass
// storyId, but they must resolve pollId via `getStoryPoll(storyId)`.
export const voteOnStoryPoll = voteOnPoll

// The new spec has no /stories/tray, /stories/{id}/stream,
// /stories/{id}/react, or /stories/{id}/reply endpoints. These
// helpers no-op so callers compile; the corresponding UI affordances
// degrade gracefully (empty tray, no live updates, swallowed reactions).
export const getStoryTray = async () => []
export const storyTrayStreamUrl = () => null
export const storyStreamUrl = () => null
export const reactToStory = async () => null
export const replyToStory = async () => null
