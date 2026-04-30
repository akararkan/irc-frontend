import { rawApi } from '@/api/client'

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