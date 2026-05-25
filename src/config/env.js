export const APP_NAME = 'IRC'
export const APP_FULL_NAME = 'Islamic Research Center'
export const APP_TAGLINE = 'Knowledge, research, and community — grounded in Islamic tradition.'

// Backend port — change once if you ever move the API off 8080.
const API_PORT = 8080

/**
 * Resolve the API base URL.
 *
 * Priority:
 *   1. `VITE_API_URL` env var — use in production (e.g. https://api.irc.example.com).
 *   2. Same origin the page is loaded from — works in local dev because
 *      Vite proxies all `/api/*` paths to `localhost:8080`, so every
 *      Axios + EventSource request hits the same origin and CORS never fires.
 *   3. `http://localhost:8080` as a server-side / SSR fallback.
 */
function resolveApiUrl() {
  const fromEnv = import.meta.env.VITE_API_URL
  if (fromEnv) return fromEnv.replace(/\/+$/, '')
  // Return the window origin (e.g. http://localhost:5173) so all /api
  // requests are served by Vite's dev-server proxy instead of going
  // directly to :8080 cross-origin.
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
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
