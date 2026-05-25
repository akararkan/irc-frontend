import { api } from '@/api/client'

// ══════════════════════════════════════════════════════════════
//  CLOSE FRIENDS  —  /api/v1/close-friends
//
//  Owner is derived from the JWT principal server-side. Older
//  callers may still pass `ownerId` as a positional arg; we accept
//  it for backward compatibility but never forward it on the wire
//  (the backend rejects unknown query params strict-mode in some
//  builds, and ignores them in others).
// ══════════════════════════════════════════════════════════════

/** List my close friends. */
export async function listCloseFriends(/* ownerId */) {
  const response = await api.get('/api/v1/close-friends')
  return response.data
}

export async function addCloseFriend(/* ownerId, */ ...args) {
  // Support both old `(ownerId, friendId)` and new `(friendId)` signatures.
  const friendId = args.length >= 2 ? args[1] : args[0]
  const response = await api.post('/api/v1/close-friends', null, {
    params: { friendId },
  })
  return response.data
}

export async function removeCloseFriend(/* ownerId, */ ...args) {
  const friendId = args.length >= 2 ? args[1] : args[0]
  await api.delete('/api/v1/close-friends', {
    params: { friendId },
  })
}

/**
 * Hot-path predicate the visibility filter calls when rendering
 * CLOSE_FRIENDS stories. Returns `{ member: bool }` per spec.
 * Anonymous viewer → `{ member: false }` (does NOT 401).
 */
export async function isCloseFriendMember(/* ownerId, */ ...args) {
  const candidateId = args.length >= 2 ? args[1] : args[0]
  const response = await api.get('/api/v1/close-friends/is-member', {
    params: { candidateId },
  })
  return response.data
}
