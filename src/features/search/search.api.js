import { api } from '@/api/client'

// ══════════════════════════════════════════════════════════════
//  SEARCH  —  /api/v1/search
//
//  Unified search fans out to every requested corpus in parallel
//  on the backend (CompletableFuture). Each `SearchHit` row has the
//  same shape regardless of corpus, so the UI can render one generic
//  list. Block-aware: post/reel results filter blocked authors.
//
//  60-second Redis cache keyed by (q, types, limitEach, viewerId).
// ══════════════════════════════════════════════════════════════

export const SEARCH_TYPES = [
  'POST',
  'REEL',
  'RESEARCH',
  'QUESTION',
  'ANSWER',
  'USER',
]

/** Repeat the `type` query param for an array (matches Spring binding). */
function buildTypeParams(types) {
  if (!Array.isArray(types) || types.length === 0) return {}
  return { type: types }
}

/**
 * Multi-corpus search.
 *
 * `types` defaults to "every corpus the user has". Pass a smaller list
 * (e.g. only `['USER']`) to scope the search.
 *
 * Response: { groups: { POST: SearchHit[], USER: SearchHit[], ... }, ... }
 *           Exact shape mirrors the backend `UnifiedSearchResult` DTO —
 *           the result page treats it as `groups[type]` lookups.
 */
export async function unifiedSearch({ q, types, limit = 8 } = {}) {
  if (!q || !q.trim()) {
    return { query: '', groups: {}, hits: [] }
  }
  const response = await api.get('/api/v1/search', {
    params: { q: q.trim(), limit, ...buildTypeParams(types) },
  })
  return response.data
}

/**
 * Instant search — prefix-only LIKE 'q%' on users / posts / research /
 * questions, no FTS work. Sub-5 ms warm. Use for search-as-you-type
 * surfaces (topbar dropdown). For deeper relevance (full-text rank,
 * trigram fallback) use `unifiedSearch` instead — typically wired to
 * the submit / "see all" path.
 *
 * Same response shape as `unifiedSearch` so callers can swap them out.
 * Cached on the server under `instant:` keys.
 */
export async function instantSearch({ q, types, limit = 6 } = {}) {
  if (!q || !q.trim()) {
    return { query: '', groups: {}, hits: [] }
  }
  const response = await api.get('/api/v1/search/instant', {
    params: { q: q.trim(), limit, ...buildTypeParams(types) },
  })
  return response.data
}

// ── Per-corpus shortcuts. The backend uses ts_rank_cd for ordering,
// then pg_trgm similarity as a typo-tolerant fallback when FTS returns
// zero hits — same call from the frontend's perspective.

async function corpusSearch(path, q, limit) {
  if (!q || !q.trim()) return []
  const response = await api.get(path, {
    params: { q: q.trim(), limit },
  })
  return response.data ?? []
}

export function searchPosts({ q, limit = 20 } = {}) {
  return corpusSearch('/api/v1/search/posts', q, limit)
}

export function searchReels({ q, limit = 20 } = {}) {
  return corpusSearch('/api/v1/search/reels', q, limit)
}

export function searchResearch({ q, limit = 20 } = {}) {
  return corpusSearch('/api/v1/search/research', q, limit)
}

export function searchQuestions({ q, limit = 20 } = {}) {
  return corpusSearch('/api/v1/search/questions', q, limit)
}

export function searchAnswers({ q, limit = 20 } = {}) {
  return corpusSearch('/api/v1/search/answers', q, limit)
}

export function searchPeople({ q, limit = 20 } = {}) {
  return corpusSearch('/api/v1/search/users', q, limit)
}

/**
 * Hashtag-specific lookup. The path accepts the tag with or without `#`,
 * but we strip it client-side so the deep-link is always normalized.
 */
export async function searchByHashtag(tag, { q, limit = 20 } = {}) {
  const cleaned = String(tag ?? '').replace(/^#+/, '').trim()
  if (!cleaned) return []
  const response = await api.get(
    `/api/v1/search/tags/${encodeURIComponent(cleaned)}`,
    { params: q && q.trim() ? { q: q.trim(), limit } : { limit } },
  )
  return response.data ?? []
}
