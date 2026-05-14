import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  BellOff,
  BellRing,
  Check,
  CheckCheck,
  Inbox,
  Plus,
  Radio,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  WifiOff,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/app/empty-state'
import { MentionText } from '@/components/app/mention-text'
import { PageHeader } from '@/components/app/page-header'
import { UserAvatar } from '@/components/app/user-avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useBrowserNotificationPermission } from '@/lib/browser-notifications'
import { useNotificationSoundPreference } from '@/lib/notification-sound'
import { useNotifications } from '@/features/notifications/notifications-context'
import { useAuth } from '@/features/auth/auth-context'
import { cn } from '@/lib/utils'
import { RelativeTime } from '@/components/app/relative-time'
import { getRawUsername } from '@/lib/format'
import {
  NOTIFICATION_CATEGORIES,
  actorDisplayName,
  getNotificationCategoryMeta,
  getNotificationTypeMeta,
  notificationHref,
  pickPrimaryActor,
} from '@/lib/notifications'

const READ_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
]

function aggregateLabel(notification, actor) {
  const count = Number(notification.aggregateCount ?? 1)
  if (!count || count <= 1) return null
  const others = count - 1
  const name = actorDisplayName(actor)
  if (others === 1) return `${name} and 1 other`
  return `${name} and ${others} others`
}

function NotificationRow({ notification, onMarkRead, onDelete }) {
  const meta = getNotificationTypeMeta(notification.type)
  const categoryMeta = getNotificationCategoryMeta(notification.category)
  const actor = pickPrimaryActor(notification)
  const aggregate = aggregateLabel(notification, actor)
  const actorRoute = getRawUsername(actor)
  const actorLink = actorRoute ? `/profile/${actorRoute}` : null
  const unread = !notification.isRead
  const href = notificationHref(notification)
  const isFollowNotif =
    notification.type === 'USER_FOLLOWED' || notification.type === 'NEW_FOLLOWER'

  const name = aggregate ?? (actor ? actorDisplayName(actor) : 'Someone')

  function handleOpen() {
    if (unread) onMarkRead(notification.id)
  }

  const containerClass = cn(
    'group/notif relative flex items-start gap-4 border-b-[0.5px] border-border px-0 py-5 transition-colors',
    'hover:bg-secondary/40',
    unread && 'bg-paper',
  )

  const inner = (
    <>
      {/* Unread dot — left gutter */}
      <div className="flex w-5 shrink-0 justify-center pt-1">
        {unread ? (
          <span
            aria-hidden
            className="size-2 rounded-full bg-ink"
            title="Unread"
          />
        ) : (
          <span className="size-2" />
        )}
      </div>

      {/* Actor avatar */}
      <div className="relative shrink-0">
        <UserAvatar user={actor ?? {}} className="size-10" />
        {notification.aggregateCount > 1 ? (
          <span
            aria-hidden
            className="absolute -bottom-1 -right-1 inline-flex h-[18px] min-w-[20px] items-center justify-center rounded-full pill-info px-1 font-mono text-[10px] tabular-nums ring-2 ring-paper"
            title={`${notification.aggregateCount} contributors`}
          >
            {notification.aggregateCount > 99 ? '99+' : notification.aggregateCount}
          </span>
        ) : null}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 space-y-1.5">
        {/* Actor name bold + verb italic + resource title */}
        <p className="text-[15px] leading-[1.5] text-ink">
          {actorLink ? (
            <Link
              to={actorLink}
              onClick={(e) => e.stopPropagation()}
              className="font-semibold hover:underline"
            >
              {name}
            </Link>
          ) : (
            <span className="font-semibold">{name}</span>
          )}
          {' '}
          <span className="font-display italic text-ink-2">{meta.verb}</span>
          {notification.title && !aggregate ? (
            <>
              {' '}
              <span className="font-semibold">{notification.title.replace(name, '').replace(meta.verb, '').trim()}</span>
            </>
          ) : null}
        </p>

        {/* Quote / snippet — serif italic, indented */}
        {notification.body ? (
          <p className="border-l-2 border-ink-3 pl-3 font-display text-[14px] italic leading-[1.6] text-ink-3">
            <MentionText text={`"${notification.body}"`} />
          </p>
        ) : null}

        {/* Meta — CATEGORY · TIME */}
        <div className="flex flex-wrap items-center gap-x-2 font-mono text-[10.5px] uppercase tracking-wider text-ink-3">
          {notification.category ? (
            <span>{categoryMeta.label}</span>
          ) : null}
          {notification.category ? <span aria-hidden>·</span> : null}
          <RelativeTime value={notification.createdAt} />
        </div>
      </div>

      {/* Right side — follow-back button or mark-read/delete */}
      <div
        className="flex shrink-0 items-center gap-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        {isFollowNotif ? (
          <Link
            to={actorLink ?? '#'}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 rounded-xl border-[0.5px] border-border px-4 py-2.5 text-[13px] font-medium text-ink transition-colors hover:bg-secondary"
          >
            <Plus className="size-3.5" strokeWidth={2} />
            Follow back
          </Link>
        ) : (
          <>
            {unread ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="rounded-md text-ink-3 opacity-0 transition-opacity hover:text-ink group-hover/notif:opacity-100 focus-visible:opacity-100"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onMarkRead(notification.id)
                }}
                title="Mark as read"
                aria-label="Mark as read"
              >
                <Check className="size-3.5" />
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="rounded-md text-ink-3 opacity-0 transition-opacity hover:text-destructive group-hover/notif:opacity-100 focus-visible:opacity-100"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onDelete(notification.id)
              }}
              title="Delete"
              aria-label="Delete notification"
            >
              <X className="size-3.5" />
            </Button>
          </>
        )}
      </div>
    </>
  )

  if (href) {
    return (
      <Link to={href} onClick={handleOpen} className={containerClass}>
        {inner}
      </Link>
    )
  }
  return <div className={containerClass}>{inner}</div>
}

function PushPermissionBanner() {
  const { supported, permission, request } = useBrowserNotificationPermission()
  const [working, setWorking] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  if (!supported || permission === 'granted' || permission === 'denied') return null
  if (dismissed) return null

  async function handleEnable() {
    setWorking(true)
    try {
      await request()
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/30 bg-brand/[0.06] px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-full bg-brand/15 text-brand">
          <BellRing className="size-4" />
        </span>
        <div className="leading-tight">
          <p className="text-[13px] font-semibold">Get notified anywhere</p>
          <p className="text-[12px] text-muted-foreground">
            Allow browser notifications and we'll ping you even when this tab is in the background.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="rounded-full"
          onClick={() => setDismissed(true)}
          disabled={working}
        >
          Not now
        </Button>
        <Button
          type="button"
          size="sm"
          className="rounded-full"
          onClick={handleEnable}
          disabled={working}
        >
          Enable
        </Button>
      </div>
    </div>
  )
}

const ALL_TAB = { value: 'ALL', label: 'All', icon: Inbox }
const MENTIONS_TAB = { value: 'MENTIONS', label: 'Mentions' }

function SoundToggle() {
  const [enabled, setEnabled] = useNotificationSoundPreference()
  const Icon = enabled ? Volume2 : VolumeX
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(
        'gap-1.5 rounded-full',
        enabled
          ? 'border-[color-mix(in_oklch,var(--accent-sage)_36%,transparent)] bg-[color-mix(in_oklch,var(--accent-sage)_12%,transparent)] text-accent-sage'
          : 'text-muted-foreground',
      )}
      onClick={() => setEnabled(!enabled)}
      title={enabled ? 'Sound on — click to mute' : 'Sound off — click to unmute'}
      aria-pressed={enabled}
    >
      <Icon className="size-4" />
      {/* Label hides on phones so the action row fits — the icon plus
          aria-pressed still carries the state. Title attribute also
          covers screen-readers + hover tooltips. */}
      <span className="hidden sm:inline">{enabled ? 'Sound on' : 'Muted'}</span>
    </Button>
  )
}

export function NotificationsPage() {
  const { isAuthenticated } = useAuth()
  const {
    items,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    markCategoryAsRead,
    removeNotification,
    purgeReadNotifications,
  } = useNotifications()
  const [category, setCategory] = useState('ALL')

  const counts = useMemo(() => {
    const all = items.length
    const unread = items.filter((item) => !item.isRead).length
    const byCategory = NOTIFICATION_CATEGORIES.reduce((accumulator, entry) => {
      accumulator[entry.value] = items.filter(
        (item) => item.category === entry.value,
      ).length
      return accumulator
    }, {})
    const mentions = items.filter((item) => item.type === 'USER_MENTIONED').length
    return { all, unread, byCategory, mentions }
  }, [items])

  const visible = useMemo(() => {
    let list = items
    if (category === 'MENTIONS') {
      list = list.filter((item) => item.type === 'USER_MENTIONED')
    } else if (category !== 'ALL') {
      list = list.filter((item) => item.category === category)
    }
    return list
  }, [items, category])

  const activeMeta = useMemo(() => {
    if (category === 'ALL') return ALL_TAB
    if (category === 'MENTIONS') return MENTIONS_TAB
    return getNotificationCategoryMeta(category)
  }, [category])

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

  function handleClearCategory() {
    if (category === 'ALL' || category === 'MENTIONS') {
      markAllAsRead()
      return
    }
    markCategoryAsRead(category)
  }

  return (
    <div className="space-y-0">
      {/* ── Page header ───────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 pb-6">
        <h1 className="font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.016em] text-ink sm:text-[32px]">
          Notifications
        </h1>
        {unreadCount > 0 ? (
          <span className="inline-flex items-center rounded-full bg-ink px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-paper">
            {unreadCount} New
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          <SoundToggle />
          <button
            type="button"
            onClick={handleClearCategory}
            disabled={unreadCount === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border-[0.5px] border-border px-4 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-secondary disabled:opacity-40"
          >
            <Check className="size-3.5" strokeWidth={2} />
            Mark all read
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-xl border-[0.5px] border-border px-3 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-secondary disabled:opacity-40"
                disabled={items.length === 0}
              >
                <Sparkles className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onSelect={purgeReadNotifications} className="text-destructive focus:text-destructive" disabled={items.every((i) => !i.isRead)}>
                <Trash2 className="mr-2 size-4" />
                Delete all read
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <PushPermissionBanner />

      {/* ── Category tabs — flat underline ────────────────────── */}
      <div className="scrollbar-none flex flex-nowrap items-end overflow-x-auto border-b-[0.5px] border-border">
        <InboxTab
          label={ALL_TAB.label}
          count={counts.all}
          active={category === 'ALL'}
          onSelect={() => setCategory('ALL')}
        />
        {NOTIFICATION_CATEGORIES.map((entry) => (
          <InboxTab
            key={entry.value}
            label={entry.label}
            count={counts.byCategory[entry.value] ?? 0}
            active={category === entry.value}
            onSelect={() => setCategory(entry.value)}
          />
        ))}
        <InboxTab
          label={MENTIONS_TAB.label}
          count={counts.mentions}
          active={category === 'MENTIONS'}
          onSelect={() => setCategory('MENTIONS')}
        />
      </div>

      {/* ── Notifications list — flat rows ────────────────────── */}
      <div className="pt-2">
        {isLoading && items.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={BellOff}
            title={`Nothing in ${activeMeta.label}`}
            description={
              category === 'MENTIONS'
                ? "Tag colleagues with @username and mentions land here when someone tags you back."
                : 'When activity matching this category arrives, it will show up here in real time.'
            }
          />
        ) : (
          <AnimatePresence initial={false}>
            {visible.map((notification) => (
              <motion.div
                key={notification.id}
                layout="position"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                className="last:[&>div]:border-b-0 last:[&>a]:border-b-0"
              >
                <NotificationRow
                  notification={notification}
                  onMarkRead={markAsRead}
                  onDelete={removeNotification}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}

function InboxTab({ label, count, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'relative shrink-0 whitespace-nowrap pb-3 pr-5 text-[14px] font-medium transition-colors',
        active ? 'text-ink' : 'text-ink-3 hover:text-ink',
      )}
      aria-pressed={active}
    >
      {label}
      {count > 0 ? (
        <span className="ml-1.5 font-mono text-[10px] text-ink-4">
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
      {active ? (
        <span className="absolute bottom-0 left-0 h-[2px] w-[calc(100%-1.25rem)] rounded-full bg-ink" />
      ) : null}
    </button>
  )
}

