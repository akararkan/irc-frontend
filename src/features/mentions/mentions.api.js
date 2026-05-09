import { api } from '@/api/client'

// ══════════════════════════════════════════════════════════════
//  MENTIONS  —  /api/v1/mentions
//
//  Purpose-built endpoints for the @mention picker. They beat the
//  generic /users/search path because they:
//    - Rank prefix-match on username first (Slack/Twitter style),
//      fall back to name, then trigram for typos.
//    - Filter blocked / locked / deleted / self server-side.
//    - Are cached 30 s in Redis per (q, viewer) — repeated keystrokes
//      on the same prefix are free after the first hit.
//    - Return a minimal Suggestion payload (no bio / counts) so the
//      response is small enough for sub-5 ms wall-clock.
// ══════════════════════════════════════════════════════════════

/**
 * Autocomplete picker — typed `q` ≈ 1–50 chars. The backend caps
 * `limit` at a small number; we default to 8 to match the picker's
 * visible footprint.
 *
 * Response: `Suggestion[]` — each `{ id, username, fullName, avatarUrl, role }`.
 *
 * Returns `[]` for empty / whitespace-only queries so the UI doesn't
 * have to special-case.
 */
export async function suggestMentions({ q, limit = 8 } = {}) {
  if (!q || !q.trim()) return []
  const response = await api.get('/api/v1/mentions/suggest', {
    params: { q: q.trim(), limit },
  })
  return Array.isArray(response.data) ? response.data : []
}

/**
 * Lock-in the user that was actually picked from the autocomplete
 * dropdown. Records a `MENTION_LOOKUP` activity row pointing at the
 * picked user, which feeds the per-user activity stream + history.
 *
 * Best-effort — failures are swallowed so a flaky network never blocks
 * the user from inserting the mention chip. Returns `true` on a 2xx,
 * `false` otherwise (callers rarely need this; the recording is async
 * server-side anyway).
 */
export async function recordMentionClick({ q, targetUserId, targetUsername } = {}) {
  if (!targetUserId && !targetUsername) return false
  try {
    await api.post('/api/v1/mentions/click', {
      q: (q ?? '').trim(),
      targetUserId: targetUserId ?? null,
      targetUsername: targetUsername ?? null,
    })
    return true
  } catch {
    return false
  }
}

/**
 * Server-authoritative mention parser. Returns the deduped lower-cased
 * usernames the backend would notify, the `@followers` sentinel flag,
 * and a list of tokens with offsets so the UI can highlight without
 * re-running its own regex.
 *
 * Use sparingly — the FE's `tokenizeMentions` is fine for live
 * rendering; this endpoint is for "show me exactly who will be
 * notified" preview chips and pre-publish confirmation flows.
 *
 * Response: { usernames: string[], followersSentinel: boolean,
 *             tokens: { handle, start, end, followersSentinel }[] }
 */
export async function parseMentions(text) {
  if (text == null) return { usernames: [], followersSentinel: false, tokens: [] }
  const response = await api.post('/api/v1/mentions/parse', { text })
  const data = response.data ?? {}
  return {
    usernames: Array.isArray(data.usernames) ? data.usernames : [],
    followersSentinel: Boolean(data.followersSentinel),
    tokens: Array.isArray(data.tokens) ? data.tokens : [],
  }
}
