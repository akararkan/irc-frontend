import { api, rawApi } from '@/api/client'

export async function loginRequest(payload) {
  const response = await rawApi.post('/api/v1/auth/login', payload)
  return response.data
}

export async function registerRequest(payload) {
  const response = await rawApi.post('/api/v1/auth/register', payload)
  return response.data
}

export async function logoutRequest(payload = null) {
  await rawApi.post('/api/v1/auth/logout', payload ?? undefined)
}

export async function logoutAllRequest() {
  await rawApi.post('/api/v1/auth/logout-all')
}

// Requires JWT. Returns a fresh AuthResponse (new access + refresh tokens).
// Server revokes every other refresh token — other devices are signed out.
export async function changePasswordRequest({ currentPassword, newPassword }) {
  const response = await api.post('/api/v1/auth/change-password', {
    currentPassword,
    newPassword,
  })
  return response.data
}