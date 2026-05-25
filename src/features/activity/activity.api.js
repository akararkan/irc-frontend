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
 *
 * @param {object} [opts]
 * @param {string} [opts.type]
 *   Single UserActivityType filter. Back-compat only — prefer `types`.
 * @param {string[]} [opts.types]
 *   Multi-type union filter. Sent as repeated `types=` query params so
 *   Spring binds them as a collection. When present, overrides `type`.
 * @param {string|Date} [opts.from]
 *   Inclusive lower bound on `createdAt`. ISO-8601 instant (e.g.
 *   `2026-05-01T00:00:00Z`) or a `Date` instance.
 * @param {string|Date} [opts.to]
 *   Inclusive upper bound on `createdAt`. Same format as `from`.
 * @param {number} [opts.page=0]
 * @param {number} [opts.size=20]
 */
export async function getMyActivity({
  type,
  types,
  from,
  to,
  page = 0,
  size = 20,
} = {}) {
  const params = { page, size }
  if (Array.isArray(types) && types.length > 0) {
    // Spring's `Collection<UserActivityType>` binding accepts repeated
    // params (`types=A&types=B`). axios serializes arrays this way by
    // default with `paramsSerializer.indexes = null`, which we pass
    // through explicitly so the wire shape stays predictable.
    params.types = types
  } else if (type) {
    params.type = type
  }
  if (from) params.from = toIsoInstant(from)
  if (to) params.to = toIsoInstant(to)
  const response = await api.get('/api/v1/users/me/activity', {
    params,
    paramsSerializer: { indexes: null },
  })
  return response.data
}

export async function deleteActivity(activityId) {
  await api.delete(`/api/v1/users/me/activity/${activityId}`)
}

/**
 * DELETE /api/v1/users/me/activity[?type=...|&types=...]
 *
 * Same filter shape as `getMyActivity`. When neither `type` nor `types`
 * is provided, every activity row is removed.
 */
export async function clearAllActivity({ type, types } = {}) {
  let params
  if (Array.isArray(types) && types.length > 0) params = { types }
  else if (type) params = { type }
  const response = await api.delete('/api/v1/users/me/activity', {
    params,
    paramsSerializer: { indexes: null },
  })
  return response.data
}

function toIsoInstant(value) {
  if (!value) return undefined
  if (value instanceof Date) return value.toISOString()
  return String(value)
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
