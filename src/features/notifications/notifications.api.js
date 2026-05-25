import { api } from '@/api/client'
import { API_URL } from '@/config/env'

/**
 * Common params shape — all list / count endpoints accept the same
 * filter triplet:
 *
 *   - category : NotificationCategory (POSTS / QNA / RESEARCH / MENTIONS
 *                / SOCIAL / SYSTEM). Omit for everything.
 *   - types    : repeatable NotificationType filter (e.g. POST_REACTED).
 *                Pass an array; the backend re-combines the values.
 *   - unread   : boolean — when true, only unread rows are returned.
 */
function buildFilterParams({ category, types, unread } = {}) {
  const params = {}
  if (category) params.category = category
  if (Array.isArray(types) && types.length > 0) params.type = types
  if (unread === true) params.unread = true
  return params
}

export async function getNotifications({
  page = 0,
  size = 20,
  category,
  types,
  unread,
} = {}) {
  const response = await api.get('/api/v1/notifications', {
    params: { page, size, ...buildFilterParams({ category, types, unread }) },
  })
  return response.data
}

export async function getUnreadNotifications({ page = 0, size = 20, category } = {}) {
  const response = await api.get('/api/v1/notifications/unread', {
    params: { page, size, ...buildFilterParams({ category }) },
  })
  return response.data
}

export async function getUnreadCount({ category } = {}) {
  const response = await api.get('/api/v1/notifications/unread/count', {
    params: buildFilterParams({ category }),
  })
  return response.data?.count ?? 0
}

export async function markAllRead() {
  await api.patch('/api/v1/notifications/read-all')
}

/** Single-id mark-read. Kept for compatibility with the bell-row click. */
export async function markRead(id) {
  await api.patch(`/api/v1/notifications/${id}/read`)
}

/** Bulk mark-read — body { ids: [...] }. SSE `read` event syncs other tabs. */
export async function markManyRead(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return
  await api.patch('/api/v1/notifications/read', { ids })
}

/** Clear an entire category tab in one shot. */
export async function markCategoryRead(category) {
  if (!category) return
  await api.patch(
    `/api/v1/notifications/category/${encodeURIComponent(category)}/read`,
  )
}

/** Delete one notification. SSE `deleted` event syncs other tabs. */
export async function deleteNotification(id) {
  await api.delete(`/api/v1/notifications/${id}`)
}

/** Purge every already-read notification (cannot be undone). */
export async function deleteAllRead() {
  await api.delete('/api/v1/notifications/read')
}

export function notificationStreamUrl(token) {
  const url = new URL('/api/v1/notifications/stream', API_URL)
  if (token) url.searchParams.set('token', token)
  return url.toString()
}

// Notifications are JWT-derived — the canonical endpoints above
// (`getNotifications`, `getUnreadCount`, `markRead`, etc.) cover every
// shape the backend ships. Earlier in the migration we had a parallel
// userId-passing set (`getNotificationsForUser`, `getUnreadCountForUser`,
// `markNotificationRead` POST, `deliverNotification`); the backend
// audit confirmed none of those paths exist server-side, so they were
// removed to stop the unread badge from occasionally 404-ing.
