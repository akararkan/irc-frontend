import { useEffect, useState } from 'react'

import { suggestMentions } from '@/features/mentions/mentions.api'
import { getUserByUsername } from '@/features/users/users.api'

/**
 * Tiny lazy cache for resolving `@username` mentions to the user's
 * display name (the rest of the profile, too — avatar, role, id).
 *
 * Why: posts/comments/answers carry mention tokens as `@username`
 * because that's all the backend's MentionService parses. To render
 * Facebook-style mentions ("Jane Smith" in blue, no `@`), we need
 * the user's `fullName` and avatar — neither is in the source string.
 *
 * Strategy:
 *   - Look up `/api/v1/users/username/{name}` once per username; keep
 *     the result in memory for `STALE_MS`.
 *   - Dedupe in-flight requests so a feed full of `@bob` mentions
 *     fires one network call.
 *   - When a username can't be resolved (404, blocked, deactivated),
 *     remember the negative answer for `NEGATIVE_TTL_MS` so we don't
 *     hammer the endpoint.
 *   - Subscribers (the `useResolvedUser` hook) re-render automatically
 *     when their username's entry lands.
 *
 * `seedUserCache(user)` lets the topbar search, autocomplete picker,
 * profile pages, etc. drop a freshly-fetched user into the cache so
 * any mention chip showing up in the same session renders instantly.
 */

const STALE_MS = 5 * 60 * 1000 // 5 minutes
const NEGATIVE_TTL_MS = 60 * 1000 // 1 minute for misses

const cache = new Map() // key (lowerUsername) → { user|null, fetchedAt }
const inflight = new Map() // key → Promise<user|null>
const subscribers = new Map() // key → Set<callback>

function keyOf(username) {
  if (!username || typeof username !== 'string') return null
  return username.replace(/^@+/, '').toLowerCase().trim()
}

function notify(key) {
  const set = subscribers.get(key)
  if (!set) return
  for (const fn of set) {
    try {
      fn()
    } catch {
      // a misbehaving subscriber must never break the cache loop
    }
  }
}

function setEntry(key, user) {
  cache.set(key, { user: user ?? null, fetchedAt: Date.now() })
  notify(key)
}

/**
 * Read-only peek into the cache. Returns `null` if we've never tried,
 * the user object if we have a fresh hit, or `null` if it was a miss
 * (caller can disambiguate via `hasCachedUser`).
 */
export function getCachedUser(username) {
  const key = keyOf(username)
  if (!key) return null
  const entry = cache.get(key)
  if (!entry) return null
  if (entry.user == null) return null
  if (Date.now() - entry.fetchedAt > STALE_MS) return null
  return entry.user
}

export function hasCachedUser(username) {
  const key = keyOf(username)
  if (!key) return false
  const entry = cache.get(key)
  if (!entry) return false
  return Date.now() - entry.fetchedAt <= STALE_MS
}

/**
 * Drop a freshly-known user into the cache. Accepts the various shapes
 * the rest of the codebase passes around — UserResponse, search hit,
 * mention picker option — and normalizes to a record with `username`.
 *
 * When the username is email-shaped (`name@host`), we ALSO seed under
 * the local-part key so a mention chip parsed by the FE regex (which
 * only ever captures the local-part) resolves to the same record. Without
 * this dual-keying, a user whose stored username is the email would
 * have their `@akar.arkanf19` mentions stuck on the handle fallback
 * because `useResolvedUser('akar.arkanf19')` would miss.
 */
export function seedUserCache(user) {
  if (!user) return
  const raw = user.username ?? user.authorUsername ?? user.lastActorUsername
  const primary = keyOf(raw)
  if (!primary) return
  setEntry(primary, user)
  // Mirror under the local-part so handle-shaped mention tokens hit.
  if (typeof raw === 'string' && raw.includes('@')) {
    const localPart = raw.split('@')[0]
    const alias = keyOf(localPart)
    if (alias && alias !== primary) setEntry(alias, user)
  }
}

/**
 * Fetch a user by username, deduping concurrent calls. Resolves to the
 * user object on success or `null` on miss. The result is cached.
 */
export async function fetchUserByUsername(username) {
  const key = keyOf(username)
  if (!key) return null

  const entry = cache.get(key)
  if (entry) {
    const negative = entry.user == null
    const ttl = negative ? NEGATIVE_TTL_MS : STALE_MS
    if (Date.now() - entry.fetchedAt <= ttl) {
      return entry.user
    }
  }

  const existing = inflight.get(key)
  if (existing) return existing

  const promise = (async () => {
    try {
      const user = await getUserByUsername(key)
      if (user) {
        // Use seedUserCache so the email-shaped alias also fills in.
        seedUserCache(user)
        return user
      }
    } catch {
      // fall through to the suggest fallback
    }
    // Fallback: the backend lookup is exact-match on `username`, so a
    // mention `@akar.arkanf19` whose actual stored username is
    // `akar.arkanf19@gmail.com` 404s. The mention-suggest endpoint
    // does prefix matching, so we use it to pick up the email-shaped
    // record by its local-part. Top result is the most relevant by
    // backend ranking; we only accept it when the local-part actually
    // matches what we asked for (avoids returning a sibling like
    // `akar.arkanf20` when the query had a typo).
    try {
      const suggestions = await suggestMentions({ q: key, limit: 5 })
      const match = suggestions.find((u) => {
        const candidate = (u.username ?? '').toString().toLowerCase()
        if (!candidate) return false
        if (candidate === key) return true
        const localPart = candidate.split('@')[0]
        return localPart === key
      })
      if (match) {
        seedUserCache(match)
        return match
      }
    } catch {
      // ignore — fall through to the negative cache
    }
    setEntry(key, null)
    return null
  })().finally(() => {
    inflight.delete(key)
  })
  inflight.set(key, promise)
  return promise
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
 * React hook — returns the cached user (or `null` while loading / on
 * miss). Triggers a one-shot fetch when the username isn't already in
 * the cache. Subscribes for updates so a late arrival re-renders the
 * caller.
 */
export function useResolvedUser(username) {
  const key = keyOf(username)
  const [user, setUser] = useState(() =>
    key ? (cache.get(key)?.user ?? null) : null,
  )

  useEffect(() => {
    if (!key) {
      setUser(null)
      return undefined
    }

    // Snapshot whatever's already there for the new key — this also
    // covers the case where the same hook is reused with a new
    // username via prop changes.
    setUser(cache.get(key)?.user ?? null)

    const unsubscribe = subscribe(key, () => {
      setUser(cache.get(key)?.user ?? null)
    })

    fetchUserByUsername(key)

    return unsubscribe
  }, [key])

  return user
}
