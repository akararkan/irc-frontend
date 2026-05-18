import { useEffect, useState } from 'react'

/**
 * Per-device memory of which entities the current viewer has reacted to.
 *
 * Why this exists: the backend's post-feed endpoints (home, following,
 * reels, user profile, search) do not yet hydrate `myReaction` for the
 * viewer — every row arrives with `myReaction: null` even when the user
 * has previously liked it. Without this cache, a user reacts to a post,
 * scrolls away, comes back, and the heart renders empty. With this
 * cache, the act of reacting persists locally and survives a reload.
 *
 * Research and QnA already populate the reacted state server-side, so
 * they don't need to read from here — only posts (incl. reels) and post
 * comments do, but the post-card hooks call into this for both.
 *
 * Storage shape (localStorage key `rxn-cache:<userId>`):
 *   { "post:<uuid>": "LIKE", "comment:<uuid>": "LIKE", … }
 *
 * Scoped per user so logging out / switching accounts doesn't leak
 * one viewer's reactions onto another's feed — each viewer reads their
 * own `rxn-cache:<userId>` key, so the cache deliberately survives
 * sign-out and lets the same user's next sign-in still see their
 * hearts filled in.
 */

const STORAGE_PREFIX = 'rxn-cache:'

let currentUserId = null
let cache = {}
const subscribers = new Set()

function keyFor(userId) {
  return `${STORAGE_PREFIX}${userId}`
}

function load(userId) {
  if (!userId || typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(keyFor(userId))
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function persist() {
  if (!currentUserId || typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(keyFor(currentUserId), JSON.stringify(cache))
  } catch {
    // quota / disabled — silently degrade to in-memory only.
  }
}

function notify(entityKey) {
  for (const handler of subscribers) {
    try {
      handler(entityKey)
    } catch {
      // a misbehaving subscriber must not break the loop
    }
  }
}

function entityKey(kind, id) {
  if (!kind || !id) return null
  return `${kind}:${id}`
}

/**
 * Switch the active viewer. Call from AuthProvider whenever the
 * current user changes (sign-in, sign-out, account switch). Reading
 * for a different user without this call would surface someone else's
 * cached reactions.
 */
export function setReactionCacheUser(userId) {
  if (currentUserId === userId) return
  currentUserId = userId ?? null
  cache = load(currentUserId)
  notify(null) // broadcast a global invalidation
}

/** Wipe the in-memory cache + the persisted copy for the current user. */
export function clearReactionCache() {
  if (!currentUserId) {
    cache = {}
    notify(null)
    return
  }
  cache = {}
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(keyFor(currentUserId))
    } catch {
      // ignore
    }
  }
  notify(null)
}

/**
 * Synchronous read: returns the reaction type ("LIKE") if the viewer
 * has reacted, or null. Safe to call during render.
 */
export function getCachedReaction(kind, id) {
  const k = entityKey(kind, id)
  if (!k) return null
  return cache[k] ?? null
}

/** Record (or overwrite) the viewer's reaction. Persists immediately. */
export function rememberReaction(kind, id, type = 'LIKE') {
  const k = entityKey(kind, id)
  if (!k) return
  if (cache[k] === type) return
  cache[k] = type
  persist()
  notify(k)
}

/** Forget the viewer's reaction (undo path). Persists immediately. */
export function forgetReaction(kind, id) {
  const k = entityKey(kind, id)
  if (!k) return
  if (!(k in cache)) return
  delete cache[k]
  persist()
  notify(k)
}

/**
 * React hook — returns the cached reaction for an entity, reactive to
 * cache mutations. Use as a fallback when the server's `myReaction`
 * field is null (which it is for every post-list endpoint today).
 *
 * Example:
 *   const cached = useCachedReaction('post', post.id)
 *   const myReaction = post.myReaction ?? cached
 */
export function useCachedReaction(kind, id) {
  const k = entityKey(kind, id)
  const [value, setValue] = useState(() => (k ? cache[k] ?? null : null))

  useEffect(() => {
    if (!k) {
      setValue(null)
      return undefined
    }
    setValue(cache[k] ?? null)
    const handler = (changedKey) => {
      if (changedKey == null || changedKey === k) {
        setValue(cache[k] ?? null)
      }
    }
    subscribers.add(handler)
    return () => {
      subscribers.delete(handler)
    }
  }, [k])

  return value
}
