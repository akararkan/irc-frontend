import { api } from '@/api/client'

// ══════════════════════════════════════════════════════════════
//  SOUND LIBRARY  —  /api/v1/sounds
// ══════════════════════════════════════════════════════════════

// ── Browse ─────────────────────────────────────────────────────

/**
 * Browse the sound library.
 * category: SoundCategory — NASHEED | QURAN_RECITATION | LECTURE_CLIP |
 *                           NATURE | ORIGINAL | PLATFORM_MUSIC
 * q: free-text search on title and artist name.
 * Returns Page<SoundResponse>.
 */
export async function browseSounds({ category, q = '', page = 0, size = 20 } = {}) {
  const response = await api.get('/api/v1/sounds', {
    params: { category, q: q || undefined, page, size },
  })
  return response.data
}

/**
 * Top sounds ordered by use_count descending.
 * Returns SoundResponse[] (not paged — bounded by limit).
 */
export async function getTrendingSounds({ limit = 20 } = {}) {
  const response = await api.get('/api/v1/sounds/trending', { params: { limit } })
  return response.data
}

/**
 * Sounds recently used by the authenticated user — personalised picker.
 * Returns SoundResponse[] most-recently-used first.
 */
export async function getRecentlyUsedSounds({ limit = 10 } = {}) {
  const response = await api.get('/api/v1/sounds/recent', { params: { limit } })
  return response.data
}

/** Single sound detail — includes waveform data (JSON array of ~100 amplitude samples). */
export async function getSound(soundId) {
  const response = await api.get(`/api/v1/sounds/${soundId}`)
  return response.data
}

// ── Upload ─────────────────────────────────────────────────────

/**
 * Upload a user-generated sound. Status starts at PENDING_REVIEW.
 * Server extracts duration, MIME type, file size, and generates waveform data.
 *
 * Parts:
 *   `data`     — UploadSoundRequest JSON: { title, artistName?, description?,
 *                  category, sourceUrl?, license?, defaultClipStart? }
 *   `audio`    — the audio file (required)
 *   `coverArt` — optional cover image
 */
export async function uploadSound({ data, audio, coverArt }) {
  const form = new FormData()
  form.append('data', new Blob([JSON.stringify(data)], { type: 'application/json' }))
  form.append('audio', audio)
  if (coverArt) form.append('coverArt', coverArt)
  const response = await api.post('/api/v1/sounds/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data
}

// ── Admin moderation ────────────────────────────────────────────

/** Pending sounds awaiting review. Requires MODERATOR or ADMIN role. */
export async function getPendingSounds({ page = 0, size = 20 } = {}) {
  const response = await api.get('/api/v1/admin/sounds/pending', {
    params: { page, size },
  })
  return response.data
}

/** Approve a pending sound — makes it live in the library. */
export async function approveSound(soundId) {
  const response = await api.post(`/api/v1/admin/sounds/${soundId}/approve`)
  return response.data
}

/** Reject a pending sound with optional reason. */
export async function rejectSound(soundId, { reason } = {}) {
  const response = await api.post(`/api/v1/admin/sounds/${soundId}/reject`, null, {
    params: reason ? { reason } : undefined,
  })
  return response.data
}
