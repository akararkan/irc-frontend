import { api } from '@/api/client'

// ══════════════════════════════════════════════════════════════
//  POSTS  —  /api/v1/posts
// ══════════════════════════════════════════════════════════════

// ── Feeds ──────────────────────────────────────────────────────

export async function getFeed({ page = 0, size = 20 } = {}) {
  const response = await api.get('/api/v1/posts/feed', { params: { page, size } })
  return response.data
}

export async function getFollowingFeed({ page = 0, size = 20 } = {}) {
  const response = await api.get('/api/v1/posts/feed/following', { params: { page, size } })
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

/** POST /api/v1/posts/{postId}/react — body { reactionType } */
export async function reactToPost(postId, reactionType) {
  const response = await api.post(`/api/v1/posts/${postId}/react`, { reactionType })
  return response.data
}

export async function removePostReaction(postId) {
  await api.delete(`/api/v1/posts/${postId}/react`)
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
  const response = await api.post(`/api/v1/posts/${postId}/repost`, null, {
    params: caption ? { caption } : undefined,
  })
  return response.data
}

export async function undoRepost(postId) {
  await api.delete(`/api/v1/posts/${postId}/repost`)
}

export async function sharePost(postId, caption) {
  // Legacy alias — server now creates a repost too.
  return repostPost(postId, caption)
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

/** POST /api/v1/posts/{postId}/comments — CreateCommentRequest body. */
export async function createPostComment(postId, payload) {
  const response = await api.post(`/api/v1/posts/${postId}/comments`, payload)
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
    { headers: { 'Content-Type': 'multipart/form-data' } },
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

/** POST …/react — body { reactionType } */
export async function reactToComment(postId, commentId, reactionType) {
  const response = await api.post(
    `/api/v1/posts/${postId}/comments/${commentId}/react`,
    { reactionType },
  )
  return response.data
}

export async function removeCommentReaction(postId, commentId) {
  await api.delete(`/api/v1/posts/${postId}/comments/${commentId}/react`)
}
