/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

import {
  getNotifications,
  getUnreadCount,
  markAllRead as apiMarkAllRead,
  markRead as apiMarkRead,
  notificationStreamUrl,
} from '@/features/notifications/notifications.api'
import { useAuth } from '@/features/auth/auth-context'

const NotificationsContext = createContext(null)

function upsertNotification(list, notification) {
  const existingIndex = list.findIndex((item) => item.id === notification.id)
  if (existingIndex === -1) return [notification, ...list]
  const next = [...list]
  next[existingIndex] = { ...next[existingIndex], ...notification }
  return next
}

export function NotificationsProvider({ children }) {
  const { isAuthenticated, session } = useAuth()
  const [items, setItems] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const sourceRef = useRef(null)

  const loadInitial = useCallback(async () => {
    if (!isAuthenticated) return
    setIsLoading(true)
    try {
      const [page, count] = await Promise.all([
        getNotifications({ page: 0, size: 30 }),
        getUnreadCount(),
      ])
      setItems(page?.content ?? [])
      setUnreadCount(Number(count ?? 0))
    } catch {
      // swallow; page still renders
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) {
      setItems([])
      setUnreadCount(0)
      return
    }
    loadInitial()
  }, [isAuthenticated, loadInitial])

  useEffect(() => {
    if (!isAuthenticated || !session?.accessToken) {
      sourceRef.current?.close?.()
      sourceRef.current = null
      setIsConnected(false)
      return undefined
    }

    const url = notificationStreamUrl(session.accessToken)
    const source = new EventSource(url, { withCredentials: true })
    sourceRef.current = source

    source.addEventListener('connected', () => setIsConnected(true))
    source.addEventListener('error', () => setIsConnected(false))

    source.addEventListener('notification', (event) => {
      try {
        const payload = JSON.parse(event.data)
        setItems((current) => upsertNotification(current, payload))
        if (!payload.isRead) {
          setUnreadCount((count) => count + 1)
        }
      } catch {
        // ignore malformed event
      }
    })

    return () => {
      source.close()
      sourceRef.current = null
      setIsConnected(false)
    }
  }, [isAuthenticated, session?.accessToken])

  const markAsRead = useCallback(async (id) => {
    await apiMarkRead(id)
    setItems((current) =>
      current.map((item) =>
        item.id === id && !item.isRead
          ? { ...item, isRead: true, readAt: new Date().toISOString() }
          : item,
      ),
    )
    setUnreadCount((count) => Math.max(0, count - 1))
  }, [])

  const markAllAsRead = useCallback(async () => {
    await apiMarkAllRead()
    setItems((current) =>
      current.map((item) =>
        item.isRead ? item : { ...item, isRead: true, readAt: new Date().toISOString() },
      ),
    )
    setUnreadCount(0)
  }, [])

  const value = useMemo(
    () => ({
      items,
      unreadCount,
      isLoading,
      isConnected,
      refresh: loadInitial,
      markAsRead,
      markAllAsRead,
    }),
    [items, unreadCount, isLoading, isConnected, loadInitial, markAsRead, markAllAsRead],
  )

  return (
    <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationsContext)
  if (!context) {
    throw new Error('useNotifications must be used within NotificationsProvider')
  }
  return context
}
