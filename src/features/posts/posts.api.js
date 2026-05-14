import { api } from '@/api/client'
import { API_URL } from '@/config/env'
import { idempotencyHeaders, newIdempotencyKey } from '@/lib/idempotency'

// ══════════════════════════════════════════════════════════════
//  POSTS  —  /api/v1/posts
// ══════════════════════════════════════════════════════════════

// ── Feeds ──────────────────────────────────────────────────────

export async function getFeed({ page = 0, size = 20 } = {}) {
  const response = await api.get('/api/v1/posts/feed', { params: { page, size } })
  return response.data
}

/**
 * Cursor-paginated public feed. Preferred for infinite scroll — performance
 * stays flat as the user scrolls (offset pagination degrades past page ~50).
 *
 * - First request: omit `cursor`.
 * - Subsequent requests: pass the `nextCursor` returned by the previous call.
 * - Treat the cursor as opaque (it's an ISO-8601 datetime today, but don't
 *   manipulate it).
 * - Server caps `limit` at 50.
 *
 * Response: { items: PostResponse[], nextCursor: string|null, hasMore: boolean }
 */
export async function getFeedCursor({ cursor, limit = 20 } = {}) {
  const params = { limit }
  if (cursor) params.cursor = cursor
  const response = await api.get('/api/v1/posts/feed/cursor', { params })
  return response.data
}

/**
 * Cursor-paginated following feed — same shape as {@link getFeedCursor}.
 * Stable under concurrent inserts: a new post landing while the user
 * scrolls doesn't shift the page boundary like offset pagination does.
 * Auth required.
 *
 * Response: { items: PostResponse[], nextCursor: string|null, hasMore: boolean }
 */
export async function getFollowingFeedCursor({ cursor, limit = 20 } = {}) {
  const params = { limit }
  if (cursor) params.cursor = cursor
  const response = await api.get('/api/v1/posts/feed/following/cursor', { params })
  return response.data
}

/**
 * For-You ranked feed. The backend's FeedRankingService scores each
 * candidate post with a 0.4·engagement + 0.3·recency + 0.2·relationship
 * + 0.1·diversity formula and caches the result in Redis for 60 s, so
 * paginated scrolls hit the same ordering. Use this as the home feed's
 * primary mode for signed-in viewers; fall back to {@link getFeed} for
 * guests or when ranking returns an empty page.
 *
 * @param {object} [params]
 * @param {number} [params.limit=20] — capped at 100 server-side.
 * @returns Promise<{ items: PostResponse[], hasMore: boolean }>
 */
export async function getForYouFeed({ limit = 20 } = {}) {
  const response = await api.get('/api/v1/posts/feed/for-you', {
    params: { limit },
  })
  return response.data
}

export async function getReels({ page = 0, size = 10 } = {}) {
  const response = await api.get('/api/v1/posts/feed/reels', { params: { page, size } })
  return response.data
}

export async function getFollowingReels({ page = 0, size = 10 } = {}) {
  const response = await api.get('/api/v1/posts/feed/reels/following', {
    params: { page, size },
  })
  return response.data
}

// ── Read ───────────────────────────────────────────────────────

export async function getPost(postId) {
  const response = await api.get(`/api/v1/posts/${postId}`)
  return response.data
}

export async function getUserPosts(authorId, { page = 0, size = 20 } = {}) {
  const response = await api.get(`/api/v1/posts/user/${authorId}`, {
    params: { page, size },
  })
  return response.data
}

export async function searchPosts({ q = '', page = 0, size = 20 } = {}) {
  const response = await api.get('/api/v1/posts/search', { params: { q, page, size } })
  return response.data
}

// ── Create / Update / Delete ──────────────────────────────────

/** POST /api/v1/posts — CreatePostRequest body (no files). */
export async function createPost(payload) {
  const response = await api.post('/api/v1/posts', payload)
  return response.data
}

/**
 * POST /api/v1/posts/upload — multipart.
 * Parts: `data` (CreatePostRequest JSON) + `files` (zero or more binaries).
 * The backend matches files to the mediaList entries it builds itself, so
 * callers just pass raw files.
 */
export async function createPostWithFiles({ data, files = [] }) {
  const form = new FormData()
  form.append(
    'data',
    new Blob([JSON.stringify(data)], { type: 'application/json' }),
  )
  for (const file of files) form.append('files', file)
  const response = await api.post('/api/v1/posts/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data
}

/** PATCH /api/v1/posts/{postId} — UpdatePostRequest body. */
export async function updatePost(postId, payload) {
  const response = await api.patch(`/api/v1/posts/${postId}`, payload)
  return response.data
}

export async function deletePost(postId) {
  await api.delete(`/api/v1/posts/${postId}`)
}

// ── Reactions on posts ─────────────────────────────────────────

/**
 * POST /api/v1/posts/{postId}/react — Instagram-style heart toggle.
 *
 * Backend only accepts LIKE now and treats an empty body as LIKE, so
 * we send no payload. The signature still accepts a `reactionType`
 * argument so legacy call sites compile, but the value is ignored.
 */
// eslint-disable-next-line no-unused-vars
export async function reactToPost(postId, reactionType) {
  // Idempotency-Key — guards against double-tap / network-retry
  // duplicate fires. The backend caches the response for 24 h keyed
  // by (actor, key) so the second click just replays.
  const response = await api.post(
    `/api/v1/posts/${postId}/react`,
    null,
    idempotencyHeaders(newIdempotencyKey()),
  )
  return response.data
}

// Backend returns 200 with the updated PostResponse body (the
// authoritative reactionCount + myReaction:null), so we surface it
// here for callers to reconcile their optimistic state against.
export async function removePostReaction(postId) {
  const response = await api.delete(
    `/api/v1/posts/${postId}/react`,
    idempotencyHeaders(newIdempotencyKey()),
  )
  return response.data
}

// ── Repost / Reshare (Facebook-style) ──────────────────────────
//
// `repostPost` creates a new post in the sharer's feed with
// postType=REPOST embedding the original. Self-reposts are allowed.
// The backend rejects DUPLICATE_REPOST (same original reposted twice
// by the same user) with HTTP 400.
//
// `undoRepost` removes the repost and decrements the share count.
// `sharePost` is kept as a thin alias — the backend's `/share`
// endpoint now delegates to repost too, so external callers keep
// working.

export async function repostPost(postId, caption) {
  const key = newIdempotencyKey()
  const response = await api.post(`/api/v1/posts/${postId}/repost`, null, {
    params: caption ? { caption } : undefined,
    headers: { 'Idempotency-Key': key },
  })
  return response.data
}

export async function undoRepost(postId) {
  await api.delete(
    `/api/v1/posts/${postId}/repost`,
    idempotencyHeaders(newIdempotencyKey()),
  )
}

export async function sharePost(postId, caption) {
  // Legacy alias — server now creates a repost too.
  return repostPost(postId, caption)
}

// ── Copy-link (counter-aware short link) ───────────────────────
//
// `getShareLink` previews the URL without bumping the counter — useful
// for in-app preview surfaces. `copyShareLink` is the action: an
// atomic increment of `shareCount`, broadcast on the post stream so
// every viewer sees the count tick, and returns the short token URL
// the caller should put on the clipboard.
//
// Both endpoints follow the canonical original even when called on a
// repost — the share is attributed to the original author's counter.

export async function getPostShareLink(postId) {
  const response = await api.get(`/api/v1/posts/${postId}/share-link`)
  return response.data
}

export async function copyPostShareLink(postId) {
  const response = await api.post(`/api/v1/posts/${postId}/copy-link`)
  return response.data
}

// ── Saves / bookmarks ──────────────────────────────────────────
//
// Instagram-style bookmarks. Backend mirrors the ResearchSave model:
// composite (post_id, user_id) key, optional `collection` name, an
// idempotent POST/DELETE pair, and a denormalized `saveCount` on the
// post that broadcasts SAVE_COUNT_UPDATED on the realtime stream.
//
// PostResponse.isSaved / .saveCount are hydrated for the requester on
// GET /posts/{id} — feed lists rely on the batch endpoint instead, so
// optimistic UI fills the gap until the next page fetch.

/**
 * POST /api/v1/posts/{postId}/save — idempotent bookmark.
 * `collection` is optional; backend defaults to "Default".
 * Returns the updated PostResponse (authoritative isSaved + saveCount).
 */
export async function savePost(postId, collection) {
  const headers = idempotencyHeaders(newIdempotencyKey())
  const response = await api.post(
    `/api/v1/posts/${postId}/save`,
    null,
    collection
      ? { params: { collection }, headers: headers?.headers }
      : headers,
  )
  return response.data
}

// DELETE returns 200 with the updated PostResponse — surface it so
// callers can reconcile their optimistic state against the server.
export async function unsavePost(postId) {
  const response = await api.delete(
    `/api/v1/posts/${postId}/save`,
    idempotencyHeaders(newIdempotencyKey()),
  )
  return response.data
}

/** GET /api/v1/posts/me/saved — paged PostResponse. */
export async function getSavedPosts({ page = 0, size = 20 } = {}) {
  const response = await api.get('/api/v1/posts/me/saved', {
    params: { page, size },
  })
  return response.data
}

export async function getSavedPostsByCollection(name, { page = 0, size = 20 } = {}) {
  const response = await api.get('/api/v1/posts/me/saved/collection', {
    params: { name, page, size },
  })
  return response.data
}

export async function getMyPostCollections() {
  const response = await api.get('/api/v1/posts/me/saved/collections')
  return response.data
}

export async function renamePostCollection(oldName, newName) {
  await api.patch('/api/v1/posts/me/saved/collections', null, {
    params: { oldName, newName },
  })
}

// ══════════════════════════════════════════════════════════════
//  COMMENTS  —  /api/v1/posts/{postId}/comments
// ══════════════════════════════════════════════════════════════

export async function getPostComments(postId, { page = 0, size = 20 } = {}) {
  const response = await api.get(`/api/v1/posts/${postId}/comments`, {
    params: { page, size },
  })
  return response.data
}

export async function getPostCommentReplies(postId, commentId, { page = 0, size = 10 } = {}) {
  const response = await api.get(
    `/api/v1/posts/${postId}/comments/${commentId}/replies`,
    { params: { page, size } },
  )
  return response.data
}

/**
 * Cursor-paginated top-level comments. Stable under concurrent
 * inserts — page-based pagination shifts entries when a new comment
 * lands above the current page, causing duplicates or skips on
 * scroll. The cursor is the previous page's last `createdAt` (ISO).
 *
 * @returns Promise<{ items: CommentResponse[], nextCursor: string|null, hasMore: boolean }>
 */
export async function getPostCommentsCursor(postId, { cursor, limit = 20 } = {}) {
  const params = { limit }
  if (cursor) params.cursor = cursor
  const response = await api.get(`/api/v1/posts/${postId}/comments/cursor`, { params })
  return response.data
}

/** Cursor-paginated reply thread under a single comment. */
export async function getPostCommentRepliesCursor(
  postId,
  commentId,
  { cursor, limit = 10 } = {},
) {
  const params = { limit }
  if (cursor) params.cursor = cursor
  const response = await api.get(
    `/api/v1/posts/${postId}/comments/${commentId}/replies/cursor`,
    { params },
  )
  return response.data
}

/** POST /api/v1/posts/{postId}/comments — CreateCommentRequest body. */
export async function createPostComment(postId, payload) {
  const response = await api.post(
    `/api/v1/posts/${postId}/comments`,
    payload,
    idempotencyHeaders(newIdempotencyKey()),
  )
  return response.data
}

/**
 * POST /api/v1/posts/{postId}/comments/upload — multipart.
 * Parts: `data` (CreateCommentRequest JSON) + `media` (single optional file).
 */
export async function createPostCommentWithMedia(postId, { data, media }) {
  const form = new FormData()
  form.append('data', new Blob([JSON.stringify(data)], { type: 'application/json' }))
  if (media) form.append('media', media)
  const response = await api.post(
    `/api/v1/posts/${postId}/comments/upload`,
    form,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Idempotency-Key': newIdempotencyKey(),
      },
    },
  )
  return response.data
}

/** PATCH /api/v1/posts/{postId}/comments/{commentId} — EditCommentRequest body. */
export async function editPostComment(postId, commentId, { textContent }) {
  const response = await api.patch(
    `/api/v1/posts/${postId}/comments/${commentId}`,
    { textContent },
  )
  return response.data
}

export async function deletePostComment(postId, commentId) {
  await api.delete(`/api/v1/posts/${postId}/comments/${commentId}`)
}

/** POST …/react — empty body; backend defaults to LIKE (heart toggle). */
// eslint-disable-next-line no-unused-vars
export async function reactToComment(postId, commentId, reactionType) {
  const response = await api.post(
    `/api/v1/posts/${postId}/comments/${commentId}/react`,
    null,
    idempotencyHeaders(newIdempotencyKey()),
  )
  return response.data
}

export async function removeCommentReaction(postId, commentId) {
  await api.delete(
    `/api/v1/posts/${postId}/comments/${commentId}/react`,
    idempotencyHeaders(newIdempotencyKey()),
  )
}

// ══════════════════════════════════════════════════════════════
//  REALTIME  —  /api/v1/posts/{postId}/stream  (SSE)
// ══════════════════════════════════════════════════════════════
//
// EventSource cannot send Authorization headers, so the access token
// is appended as a query parameter and validated by the backend.
// The stream emits PostRealtimeEventType events (POST_UPDATED,
// POST_DELETED, POST_REACTED, POST_COMMENTED, POST_SHARED, …) plus
// the standard `connected` / `heartbeat` envelope events.
export function postStreamUrl(postId, token) {
  const url = new URL(`/api/v1/posts/${postId}/stream`, API_URL)
  if (token) url.searchParams.set('token', token)
  return url.toString()
}
