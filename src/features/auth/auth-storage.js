import { AUTH_STORAGE_KEY } from '@/config/env'

export const AUTH_SESSION_EVENT = 'irc-auth-session-changed'

function parseJson(value) {
  try {
    return value ? JSON.parse(value) : null
  } catch {
    return null
  }
}

function emitSessionChange(session) {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(
    new CustomEvent(AUTH_SESSION_EVENT, {
      detail: session,
    }),
  )
}

export function mapAuthResponseToSession(authResponse, fallbackUser = null) {
  const expiresInSeconds = Number(authResponse?.expiresIn ?? 0)

  return {
    accessToken: authResponse?.accessToken ?? '',
    refreshToken: authResponse?.refreshToken ?? '',
    tokenType: authResponse?.tokenType ?? 'Bearer',
    expiresIn: expiresInSeconds,
    expiresAt:
      expiresInSeconds > 0 ? Date.now() + expiresInSeconds * 1000 : null,
    user: authResponse?.user ?? fallbackUser,
  }
}

// localStorage can throw on Safari private mode, in iframes with
// blocked storage, and when the quota is exceeded. Wrapping every
// access keeps the app from crashing in those environments — at worst
// the session reverts to in-memory only.

export function readStoredSession() {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    return parseJson(window.localStorage.getItem(AUTH_STORAGE_KEY))
  } catch {
    return null
  }
}

export function saveStoredSession(session) {
  if (typeof window === 'undefined') {
    return session
  }
  try {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
  } catch {
    // storage unavailable / quota exceeded — fall through so the rest
    // of the app still notices the new session via the change event.
  }
  emitSessionChange(session)
  return session
}

export function clearStoredSession() {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
  } catch {
    // ignore — caller's intent is "log me out"; if storage is read-only
    // we still emit the change event so listeners react.
  }
  emitSessionChange(null)
}