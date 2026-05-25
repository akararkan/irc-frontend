import { api } from '@/api/client'

// ══════════════════════════════════════════════════════════════
//  SOUNDS (audio library used by posts/reels)  —  /api/v1/sounds
//
//  Categories: NASHEED | QURAN_RECITATION | LECTURE_CLIP |
//              NATURE | ORIGINAL | PLATFORM_MUSIC
// ══════════════════════════════════════════════════════════════

/** POST /api/v1/sounds — upload a sound. */
export async function createSound(payload) {
  const response = await api.post('/api/v1/sounds', payload)
  return response.data
}

/** GET /api/v1/sounds/{id} — sound detail. */
export async function getSound(soundId) {
  const response = await api.get(`/api/v1/sounds/${soundId}`)
  return response.data
}

/** POST /api/v1/sounds/{id}/approve — admin approve. */
export async function approveSound(soundId) {
  const response = await api.post(`/api/v1/sounds/${soundId}/approve`)
  return response.data
}

/** GET /api/v1/sounds/by-category/{category} — browse by category. */
export async function getSoundsByCategory(category, { pageSize = 20, cursor } = {}) {
  const params = { pageSize }
  if (cursor) params.cursor = cursor
  const response = await api.get(`/api/v1/sounds/by-category/${category}`, { params })
  return response.data
}

/** GET /api/v1/sounds/{id}/posts — posts that use this sound. */
export async function getPostsBySound(soundId, { pageSize = 20 } = {}) {
  const response = await api.get(`/api/v1/sounds/${soundId}/posts`, {
    params: { pageSize },
  })
  return response.data
}

/** GET /api/v1/sounds/{id}/usage → { soundId, useCount }. */
export async function getSoundUsage(soundId) {
  const response = await api.get(`/api/v1/sounds/${soundId}/usage`)
  return response.data
}
