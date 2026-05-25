import { api } from '@/api/client'
import { API_URL } from '@/config/env'
import { idempotencyHeaders, newIdempotencyKey } from '@/lib/idempotency'

// ══════════════════════════════════════════════════════════════
//  POSTS  —  /api/v1/posts
//
//  Mirrors the backend post package contract (see POST_API.md).
//
//    1.  Posts (create / read / delete / SSE)
//    2.  Feeds (home, profile, reels, search, suggestions)
//    3.  Reactions (post + comment)
//    4.  Comments & Replies
//    5.  Saves (bookmarks)
//    6.  Shares
//    7.  Views
//    8.  Media (carousels)
//    9.  Hashtags & Mentions
//
//  Project rules baked into every signature here:
//    - Author / sharer / viewer derived from the JWT — body / query
//      params for `authorId`, `sharerId`, `userId` are not part of the
//      contract on mutating endpoints. Legacy aliases at the bottom
//      absorb stray `userId` args from older callers so call sites
//      that still pass them keep compiling.
//    - One reaction type only (`LIKE`); `type` args from older callers
//      are accepted but ignored.
//    - Repost = `createPost({ postType: 'REPOST', sharedPostId })`.
// ══════════════════════════════════════════════════════════════

// ── Enums (mirrored from ak.dev.irc.app.post.enums) ────────────

export const PostType = Object.freeze({
  TEXT: 'TEXT',
  EMBEDDED: 'EMBEDDED',
  VOICE_POST: 'VOICE_POST',
  REEL: 'REEL',
  REPOST: 'REPOST',
  STORY: 'STORY',
})

export const PostVisibility = Object.freeze({
  PUBLIC: 'PUBLIC',
  FOLLOWERS_ONLY: 'FOLLOWERS_ONLY',
  ONLY_ME: 'ONLY_ME',
})

export const PostStatus = Object.freeze({
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  ARCHIVED: 'ARCHIVED',
  REMOVED: 'REMOVED',
})

export const PostMediaType = Object.freeze({
  IMAGE: 'IMAGE',
  VIDEO: 'VIDEO',
  AUDIO_TRACK: 'AUDIO_TRACK',
  DOCUMENT: 'DOCUMENT',
})

export const PostReactionType = Object.freeze({ LIKE: 'LIKE' })

// ── Internal helpers ───────────────────────────────────────────

function stripDerivedIds(payload) {
  if (!payload || typeof payload !== 'object') return payload
  // The server derives these from the JWT principal — sending them is
  // a no-op at best, a footgun if a stale client value disagrees.
  // eslint-disable-next-line no-unused-vars
  const { authorId, sharerId, userId, ...rest } = payload
  return rest
}

function todayUtcIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

// ── Media normalization ───────────────────────────────────────
//
// The Cassandra contract stores media as two parallel arrays on
// `PostResponse` (`mediaUrls[]` + `mediaTypes[]`) and as a single
// `mediaUrl` on the lighter `FeedItemResponse`. The frontend
// consumes media as `mediaList: [{ url, mediaType }, ...]`. Zip
// them here so the UI never has to know about the wire shape.

const VIDEO_EXT_RE = /\.(mp4|m4v|mov|webm|ogg|ogv|mkv|avi)(\?|$)/i
const AUDIO_EXT_RE = /\.(mp3|wav|m4a|aac|flac|opus|oga)(\?|$)/i

function sniffMediaType(url) {
  if (!url || typeof url !== 'string') return 'IMAGE'
  if (VIDEO_EXT_RE.test(url)) return 'VIDEO'
  if (AUDIO_EXT_RE.test(url)) return 'AUDIO_TRACK'
  return 'IMAGE'
}

function defaultMediaTypeFor(postType, url) {
  // `postType` is the most reliable signal — CDN URLs often lack an
  // extension so we can't rely on URL sniffing alone for reels /
  // voice posts. Fall back to extension sniffing for EMBEDDED posts
  // where the carousel can mix images and videos.
  switch ((postType ?? '').toUpperCase()) {
    case 'REEL':
      return 'VIDEO'
    case 'VOICE_POST':
      return 'AUDIO_TRACK'
    default:
      return sniffMediaType(url)
  }
}

function buildMediaList(post) {
  if (!post || typeof post !== 'object') return null
  const postType = post.postType
  // Carousel form (PostResponse).
  if (Array.isArray(post.mediaUrls) && post.mediaUrls.length > 0) {
    const types = Array.isArray(post.mediaTypes) ? post.mediaTypes : []
    return post.mediaUrls
      .map((url, idx) => {
        if (!url) return null
        const t =
          types[idx] ??
          (idx === 0 ? defaultMediaTypeFor(postType, url) : sniffMediaType(url))
        return { url, mediaType: String(t).toUpperCase() }
      })
      .filter(Boolean)
  }
  // Single-media form (FeedItemResponse — no `mediaTypes`).
  if (typeof post.mediaUrl === 'string' && post.mediaUrl.length > 0) {
    return [
      {
        url: post.mediaUrl,
        mediaType: String(
          post.mediaType ?? defaultMediaTypeFor(postType, post.mediaUrl),
        ).toUpperCase(),
      },
    ]
  }
  // VOICE_POST sometimes ships its audio at `audioTrackUrl` only, with
  // no entries in `mediaUrls` — surface it through the same channel
  // so post-card's `mediaList?.[0]?.url` resolution Just Works.
  if (
    (postType ?? '').toUpperCase() === 'VOICE_POST' &&
    typeof post.audioTrackUrl === 'string' &&
    post.audioTrackUrl.length > 0
  ) {
    return [{ url: post.audioTrackUrl, mediaType: 'AUDIO_TRACK' }]
  }
  return []
}

/**
 * Decorate a server post with a UI-friendly `mediaList`. Idempotent
 * — if the post already has `mediaList`, it's returned unchanged.
 * Safe on falsy input (returns it through). Never throws — on any
 * unexpected shape the original post passes through untouched so the
 * UI still renders the rest of the card.
 */
export function hydratePost(post) {
  try {
    if (!post || typeof post !== 'object') return post
    if (Array.isArray(post.mediaList)) return post
    const mediaList = buildMediaList(post)
    return mediaList ? { ...post, mediaList } : post
  } catch (error) {
    if (typeof console !== 'undefined') {
      // Loud in dev, silent in prod — but never thrown.
      console.warn('[posts.api] hydratePost failed; passing through', error)
    }
    return post
  }
}

// ── Shared-post (repost) resolution ───────────────────────────
//
// A `REPOST` carries only `sharedPostId` on the wire; the UI wants a
// nested `sharedPost` object so it can render the original author,
// text, and media inside the quoted card. We resolve it by fetching
// the original via `GET /posts/{id}` — bounded by unique IDs per
// response so a feed with 20 reposts of the same source is one call,
// not twenty.
//
// Depth cap: we never resolve a `sharedPostId` on the *embedded*
// original. Reposts-of-reposts collapse to a single quote level,
// which is what every Instagram/Twitter-shaped UI does anyway.

async function fetchOriginalPost(postId) {
  // Bypass the public `getPost` so we don't recurse through the
  // resolver. Depth cap: the embedded original gets `mediaList` from
  // `hydratePost` but does NOT chase its own `sharedPostId`. A repost
  // of a repost collapses to a single quote level — same as every
  // mainstream social UI.
  const response = await api.get(`/api/v1/posts/${postId}`)
  return hydratePost(response.data)
}

async function attachSharedPost(post) {
  if (!post || typeof post !== 'object') return post
  if (post.sharedPost) return post
  if (!post.sharedPostId) return post
  try {
    const original = await fetchOriginalPost(post.sharedPostId)
    return { ...post, sharedPost: original, isRepost: true }
  } catch {
    // Original deleted / hidden / 404 — leave `isRepost` set so the
    // repost banner still renders as a tombstone.
    return { ...post, isRepost: true }
  }
}

async function attachSharedPostsBatched(items) {
  if (!Array.isArray(items) || items.length === 0) return items

  // ── Phase 1: upgrade light feed items that are reposts ────────
  // `FeedItemResponse` (per spec) omits `sharedPostId`, so a repost
  // in the home/profile feed has no way to point at its origin. Fetch
  // the full `PostResponse` for those before phase 2 so the resolver
  // has something to chase. Deduped by post id.
  const upgradeIds = [
    ...new Set(
      items
        .filter(
          (p) =>
            p &&
            (p.postType ?? '').toUpperCase() === 'REPOST' &&
            !p.sharedPostId &&
            !p.sharedPost &&
            p.id,
        )
        .map((p) => p.id),
    ),
  ]
  let upgraded = items
  if (upgradeIds.length > 0) {
    const settled = await Promise.all(
      upgradeIds.map(async (id) => {
        try {
          return [id, await fetchOriginalPost(id)]
        } catch {
          return [id, null]
        }
      }),
    )
    const byId = new Map(settled)
    upgraded = items.map((p) => {
      if (!p) return p
      if (
        (p.postType ?? '').toUpperCase() !== 'REPOST' ||
        p.sharedPostId ||
        !p.id
      ) {
        return p
      }
      const full = byId.get(p.id)
      // Layer the fuller PostResponse on top of the light feed item
      // so we pick up `sharedPostId`, `audioTrackUrl`, the carousel
      // arrays, and the freshly built `mediaList`.
      return full ? { ...p, ...full } : p
    })
  }

  // ── Phase 2: resolve `sharedPostId` → embedded `sharedPost` ───
  const sharedIds = [
    ...new Set(
      upgraded
        .filter((p) => p && p.sharedPostId && !p.sharedPost)
        .map((p) => p.sharedPostId),
    ),
  ]
  if (sharedIds.length === 0) return upgraded
  const settled = await Promise.all(
    sharedIds.map(async (id) => {
      try {
        return [id, await fetchOriginalPost(id)]
      } catch {
        return [id, null]
      }
    }),
  )
  const byId = new Map(settled)
  return upgraded.map((p) => {
    if (!p || !p.sharedPostId || p.sharedPost) return p
    const original = byId.get(p.sharedPostId)
    return original
      ? { ...p, sharedPost: original, isRepost: true }
      : { ...p, isRepost: true }
  })
}

async function hydrateAndAttach(post) {
  // The single-post path is best-effort: if `attachSharedPost` throws
  // (it shouldn't — it catches its own fetch errors — but defence in
  // depth), the user still gets the hydrated raw post back.
  const hydrated = hydratePost(post)
  try {
    return await attachSharedPost(hydrated)
  } catch (error) {
    if (typeof console !== 'undefined') {
      console.warn('[posts.api] attachSharedPost failed; rendering without quote', error)
    }
    return hydrated
  }
}

async function safeBatchAttach(arr) {
  try {
    return await attachSharedPostsBatched(arr)
  } catch (error) {
    if (typeof console !== 'undefined') {
      console.warn('[posts.api] attachSharedPostsBatched failed; rendering raw list', error)
    }
    return arr
  }
}

async function hydrateAndAttachList(payload) {
  // Goal: under no circumstances let an enrichment failure (a 404 on
  // a deleted original, a Cassandra timeout, a malformed item) take
  // down the feed. The user sees whatever the server already gave us.
  try {
    if (Array.isArray(payload)) {
      return await safeBatchAttach(payload.map(hydratePost))
    }
    if (!payload || typeof payload !== 'object') return payload
    // Spring's `Page<T>` shape: `{ content, totalElements, last, ... }`.
    if (Array.isArray(payload.content)) {
      const content = await safeBatchAttach(payload.content.map(hydratePost))
      return { ...payload, content }
    }
    // Cassandra cursor shape: `{ items, nextCursor, hasMore }`.
    if (Array.isArray(payload.items)) {
      const items = await safeBatchAttach(payload.items.map(hydratePost))
      return { ...payload, items }
    }
    return payload
  } catch (error) {
    if (typeof console !== 'undefined') {
      console.warn('[posts.api] hydrateAndAttachList failed; returning raw payload', error)
    }
    return payload
  }
}

// =============================================================
//  1.  POSTS
// =============================================================

/**
 * `POST /api/v1/posts` — JSON create.
 *
 * Body fields (all optional except `postType`):
 *   postType, visibility, textContent, audioTrackUrl, audioTrackName,
 *   locationName, locationLat, locationLng, sharedPostId, shareLink,
 *   mediaUrls[], mediaTypes[], soundId.
 *
 * Returns a hydrated `PostResponse`.
 */
export async function createPost(payload) {
  const response = await api.post(
    '/api/v1/posts',
    stripDerivedIds(payload),
    idempotencyHeaders(newIdempotencyKey()),
  )
  return hydrateAndAttach(response.data)
}

/**
 * `POST /api/v1/posts` (multipart) — flat form fields + binary parts.
 *
 * Files are accepted under any of these part names per the backend:
 * `files`, `files[]`, `media`, `media[]`, `file`, `video`, `videos`,
 * `image`, `images`. We use `files` (the canonical name) and let the
 * server expand the array.
 *
 * Falls back gracefully if you've already uploaded binaries elsewhere:
 * pass `mediaUrls` / `mediaTypes` and skip `files` — the request will
 * still hit the same multipart endpoint.
 */
export async function createPostMultipart({ files = [], ...fields } = {}) {
  const form = new FormData()
  const clean = stripDerivedIds(fields)

  for (const [key, value] of Object.entries(clean)) {
    if (value === null || value === undefined) continue
    if (Array.isArray(value)) {
      for (const item of value) form.append(key, item)
    } else {
      form.append(key, value)
    }
  }
  for (const file of files) form.append('files', file)

  const response = await api.post('/api/v1/posts', form, {
    headers: {
      'Content-Type': 'multipart/form-data',
      'Idempotency-Key': newIdempotencyKey(),
    },
  })
  return hydrateAndAttach(response.data)
}

/** `GET /api/v1/posts/{id}` — hydrated `PostResponse`. */
export async function getPost(postId) {
  const response = await api.get(`/api/v1/posts/${postId}`)
  return hydrateAndAttach(response.data)
}

/** `DELETE /api/v1/posts/{id}` — hard-delete (author only). */
export async function deletePost(postId) {
  await api.delete(`/api/v1/posts/${postId}`)
}

/**
 * Per-post SSE stream — every event on this post (reactions,
 * comments, replies, view / share / save counters, edits, deletes).
 * EventSource can't send headers; the token rides as a query param.
 */
export function postStreamUrl(postId, token) {
  const url = new URL(`/api/v1/posts/${postId}/stream`, API_URL)
  if (token) url.searchParams.set('token', token)
  return url.toString()
}

// =============================================================
//  2.  FEEDS
// =============================================================

/**
 * `GET /api/v1/posts/feed` — home timeline (fanout-on-write).
 * Cursor is an instant string from the previous page's tail.
 */
export async function getHomeFeed({ pageSize = 20, cursor } = {}) {
  const params = { pageSize }
  if (cursor) params.cursor = cursor
  const response = await api.get('/api/v1/posts/feed', { params })
  return hydrateAndAttachList(response.data)
}

/** `GET /api/v1/posts/by-author/{authorId}` — profile feed, DESC. */
export async function getProfileFeed(authorId, { pageSize = 20, cursor } = {}) {
  const params = { pageSize }
  if (cursor) params.cursor = cursor
  const response = await api.get(`/api/v1/posts/by-author/${authorId}`, { params })
  return hydrateAndAttachList(response.data)
}

/** `GET /api/v1/posts/reels` — global reels for a UTC day. */
export async function getReels({ day, pageSize = 20 } = {}) {
  const response = await api.get('/api/v1/posts/reels', {
    params: { day: day ?? todayUtcIsoDate(), pageSize },
  })
  return hydrateAndAttachList(response.data)
}

/** `GET /api/v1/posts/search` — ES BM25 over posts. Returns post UUIDs. */
export async function searchPosts({ q = '', page = 0, size = 20 } = {}) {
  const response = await api.get('/api/v1/posts/search', { params: { q, page, size } })
  return response.data
}

/** `GET /api/v1/posts/suggestions` — friends-of-friends, mutual-count DESC. */
export async function getFriendSuggestions({ userId, limit = 20 } = {}) {
  const response = await api.get('/api/v1/posts/suggestions', {
    params: { userId, limit },
  })
  return response.data
}

/** `POST /api/v1/posts/suggestions/recompute` — async recompute (returns 202). */
export async function recomputeFriendSuggestions(userId) {
  await api.post('/api/v1/posts/suggestions/recompute', null, {
    params: { userId },
  })
}

// =============================================================
//  3.  REACTIONS  (single type — LIKE)
// =============================================================

/** `POST /api/v1/posts/{postId}/reactions` — toggle. → `{postId, userId, liked}`. */
export async function togglePostReaction(postId) {
  const response = await api.post(
    `/api/v1/posts/${postId}/reactions`,
    null,
    idempotencyHeaders(newIdempotencyKey()),
  )
  return response.data
}

/** `DELETE /api/v1/posts/{postId}/reactions` — explicit unlike (idempotent). */
export async function unlikePost(postId) {
  const response = await api.delete(`/api/v1/posts/${postId}/reactions`, {
    headers: { 'Idempotency-Key': newIdempotencyKey() },
  })
  return response.data
}

/** `GET /api/v1/posts/{postId}/reactions/me` — "did I like this?" */
export async function getPostReactionStatus(postId) {
  const response = await api.get(`/api/v1/posts/${postId}/reactions/me`)
  return response.data
}

/** `GET /api/v1/posts/users/{userId}/reactions` — reaction history (DESC). */
export async function listUserReactions(userId, { pageSize = 20 } = {}) {
  const response = await api.get(`/api/v1/posts/users/${userId}/reactions`, {
    params: { pageSize },
  })
  return response.data
}

/** `POST /api/v1/posts/{postId}/comments/{commentId}/reactions` — toggle. */
export async function toggleCommentReaction(postId, commentId) {
  const response = await api.post(
    `/api/v1/posts/${postId}/comments/${commentId}/reactions`,
    null,
    idempotencyHeaders(newIdempotencyKey()),
  )
  return response.data
}

/** `DELETE /api/v1/posts/{postId}/comments/{commentId}/reactions` — explicit unlike. */
export async function unlikeComment(postId, commentId) {
  const response = await api.delete(
    `/api/v1/posts/${postId}/comments/${commentId}/reactions`,
    { headers: { 'Idempotency-Key': newIdempotencyKey() } },
  )
  return response.data
}

// =============================================================
//  4.  COMMENTS & REPLIES   (depth-1 enforced server-side)
// =============================================================

/** `POST /api/v1/posts/{postId}/comments` — body `{ text, mediaUrl?, mediaType? }`. */
export async function addPostComment(postId, payload) {
  const response = await api.post(
    `/api/v1/posts/${postId}/comments`,
    stripDerivedIds(payload),
    idempotencyHeaders(newIdempotencyKey()),
  )
  return response.data
}

/** `GET /api/v1/posts/{postId}/comments` — top-level, ASC. */
export async function listPostComments(postId, { pageSize = 20, cursor } = {}) {
  const params = { pageSize }
  if (cursor) params.cursor = cursor
  const response = await api.get(`/api/v1/posts/${postId}/comments`, { params })
  return response.data
}

/**
 * `POST /api/v1/posts/comments/{commentId}/replies` — body `{ text, mediaUrl? }`.
 * Depth-1: replying to a reply lands as a sibling under the original
 * top-level comment.
 */
export async function replyToComment(commentId, payload) {
  const response = await api.post(
    `/api/v1/posts/comments/${commentId}/replies`,
    stripDerivedIds(payload),
    idempotencyHeaders(newIdempotencyKey()),
  )
  return response.data
}

/** `GET /api/v1/posts/comments/{commentId}/replies` — flat replies, ASC. */
export async function listCommentReplies(commentId, { pageSize = 10 } = {}) {
  const response = await api.get(
    `/api/v1/posts/comments/${commentId}/replies`,
    { params: { pageSize } },
  )
  return response.data
}

/** `PATCH /api/v1/posts/comments/{commentId}` — body `{ text }`. Author only. */
export async function updateComment(commentId, payload) {
  const response = await api.patch(
    `/api/v1/posts/comments/${commentId}`,
    stripDerivedIds(payload),
  )
  return response.data
}

/** `DELETE /api/v1/posts/comments/{commentId}` — soft-delete. Author only. */
export async function removeComment(commentId) {
  await api.delete(`/api/v1/posts/comments/${commentId}`)
}

// =============================================================
//  5.  SAVES   (toggle + optional named collections)
// =============================================================

/** `POST /api/v1/posts/{postId}/saves?collection=` — toggle save. */
export async function togglePostSave(postId, collection) {
  const params = {}
  if (collection) params.collection = collection
  const response = await api.post(`/api/v1/posts/${postId}/saves`, null, {
    params,
    headers: { 'Idempotency-Key': newIdempotencyKey() },
  })
  return response.data
}

/** `DELETE /api/v1/posts/{postId}/saves` — explicit unsave (idempotent). */
export async function unsavePostExplicit(postId) {
  const response = await api.delete(`/api/v1/posts/${postId}/saves`, {
    headers: { 'Idempotency-Key': newIdempotencyKey() },
  })
  return response.data
}

/** `GET /api/v1/posts/{postId}/saves/me` — "did I save this?" */
export async function getPostSaveStatus(postId) {
  const response = await api.get(`/api/v1/posts/${postId}/saves/me`)
  return response.data
}

/** `GET /api/v1/posts/users/{userId}/saves` — user's saved posts (DESC). */
export async function listUserSaves(userId, { pageSize = 20, cursor } = {}) {
  const params = { pageSize }
  if (cursor) params.cursor = cursor
  const response = await api.get(`/api/v1/posts/users/${userId}/saves`, { params })
  return hydrateAndAttachList(response.data)
}

// =============================================================
//  6.  SHARES   (append-only ledger; REPOST is a separate create)
// =============================================================

/** `POST /api/v1/posts/{postId}/shares` — body `{ caption? }`. Sharer from JWT. */
export async function recordPostShare(postId, caption) {
  const body = caption ? { caption } : null
  const response = await api.post(`/api/v1/posts/${postId}/shares`, body, {
    headers: { 'Idempotency-Key': newIdempotencyKey() },
  })
  return response.data
}

/** `GET /api/v1/posts/{postId}/shares` — recent shares (DESC). */
export async function listPostShares(postId, { pageSize = 20 } = {}) {
  const response = await api.get(`/api/v1/posts/${postId}/shares`, {
    params: { pageSize },
  })
  return response.data
}

// =============================================================
//  7.  VIEWS   (Redis-NX 7-day dedupe; first view per user counts)
// =============================================================

/** `POST /api/v1/posts/{postId}/views` — bump view counter. */
export async function recordPostView(postId) {
  const response = await api.post(`/api/v1/posts/${postId}/views`)
  return response.data
}

// =============================================================
//  8.  MEDIA   (carousels — for albums > 4 or post-publish edits)
// =============================================================

/** `POST /api/v1/posts/{postId}/media` — add one item. */
export async function addPostMedia(postId, media) {
  const response = await api.post(`/api/v1/posts/${postId}/media`, media)
  return response.data
}

/** `GET /api/v1/posts/{postId}/media` — list, sorted ASC by `sortOrder`. */
export async function getPostMedia(postId) {
  const response = await api.get(`/api/v1/posts/${postId}/media`)
  return response.data
}

/** `DELETE /api/v1/posts/{postId}/media/{mediaId}` — remove one. */
export async function deletePostMedia(postId, mediaId, sortOrder) {
  await api.delete(`/api/v1/posts/${postId}/media/${mediaId}`, {
    params: sortOrder != null ? { sortOrder } : undefined,
  })
}

/** `PUT /api/v1/posts/{postId}/media` — bulk replace (drag-and-drop reorder). */
export async function replacePostMedia(postId, mediaList) {
  const response = await api.put(`/api/v1/posts/${postId}/media`, mediaList)
  return response.data
}

// =============================================================
//  9.  HASHTAGS & MENTIONS   (extracted synchronously on create)
// =============================================================

/** `GET /api/v1/hashtags/{tag}/posts` — tagged posts (DESC). */
export async function getHashtagPosts(tag, { pageSize = 20, cursor } = {}) {
  const params = { pageSize }
  if (cursor) params.cursor = cursor
  const response = await api.get(
    `/api/v1/hashtags/${encodeURIComponent(tag)}/posts`,
    { params },
  )
  return hydrateAndAttachList(response.data)
}

/** `GET /api/v1/hashtags/{tag}/usage` → `{ hashtag, postCount }`. */
export async function getHashtagUsage(tag) {
  const response = await api.get(
    `/api/v1/hashtags/${encodeURIComponent(tag)}/usage`,
  )
  return response.data
}

/** `GET /api/v1/users/{userId}/mentions` — "posts that mention me". */
export async function getUserMentions(userId, { pageSize = 20 } = {}) {
  const response = await api.get(`/api/v1/users/${userId}/mentions`, {
    params: { pageSize },
  })
  return hydrateAndAttachList(response.data)
}

// ══════════════════════════════════════════════════════════════
//  COMPAT ALIASES
//
//  The new contract is JWT-derived and reaction-typeless, but a lot
//  of existing call sites still pass `userId`, `type`, etc. These
//  wrappers absorb those args at the boundary so nothing has to
//  change in the components in one pass. They forward to the
//  spec-aligned functions above.
// ══════════════════════════════════════════════════════════════

// Feeds — every legacy name maps to the home feed.
export const getFeed = (opts = {}) => getHomeFeed(opts)
export const getFeedCursor = getFeed
export const getFollowingFeedCursor = getFeed
export const getForYouFeed = getFeed
export const getUserPosts = (authorId, opts) => getProfileFeed(authorId, opts)
export const getPostsByAuthor = getProfileFeed

// Reactions — older callers pass (postId, userId, type); only postId is honored.
export const reactToPost = (postId /* , userId, type */) => togglePostReaction(postId)
export const removePostReaction = (postId /* , userId */) => unlikePost(postId)
export const reactToComment = (postId, commentId /* , userId, type */) =>
  toggleCommentReaction(postId, commentId)
export const removeCommentReaction = (postId, commentId /* , userId */) =>
  unlikeComment(postId, commentId)

// Saves — older callers pass (postId, userId, collection); userId is dropped.
export const savePost = (postId, _userId, collection) =>
  togglePostSave(postId, collection)
export const unsavePost = (postId /* , userId */) => unsavePostExplicit(postId)
export const getSavedPosts = listUserSaves

// Views — older callers pass (postId, userId); userId is dropped.
export const viewPost = (postId /* , userId */) => recordPostView(postId)

// Repost = a fresh post with `sharedPostId` set. Self-repost is allowed.
export const repostPost = (postId, caption) =>
  createPost({
    postType: PostType.REPOST,
    visibility: PostVisibility.PUBLIC,
    textContent: caption ?? '',
    sharedPostId: postId,
  })
export const sharePost = repostPost
/** Reposts are regular posts now — delete by the resulting post id. */
export const undoRepost = async () => {
  // Intentionally a no-op: call `deletePost(repostId)` at the call site.
}

/** Share-to-clipboard records a share entry; the URL is built client-side. */
export const copyPostShareLink = (postId, caption) =>
  recordPostShare(postId, caption)

// Comment helpers — old shape was keyed by (postId, commentId).
// The spec is keyed by commentId only.
export const getPostComments = listPostComments
export const getPostCommentsCursor = listPostComments
export const getPostCommentReplies = (_postId, commentId, opts = {}) =>
  listCommentReplies(commentId, { pageSize: opts.pageSize ?? opts.size ?? 10 })
export const getPostCommentRepliesCursor = (_postId, commentId, opts = {}) =>
  listCommentReplies(commentId, { pageSize: opts.pageSize ?? opts.limit ?? 10 })
export const createPostComment = addPostComment
export const createPostCommentWithMedia = (postId, { data }) =>
  addPostComment(postId, data)
export const editPostComment = (_postId, commentId, { textContent, text }) =>
  updateComment(commentId, { text: text ?? textContent })
export const deletePostComment = (_postId, commentId) => removeComment(commentId)

/**
 * Multipart create — legacy shape `{ data, files }`. The spec wants
 * flat form fields, so we unpack `data` here.
 */
export const createPostWithFiles = ({ data, files = [] } = {}) =>
  createPostMultipart({ ...stripDerivedIds(data ?? {}), files })

/**
 * `updatePost` is not in the documented post contract (no PATCH on
 * `/api/v1/posts/{id}`). Kept as a thin passthrough for the edit
 * dialog so the call compiles; if the backend rejects it, the dialog
 * surfaces the error normally.
 */
export async function updatePost(postId, payload) {
  const response = await api.patch(
    `/api/v1/posts/${postId}`,
    stripDerivedIds(payload),
  )
  return hydrateAndAttach(response.data)
}
