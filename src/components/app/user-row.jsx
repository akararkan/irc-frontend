import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { RoleBadge } from '@/components/app/role-badge'
import { UserAvatar } from '@/components/app/user-avatar'
import { cn } from '@/lib/utils'
import {
  formatNumber,
  getFullName,
  getHandle,
  getRawUsername,
} from '@/lib/format'

export function UserRow({ user, trailing, className }) {
  const handle = getHandle(user)
  const route = getRawUsername(user)
  const fullName = getFullName(user) || handle || 'Unknown user'
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border bg-card p-3 shadow-sm',
        className,
      )}
    >
      <Link to={`/profile/${route}`}>
        <UserAvatar user={user} className="size-11 ring-1 ring-border" />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            to={`/profile/${route}`}
            className="truncate text-sm font-semibold hover:underline"
          >
            {fullName}
          </Link>
          {user.role ? <RoleBadge role={user.role} size="xs" /> : null}
        </div>
        {handle && handle.toLowerCase() !== fullName.toLowerCase() ? (
          <p className="truncate font-mono text-[11px] text-muted-foreground">
            @{handle}
          </p>
        ) : null}
        {user.profileBio ? (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{user.profileBio}</p>
        ) : null}
        <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
          <Badge variant="outline" className="rounded-full px-2 py-0 text-[10px]">
            {formatNumber(user.followerCount ?? 0)} followers
          </Badge>
        </div>
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  )
}
