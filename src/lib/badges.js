import {
  BadgeCheck,
  Building2,
  GraduationCap,
  Microscope,
  Radio,
  Star,
} from 'lucide-react'

// Badge metadata — mirrors BadgeType / AccountType enums and the
// resolveBadges() logic in UserMapper.java on the backend.
//
// The server computes `user.badges` from `accountType` + verification
// state and ships them sorted by priority. Frontend never reverse-
// derives the list when `badges[]` is present; the fallback only fires
// when an endpoint returns a thinner UserResponse (no `badges` field).
//
// Visual treatment (consistent with RoleBadge):
//   - PLATFORM_OFFICIAL : gold   · BadgeCheck   · the verified ✓
//   - SENIOR_SCHOLAR    : teal   · Star
//   - VERIFIED_SCHOLAR  : teal   · GraduationCap
//   - VERIFIED_RESEARCHER: purple · Microscope
//   - INSTITUTION       : blue   · Building2
//   - MEDIA             : coral  · Radio
//   - EMAIL_VERIFIED    : gray   · BadgeCheck (small, low-priority)
//
// Each entry also carries a `priority` so an UI that picks "the one
// primary badge" can do so without a server round-trip — lower wins.
// Numbers match the backend's BadgePriority constants.

const PRIORITY = {
  PLATFORM_OFFICIAL: 0,
  SENIOR_SCHOLAR: 10,
  VERIFIED_SCHOLAR: 20,
  VERIFIED_RESEARCHER: 30,
  INSTITUTION: 40,
  MEDIA: 50,
  EMAIL_VERIFIED: 90,
}

export const BADGE_META = {
  PLATFORM_OFFICIAL: {
    label: 'Official',
    icon: BadgeCheck,
    cssClass: 'badge-gold',
    priority: PRIORITY.PLATFORM_OFFICIAL,
  },
  INSTITUTION: {
    label: 'Institution',
    icon: Building2,
    cssClass: 'badge-blue',
    priority: PRIORITY.INSTITUTION,
  },
  SENIOR_SCHOLAR: {
    label: 'Senior Scholar',
    icon: Star,
    cssClass: 'badge-teal',
    priority: PRIORITY.SENIOR_SCHOLAR,
  },
  VERIFIED_SCHOLAR: {
    label: 'Scholar',
    icon: GraduationCap,
    cssClass: 'badge-teal',
    priority: PRIORITY.VERIFIED_SCHOLAR,
  },
  VERIFIED_RESEARCHER: {
    label: 'Researcher',
    icon: Microscope,
    cssClass: 'badge-purple',
    priority: PRIORITY.VERIFIED_RESEARCHER,
  },
  MEDIA: {
    label: 'Media',
    icon: Radio,
    cssClass: 'badge-coral',
    priority: PRIORITY.MEDIA,
  },
  EMAIL_VERIFIED: {
    label: 'Verified',
    icon: BadgeCheck,
    cssClass: 'badge-gray',
    priority: PRIORITY.EMAIL_VERIFIED,
  },
}

// AccountType → primary BadgeType. REGULAR has no badge (the spec
// reserves the chip for "elevated standings" — same rule as RoleBadge).
const ACCOUNT_TYPE_TO_BADGE = {
  PLATFORM_OFFICIAL: 'PLATFORM_OFFICIAL',
  INSTITUTION: 'INSTITUTION',
  VERIFIED_SCHOLAR: 'VERIFIED_SCHOLAR',
  VERIFIED_RESEARCHER: 'VERIFIED_RESEARCHER',
  MEDIA: 'MEDIA',
}

/** Resolve a `BadgeType` to its render metadata. Unknown types → null. */
export function getBadgeInfo(type) {
  if (!type) return null
  return BADGE_META[type] ?? null
}

/**
 * Resolve an `AccountType` to its primary badge metadata. Used when
 * the server response is thin (no `badges[]`) and we need to draw the
 * canonical chip from `accountType` alone.
 */
export function getAccountTypeInfo(accountType) {
  if (!accountType) return null
  const badgeType = ACCOUNT_TYPE_TO_BADGE[accountType]
  if (!badgeType) return null
  return { type: badgeType, ...BADGE_META[badgeType] }
}

/**
 * Returns server-provided badges sorted by priority. Empty array when
 * `badges` isn't present on the user payload.
 */
export function getBadges(user) {
  if (!user?.badges?.length) return []
  return [...user.badges].sort(
    (a, b) => (a.priority ?? 99) - (b.priority ?? 99),
  )
}

/**
 * Best-effort badge list for any user shape:
 *   1. If the server already sent `badges[]`, use it.
 *   2. Otherwise, derive one entry from `accountType`.
 *   3. Optionally append `EMAIL_VERIFIED` if `user.emailVerified === true`
 *      and it isn't already in the list.
 *
 * Each returned entry is `{ type, label, icon, cssClass, priority }`.
 */
export function resolveBadges(user) {
  if (!user) return []
  const fromServer = getBadges(user)
  if (fromServer.length > 0) {
    return fromServer
      .map((b) => {
        const meta = getBadgeInfo(b.type)
        return meta ? { type: b.type, ...meta, ...b } : null
      })
      .filter(Boolean)
  }
  const derived = []
  const primary = getAccountTypeInfo(user.accountType)
  if (primary) derived.push(primary)
  if (
    user.emailVerified === true &&
    !derived.some((b) => b.type === 'EMAIL_VERIFIED')
  ) {
    derived.push({ type: 'EMAIL_VERIFIED', ...BADGE_META.EMAIL_VERIFIED })
  }
  return derived
}

/** The primary inline badge — index 0 after sorting by priority. */
export function getPrimaryBadge(user) {
  return resolveBadges(user)[0] ?? null
}

export function getAccountType(user) {
  return user?.accountType ?? 'REGULAR'
}

export function isPlatformOfficial(user) {
  return user?.accountType === 'PLATFORM_OFFICIAL'
}

export function isVerifiedScholar(user) {
  return (
    user?.accountType === 'VERIFIED_SCHOLAR' ||
    user?.verificationTier === 'SCHOLAR' ||
    user?.verificationTier === 'SENIOR_SCHOLAR'
  )
}

export function isVerifiedResearcher(user) {
  return user?.accountType === 'VERIFIED_RESEARCHER'
}

export function isInstitution(user) {
  return user?.accountType === 'INSTITUTION'
}

export function isMedia(user) {
  return user?.accountType === 'MEDIA'
}
