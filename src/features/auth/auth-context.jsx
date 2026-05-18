import { createContext, useContext, useEffect, useState } from 'react'

import { changePasswordRequest, loginRequest, logoutRequest, registerRequest } from '@/features/auth/auth.api'
import {
  clearStoredSession,
  AUTH_SESSION_EVENT,
  mapAuthResponseToSession,
  readStoredSession,
  saveStoredSession,
} from '@/features/auth/auth-storage'
import { getCurrentUser } from '@/features/users/users.api'
import { setReactionCacheUser } from '@/lib/reaction-cache'
import { setCurrentUserId } from '@/lib/my-reaction-store'
import { seedUserCache } from '@/lib/user-cache'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [status, setStatus] = useState('loading')

  // Scope the local reaction-cache + per-viewer reaction store to
  // whoever is signed in. Switches when sign-in / sign-out / account
  // switch flips session.user.id so a viewer never sees another
  // viewer's reactions, and so the actor-aware SSE dispatch knows
  // which `actorId` to match against.
  useEffect(() => {
    const id = session?.user?.id ?? null
    setReactionCacheUser(id)
    setCurrentUserId(id)
    // Seed the resolver cache so every `@<self>` mention chip renders
    // the viewer's display name immediately — both directly (e.g.
    // `akar.arkanf19@gmail.com`) and via its email-local-part alias
    // (`akar.arkanf19`), which is what the mention regex captures.
    if (session?.user) seedUserCache(session.user)
  }, [
    session?.user?.id,
    session?.user?.username,
    session?.user?.fullName,
    session?.user?.firstName,
    session?.user?.lastName,
    session?.user?.avatarUrl,
  ])

  useEffect(() => {
    let isMounted = true

    function syncSessionFromStorage() {
      const storedSession = readStoredSession()

      if (!storedSession?.accessToken) {
        setSession(null)
        setStatus('guest')
        return
      }

      setSession(storedSession)
      setStatus('authenticated')
    }

    async function bootstrap() {
      const storedSession = readStoredSession()

      if (!storedSession?.accessToken) {
        if (isMounted) {
          setSession(null)
          setStatus('guest')
        }
        return
      }

      if (isMounted) {
        setSession(storedSession)
      }

      try {
        const user = await getCurrentUser()
        const nextSession = {
          ...storedSession,
          user,
        }

        saveStoredSession(nextSession)

        if (isMounted) {
          setSession(nextSession)
          setStatus('authenticated')
        }
      } catch {
        clearStoredSession()

        if (isMounted) {
          setSession(null)
          setStatus('guest')
        }
      }
    }

    bootstrap()

    window.addEventListener('storage', syncSessionFromStorage)
    window.addEventListener(AUTH_SESSION_EVENT, syncSessionFromStorage)

    return () => {
      isMounted = false
      window.removeEventListener('storage', syncSessionFromStorage)
      window.removeEventListener(AUTH_SESSION_EVENT, syncSessionFromStorage)
    }
  }, [])

  async function signIn(payload) {
    const authResponse = await loginRequest(payload)
    const nextSession = mapAuthResponseToSession(authResponse)

    saveStoredSession(nextSession)
    setSession(nextSession)
    setStatus('authenticated')

    return nextSession
  }

  async function signUp(payload) {
    const authResponse = await registerRequest(payload)
    const nextSession = mapAuthResponseToSession(authResponse)

    saveStoredSession(nextSession)
    setSession(nextSession)
    setStatus('authenticated')

    return nextSession
  }

  async function signOut() {
    const currentSession = readStoredSession() ?? session

    try {
      await logoutRequest({
        refreshToken: currentSession?.refreshToken ?? null,
      })
    } finally {
      // Intentionally do NOT call clearReactionCache() — the reaction
      // cache is keyed `rxn-cache:<userId>` per viewer, so the next
      // sign-in (same user) restores their "liked by me" hearts even
      // though feed endpoints still return myReaction: null. Wiping it
      // here was the cause of the post-logout re-react double-toggle.
      clearStoredSession()
      setSession(null)
      setStatus('guest')
    }
  }

  // Sends currentPassword + newPassword to the server, which verifies,
  // re-hashes, revokes every other refresh token, and issues a fresh pair.
  // We adopt the new tokens immediately so this device stays signed in.
  async function changePassword({ currentPassword, newPassword }) {
    const authResponse = await changePasswordRequest({ currentPassword, newPassword })
    const nextSession = mapAuthResponseToSession(authResponse)
    saveStoredSession(nextSession)
    setSession(nextSession)
    setStatus('authenticated')
    return nextSession
  }

  async function refreshCurrentUser() {
    const currentUser = await getCurrentUser()
    const currentSession = readStoredSession() ?? session

    if (currentSession) {
      const nextSession = {
        ...currentSession,
        user: currentUser,
      }

      saveStoredSession(nextSession)
      setSession(nextSession)
    }

    return currentUser
  }

  const value = {
    session,
    user: session?.user ?? null,
    status,
    isLoading: status === 'loading',
    isAuthenticated: status === 'authenticated',
    signIn,
    signUp,
    signOut,
    changePassword,
    refreshCurrentUser,
    updateSession(nextSession) {
      if (!nextSession) {
        clearStoredSession()
        setSession(null)
        setStatus('guest')
        return
      }

      saveStoredSession(nextSession)
      setSession(nextSession)
      setStatus('authenticated')
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }

  return context
}