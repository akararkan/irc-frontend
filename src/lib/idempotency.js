/**
 * Idempotency-Key helper.
 *
 * The backend's IdempotencyFilter caches the full response body for any
 * mutating request that carries an `Idempotency-Key` header, keyed by
 * (actor, token), for 24 h. A repeat request with the same token
 * replays the cached response instead of re-executing the handler.
 *
 * Use this from a click handler when:
 *   - The mutation is expensive or has user-visible side-effects (a
 *     reaction broadcast, a save, a share).
 *   - Network flakiness might cause a retry that would otherwise
 *     double-count.
 *
 * Generate the token once per logical user action — typically at the
 * very top of the click handler, before any optimistic write. Reuse it
 * across the retry path of the same click; do NOT reuse it across two
 * separate user actions (the second action would silently replay the
 * first's response).
 *
 * Example:
 *   const idempotencyKey = newIdempotencyKey()
 *   await api.post('/posts/{id}/react', null, idempotencyHeaders(idempotencyKey))
 *
 * The token is opaque to the server; UUID v4 is the conventional
 * shape. Falls back to crypto.getRandomValues + a Math.random splash
 * when running in an older environment without crypto.randomUUID
 * (still strong enough — the key just needs to be unique per request,
 * not cryptographically secret).
 */
export function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback: 122-bit RFC4122-shaped value via getRandomValues. Older
  // Edge/iOS builds lacked randomUUID but had getRandomValues.
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant 1
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }
  // Last-resort: timestamped Math.random. Not unique under high
  // concurrency on a single device, but the backend dedupe is by
  // (actor, key) and the realistic worst case is a duplicate replay
  // — acceptable degradation.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** Wrap a token in the axios config shape `{ headers: { 'Idempotency-Key': … } }`. */
export function idempotencyHeaders(token) {
  if (!token) return undefined
  return { headers: { 'Idempotency-Key': token } }
}
