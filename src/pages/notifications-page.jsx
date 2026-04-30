import { BellOff, Check, CheckCheck, Radio, WifiOff } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/app/empty-state'
import { PageHeader } from '@/components/app/page-header'
import { UserAvatar } from '@/components/app/user-avatar'
import { useNotifications } from '@/features/notifications/notifications-context'
import { useAuth } from '@/features/auth/auth-context'
import { cn } from '@/lib/utils'
import { formatRelativeTime } from '@/lib/format'

function NotificationRow({ notification, onMarkRead }) {
  const actor = notification.actorId
    ? {
        id: notification.actorId,
        username: notification.actorUsername,
        profileImage: notification.actorProfileImage,
      }
    : null

  const actorLink = actor?.username ? `/profile/${actor.username}` : null
  const unread = !notification.isRead

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border p-4 transition-colors',
        unread ? 'border-border bg-accent/50' : 'border-border bg-card',
      )}
    >
      {actorLink ? (
        <Link to={actorLink} className="shrink-0">
          <UserAvatar user={actor} className="size-10" />
        </Link>
      ) : (
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
          {(notification.type ?? 'N').slice(0, 1)}
        </div>
      )}

      <div className="min-w-0 flex-1 space-y-1">
        {notification.title ? (
          <p className="text-sm font-semibold leading-snug">{notification.title}</p>
        ) : null}
        {notification.body ? (
          <p className="text-sm leading-relaxed text-muted-foreground">{notification.body}</p>
        ) : null}
        <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
          <span>{formatRelativeTime(notification.createdAt)}</span>
          {unread ? (
            <span className="inline-flex size-1.5 rounded-full bg-primary" aria-label="Unread" />
          ) : null}
        </div>
      </div>

      {unread ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="rounded-full text-muted-foreground"
          onClick={() => onMarkRead(notification.id)}
          title="Mark as read"
        >
          <Check className="size-4" />
        </Button>
      ) : null}
    </div>
  )
}

export function NotificationsPage() {
  const { isAuthenticated } = useAuth()
  const { items, unreadCount, isConnected, isLoading, markAsRead, markAllAsRead } =
    useNotifications()

  if (!isAuthenticated) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Notifications"
          title="Your activity"
          description="Sign in to see your real-time notifications."
        />
        <EmptyState
          icon={BellOff}
          title="Sign in to view notifications"
          description="Your follower activity, reactions, comments, and system messages appear here in real time."
          action={
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm" className="rounded-full">
                <Link to="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm" className="rounded-full">
                <Link to="/signup">Create account</Link>
              </Button>
            </div>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Notifications"
        title="Your activity"
        description="Follower activity, reactions, replies, and system messages — streamed in real time."
        action={
          <>
            <Badge
              variant="outline"
              className={cn(
                'gap-1.5 text-xs',
                isConnected
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'border-border text-muted-foreground',
              )}
            >
              {isConnected ? (
                <>
                  <Radio className="size-3" />
                  Live
                </>
              ) : (
                <>
                  <WifiOff className="size-3" />
                  Offline
                </>
              )}
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
            >
              <CheckCheck className="size-4" />
              Mark all read
            </Button>
          </>
        }
      />

      {isLoading && items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title="You're all caught up"
          description="New activity from people you follow and reactions on your posts will show up here."
        />
      ) : (
        <div className="space-y-2.5">
          {items.map((notification) => (
            <NotificationRow
              key={notification.id}
              notification={notification}
              onMarkRead={markAsRead}
            />
          ))}
        </div>
      )}
    </div>
  )
}
