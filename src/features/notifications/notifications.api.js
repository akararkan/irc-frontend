import { api } from '@/api/client'
import { API_URL } from '@/config/env'

export async function getNotifications({ page = 0, size = 20 } = {}) {
  const response = await api.get('/api/v1/notifications', {
    params: { page, size },
  })
  return response.data
}

export async function getUnreadNotifications({ page = 0, size = 20 } = {}) {
  const response = await api.get('/api/v1/notifications/unread', {
    params: { page, size },
  })
  return response.data
}

export async function getUnreadCount() {
  const response = await api.get('/api/v1/notifications/unread/count')
  return response.data?.count ?? 0
}

export async function markAllRead() {
  await api.patch('/api/v1/notifications/read-all')
}

export async function markRead(id) {
  await api.patch(`/api/v1/notifications/${id}/read`)
}

export function notificationStreamUrl(token) {
  const url = new URL('/api/v1/notifications/stream', API_URL)
  if (token) url.searchParams.set('token', token)
  return url.toString()
}
