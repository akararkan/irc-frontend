// Badge metadata — mirrors BadgeType enum and resolveBadges() in UserMapper.java.
// Badges are NOT stored; the backend computes them from accountType +
// verificationTier and ships a sorted BadgeDto list in UserResponse.badges.

export const BADGE_META = {
  PLATFORM_OFFICIAL: {
    colorKey: 'gold',
    icon: 'ti-hexagon',
    label: 'Official',
    cssClass: 'badge-gold',
  },
  INSTITUTION: {
    colorKey: 'blue',
    icon: 'ti-building',
    label: 'Institution',
    cssClass: 'badge-blue',
  },
  SENIOR_SCHOLAR: {
    colorKey: 'teal',
    icon: 'ti-star',
    label: 'Senior Scholar',
    cssClass: 'badge-teal',
  },
  VERIFIED_SCHOLAR: {
    colorKey: 'teal',
    icon: 'ti-certificate',
    label: 'Scholar',
    cssClass: 'badge-teal',
  },
  VERIFIED_RESEARCHER: {
    colorKey: 'purple',
    icon: 'ti-flask',
    label: 'Researcher',
    cssClass: 'badge-purple',
  },
  MEDIA: {
    colorKey: 'coral',
    icon: 'ti-broadcast',
    label: 'Media',
    cssClass: 'badge-coral',
  },
  EMAIL_VERIFIED: {
    colorKey: 'gray',
    icon: 'ti-check',
    label: 'Verified',
    cssClass: 'badge-gray',
  },
}

/**
 * Returns the server-provided badge list sorted by priority (lowest first).
 * Falls back to an empty array when the field isn't present.
 */
export function getBadges(user) {
  if (!user?.badges?.length) return []
  return [...user.badges].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
}

/**
 * The primary inline badge — index 0 after sorting by priority.
 * Returns null when the user has no badges.
 */
export function getPrimaryBadge(user) {
  return getBadges(user)[0] ?? null
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
