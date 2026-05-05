/**
 * Tiny pub/sub that ticks once every ~15 seconds and notifies every
 * subscribed `<RelativeTime>` so they re-format their string from the
 * live wall clock.
 *
 * One shared timer instead of one timer per row keeps a long feed cheap.
 * The timer only runs while at least one subscriber is mounted.
 */
const TICK_INTERVAL_MS = 15_000

const subscribers = new Set()
let timer = null

function notify() {
  // Snapshot first — a subscriber unsubscribing during notification
  // would otherwise mutate the iteration target.
  const snapshot = [...subscribers]
  for (const fn of snapshot) {
    try {
      fn()
    } catch {
      // A misbehaving subscriber must never break the tick loop.
    }
  }
}

function ensureTimer() {
  if (timer != null || typeof window === 'undefined') return
  timer = window.setInterval(notify, TICK_INTERVAL_MS)
}

function maybeStop() {
  if (subscribers.size === 0 && timer != null) {
    window.clearInterval(timer)
    timer = null
  }
}

export function subscribeNowTicks(handler) {
  if (typeof handler !== 'function') return () => {}
  subscribers.add(handler)
  ensureTimer()
  return () => {
    subscribers.delete(handler)
    maybeStop()
  }
}
