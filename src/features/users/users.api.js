import { api } from '@/api/client'

// ── Identity (auth-layer fields: fname, lname, username) ──────────────────────

export async function getCurrentUser() {
  const response = await api.get('/api/v1/users/me')
  return response.data
}

export async function getUserByUsername(username) {
  const response = await api.get(`/api/v1/users/username/${encodeURIComponent(username)}`)
  return response.data
}

export async function getUserById(id) {
  const response = await api.get(`/api/v1/users/${id}`)
  return response.data
}

export async function searchUsers({ q = '', page = 0, size = 20, specialization, madhhab, tier } = {}) {
  const response = await api.get('/api/v1/users/search', {
    params: { q, page, size, specialization, madhhab, tier },
  })
  return response.data
}

/** Update identity fields only: fname, lname, username. */
export async function updateProfile(payload) {
  const response = await api.patch('/api/v1/users/me', payload)
  return response.data
}

// ── Public profile layer (UserProfile entity) ─────────────────────────────────

export async function getPublicProfile(userId) {
  const response = await api.get(`/api/v1/users/${userId}/profile`)
  return response.data
}

export async function getMyProfile() {
  const response = await api.get('/api/v1/users/me/profile')
  return response.data
}

/** Update profile fields: bio, displayName, academicTitle, institutionName, websiteUrl, madhhabId, contentLanguage, isForHire. */
export async function updateUserProfile(payload) {
  const response = await api.patch('/api/v1/users/me/profile', payload)
  return response.data
}

export async function uploadProfileImage(file) {
  const form = new FormData()
  form.append('image', file)
  const response = await api.post('/api/v1/users/me/profile/avatar', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data
}

export async function deleteProfileImage() {
  const response = await api.delete('/api/v1/users/me/profile/avatar')
  return response.data
}

export async function uploadCoverImage(file) {
  const form = new FormData()
  form.append('image', file)
  const response = await api.post('/api/v1/users/me/profile/cover', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data
}

export async function deleteCoverImage() {
  const response = await api.delete('/api/v1/users/me/profile/cover')
  return response.data
}

/** Replace the full specialization list. items: [{ topicId, displayOrder }] */
export async function updateSpecializations(items) {
  const response = await api.patch('/api/v1/users/me/profile/specializations', { items })
  return response.data
}

// ── Links & contacts (moved to profile layer; URL paths unchanged) ────────────

export async function addLink(payload) {
  const response = await api.post('/api/v1/users/me/links', payload)
  return response.data
}

export async function deleteLink(linkId) {
  await api.delete(`/api/v1/users/me/links/${linkId}`)
}

export async function addContact(payload) {
  const response = await api.post('/api/v1/users/me/contacts', payload)
  return response.data
}

export async function deleteContact(contactId) {
  await api.delete(`/api/v1/users/me/contacts/${contactId}`)
}

// ── Scholar verification ──────────────────────────────────────────────────────

/** Apply for scholar/researcher verification. payload: { claimedTier, affiliation, evidenceUrls, orcidId } */
export async function applyForVerification(payload) {
  const response = await api.post('/api/v1/verification/apply', payload)
  return response.data
}

export async function getMyVerificationStatus() {
  const response = await api.get('/api/v1/verification/my-status')
  return response.data
}
