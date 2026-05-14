export const APP_NAME = 'IRC'
export const APP_FULL_NAME = 'Islamic Research Center'
export const APP_TAGLINE = 'Knowledge, research, and community — grounded in Islamic tradition.'

// Backend port — change once if you ever move the API off 8080.
const API_PORT = 8080

/**
 * Resolve the API base URL.
 *
 * Priority:
 *   1. `VITE_API_URL` env var, if set (production / explicit override).
 *   2. Same hostname the page was loaded from, on `API_PORT`. This makes the
 *      app "just work" whether you open it from `localhost:5173`, your LAN
 *      IP `http://192.168.x.x:5173`, or a tunnel — no env rebuild needed.
 *   3. `http://localhost:8080` as a server-side / SSR fallback.
 */
function resolveApiUrl() {
  const fromEnv = import.meta.env.VITE_API_URL
  if (fromEnv) return fromEnv.replace(/\/+$/, '')
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const { protocol, hostname } = window.location
    return `${protocol}//${hostname}:${API_PORT}`
  }
  return `http://localhost:${API_PORT}`
}

export const API_URL = resolveApiUrl()

export const AUTH_STORAGE_KEY = 'irc-auth-session'

/**
 * The public frontend URL — used to build share links and email CTAs
 * so they always point at the Vercel deployment, not the current window origin.
 * Falls back to window.location.origin so local dev still works.
 */
export const FRONTEND_URL =
  import.meta.env.VITE_FRONTEND_URL?.replace(/\/+$/, '') ||
  (typeof window !== 'undefined' ? window.location.origin : '')
