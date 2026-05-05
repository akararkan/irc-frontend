import { useEffect, useRef, useState } from 'react'

import { useAuth } from '@/features/auth/auth-context'

const HEARTBEAT_TIMEOUT_MS = 60_000
const RECONNECT_INITIAL_MS = 1000
const RECONNECT_MAX_MS = 30_000

/**
 * Generic per-resource SSE subscriber.
 *
 * The frontend has two near-identical streams (posts + questions) and
 * the backend will likely add more (research, …). Rather than copy the
 * EventSource lifecycle into each `useXxxStream`, we capture it once
 * here. Each feature passes:
 *
 *   - `urlBuilder(resourceId, token)` → SSE endpoint URL
 *   - `eventNames`                    → list of named events to listen for
 *   - `enabled`                       → opt-out switch (default: true)
 *   - `onReconnect`                   → optional callback fired after a
 *     non-first connection comes back, so the page can refetch state
 *     it may have missed during the outage.
 *
 * Resilience built in:
 *   - Heartbeat watchdog — if no event of any kind (heartbeat, named
 *     event, or generic message) arrives within 60 s, the connection
 *     is presumed dead and the EventSource is rebuilt.
 *   - Manual reconnect with exponential backoff (1 s → 30 s cap).
 *   - Visibility-change resync — when the tab returns to foreground,
 *     pulse the watchdog so any background-throttled drift is caught
 *     within a heartbeat window.
 *
 * Handlers live in `handlers` (`{ EVENT_NAME: (payload) => …, onEvent: … }`)
 * and are kept in a ref so the EventSource is not torn down on every
 * parent re-render. The hook reconnects only when `resourceId` /
 * `enabled` / `accessToken` change.
 *
 * Returns `{ isConnected }` so callers can render a tiny "live" pip.
 */
export function useSseStream(
  resourceId,
  handlers,
  { urlBuilder, eventNames, enabled = true, onReconnect } = {},
) {
  const { isAuthenticated, session } = useAuth()
  const [isConnected, setIsConnected] = useState(false)
  const handlersRef = useRef(handlers)
  const reconnectRef = useRef(onReconnect)

  // Sync refs via effect — writing to refs during render trips the
  // React lint rule and can drop updates under concurrent rendering.
  useEffect(() => {
    handlersRef.current = handlers
  })
  useEffect(() => {
    reconnectRef.current = onReconnect
  })

  const accessToken = session?.accessToken
  const active = Boolean(
    enabled && resourceId && isAuthenticated && accessToken && urlBuilder,
  )

  useEffect(() => {
    if (!active) {
      setIsConnected(false)
      return undefined
    }

    let cancelled = false
    let attempts = 0
    let firstConnect = true
    let watchdogId = null
    let reconnectId = null
    let activeSource = null

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
        setIsConnected(false)
        scheduleReconnect()
      }, HEARTBEAT_TIMEOUT_MS)
    }

    function scheduleReconnect() {
      if (cancelled) return
      if (activeSource) {
        try {
          activeSource._teardown?.()
          activeSource.close()
        } catch {
          // ignore
        }
        activeSource = null
      }
      clearTimers()
      const delay = Math.min(
        RECONNECT_MAX_MS,
        RECONNECT_INITIAL_MS * 2 ** attempts,
      )
      attempts += 1
      reconnectId = setTimeout(connect, delay)
    }

    function dispatch(type, raw) {
      let payload = null
      if (raw) {
        try {
          payload = JSON.parse(raw)
        } catch {
          payload = raw
        }
      }
      const current = handlersRef.current
      current?.onEvent?.(type, payload)
      const fn = current?.[type]
      if (typeof fn === 'function') fn(payload)
    }

    function connect() {
      if (cancelled) return
      reconnectId = null

      const url = urlBuilder(resourceId, accessToken)
      const source = new EventSource(url, { withCredentials: true })
      activeSource = source

      const onConnected = () => {
        attempts = 0
        setIsConnected(true)
        pulseWatchdog()
        if (!firstConnect) {
          // Catch-up hook for the page — fetch latest state since the
          // last clean connection so we don't miss aggregation bumps.
          try {
            reconnectRef.current?.()
          } catch {
            // ignore
          }
        }
        firstConnect = false
      }
      const onError = () => {
        // EventSource may auto-reconnect; we rely on the watchdog to
        // promote to a hard reconnect if nothing recovers in time.
        setIsConnected(false)
      }

      source.addEventListener('connected', onConnected)
      source.addEventListener('error', onError)
      source.addEventListener('heartbeat', pulseWatchdog)

      const removers = (eventNames ?? []).map((type) => {
        const handler = (event) => {
          pulseWatchdog()
          dispatch(type, event.data)
        }
        source.addEventListener(type, handler)
        return () => source.removeEventListener(type, handler)
      })

      // Catch-all for future event types the server adds before this
      // list is updated — payload's `type` field decides routing.
      const onMessage = (event) => {
        pulseWatchdog()
        if (!event?.data) return
        try {
          const payload = JSON.parse(event.data)
          if (payload?.type && !(eventNames ?? []).includes(payload.type)) {
            dispatch(payload.type, event.data)
          }
        } catch {
          // ignore non-JSON message
        }
      }
      source.addEventListener('message', onMessage)

      source._teardown = () => {
        source.removeEventListener('connected', onConnected)
        source.removeEventListener('error', onError)
        source.removeEventListener('heartbeat', pulseWatchdog)
        source.removeEventListener('message', onMessage)
        removers.forEach((remove) => remove())
      }
    }

    // Background-tab throttling — when the user comes back, give the
    // watchdog a fresh budget. If the connection silently died while
    // backgrounded the watchdog will fire within the heartbeat window.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') pulseWatchdog()
    }
    document.addEventListener('visibilitychange', onVisibility)

    connect()

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      clearTimers()
      if (activeSource) {
        try {
          activeSource._teardown?.()
          activeSource.close()
        } catch {
          // ignore
        }
        activeSource = null
      }
      setIsConnected(false)
    }
    // urlBuilder is stable for the lifetime of a feature; don't depend on it.
  }, [active, resourceId, accessToken])

  return { isConnected }
}
