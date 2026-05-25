import { useEffect, useRef, useState } from 'react'

import { useAuth } from '@/features/auth/auth-context'

const HEARTBEAT_TIMEOUT_MS = 60_000
const RECONNECT_INITIAL_MS = 1000
const RECONNECT_MAX_MS = 30_000

// Dev-only console breadcrumb when SSE events flow. Helps diagnose
// "the count isn't updating live" symptoms: open DevTools and you'll
// see one [SSE] line per event arrival. Production builds strip these
// (import.meta.env.DEV is false in `vite build`).
const DEBUG = typeof import.meta !== 'undefined' && import.meta.env?.DEV
function sseLog(...args) {
  if (DEBUG) console.log('[SSE]', ...args)
}

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
  // Public streams (posts / research / questions) accept anonymous
  // subscribers — the backend gates per-event with `assertPostVisible`
  // / equivalents, so a guest still receives realtime updates for
  // PUBLIC content. We only need `resourceId` + `urlBuilder` to open
  // the connection. When `accessToken` is present we pass it as the
  // `?token=` query param (EventSource can't set headers) so the
  // backend can apply block / mute filtering for the viewer.
  //
  // Authentication tracked here only so the watchdog / reconnect path
  // re-evaluates when the user logs in or out mid-session.
  void isAuthenticated
  const active = Boolean(enabled && resourceId && urlBuilder)

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
      if (!url) {
        // urlBuilder returned null/undefined (stub or feature disabled)
        sseLog('skip — urlBuilder returned null', { resourceId })
        return
      }
      sseLog('open', { url, resourceId })
      const source = new EventSource(url, { withCredentials: true })
      activeSource = source

      const onConnected = () => {
        attempts = 0
        setIsConnected(true)
        pulseWatchdog()
        sseLog('connected', { resourceId })
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
      const onError = (event) => {
        // EventSource fires `error` with readyState=CLOSED when the page
        // is unloading / navigating — that's not a real failure, just
        // the browser tearing down the document. Suppress the log so the
        // console isn't littered on every route change. Real failures
        // (network drop, server crash) fire with readyState=CONNECTING
        // and we still surface those so the watchdog story is debuggable.
        if (source.readyState === EventSource.CLOSED) {
          setIsConnected(false)
          return
        }
        sseLog('error', { resourceId, readyState: source.readyState, event })
        setIsConnected(false)
      }

      source.addEventListener('connected', onConnected)
      source.addEventListener('error', onError)
      source.addEventListener('heartbeat', pulseWatchdog)

      const removers = (eventNames ?? []).map((type) => {
        const handler = (event) => {
          pulseWatchdog()
          sseLog(type, { resourceId, data: event.data })
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
      sseLog('close', { resourceId })
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
