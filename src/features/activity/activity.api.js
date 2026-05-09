import { api } from '@/api/client'
import { API_URL } from '@/config/env'

// ══════════════════════════════════════════════════════════════
//  USER ACTIVITY  —  /api/v1/users/me/activity
// ══════════════════════════════════════════════════════════════
//
// The backend records activities automatically as side-effects of
// reactions, comments, shares, and reel watches. This API lets the
// user browse and clean up their own activity log.
//
//   activityType ∈
//     POST_REACTION
//     POST_COMMENT
//     POST_COMMENT_REACTION
//     POST_SHARE
//     REEL_WATCH

/**
 * GET /api/v1/users/me/activity
 * @param {object} [opts]
 * @param {string} [opts.type] — filter by UserActivityType (omit for all)
 * @param {number} [opts.page=0]
 * @param {number} [opts.size=20]
 */
export async function getMyActivity({ type, page = 0, size = 20 } = {}) {
  const params = { page, size }
  if (type) params.type = type
  const response = await api.get('/api/v1/users/me/activity', { params })
  return response.data
}

export async function deleteActivity(activityId) {
  await api.delete(`/api/v1/users/me/activity/${activityId}`)
}

/**
 * DELETE /api/v1/users/me/activity[?type=...]
 * @param {object} [opts]
 * @param {string} [opts.type] — when provided, only entries of that
 *   UserActivityType are deleted (e.g. clear reactions without
 *   touching comments). Omit to wipe the whole log.
 * @returns {Promise<{ deleted: number }>}
 */
export async function clearAllActivity({ type } = {}) {
  const params = type ? { type } : undefined
  const response = await api.delete('/api/v1/users/me/activity', { params })
  return response.data
}

// ══════════════════════════════════════════════════════════════
//  WATCHED REELS  —  /api/v1/users/me/reels/watched
// ══════════════════════════════════════════════════════════════

/**
 * Record that the current user watched a reel. Safe to call multiple
 * times — the backend dedupes/updates as appropriate.
 *
 * @param {string} postId
 * @param {number} [watchedSeconds] — total seconds watched (server-side max kept)
 */
export async function recordReelView(postId, watchedSeconds) {
  const body = watchedSeconds != null ? { watchedSeconds } : null
  const response = await api.post(
    `/api/v1/posts/${postId}/reels/view`,
    body,
  )
  return response.data
}

export async function getMyWatchedReels({ page = 0, size = 20 } = {}) {
  const response = await api.get('/api/v1/users/me/reels/watched', {
    params: { page, size },
  })
  return response.data
}

export async function deleteWatchedReel(reelViewId) {
  await api.delete(`/api/v1/users/me/reels/watched/${reelViewId}`)
}

export async function clearWatchedReels() {
  const response = await api.delete('/api/v1/users/me/reels/watched')
  return response.data
}

// ══════════════════════════════════════════════════════════════
//  REALTIME  —  /api/v1/users/me/activity/stream  (SSE)
// ══════════════════════════════════════════════════════════════
//
// Fan-out channel for the current user's activity log. Backed by the
// per-user Redis pub/sub channel `irc:activity:{userId}` so a record
// written by any backend instance reaches every device the user has
// open. Used by the activity page (live insert), the topbar's recent-
// search list, and any "you just X-ed" toasts.
//
// EventSource cannot send Authorization headers, so the access token
// is appended as a query parameter and validated by the backend.
export function userActivityStreamUrl(_resourceId, token) {
  const url = new URL('/api/v1/users/me/activity/stream', API_URL)
  if (token) url.searchParams.set('token', token)
  return url.toString()
}
