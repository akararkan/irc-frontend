import { api } from '@/api/client'

export async function followUser(userId) {
  const response = await api.post(`/api/v1/users/${userId}/follow`)
  return response.data
}

export async function unfollowUser(userId) {
  const response = await api.delete(`/api/v1/users/${userId}/follow`)
  return response.data
}

export async function blockUser(userId) {
  const response = await api.post(`/api/v1/users/${userId}/block`)
  return response.data
}

export async function unblockUser(userId) {
  const response = await api.delete(`/api/v1/users/${userId}/block`)
  return response.data
}

export async function restrictUser(userId) {
  const response = await api.post(`/api/v1/users/${userId}/restrict`)
  return response.data
}

export async function unrestrictUser(userId) {
  const response = await api.delete(`/api/v1/users/${userId}/restrict`)
  return response.data
}

export async function getSocialStatus(userId) {
  const response = await api.get(`/api/v1/users/${userId}/social-status`)
  return response.data
}

export async function getFollowers(userId, { page = 0, size = 20 } = {}) {
  const response = await api.get(`/api/v1/users/${userId}/followers`, {
    params: { page, size },
  })
  return response.data
}

export async function getFollowing(userId, { page = 0, size = 20 } = {}) {
  const response = await api.get(`/api/v1/users/${userId}/following`, {
    params: { page, size },
  })
  return response.data
}

export async function getBlockedUsers({ page = 0, size = 20 } = {}) {
  const response = await api.get('/api/v1/users/me/blocked', {
    params: { page, size },
  })
  return response.data
}

export async function getRestrictedUsers({ page = 0, size = 20 } = {}) {
  const response = await api.get('/api/v1/users/me/restricted', {
    params: { page, size },
  })
  return response.data
}
