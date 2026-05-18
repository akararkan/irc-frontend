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

export async function getUserByEmail(email) {
  const response = await api.get(`/api/v1/users/email/${encodeURIComponent(email)}`)
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

/** Soft-delete own account. */
export async function deleteMyAccount() {
  await api.delete('/api/v1/users/me')
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

export async function editLink(linkId, payload) {
  const response = await api.patch(`/api/v1/users/me/links/${linkId}`, payload)
  return response.data
}

export async function deleteLink(linkId) {
  await api.delete(`/api/v1/users/me/links/${linkId}`)
}

export async function addContact(payload) {
  const response = await api.post('/api/v1/users/me/contacts', payload)
  return response.data
}

export async function editContact(contactId, payload) {
  const response = await api.patch(`/api/v1/users/me/contacts/${contactId}`, payload)
  return response.data
}

export async function deleteContact(contactId) {
  await api.delete(`/api/v1/users/me/contacts/${contactId}`)
}

// ── Scholar verification ──────────────────────────────────────────────────────
//
// The user-facing "apply for verification" + "my status" endpoints were
// removed on the backend: scholar/researcher account type is now
// admin-assigned only (see PATCH /api/v1/admin/users/{userId}/account-type
// in `changeUserAccountType`). The admin queue endpoints below survive so
// admins can close out legacy pending rows.

/**
 * Admin-only: change a user's account type / verification tier / role.
 * Body: { accountType, verificationTier?, role?, reason? }
 */
export async function changeUserAccountType(userId, payload) {
  const response = await api.patch(`/api/v1/admin/users/${userId}/account-type`, payload)
  return response.data
}

// ── Admin: verification queue ─────────────────────────────────────────────────

export async function getVerificationQueue({ status = 'PENDING', page = 0, size = 20 } = {}) {
  const response = await api.get('/api/v1/admin/verification/queue', {
    params: { status, page, size },
  })
  return response.data
}

export async function approveVerification(applicationId, { reviewerNote } = {}) {
  const response = await api.post(`/api/v1/admin/verification/${applicationId}/approve`, { reviewerNote })
  return response.data
}

export async function rejectVerification(applicationId, { reviewerNote } = {}) {
  const response = await api.post(`/api/v1/admin/verification/${applicationId}/reject`, { reviewerNote })
  return response.data
}

// ── Close friends ─────────────────────────────────────────────────────────────

export async function getCloseFriends({ page = 0, size = 20 } = {}) {
  const response = await api.get('/api/v1/users/me/close-friends', {
    params: { page, size },
  })
  return response.data
}

export async function addCloseFriend(userId) {
  const response = await api.post(`/api/v1/users/me/close-friends/${userId}`)
  return response.data
}

export async function removeCloseFriend(userId) {
  await api.delete(`/api/v1/users/me/close-friends/${userId}`)
}
