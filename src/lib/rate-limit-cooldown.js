import { useEffect, useState } from 'react'

/**
 * Per-action cooldown driven by the backend's RATE_LIMITED response.
 *
 * The backend's RateLimiter caps click bursts (e.g. 30 reactions / 10 s)
 * and returns a 429 with `details.retryAfterSeconds` whenever the
 * limit is hit. Without a UI hook, the user keeps pounding the button
 * and stacks up more 429s; with this hook, the click is suppressed
 * for the exact remaining window and the affordance can render a
 * countdown.
 *
 * Scope: per-action (the backend's bucket is shared across entities
 * of the same action category — every reaction click counts against
 * the same 10-s window for a given user, regardless of which post).
 * So a 429 on liking post A correctly disables liking post B too,
 * until the window passes.
 *
 * Known action keys (must match `details.action` from the backend):
 *   - "reaction"  → 30 / 10 s   (post / answer / comment reactions)
 *   - "comment"   → 10 / 30 s   (post / research / answer comments)
 *   - "social"    → 30 / minute (saves, follows, …)
 *
 * Reading: `useCooldown(action)` returns seconds remaining (0 when free).
 * Writing: `markRateLimited(action, seconds)` sets a deadline; the
 * hook updates every 250 ms so the rendered countdown is smooth.
 */

const deadlines = new Map() // action → epoch-ms when the window expires
const subscribers = new Set()

function notify() {
  for (const handler of subscribers) {
    try {
      handler()
    } catch {
      // a misbehaving subscriber must not break the loop
    }
  }
}

/**
 * Park `action` until `seconds` from now. If the action already has a
 * later deadline, the existing one wins (don't shorten a server-set
 * window with a stale event).
 */
export function markRateLimited(action, seconds) {
  if (!action || typeof seconds !== 'number' || seconds <= 0) return
  const next = Date.now() + Math.ceil(seconds * 1000)
  const current = deadlines.get(action) ?? 0
  if (next <= current) return
  deadlines.set(action, next)
  notify()
}

/** Synchronous read of the cooldown deadline (ms epoch), or 0 if none. */
export function getCooldownDeadline(action) {
  return deadlines.get(action) ?? 0
}

/** True if `action` is currently in cooldown. */
export function isCooldown(action) {
  const deadline = deadlines.get(action) ?? 0
  return deadline > Date.now()
}

/** Clear `action`'s cooldown — useful for tests or admin overrides. */
export function clearCooldown(action) {
  if (!deadlines.has(action)) return
  deadlines.delete(action)
  notify()
}

function secondsRemaining(action) {
  const deadline = deadlines.get(action) ?? 0
  const remaining = deadline - Date.now()
  if (remaining <= 0) return 0
  // Round up so the countdown reads "3 → 2 → 1 → 0" rather than
  // flashing the moment we cross each second boundary.
  return Math.ceil(remaining / 1000)
}

/**
 * React hook — returns seconds remaining for `action`. Re-renders
 * every 250 ms while the cooldown is active, then unsubscribes from
 * the tick once it expires so idle pages don't keep firing
 * timers.
 *
 *   const cooldown = useCooldown('reaction')
 *   <button disabled={cooldown > 0} aria-label={cooldown > 0 ? `Try again in ${cooldown}s` : 'Like'} />
 */
export function useCooldown(action) {
  const [value, setValue] = useState(() => secondsRemaining(action))

  useEffect(() => {
    if (!action) {
      setValue(0)
      return undefined
    }
    let ticker = null
    function refresh() {
      const next = secondsRemaining(action)
      setValue(next)
      if (next === 0 && ticker != null) {
        clearInterval(ticker)
        ticker = null
      }
    }
    refresh()
    // Restart the tick whenever someone calls markRateLimited /
    // clearCooldown so the UI promptly reflects a new deadline.
    const onStoreChange = () => {
      if (ticker != null) {
        clearInterval(ticker)
        ticker = null
      }
      refresh()
      if (secondsRemaining(action) > 0 && ticker == null) {
        ticker = setInterval(refresh, 250)
      }
    }
    subscribers.add(onStoreChange)
    if (secondsRemaining(action) > 0) {
      ticker = setInterval(refresh, 250)
    }
    return () => {
      subscribers.delete(onStoreChange)
      if (ticker != null) clearInterval(ticker)
    }
  }, [action])

  return value
}
