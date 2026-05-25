import axios from 'axios'

import { API_URL } from '@/config/env'
import {
  clearStoredSession,
  readStoredSession,
  saveStoredSession,
} from '@/features/auth/auth-storage'
import {
  parseApiError,
  RateLimited,
  UnhydratedIdError,
} from '@/lib/api-errors'
import { markRateLimited } from '@/lib/rate-limit-cooldown'

// Detect `.../undefined/...`, `/undefined?`, `/null/...`, `/null?`,
// trailing `/undefined`, trailing `/null`, and the same surrounded
// by query strings. Path-only — querystring values that legitimately
// say `?type=undefined` (rare, but possible) aren't blocked.
const UNHYDRATED_PATH_RE = /\/(undefined|null|NaN)(?:\/|\?|$)/i

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
  // Short-circuit unhydrated path params (`/api/v1/posts/undefined`)
  // before they hit the network. Backend's TYPE_MISMATCH handler tags
  // these with `details.hint = "frontend_path_param_unhydrated"`, but
  // the cleanest fix is to never send the request at all — saves a
  // round-trip and surfaces the bug right where the call originated.
  const url = String(config.url ?? '')
  if (UNHYDRATED_PATH_RE.test(url)) {
    if (typeof console !== 'undefined' && import.meta.env?.DEV) {
      console.warn(
        `[api] aborted ${config.method?.toUpperCase() ?? 'GET'} ${url} — path contains literal "undefined" / "null" / "NaN". Guard the call site (e.g. \`if (!id) return\`).`,
      )
    }
    return Promise.reject(
      new UnhydratedIdError(
        'Path parameter was not hydrated before the request fired.',
        {
          errorCode: 'CLIENT_ID_UNHYDRATED',
          path: url,
          details: { hint: 'frontend_path_param_unhydrated', url },
        },
      ),
    )
  }

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

    // Parse once at the interceptor boundary and stash on the error so
    // every call site downstream gets the typed view for free —
    // `extractApiMessage(err)` / `formatApiError(err)` / instanceof
    // checks all work without re-parsing.
    error.parsedError = parseApiError(error)

    // Rate-limit captured globally so every click handler doesn't have
    // to do this individually. The typed parser already pulls action +
    // retryAfterSeconds from the `details` envelope (and falls back to
    // the Retry-After header), so we just register the cooldown.
    if (error.parsedError instanceof RateLimited) {
      const retry = error.parsedError.retryAfterSeconds
      const action =
        error.parsedError.action ??
        Number(error.response?.headers?.['retry-after']) /* not really an action; only used when bare */
      if (action && retry) markRateLimited(action, retry)
    }

    // 401 → try refresh once. The typed parser will return
    // `SessionExpired` for both AUTH_TOKEN_INVALID/AUTH_REQUIRED codes
    // and bare-body 401s, so this `status === 401` check stays correct.
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