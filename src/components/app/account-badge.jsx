import { cn } from '@/lib/utils'
import { getBadgeInfo, resolveBadges } from '@/lib/badges'

/**
 * AccountBadge — single chip for a `BadgeType` value, in the same
 * visual family as RoleBadge so they stack cleanly next to each
 * other on author rows.
 *
 * The colour + icon mapping lives in BADGE_META; the chip itself uses
 * the `.badge-*` utilities from index.css so the dark/light themes
 * both look right without any extra plumbing here.
 */
export function AccountBadge({
  type,
  badge,
  size = 'sm',
  showIcon = true,
  showLabel = true,
  className,
}) {
  // Accept either `{type}` shape from `resolveBadges()` or a bare type
  // string. Prefer the explicit prop when both are passed.
  const resolvedType = type ?? badge?.type
  const info = resolvedType ? getBadgeInfo(resolvedType) : null
  if (!info) return null
  const Icon = info.icon

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium leading-none whitespace-nowrap',
        info.cssClass,
        size === 'xs' && 'px-1.5 py-0.5 text-[10px]',
        size === 'sm' && 'px-2 py-0.5 text-[11px]',
        size === 'md' && 'px-2.5 py-1 text-xs',
        // `iconOnly` style for tight rails: square padding, just the icon.
        !showLabel && (size === 'xs' ? 'px-1' : 'px-1.5'),
        className,
      )}
      title={showLabel ? undefined : info.label}
      aria-label={info.label}
    >
      {showIcon ? (
        <Icon
          className={cn(
            size === 'xs' ? 'size-[10px]' : size === 'sm' ? 'size-[11px]' : 'size-3',
          )}
          strokeWidth={1.7}
        />
      ) : null}
      {showLabel ? <span className="truncate">{info.label}</span> : null}
    </span>
  )
}

/**
 * AccountBadges — renders every elevated badge the user holds, sorted
 * by priority. Uses the server-shipped `user.badges[]` when available
 * and falls back to deriving from `accountType` when not (so author
 * rows still get a chip on endpoints that ship a thinner User shape).
 *
 * Props:
 *   user         — anything with `badges[]` / `accountType` / `emailVerified`
 *   size         — xs | sm | md (default sm)
 *   max          — cap the number of chips rendered (default 2)
 *   iconOnly     — drop the label, render just the icon (for dense rails)
 *   includeEmailVerified — include the low-priority EMAIL_VERIFIED chip
 *                          (default false; it competes for attention)
 *   className    — applied to the wrapper
 */
export function AccountBadges({
  user,
  size = 'sm',
  max = 2,
  iconOnly = false,
  includeEmailVerified = false,
  className,
}) {
  if (!user) return null
  let badges = resolveBadges(user)
  if (!includeEmailVerified) {
    badges = badges.filter((b) => b.type !== 'EMAIL_VERIFIED')
  }
  if (badges.length === 0) return null

  const visible = badges.slice(0, Math.max(1, max))

  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {visible.map((b) => (
        <AccountBadge
          key={b.type}
          type={b.type}
          size={size}
          showLabel={!iconOnly}
        />
      ))}
    </span>
  )
}
