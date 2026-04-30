import { api } from '@/api/client'

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

export async function searchUsers({ q = '', page = 0, size = 20 } = {}) {
  const response = await api.get('/api/v1/users/search', {
    params: { q, page, size },
  })
  return response.data
}

export async function updateProfile(payload) {
  const response = await api.patch('/api/v1/users/me', payload)
  return response.data
}

export async function uploadProfileImage(file) {
  const form = new FormData()
  form.append('image', file)
  const response = await api.post('/api/v1/users/me/profile-image', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data
}

export async function deleteProfileImage() {
  const response = await api.delete('/api/v1/users/me/profile-image')
  return response.data
}

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
