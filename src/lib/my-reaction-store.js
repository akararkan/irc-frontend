import { useEffect, useState } from 'react'

/**
 * Mirrors the backend's per-viewer reaction state — "did *I* react?",
 * "did *I* save?", and what reaction type I used.
 *
 * Parallel to {@link import('./counter-store').useCounter}, which holds
 * everyone-visible totals. Where the counter store answers "how many?",
 * this store answers "what about me?".
 *
 * Three maps, all keyed by `<kind>:<id>`:
 *   - reacted:      Map<string, boolean>
 *   - saved:        Map<string, boolean>
 *   - reactionType: Map<string, 'LIKE' | …>   (semantic detail of `reacted`)
 *
 * Two writers, exactly as the backend describes:
 *   1. The initial API response seeds the store (every detail-page /
 *      feed-item fetch hands the mappers the viewer's row from
 *      post_reactions / research_reactions / answer_reactions, so the
 *      DTO arrives with `myReaction`, `currentUserReacted`, `isSaved`).
 *   2. SSE events with `actorId === currentUserId` patch the store
 *      live — covers the case where the viewer reacted in another tab
 *      or device.
 *
 * Why a separate store from the counter store? Because the two have
 * different fan-out semantics: counters update for *every* viewer, but
 * "did I react" only changes when the event actor is me. Keeping them
 * apart means counter subscribers don't re-render on actor matches and
 * vice versa.
 */

const KINDS = new Set([
  'post',
  'postComment',
  'research',
  'researchComment',
  'answer',
  'question',
])

const reacted = new Map() // key → boolean
const saved = new Map() // key → boolean
const reactionType = new Map() // key → string ('LIKE' currently)
const subscribers = new Map() // key → Set<callback>

let currentUserId = null
const userSubscribers = new Set()

function keyFor(kind, id) {
  if (!KINDS.has(kind) || !id) return null
  return `${kind}:${id}`
}

function notify(key) {
  const set = subscribers.get(key)
  if (!set) return
  for (const handler of set) {
    try {
      handler()
    } catch {
      // a misbehaving subscriber must not break the loop
    }
  }
}

/**
 * Inform the store of the active viewer's id. Called from
 * AuthProvider whenever sign-in / sign-out flips the user. SSE
 * dispatchers compare each event's `actorId` against this to decide
 * whether to patch the "did I react" state.
 *
 * Sign-out (id == null) clears every stored flag so the next viewer
 * doesn't inherit the previous viewer's reactions.
 */
export function setCurrentUserId(nextId) {
  const normalized = nextId ?? null
  if (currentUserId === normalized) return
  currentUserId = normalized
  // Sign-out wipes everything. Sign-in just changes the lookup target —
  // we don't clear because the next seeded API response will overwrite
  // each entry with the new viewer's truth anyway.
  if (normalized == null) {
    const allKeys = new Set([
      ...reacted.keys(),
      ...saved.keys(),
      ...reactionType.keys(),
    ])
    reacted.clear()
    saved.clear()
    reactionType.clear()
    for (const key of allKeys) notify(key)
  }
  for (const handler of userSubscribers) {
    try {
      handler(normalized)
    } catch {
      // ignore
    }
  }
}

export function getCurrentUserId() {
  return currentUserId
}

export function subscribeCurrentUser(handler) {
  if (typeof handler !== 'function') return () => {}
  userSubscribers.add(handler)
  return () => {
    userSubscribers.delete(handler)
  }
}

// ── Writers ──────────────────────────────────────────────────────

export function setReacted(kind, id, on, type = null) {
  const key = keyFor(kind, id)
  if (!key) return
  const next = Boolean(on)
  const prev = reacted.get(key) ?? false
  const prevType = reactionType.get(key) ?? null
  const nextType = next ? (type ?? prevType ?? 'LIKE') : null
  if (prev === next && prevType === nextType) return
  reacted.set(key, next)
  if (nextType == null) reactionType.delete(key)
  else reactionType.set(key, nextType)
  notify(key)
}

export function setSaved(kind, id, on) {
  const key = keyFor(kind, id)
  if (!key) return
  const next = Boolean(on)
  if ((saved.get(key) ?? false) === next) return
  saved.set(key, next)
  notify(key)
}

/**
 * Bulk seed from an API response. Accepts the various DTO shapes the
 * backend uses across modules (`myReaction`, `currentUserReacted` +
 * `currentUserReactionType`, `isSaved` / `saved`) so callers can pass
 * the response object verbatim.
 *
 * Seeds true / false explicitly when {@code authoritative} is true
 * (detail endpoints, where the mapper resolves the viewer's row).
 * When {@code authoritative} is false (feed listings — some of which
 * still hard-code `myReaction: null` for every row), only positive
 * signals are persisted so a feed render doesn't wipe a known-true
 * state established by a prior detail fetch or optimistic toggle.
 */
export function seedFromResponse(kind, response, { authoritative = true } = {}) {
  if (!response || !KINDS.has(kind)) return
  const id = response.id
  if (!id) return
  let reactedFlag
  let type
  if (response.myReaction !== undefined) {
    reactedFlag = response.myReaction != null
    type = response.myReaction ?? null
  } else if (response.currentUserReacted !== undefined) {
    reactedFlag = Boolean(response.currentUserReacted)
    type = response.currentUserReactionType ?? null
  } else if (response.likedByMe !== undefined) {
    // Cassandra-era PostResponse / FeedItemResponse / CommentResponse.
    reactedFlag = Boolean(response.likedByMe)
    type = response.likedByMe ? 'LIKE' : null
  }
  if (reactedFlag === true) {
    setReacted(kind, id, true, type)
  } else if (reactedFlag === false && authoritative) {
    setReacted(kind, id, false)
  }
  let savedFlag
  if (response.isSaved !== undefined) savedFlag = Boolean(response.isSaved)
  else if (response.saved !== undefined) savedFlag = Boolean(response.saved)
  else if (response.currentUserSaved !== undefined) savedFlag = Boolean(response.currentUserSaved)
  else if (response.savedByMe !== undefined) savedFlag = Boolean(response.savedByMe)
  if (savedFlag === true) {
    setSaved(kind, id, true)
  } else if (savedFlag === false && authoritative) {
    setSaved(kind, id, false)
  }
}

// ── Readers ──────────────────────────────────────────────────────

export function didIReact(kind, id) {
  const key = keyFor(kind, id)
  if (!key) return false
  return reacted.get(key) ?? false
}

export function didISave(kind, id) {
  const key = keyFor(kind, id)
  if (!key) return false
  return saved.get(key) ?? false
}

export function myReactionType(kind, id) {
  const key = keyFor(kind, id)
  if (!key) return null
  return reactionType.get(key) ?? null
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

// ── Hooks ────────────────────────────────────────────────────────

export function useDidIReact(kind, id, fallback = false) {
  const key = keyFor(kind, id)
  const [value, setValue] = useState(() => {
    if (!key) return fallback
    const stored = reacted.get(key)
    return stored != null ? stored : fallback
  })
  useEffect(() => {
    if (!key) {
      setValue(fallback)
      return undefined
    }
    const stored = reacted.get(key)
    setValue(stored != null ? stored : fallback)
    return subscribe(key, () => {
      const next = reacted.get(key)
      setValue(next != null ? next : fallback)
    })
  }, [key, fallback])
  return value
}

export function useDidISave(kind, id, fallback = false) {
  const key = keyFor(kind, id)
  const [value, setValue] = useState(() => {
    if (!key) return fallback
    const stored = saved.get(key)
    return stored != null ? stored : fallback
  })
  useEffect(() => {
    if (!key) {
      setValue(fallback)
      return undefined
    }
    const stored = saved.get(key)
    setValue(stored != null ? stored : fallback)
    return subscribe(key, () => {
      const next = saved.get(key)
      setValue(next != null ? next : fallback)
    })
  }, [key, fallback])
  return value
}

export function useMyReactionType(kind, id, fallback = null) {
  const key = keyFor(kind, id)
  const [value, setValue] = useState(() => {
    if (!key) return fallback
    return reactionType.get(key) ?? fallback
  })
  useEffect(() => {
    if (!key) {
      setValue(fallback)
      return undefined
    }
    setValue(reactionType.get(key) ?? fallback)
    return subscribe(key, () => {
      setValue(reactionType.get(key) ?? fallback)
    })
  }, [key, fallback])
  return value
}
