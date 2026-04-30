import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { getAvatarUrl, getInitials, resolveMediaUrl } from '@/lib/format'

export function UserAvatar({ user, className, imgClassName, fallbackClassName }) {
  const src = resolveMediaUrl(getAvatarUrl(user))
  return (
    <Avatar className={cn(className)}>
      {src ? (
        <AvatarImage src={src} alt={user?.username ?? 'User avatar'} className={imgClassName} />
      ) : null}
      <AvatarFallback className={fallbackClassName}>{getInitials(user)}</AvatarFallback>
    </Avatar>
  )
}
