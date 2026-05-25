import { api } from '@/api/client'
import {
  getPost,
  getHashtagPosts,
  searchPosts as searchPostIds,
} from '@/features/posts/posts.api'
import { getResearch, searchResearch as searchResearchIds } from '@/features/research/research.api'
import { getQuestion, searchQuestions as searchQuestionIds } from '@/features/qna/qna.api'
import { searchUsers, getUserById } from '@/features/users/users.api'

// ══════════════════════════════════════════════════════════════
//  SEARCH  —  unified ES + per-entity hydration
//
//  The canonical search surface is GET /api/v1/search?q=&types=&page=&size=.
//  It returns `{query, types, page, size, results: [{type, id, score}]}`.
//  Each per-corpus endpoint (/posts/search, /researches/search,
//  /questions/search, /users/search) returns `{query, page, size,
//  results: [UUID]}`.
//
//  Consumers (topbar dropdown, /search page) expect rich "hit" objects
//  with title / snippet / thumbnailUrl / authorUsername / etc. — so this
//  module hydrates each id into a hit shape via the per-entity GETs
//  (cache-warm Redis / Cassandra per spec). The output shape is kept
//  backwards-compatible: { groups: { POST: [hit, ...], ... } }.
// ══════════════════════════════════════════════════════════════

export const SEARCH_TYPES = [
  'POST',
  'REEL',
  'RESEARCH',
  'QUESTION',
  'USER',
]

// ─── Hit synthesis ────────────────────────────────────────────────
//
// Each hydrator turns a fetched entity into the SearchHit shape the
// UI renders. Keeping these in one place means a backend rename of
// `mediaUrls` → `media` would only need one edit.

function postToHit(post, score = null) {
  if (!post) return null
  const isReel = post.postType === 'REEL'
  return {
    type: isReel ? 'REEL' : 'POST',
    id: post.id,
    title: null,
    snippet: post.textContent ?? null,
    thumbnailUrl:
      post.thumbnailUrl ??
      post.coverUrl ??
      post.mediaUrls?.[0] ??
      post.media?.[0]?.url ??
      null,
    authorUsername: post.authorUsername ?? post.author?.username ?? null,
    authorProfileImage: post.authorProfileImage ?? post.author?.avatarUrl ?? null,
    createdAt: post.createdAt ?? null,
    score,
  }
}

function researchToHit(r, score = null) {
  if (!r) return null
  return {
    type: 'RESEARCH',
    id: r.id,
    title: r.title ?? null,
    snippet: r.abstract ?? r.subtitle ?? r.body ?? null,
    thumbnailUrl: r.coverImageUrl ?? r.coverUrl ?? null,
    authorUsername: r.authorUsername ?? r.author?.username ?? null,
    authorProfileImage: r.authorProfileImage ?? r.author?.avatarUrl ?? null,
    slug: r.slug ?? null,
    createdAt: r.publishedAt ?? r.createdAt ?? null,
    score,
  }
}

function questionToHit(q, score = null) {
  if (!q) return null
  return {
    type: 'QUESTION',
    id: q.id,
    title: q.title ?? null,
    snippet: q.body ?? q.bodyPreview ?? null,
    thumbnailUrl: null,
    authorUsername: q.authorUsername ?? q.author?.username ?? null,
    authorProfileImage: q.authorProfileImage ?? q.author?.avatarUrl ?? null,
    createdAt: q.createdAt ?? null,
    score,
  }
}

function userToHit(u, score = null) {
  if (!u) return null
  const fullName =
    u.fullName ??
    [u.fname, u.lname].filter(Boolean).join(' ').trim() ??
    null
  return {
    type: 'USER',
    id: u.id,
    title: fullName || u.username || null,
    snippet: u.bio ?? null,
    username: u.username ?? null,
    thumbnailUrl: u.avatarUrl ?? u.profileImage ?? null,
    score,
  }
}

const HYDRATORS = {
  POST: async (id) => postToHit(await getPost(id)),
  REEL: async (id) => postToHit(await getPost(id)),
  RESEARCH: async (id) => researchToHit(await getResearch(id)),
  QUESTION: async (id) => questionToHit(await getQuestion(id)),
  USER: async (id) => userToHit(await getUserById(id)),
}

async function hydrateByIds(type, ids, scores = []) {
  const fn = HYDRATORS[type]
  if (!fn || !ids?.length) return []
  const settled = await Promise.allSettled(
    ids.map(async (id, i) => {
      const hit = await fn(id)
      if (!hit) return null
      if (scores[i] != null) hit.score = scores[i]
      return hit
    }),
  )
  return settled
    .filter((s) => s.status === 'fulfilled' && s.value)
    .map((s) => s.value)
}

// ─── ID extraction ────────────────────────────────────────────────
//
// Per-corpus endpoints return `{results: [UUID]}` or Spring `Page<UUID>`.
// Global `/search` returns `{results: [{type, id, score}]}`.

function extractIds(data) {
  if (!data) return []
  if (Array.isArray(data)) return data
  if (Array.isArray(data.results)) return data.results
  if (Array.isArray(data.content)) return data.content
  return []
}

// ─── Global multi-corpus search ──────────────────────────────────

/**
 * Calls the global ES multi-index endpoint and hydrates each `{type, id}`
 * hit into a rich object so consumers can render previews without an
 * extra round-trip per row.
 *
 * Param shape mirrors the canonical spec:
 *   - q     : query string
 *   - types : array of `SEARCH_TYPES`. Joined with `,` server-side.
 *   - page  : 0-indexed page
 *   - size  : page size (used as the legacy `limit` if `size` isn't given)
 *
 * Output (kept stable for legacy callers):
 *   { query, page, size, groups: { POST: hit[], REEL: hit[], ... },
 *     buckets: groups, elapsedMs: null }
 */
export async function unifiedSearch({ q, types, page = 0, size, limit = 20 } = {}) {
  if (!q || !q.trim()) {
    return { query: '', page: 0, size: 0, groups: {}, buckets: {}, elapsedMs: null }
  }
  const pageSize = size ?? limit
  const params = { q: q.trim(), page, size: pageSize }
  if (Array.isArray(types) && types.length > 0) {
    params.types = types.join(',')
  }
  const response = await api.get('/api/v1/search', { params })
  const data = response.data ?? {}
  const results = Array.isArray(data.results) ? data.results : []

  // Group ids by type
  const byType = {}
  for (const row of results) {
    if (!row?.type || !row?.id) continue
    if (!byType[row.type]) byType[row.type] = { ids: [], scores: [] }
    byType[row.type].ids.push(row.id)
    byType[row.type].scores.push(row.score ?? null)
  }

  // Hydrate every type concurrently
  const groups = {}
  await Promise.all(
    Object.entries(byType).map(async ([type, { ids, scores }]) => {
      groups[type] = await hydrateByIds(type, ids, scores)
    }),
  )

  return {
    query: data.query ?? q.trim(),
    page: data.page ?? page,
    size: data.size ?? pageSize,
    elapsedMs: data.elapsedMs ?? null,
    groups,
    buckets: groups,
  }
}

/**
 * Back-compat alias for the topbar's instant dropdown — `/search/instant`
 * was removed when the unified ES endpoint became the canonical surface.
 * We forward to `unifiedSearch` so callers don't have to change.
 *
 * @deprecated Call `unifiedSearch` directly.
 */
export function instantSearch(args) {
  return unifiedSearch(args)
}

// ─── Per-corpus search (hydrated) ─────────────────────────────────

async function searchOneCorpus({ type, q, page = 0, size, limit = 20 }, idFetcher) {
  if (!q || !q.trim()) return []
  const pageSize = size ?? limit
  const data = await idFetcher({ q: q.trim(), page, size: pageSize })
  const ids = extractIds(data)
  return hydrateByIds(type, ids)
}

export function searchPosts({ q, limit = 20, page = 0, size } = {}) {
  return searchOneCorpus({ type: 'POST', q, page, size, limit }, searchPostIds)
}

/**
 * Reels share the posts ES index — the spec note says filtering via
 * `postType=REEL` is "if added". We post-filter the hydrated hits so
 * the surface keeps working today and benefits from server-side
 * filtering automatically when it lands.
 */
export async function searchReels({ q, limit = 20, page = 0, size } = {}) {
  if (!q || !q.trim()) return []
  const pageSize = size ?? limit
  const data = await searchPostIds({ q: q.trim(), page, size: pageSize })
  const ids = extractIds(data)
  const hits = await hydrateByIds('POST', ids)
  return hits.filter((h) => h.type === 'REEL')
}

export function searchResearch({ q, limit = 20, page = 0, size } = {}) {
  return searchOneCorpus({ type: 'RESEARCH', q, page, size, limit }, searchResearchIds)
}

export function searchQuestions({ q, limit = 20, page = 0, size } = {}) {
  return searchOneCorpus({ type: 'QUESTION', q, page, size, limit }, searchQuestionIds)
}

/**
 * Answer search is not a top-level corpus on the new ES setup (the spec
 * lists POST,REEL,QUESTION,RESEARCH only). The tab on the search page
 * falls back to question hits whose body or accepted answer matches.
 * If the backend later exposes /api/v1/answers/search this is the spot
 * to wire it up.
 */
export async function searchAnswers({ q, limit = 20, page = 0, size } = {}) {
  return searchQuestions({ q, limit, page, size })
}

export async function searchPeople({ q, limit = 20, page = 0, size } = {}) {
  if (!q || !q.trim()) return []
  const pageSize = size ?? limit
  const data = await searchUsers({ q: q.trim(), page, size: pageSize })
  // searchUsers returns a Spring Page<UserResponse> with full bodies, so
  // we can map directly without an extra hydration round-trip.
  const list = data?.content ?? data?.results ?? (Array.isArray(data) ? data : [])
  return list.map((u) => userToHit(u)).filter(Boolean)
}

/**
 * Hashtag posts — canonical endpoint is `/api/v1/hashtags/{tag}/posts`
 * (the legacy `/api/v1/search/tags/{tag}` is gone). Tag is normalised
 * with the leading `#` stripped so deep-links stay stable.
 */
export async function searchByHashtag(tag, { limit = 20, cursor } = {}) {
  const cleaned = String(tag ?? '').replace(/^#+/, '').trim()
  if (!cleaned) return []
  const data = await getHashtagPosts(cleaned, { pageSize: limit, cursor })
  const ids = extractIds(data)
  if (ids.length === 0) {
    // Endpoint may return full PostByHashtagEntity rows (with postId on each).
    const rows = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : []
    return hydrateByIds(
      'POST',
      rows.map((r) => r.postId ?? r.id).filter(Boolean),
    )
  }
  return hydrateByIds('POST', ids)
}
