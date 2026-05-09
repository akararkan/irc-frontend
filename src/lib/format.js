import { API_URL } from '@/config/env'

export function getInitials(user) {
  if (!user) return '?'
  const first = (user.fname ?? user.firstName ?? '').trim()
  const last = (user.lname ?? user.lastName ?? '').trim()
  const from = `${first[0] ?? ''}${last[0] ?? ''}`
  if (from) return from.toUpperCase()

  const full = (user.fullName ?? user.authorFullName ?? user.researcherFullName ?? '').trim()
  if (full) {
    const [f, l] = full.split(/\s+/)
    const initials = `${f?.[0] ?? ''}${l?.[0] ?? ''}`
    if (initials) return initials.toUpperCase()
  }

  const name = (user.username ?? user.authorUsername ?? user.name ?? '?').trim()
  return name.slice(0, 2).toUpperCase()
}

export function getFullName(user) {
  if (!user) return ''
  const parts = [user.fname ?? user.firstName, user.lname ?? user.lastName].filter(Boolean)
  if (parts.length) return parts.join(' ')
  const full = user.fullName ?? user.authorFullName ?? user.researcherFullName
  if (full) return full
  // Last-ditch handle fallback — but strip email syntax so a row never
  // renders as the user's literal email address. `getHandle` is safe to
  // call here; it gracefully degrades when the input is undefined.
  return getHandle(user)
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Email-shape detector. Returns true for a string that looks like an
 * email address (so the UI can avoid rendering it as a handle).
 */
export function looksLikeEmail(value) {
  if (!value || typeof value !== 'string') return false
  return EMAIL_RE.test(value.trim())
}

/**
 * Display-safe handle for a user. Some legacy accounts have their email
 * stored as the `username`; rendering `@user@gmail.com` is jarring and
 * leaks contact info. This helper returns:
 *
 *   - the local-part of an email-shaped username (`user@gmail.com` → `user`)
 *   - the username as-is when it isn't email-shaped
 *   - an empty string when no handle is available
 *
 * Use everywhere a `@handle` is rendered. Routing keys (`/profile/:username`)
 * should still use the raw username so the link resolves on the backend —
 * `getRawUsername(user)` is the canonical lookup for those cases.
 */
export function getHandle(user) {
  if (!user) return ''
  const raw =
    user.username ??
    user.authorUsername ??
    user.researcherUsername ??
    user.actorUsername ??
    ''
  if (!raw) return ''
  if (looksLikeEmail(raw)) {
    return raw.split('@')[0]
  }
  return raw
}

/**
 * Raw username — the value the backend stores. Use this for routing
 * (`/profile/${getRawUsername(user)}`) and API lookups, never for
 * presentation. For presentation use `getHandle`.
 */
export function getRawUsername(user) {
  if (!user) return ''
  return (
    user.username ??
    user.authorUsername ??
    user.researcherUsername ??
    user.actorUsername ??
    ''
  )
}

export function getAvatarUrl(user) {
  if (!user) return null
  return (
    user.profileImage ??
    user.avatarUrl ??
    user.actorProfileImage ??
    user.authorProfileImage ??
    user.researcherProfileImage ??
    null
  )
}

export function getUsername(user) {
  if (!user) return ''
  return (
    user.username ??
    user.authorUsername ??
    user.researcherUsername ??
    user.actorUsername ??
    ''
  )
}

export function resolveMediaUrl(value) {
  if (!value) return null
  if (/^(https?:|data:|blob:)/i.test(value)) return value
  if (value.startsWith('/')) return `${API_URL}${value}`
  return `${API_URL}/api/v1/media/${value.replace(/^\/+/, '')}`
}

const RELATIVE_UNITS = [
  { unit: 'year', seconds: 31536000 },
  { unit: 'month', seconds: 2592000 },
  { unit: 'week', seconds: 604800 },
  { unit: 'day', seconds: 86400 },
  { unit: 'hour', seconds: 3600 },
  { unit: 'minute', seconds: 60 },
  { unit: 'second', seconds: 1 },
]

const relativeFormatter =
  typeof Intl !== 'undefined' && Intl.RelativeTimeFormat
    ? new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
    : null

/**
 * Prefer the backend's pre-formatted `timeAgo` string when present —
 * the server uses UTC time so it isn't subject to client-clock skew. Falls
 * back to `formatRelativeTime(createdAt)` when the field isn't shipped.
 *
 * Pass the whole entity (post / answer / comment / research) — works with
 * any DTO that has either `timeAgo` or `createdAt`.
 */
export function displayTime(entity) {
  if (!entity) return ''
  if (typeof entity === 'string' || typeof entity === 'number' || entity instanceof Date) {
    return formatRelativeTime(entity)
  }
  if (entity.timeAgo) return entity.timeAgo
  return formatRelativeTime(entity.createdAt ?? entity.publishedAt ?? entity.updatedAt)
}

export function formatRelativeTime(value) {
  if (!value) return ''
  const time = typeof value === 'number' ? value : new Date(value).getTime()
  if (Number.isNaN(time)) return ''

  const diffSeconds = Math.round((time - Date.now()) / 1000)
  const absDiff = Math.abs(diffSeconds)

  if (absDiff < 5) return 'just now'

  const match = RELATIVE_UNITS.find(({ seconds }) => absDiff >= seconds) ?? RELATIVE_UNITS.at(-1)
  const amount = Math.round(diffSeconds / match.seconds)

  if (relativeFormatter) {
    return relativeFormatter.format(amount, match.unit)
  }

  const abs = Math.abs(amount)
  const label = `${abs} ${match.unit}${abs === 1 ? '' : 's'}`
  return amount < 0 ? `${label} ago` : `in ${label}`
}

export function formatNumber(value) {
  if (value == null) return '0'
  const num = Number(value)
  if (Number.isNaN(num)) return String(value)
  if (Math.abs(num) >= 1000) {
    return Intl.NumberFormat(undefined, {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(num)
  }
  return String(num)
}
