import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  deleteAllRead as apiDeleteAllRead,
  deleteNotification as apiDeleteNotification,
  getNotifications,
  getUnreadCount,
  markAllRead as apiMarkAllRead,
  markCategoryRead as apiMarkCategoryRead,
  markManyRead as apiMarkManyRead,
  markRead as apiMarkRead,
  notificationStreamUrl,
} from '@/features/notifications/notifications.api'
import { useAuth } from '@/features/auth/auth-context'

const NotificationsContext = createContext(null)

function upsertNotification(list, notification) {
  const existingIndex = list.findIndex((item) => item.id === notification.id)
  if (existingIndex === -1) return [notification, ...list]
  // Aggregated re-deliveries lift the row back to the top so the user
  // sees "now" activity at the top of the bell. The backend's
  // NotificationDispatcher updates `createdAt`/`updatedAt`, so trust
  // those — we just reorder.
  const next = [...list]
  const [existing] = next.splice(existingIndex, 1)
  return [{ ...existing, ...notification }, ...next]
}

function applyReadIds(list, ids) {
  if (!ids || ids.length === 0) return list
  const set = new Set(ids)
  let mutated = false
  const next = list.map((item) => {
    if (!set.has(item.id) || item.isRead) return item
    mutated = true
    return { ...item, isRead: true, readAt: new Date().toISOString() }
  })
  return mutated ? next : list
}

export function NotificationsProvider({ children }) {
  const { isAuthenticated, session } = useAuth()
  const [items, setItems] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const sourceRef = useRef(null)

  // Subscribers receive a callback only for *brand-new* notifications
  // (first time we've ever seen this id) — not for re-deliveries
  // (reconnect or aggregation bump). Used by the global bridge.
  const subscribersRef = useRef(new Set())
  const seenIdsRef = useRef(new Set())

  const subscribeIncoming = useCallback((handler) => {
    if (typeof handler !== 'function') return () => {}
    subscribersRef.current.add(handler)
    return () => {
      subscribersRef.current.delete(handler)
    }
  }, [])

  const loadInitial = useCallback(async () => {
    if (!isAuthenticated) return
    setIsLoading(true)
    try {
      const [page, count] = await Promise.all([
        getNotifications({ page: 0, size: 30 }),
        getUnreadCount(),
      ])
      const initial = page?.content ?? []
      // Seed the seen set with the initial fetch so we don't blast a
      // toast for every existing notification right after sign-in.
      for (const item of initial) {
        if (item?.id != null) seenIdsRef.current.add(item.id)
      }
      setItems(initial)
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
      seenIdsRef.current = new Set()
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

    // ── Resilient SSE wiring ──────────────────────────────────────
    //
    // EventSource has *some* native auto-reconnect, but in practice
    // it can get stuck in error after an auth flap or a long network
    // hiccup. Three guarantees we add on top:
    //
    //   1. Heartbeat watchdog — backend sends `heartbeat` every 25s.
    //      We assume the connection is dead if no event of any kind
    //      arrives for 60s, then tear down + manual-reconnect.
    //   2. Manual reconnect with exponential backoff (1s → 30s cap)
    //      so a transient outage doesn't escalate into a busy loop.
    //   3. State refresh on every successful *re*-connect — pulls the
    //      latest list + count so any events we missed during the
    //      disconnect window are caught up. (Skipped on the very first
    //      connect; `loadInitial` already ran from the auth effect.)
    //
    // Plus a visibility-change handler: when the tab comes back from
    // background after being hidden, refresh — Chrome aggressively
    // throttles SSE on background tabs and we may have drifted.

    const HEARTBEAT_TIMEOUT_MS = 60_000
    const RECONNECT_INITIAL_MS = 1000
    const RECONNECT_MAX_MS = 30_000

    let attempts = 0
    let watchdogId = null
    let reconnectId = null
    let cancelled = false
    let firstConnect = true

    function clearTimers() {
      if (watchdogId != null) {
        clearTimeout(watchdogId)
        watchdogId = null
      }
      if (reconnectId != null) {
        clearTimeout(reconnectId)
        reconnectId = null
      }
    }

    function pulseWatchdog() {
      if (watchdogId != null) clearTimeout(watchdogId)
      watchdogId = setTimeout(() => {
        // Two missed heartbeats — pretend the server hung up and
        // rebuild the EventSource. setIsConnected first so the UI
        // pip drops to "Off" while we reconnect.
        setIsConnected(false)
        scheduleReconnect()
      }, HEARTBEAT_TIMEOUT_MS)
    }

    function scheduleReconnect() {
      if (cancelled) return
      const existing = sourceRef.current
      if (existing) {
        try {
          existing.close()
        } catch {
          // ignore
        }
        sourceRef.current = null
      }
      clearTimers()
      const delay = Math.min(
        RECONNECT_MAX_MS,
        RECONNECT_INITIAL_MS * 2 ** attempts,
      )
      attempts += 1
      reconnectId = setTimeout(connect, delay)
    }

    function connect() {
      if (cancelled) return
      reconnectId = null

      const url = notificationStreamUrl(session.accessToken)
      if (!url) return
      const source = new EventSource(url, { withCredentials: true })
      sourceRef.current = source

      const onConnected = () => {
        attempts = 0
        setIsConnected(true)
        pulseWatchdog()
        // Backfill anything we missed during the outage. Skipped on the
        // very first connect — initial load already ran. We rely on the
        // SSE's own `unread-count` to follow up if our count drifts.
        if (!firstConnect) {
          loadInitial()
        }
        firstConnect = false
      }

      const onError = () => {
        // EventSource may try to reconnect itself; we let it for the
        // heartbeat window. If nothing recovers, the watchdog promotes
        // to a hard manual reconnect.
        setIsConnected(false)
      }

      source.addEventListener('connected', onConnected)
      source.addEventListener('error', onError)

      // Every server-sent message resets the watchdog — heartbeat is
      // the predictable beat, but data events count too.
      source.addEventListener('heartbeat', pulseWatchdog)

      // ── notification: insert OR aggregation-bump ───────────────
      const onNotification = (event) => {
        pulseWatchdog()
        try {
          const payload = JSON.parse(event.data)
          const id = payload?.id
          const isFirstTimeSeen = id != null && !seenIdsRef.current.has(id)
          if (id != null) seenIdsRef.current.add(id)

          setItems((current) => upsertNotification(current, payload))

          // The backend's `unread-count` event lands right after every
          // dispatch — we let that authoritative count win. Optimistic
          // +1 is only there to avoid a flicker when the count event
          // takes a moment to arrive.
          if (isFirstTimeSeen && !payload.isRead) {
            setUnreadCount((count) => count + 1)
          }

          if (isFirstTimeSeen) {
            for (const handler of subscribersRef.current) {
              try {
                handler(payload)
              } catch {
                // a misbehaving subscriber must never break the stream
              }
            }
          }
        } catch {
          // ignore malformed event
        }
      }
      source.addEventListener('notification', onNotification)

      // ── unread-count: authoritative badge for this user ────────
      const onUnreadCount = (event) => {
        pulseWatchdog()
        try {
          const payload = JSON.parse(event.data)
          const count = Number(payload?.count ?? payload ?? 0)
          if (Number.isFinite(count) && count >= 0) {
            setUnreadCount(count)
          }
        } catch {
          // ignore malformed event
        }
      }
      source.addEventListener('unread-count', onUnreadCount)

      // ── read: mark-read fired from another tab / bulk action ───
      const onRead = (event) => {
        pulseWatchdog()
        try {
          const payload = JSON.parse(event.data)
          const ids = Array.isArray(payload?.ids)
            ? payload.ids
            : payload?.id != null
              ? [payload.id]
              : []
          if (ids.length === 0) return
          setItems((current) => applyReadIds(current, ids))
        } catch {
          // ignore
        }
      }
      source.addEventListener('read', onRead)

      // ── deleted: remove a row across every open tab ────────────
      const onDeleted = (event) => {
        pulseWatchdog()
        try {
          const payload = JSON.parse(event.data)
          const ids = Array.isArray(payload?.ids)
            ? payload.ids
            : payload?.id != null
              ? [payload.id]
              : []
          if (ids.length === 0) return
          const idSet = new Set(ids)
          setItems((current) => current.filter((item) => !idSet.has(item.id)))
          for (const id of ids) seenIdsRef.current.delete(id)
        } catch {
          // ignore
        }
      }
      source.addEventListener('deleted', onDeleted)

      // Stash the listener teardown alongside the source so the outer
      // cleanup can call it without another closure.
      source._teardown = () => {
        source.removeEventListener('connected', onConnected)
        source.removeEventListener('error', onError)
        source.removeEventListener('heartbeat', pulseWatchdog)
        source.removeEventListener('notification', onNotification)
        source.removeEventListener('unread-count', onUnreadCount)
        source.removeEventListener('read', onRead)
        source.removeEventListener('deleted', onDeleted)
      }
    }

    // Background-tab throttling can let SSE drift even when the
    // connection looks healthy. When the user comes back, force a
    // refresh so the UI never lies about what's true server-side.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadInitial()
        // Also nudge the watchdog: many browsers fire a `message` event
        // queue flush on un-throttle, but a quick pulse keeps us honest
        // if the connection died silently in the background.
        pulseWatchdog()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    connect()

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      clearTimers()
      const source = sourceRef.current
      if (source) {
        try {
          source._teardown?.()
          source.close()
        } catch {
          // ignore
        }
      }
      sourceRef.current = null
      setIsConnected(false)
    }
  }, [isAuthenticated, session?.accessToken, loadInitial])

  // ── Mutations: optimistic local update + server call. The SSE
  // `read` / `deleted` / `unread-count` events from the same backend
  // request will reconcile any drift and fan the change out to every
  // other open tab.
  const markAsRead = useCallback(async (id) => {
    if (id == null) return
    setItems((current) => applyReadIds(current, [id]))
    setUnreadCount((count) => Math.max(0, count - 1))
    try {
      await apiMarkRead(id)
    } catch {
      // Server will eventually broadcast the truth; nothing to roll back.
    }
  }, [])

  const markManyAsRead = useCallback(async (ids) => {
    if (!Array.isArray(ids) || ids.length === 0) return
    setItems((current) => applyReadIds(current, ids))
    try {
      await apiMarkManyRead(ids)
    } catch {
      // server-side count will reconcile via SSE
    }
  }, [])

  const markAllAsRead = useCallback(async () => {
    setItems((current) =>
      current.map((item) =>
        item.isRead
          ? item
          : { ...item, isRead: true, readAt: new Date().toISOString() },
      ),
    )
    setUnreadCount(0)
    try {
      await apiMarkAllRead()
    } catch {
      // SSE reconciles
    }
  }, [])

  const markCategoryAsRead = useCallback(async (category) => {
    if (!category) return
    setItems((current) =>
      current.map((item) =>
        item.category === category && !item.isRead
          ? { ...item, isRead: true, readAt: new Date().toISOString() }
          : item,
      ),
    )
    try {
      await apiMarkCategoryRead(category)
    } catch {
      // SSE reconciles
    }
  }, [])

  const removeNotification = useCallback(async (id) => {
    if (id == null) return
    setItems((current) => current.filter((item) => item.id !== id))
    seenIdsRef.current.delete(id)
    try {
      await apiDeleteNotification(id)
    } catch {
      // SSE reconciles
    }
  }, [])

  const purgeReadNotifications = useCallback(async () => {
    setItems((current) => current.filter((item) => !item.isRead))
    try {
      await apiDeleteAllRead()
    } catch {
      // SSE reconciles
    }
  }, [])

  const value = useMemo(
    () => ({
      items,
      unreadCount,
      isLoading,
      isConnected,
      refresh: loadInitial,
      markAsRead,
      markManyAsRead,
      markAllAsRead,
      markCategoryAsRead,
      removeNotification,
      purgeReadNotifications,
      subscribeIncoming,
    }),
    [
      items,
      unreadCount,
      isLoading,
      isConnected,
      loadInitial,
      markAsRead,
      markManyAsRead,
      markAllAsRead,
      markCategoryAsRead,
      removeNotification,
      purgeReadNotifications,
      subscribeIncoming,
    ],
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
