import { cn } from '@/lib/utils'
import { getRoleInfo } from '@/lib/roles'

// Plain members don't get a chip — the chip is reserved for elevated
// standings (Scholar / Researcher / Admin / Super admin). Treating
// USER as "no badge" cleans up every author row across the app and
// prevents the misleading "Member" pill from competing with content.
const HIDDEN_ROLES = new Set(['USER'])

/**
 * RoleBadge — semantic pill mirroring the IRC Scholar design spec.
 * Foreground + soft fill come from `pill-{success|info|warn|danger|mute}`
 * defined in index.css. Icon precedes the label, both inherit colour.
 *
 * Renders nothing for normal members; only Scholars, Researchers,
 * and the administrative roles get a visible chip.
 */
export function RoleBadge({ role, size = 'sm', showIcon = true, className }) {
  if (!role || HIDDEN_ROLES.has(role)) return null
  const info = getRoleInfo(role)
  if (!info) return null
  const Icon = info.icon

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium leading-none whitespace-nowrap',
        info.className,
        size === 'xs' && 'px-1.5 py-0.5 text-[10px]',
        size === 'sm' && 'px-2 py-0.5 text-[11px]',
        size === 'md' && 'px-2.5 py-1 text-xs',
        className,
      )}
    >
      {showIcon ? (
        <Icon
          className={cn(size === 'xs' ? 'size-[10px]' : size === 'sm' ? 'size-[11px]' : 'size-3')}
          strokeWidth={1.7}
        />
      ) : null}
      <span className="truncate">{info.label}</span>
    </span>
  )
}
