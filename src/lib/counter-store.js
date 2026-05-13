import { useEffect, useState } from 'react'

/**
 * Single in-memory source of truth for every counter on screen.
 *
 * Keyed by `(kind, id, field)`:
 *   - kind:  'post' | 'postComment' | 'research' | 'researchComment' |
 *            'question' | 'answer'
 *   - id:    UUID string of the entity
 *   - field: 'rx' (reactions) | 'cm' (comments) | 'rp' (replies)
 *            | 'vw' (views)   | 'sh' (shares)   | 'sv' (saves)
 *            | 'dl' (downloads) | 'ct' (citations)
 *            | 'an' (answers) | 'bv' (best-answer votes)
 *
 * Writers:
 *   - Page bootstraps seed counters from the initial API response —
 *     those numbers are already backed by Redis on the server so they
 *     are authoritative the moment the page mounts.
 *   - SSE events patch the store live (see {@link applyCounterEvent}).
 *   - Optimistic UI calls {@link useCounters.delta} on click; the
 *     authoritative SSE echo overwrites within a tick.
 *
 * Readers:
 *   - Every counter component reads via {@link useCounter}, which
 *     subscribes for in-place updates.
 *
 * The store is plain — no external state library — because the rest of
 * the codebase already uses module-level pub/sub for similar caches
 * (see {@link import('./user-cache').useResolvedUser}). One less dep.
 */

const values = new Map() // key → number
const subscribers = new Map() // key → Set<callback>
const globalSubscribers = new Set() // notified on any change

function buildKey(kind, id, field) {
  if (!kind || !id || !field) return null
  return `${kind}:${id}:${field}`
}

function notify(key) {
  const set = subscribers.get(key)
  if (set) {
    for (const handler of set) {
      try {
        handler()
      } catch {
        // a misbehaving subscriber must not break the loop
      }
    }
  }
  for (const handler of globalSubscribers) {
    try {
      handler(key)
    } catch {
      // ignore
    }
  }
}

/**
 * Read the current counter value synchronously (no subscription). For
 * components that render counters, prefer the {@link useCounter} hook
 * so updates re-render automatically.
 */
export function getCounter(kind, id, field) {
  const key = buildKey(kind, id, field)
  if (!key) return undefined
  return values.get(key)
}

/**
 * Overwrite a counter with an absolute value. This is the path SSE
 * events take — server counts are monotonic and authoritative.
 *
 * Skips the no-op write when value is unchanged so subscribers don't
 * thrash. Skips entirely when value isn't a finite number.
 */
export function setCounter(kind, id, field, value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return
  const key = buildKey(kind, id, field)
  if (!key) return
  if (values.get(key) === value) return
  values.set(key, value)
  notify(key)
}

/**
 * Apply a relative change. Used by optimistic UI on click — the
 * authoritative SSE event will overwrite via {@link setCounter} a
 * tick later, so this is short-lived. Clamps at zero so a fast
 * double-unreact can never push the visible count below zero.
 *
 * IMPORTANT: returns without writing when the store has no entry yet
 * for this key. Otherwise we'd manufacture a 0 base from "nothing
 * seeded" and write `max(0, 0 + delta)` into the store, which would
 * wipe the prop fallback that `useCounter` was rendering — causing
 * the visible count to snap to 0 the first time a user unlikes after
 * a fresh page load.
 *
 * Callers that need to bump regardless of seed state should compute
 * the absolute target themselves (using the value `useCounter`
 * returned) and call {@link setCounter}. See the optimistic helpers
 * in {@link bumpCounter} for the canonical pattern.
 */
export function deltaCounter(kind, id, field, change) {
  if (typeof change !== 'number' || !Number.isFinite(change) || change === 0) return
  const key = buildKey(kind, id, field)
  if (!key) return
  const current = values.get(key)
  if (current == null) return
  const next = Math.max(0, current + change)
  if (next === current) return
  values.set(key, next)
  notify(key)
}

/**
 * Optimistic counter bump that's safe regardless of whether the store
 * has been seeded yet. `base` is the value the caller is currently
 * displaying (typically the return value of {@link useCounter}), so
 * the new absolute value lands on a number the user actually saw —
 * never on a synthetic zero. The authoritative SSE echo overwrites
 * with the server-side value a beat later.
 *
 *   const reactionCount = useCounter('post', id, 'rx', post.reactionCount ?? 0)
 *   bumpCounter('post', id, 'rx', reactionCount, +1)   // visible delta
 *
 * Returns the new absolute value so callers can use it for further
 * UI work (e.g. animations) without re-reading the store.
 */
export function bumpCounter(kind, id, field, base, change) {
  if (typeof base !== 'number' || !Number.isFinite(base)) return null
  if (typeof change !== 'number' || !Number.isFinite(change) || change === 0) return base
  const next = Math.max(0, base + change)
  setCounter(kind, id, field, next)
  return next
}

/**
 * Seed multiple counters at once from an API response. Pages call this
 * in their initial-load effect so first-paint counters come from the
 * authoritative Redis-backed numbers in the response, not from zero.
 *
 * Each entry is `[kind, id, field, value]`. Skips undefined / null
 * values so callers can pass through optional fields freely.
 */
export function seedCounters(entries) {
  if (!Array.isArray(entries)) return
  for (const entry of entries) {
    if (!entry) continue
    const [kind, id, field, value] = entry
    if (typeof value !== 'number' || !Number.isFinite(value)) continue
    const key = buildKey(kind, id, field)
    if (!key) continue
    if (values.get(key) === value) continue
    values.set(key, value)
    notify(key)
  }
}

function subscribe(key, handler) {
  if (!key || typeof handler !== 'function') return () => {}
  let set = subscribers.get(key)
  if (!set) {
    set = new Set()
    subscribers.set(key, set)
  }
  set.add(handler)
  return () => {
    set.delete(handler)
    if (set.size === 0) subscribers.delete(key)
  }
}

/**
 * React hook — reads a counter and re-renders when it changes.
 *
 *   const reactionCount = useCounter('post', post.id, 'rx', post.reactionCount)
 *
 * The `fallback` argument is what the hook returns until either:
 *   1. someone seeds the store via {@link seedCounters} or
 *      {@link setCounter}, or
 *   2. an SSE event lands on the channel.
 *
 * Pass the value from your initial API response so first-paint shows
 * the correct number without waiting for a store write.
 */
export function useCounter(kind, id, field, fallback = 0) {
  const key = buildKey(kind, id, field)
  const [value, setValue] = useState(() => {
    if (!key) return fallback
    const stored = values.get(key)
    return stored != null ? stored : fallback
  })

  useEffect(() => {
    if (!key) {
      setValue(fallback)
      return undefined
    }
    const stored = values.get(key)
    setValue(stored != null ? stored : fallback)
    const unsubscribe = subscribe(key, () => {
      const next = values.get(key)
      setValue(next != null ? next : fallback)
    })
    return unsubscribe
  }, [key, fallback])

  return value
}

/** Test / sign-out helper — drops every counter. */
export function clearAllCounters() {
  values.clear()
  for (const set of subscribers.values()) {
    for (const handler of set) {
      try {
        handler()
      } catch {
        // ignore
      }
    }
  }
  for (const handler of globalSubscribers) {
    try {
      handler(null)
    } catch {
      // ignore
    }
  }
}

/** Debug — subscribe to every change. Returns an unsubscribe fn. */
export function subscribeAll(handler) {
  if (typeof handler !== 'function') return () => {}
  globalSubscribers.add(handler)
  return () => {
    globalSubscribers.delete(handler)
  }
}
