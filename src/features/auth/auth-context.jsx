/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react'

import { loginRequest, logoutRequest, registerRequest } from '@/features/auth/auth.api'
import {
  clearStoredSession,
  AUTH_SESSION_EVENT,
  mapAuthResponseToSession,
  readStoredSession,
  saveStoredSession,
} from '@/features/auth/auth-storage'
import { getCurrentUser } from '@/features/users/users.api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [status, setStatus] = useState('loading')

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
      clearStoredSession()
      setSession(null)
      setStatus('guest')
    }
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