import axios from 'axios'

import { API_URL } from '@/config/env'
import {
  clearStoredSession,
  readStoredSession,
  saveStoredSession,
} from '@/features/auth/auth-storage'
import { markRateLimited } from '@/lib/rate-limit-cooldown'

function createClient() {
  return axios.create({
    baseURL: API_URL,
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

export const rawApi = createClient()
export const api = createClient()

let refreshPromise = null

api.interceptors.request.use((config) => {
  const session = readStoredSession()

  if (session?.accessToken) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${session.accessToken}`
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config ?? {}
    const status = error.response?.status

    // Rate-limit captured globally so every click handler doesn't have
    // to do this individually. The backend's RateLimitExceededException
    // ships `details.action` (`reaction` / `comment` / `social`) and
    // `details.retryAfterSeconds`; we park that action so click
    // affordances disable themselves until the window passes. The
    // `Retry-After` header is read as a fallback when the body's
    // details object is missing.
    if (status === 429) {
      const data = error.response?.data ?? {}
      const action = data.details?.action ?? data.action
      const retry =
        Number(data.details?.retryAfterSeconds) ||
        Number(error.response?.headers?.['retry-after']) ||
        null
      if (action && retry) markRateLimited(action, retry)
    }

    const shouldRefresh =
      status === 401 && !originalRequest._retry && !originalRequest.skipAuthRefresh

    if (!shouldRefresh) {
      return Promise.reject(error)
    }

    const session = readStoredSession()

    if (!session?.refreshToken) {
      clearStoredSession()
      return Promise.reject(error)
    }

    try {
      originalRequest._retry = true

      refreshPromise ??= rawApi
        .post('/api/v1/auth/refresh', {
          refreshToken: session.refreshToken,
        })
        .then((response) => response.data)
        .finally(() => {
          refreshPromise = null
        })

      const refreshed = await refreshPromise

      const nextSession = {
        ...session,
        accessToken: refreshed.accessToken ?? session.accessToken,
        refreshToken: refreshed.refreshToken ?? session.refreshToken,
        tokenType: refreshed.tokenType ?? session.tokenType,
        expiresIn: refreshed.expiresIn ?? session.expiresIn,
        expiresAt:
          refreshed.expiresIn != null
            ? Date.now() + refreshed.expiresIn * 1000
            : session.expiresAt,
        user: refreshed.user ?? session.user,
      }

      saveStoredSession(nextSession)

      originalRequest.headers = originalRequest.headers ?? {}
      originalRequest.headers.Authorization = `Bearer ${nextSession.accessToken}`

      return api(originalRequest)
    } catch (refreshError) {
      clearStoredSession()
      return Promise.reject(refreshError)
    }
  },
)