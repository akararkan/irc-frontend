import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  Bell,
  BellOff,
  CheckCheck,
  ChevronRight,
  Radio,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { RelativeTime } from '@/components/app/relative-time'
import { UserAvatar } from '@/components/app/user-avatar'
import { useNotifications } from '@/features/notifications/notifications-context'
import { useNotificationSoundPreference } from '@/lib/notification-sound'
import { cn } from '@/lib/utils'
import {
  actorDisplayName,
  getNotificationTypeMeta,
  notificationHref,
  pickPrimaryActor,
} from '@/lib/notifications'

function aggregateLabel(notification, actor) {
  const count = Number(notification.aggregateCount ?? 1)
  if (!count || count <= 1) return null
  const others = count - 1
  const name = actorDisplayName(actor)
  if (others === 1) return `${name} and 1 other`
  return `${name} and ${others} others`
}

const PREVIEW_LIMIT = 6

function NotificationPreviewRow({ notification, onActivate }) {
  const meta = getNotificationTypeMeta(notification.type)
  const Icon = meta.icon
  const href = notificationHref(notification)
  const actor = pickPrimaryActor(notification)
  const aggregate = aggregateLabel(notification, actor)
  const unread = !notification.isRead

  const inner = (
    <div
      className={cn(
        'flex items-start gap-3 px-3 py-2.5 transition-colors',
        unread ? 'bg-brand/[0.06]' : '',
      )}
    >
      <div className="relative shrink-0">
        {actor ? (
          <UserAvatar user={actor} className="size-9" />
        ) : (
          <div className="grid size-9 place-items-center rounded-full bg-muted">
            <Icon className="size-4 text-muted-foreground" />
          </div>
        )}
        <span
          aria-hidden
          className={cn(
            'absolute -bottom-0.5 -right-0.5 grid size-[18px] place-items-center rounded-full border-2 border-background',
            meta.accent,
          )}
        >
          <Icon className="size-2.5" strokeWidth={2.4} />
        </span>
        {notification.aggregateCount > 1 ? (
          <span
            aria-hidden
            className="absolute -left-1 -top-1 inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-foreground px-1 text-[9px] font-bold text-background ring-2 ring-background"
            title={`${notification.aggregateCount} contributors`}
          >
            {notification.aggregateCount > 99 ? '99+' : notification.aggregateCount}
          </span>
        ) : null}
      </div>

      <div className="min-w-0 flex-1 leading-tight">
        {aggregate ? (
          <p
            className={cn(
              'truncate text-[12.5px] leading-snug',
              unread ? 'font-semibold text-foreground' : 'text-foreground/85',
            )}
          >
            {aggregate}
          </p>
        ) : notification.title ? (
          <p
            className={cn(
              'truncate text-[13px] leading-snug',
              unread ? 'font-semibold text-foreground' : 'text-foreground/90',
            )}
          >
            {notification.title}
          </p>
        ) : null}
        {notification.body ? (
          <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-muted-foreground">
            {notification.body}
          </p>
        ) : null}
        <RelativeTime
          value={notification.createdAt}
          className="mt-1 block text-[10.5px] tabular-nums text-muted-foreground"
        />
      </div>

      {unread ? (
        <span
          aria-hidden
          className="mt-1 size-1.5 shrink-0 rounded-full bg-brand"
        />
      ) : null}
    </div>
  )

  if (href) {
    return (
      <Link
        to={href}
        onClick={() => onActivate(notification)}
        className="block rounded-lg outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted/60"
      >
        {inner}
      </Link>
    )
  }
  return (
    <button
      type="button"
      onClick={() => onActivate(notification)}
      className="block w-full rounded-lg text-left outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted/60"
    >
      {inner}
    </button>
  )
}

export function NotificationBell() {
  const {
    items,
    unreadCount,
    isConnected,
    isLoading,
    markAsRead,
    markAllAsRead,
  } = useNotifications()
  const [soundEnabled, setSoundEnabled] = useNotificationSoundPreference()
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const buttonRef = useRef(null)
  const navigate = useNavigate()

  // On mobile, tapping the bell skips the dropdown and routes straight
  // to /notifications — the dropdown's narrow desktop layout doesn't
  // give phone-sized screens enough room to read or act on rows.
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const mq = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener?.('change', update)
    return () => mq.removeEventListener?.('change', update)
  }, [])

  useEffect(() => {
    if (!open) return undefined
    function handleOutside(event) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setOpen(false)
      }
    }
    function handleKey(event) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const preview = items.slice(0, PREVIEW_LIMIT)

  function handleActivate(notification) {
    if (!notification.isRead) {
      markAsRead(notification.id)
    }
    setOpen(false)
  }

  function handleBellClick() {
    if (isMobile) {
      navigate('/notifications')
      return
    }
    setOpen((v) => !v)
  }

  return (
    <div className="relative">
      <Button
        ref={buttonRef}
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleBellClick}
        className={cn(
          'relative rounded-full hover:bg-accent',
          open && 'bg-accent',
        )}
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : 'Notifications'
        }
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Bell className="size-[18px]" strokeWidth={1.75} />
        {unreadCount > 0 ? (
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-accent-indigo-foreground shadow-sm ring-2 ring-background"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </Button>

      <AnimatePresence>
        {open ? (
          <motion.div
            ref={containerRef}
            key="notification-panel"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            role="dialog"
            aria-label="Notifications"
            className="absolute right-0 top-full z-30 mt-2 w-[360px] origin-top-right overflow-hidden rounded-lg border border-line bg-popover/95 shadow-soft-lg backdrop-blur-md"
          >
            <header className="flex items-center justify-between gap-2 border-b border-line px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <p className="text-[13px] font-semibold tracking-tight">
                  Notifications
                </p>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                    isConnected
                      ? 'bg-[color-mix(in_oklch,var(--accent-sage)_14%,transparent)] text-accent-sage'
                      : 'bg-muted text-muted-foreground',
                  )}
                  title={isConnected ? 'Live stream connected' : 'Reconnecting…'}
                >
                  <Radio className="size-2.5" />
                  {isConnected ? 'Live' : 'Off'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors',
                    soundEnabled
                      ? 'text-accent-sage hover:bg-[color-mix(in_oklch,var(--accent-sage)_12%,transparent)]'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                  title={
                    soundEnabled
                      ? 'Sound on — click to mute'
                      : 'Sound off — click to unmute'
                  }
                  aria-pressed={soundEnabled}
                >
                  {soundEnabled ? (
                    <Volume2 className="size-3" />
                  ) : (
                    <VolumeX className="size-3" />
                  )}
                </button>
                {unreadCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => markAllAsRead()}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <CheckCheck className="size-3" />
                    Mark all read
                  </button>
                ) : null}
              </div>
            </header>

            <div className="max-h-[420px] overflow-y-auto p-1.5">
              {isLoading && preview.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                  Loading…
                </p>
              ) : preview.length === 0 ? (
                <div className="flex flex-col items-center gap-1.5 px-3 py-7 text-center">
                  <BellOff className="size-5 text-muted-foreground" />
                  <p className="text-[12.5px] font-medium text-foreground">
                    You're all caught up
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    New activity will appear here in real time.
                  </p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {preview.map((notification) => (
                    <NotificationPreviewRow
                      key={notification.id}
                      notification={notification}
                      onActivate={handleActivate}
                    />
                  ))}
                </div>
              )}
            </div>

            <footer className="border-t border-line bg-muted/40 px-1.5 py-1.5">
              <Link
                to="/notifications"
                onClick={() => setOpen(false)}
                className="inline-flex w-full items-center justify-between rounded-lg px-3 py-2 text-[12.5px] font-semibold text-foreground transition-colors hover:bg-muted"
              >
                See all notifications
                <ChevronRight className="size-3.5" />
              </Link>
            </footer>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
