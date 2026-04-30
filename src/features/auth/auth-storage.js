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

export function readStoredSession() {
  if (typeof window === 'undefined') {
    return null
  }

  return parseJson(window.localStorage.getItem(AUTH_STORAGE_KEY))
}

export function saveStoredSession(session) {
  if (typeof window === 'undefined') {
    return session
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
  emitSessionChange(session)
  return session
}

export function clearStoredSession() {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(AUTH_STORAGE_KEY)
  emitSessionChange(null)
}