import { cn } from '@/lib/utils'
import { getRoleInfo } from '@/lib/roles'

export function RoleBadge({ role, size = 'sm', showIcon = true, className }) {
  const info = getRoleInfo(role)
  if (!info) return null
  const Icon = info.icon

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full ring-1 font-medium',
        info.className,
        size === 'xs' && 'px-1.5 py-0 text-[10px]',
        size === 'sm' && 'px-2 py-0.5 text-xs',
        size === 'md' && 'px-2.5 py-1 text-sm',
        className,
      )}
    >
      {showIcon ? <Icon className={cn(size === 'xs' ? 'size-2.5' : 'size-3')} /> : null}
      <span className="truncate">{info.label}</span>
    </span>
  )
}
