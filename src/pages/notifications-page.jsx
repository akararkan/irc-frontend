import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  BellOff,
  BellRing,
  Check,
  CheckCheck,
  Inbox,
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
import { getHandle, getRawUsername } from '@/lib/format'
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
  const Icon = meta.icon
  const actor = pickPrimaryActor(notification)
  const aggregate = aggregateLabel(notification, actor)
  const actorRoute = getRawUsername(actor)
  const actorHandle = getHandle(actor)
  const actorLink = actorRoute ? `/profile/${actorRoute}` : null
  const unread = !notification.isRead
  const href = notificationHref(notification)

  function handleOpen() {
    if (unread) onMarkRead(notification.id)
  }

  // Spec §10 — Notifications. Flat row, hairline-divided, unread dot
  // floating in the left gutter, snippet in serif italic, actions inline.
  const containerClass = cn(
    'group/notif relative flex items-start gap-3 py-3.5 pl-5 pr-2 transition-colors border-b-[0.5px] border-border',
    'hover:bg-secondary/60',
  )

  const inner = (
    <>
      {/* Unread dot — gutter left, info-blue (spec) */}
      {unread ? (
        <span
          aria-hidden
          className="absolute left-1.5 top-[26px] size-[6px] rounded-full"
          style={{ background: 'var(--info-fg)' }}
          title="Unread"
        />
      ) : null}

      {/* Actor avatar (with optional aggregate badge) */}
      <div className="relative shrink-0">
        {actor ? (
          <UserAvatar user={actor} className="size-[34px]" />
        ) : (
          <div className="grid size-[34px] place-items-center rounded-full pill-mute text-[11px] font-medium">
            {(notification.type ?? 'N').slice(0, 1)}
          </div>
        )}
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

      <div className="min-w-0 flex-1">
        {/* Bold actor + verb composed by the meta map */}
        <p
          className={cn(
            'text-[13px] leading-[1.5] text-ink-2',
          )}
        >
          {aggregate ? (
            <b className="font-medium text-ink">{aggregate}</b>
          ) : notification.title ? (
            <b className="font-medium text-ink">{notification.title}</b>
          ) : null}
        </p>

        {/* Snippet in serif italic — spec's "quoted content" treatment */}
        {notification.body ? (
          <p className="mt-1 font-display text-[12px] italic leading-[1.55] text-ink-3">
            <MentionText text={notification.body} />
          </p>
        ) : null}

        <div className="mt-1.5 flex items-center gap-2 font-mono text-[10px] text-ink-4">
          <RelativeTime value={notification.createdAt} />
          {actorLink && actorHandle ? (
            <>
              <span aria-hidden>·</span>
              <Link
                to={actorLink}
                onClick={(event) => event.stopPropagation()}
                className="hover:text-ink"
              >
                @{actorHandle}
              </Link>
            </>
          ) : null}
          {notification.category ? (
            <>
              <span aria-hidden>·</span>
              <span className="uppercase tracking-[0.12em]">
                {categoryMeta.label}
              </span>
            </>
          ) : null}
        </div>
      </div>

      {/* Inline actions */}
      <div
        className="flex shrink-0 items-center gap-1"
        onClick={(event) => event.stopPropagation()}
      >
        <span
          aria-hidden
          className={cn(
            'mr-1 hidden size-[22px] place-items-center rounded-full opacity-70 sm:grid',
            meta.accent,
          )}
          title={meta.verb}
        >
          <Icon className="size-3" strokeWidth={1.6} />
        </span>
        {unread ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="rounded-md text-ink-3 hover:text-ink"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
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
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onDelete(notification.id)
          }}
          title="Delete notification"
          aria-label="Delete notification"
        >
          <X className="size-3.5" />
        </Button>
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
      {enabled ? 'Sound on' : 'Muted'}
    </Button>
  )
}

export function NotificationsPage() {
  const { isAuthenticated } = useAuth()
  const {
    items,
    unreadCount,
    isConnected,
    isLoading,
    markAsRead,
    markAllAsRead,
    markCategoryAsRead,
    removeNotification,
    purgeReadNotifications,
  } = useNotifications()
  const [category, setCategory] = useState('ALL')
  const [readFilter, setReadFilter] = useState('all')

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
    if (readFilter === 'unread') {
      list = list.filter((item) => !item.isRead)
    }
    return list
  }, [items, category, readFilter])

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
    <div className="space-y-6">
      <PageHeader
        eyebrow="Notifications"
        title="Your activity"
        description="Follower activity, reactions, replies, and system messages — streamed in real time, coalesced when noisy."
        action={
          <>
            <Badge
              variant="outline"
              className={cn(
                'gap-1.5 text-xs',
                isConnected
                  ? 'border-[color-mix(in_oklch,var(--accent-sage)_36%,transparent)] bg-[color-mix(in_oklch,var(--accent-sage)_12%,transparent)] text-accent-sage'
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
            <SoundToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  disabled={items.length === 0}
                >
                  <Sparkles className="size-4" />
                  Manage
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  onSelect={handleClearCategory}
                  disabled={unreadCount === 0}
                >
                  <CheckCheck className="mr-2 size-4" />
                  {category === 'ALL' || category === 'MENTIONS'
                    ? 'Mark all read'
                    : `Mark ${activeMeta.label} read`}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={purgeReadNotifications}
                  className="text-destructive focus:text-destructive"
                  disabled={
                    items.length === 0 ||
                    items.every((item) => !item.isRead)
                  }
                >
                  <Trash2 className="mr-2 size-4" />
                  Delete all read
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <PushPermissionBanner />

      {/* Inbox tabs — spec's flat pill row inside a soft container */}
      <div className="flex flex-wrap items-center gap-1 overflow-x-auto rounded-md bg-secondary p-1.5">
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

      {/* Read-state secondary filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 rounded-full border border-border bg-card p-1">
          {READ_FILTERS.map((option) => {
            const active = readFilter === option.value
            const count =
              option.value === 'unread'
                ? visibleCountFor(items, category, true)
                : visibleCountFor(items, category, false)
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setReadFilter(option.value)}
                className={cn(
                  'relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-colors',
                  active
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                aria-pressed={active}
              >
                {active ? (
                  <motion.span
                    layoutId="notificationReadFilterPill"
                    className="absolute inset-0 rounded-full bg-muted"
                    transition={{ type: 'spring', stiffness: 360, damping: 30 }}
                  />
                ) : null}
                <span className="relative">{option.label}</span>
                {count > 0 ? (
                  <span
                    className={cn(
                      'relative rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                      active
                        ? 'bg-foreground text-background'
                        : 'bg-muted-foreground/15 text-muted-foreground',
                    )}
                  >
                    {count > 99 ? '99+' : count}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>

      {isLoading && items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title={
            readFilter === 'unread'
              ? `No unread ${category === 'ALL' ? 'notifications' : activeMeta.label.toLowerCase()}`
              : `Nothing in ${activeMeta.label}`
          }
          description={
            readFilter === 'unread'
              ? 'Everything is read. New activity will surface here in real time.'
              : category === 'MENTIONS'
                ? "Tag colleagues with @username and mentions land here when someone tags you back."
                : 'When activity matching this category arrives, it will show up here.'
          }
        />
      ) : (
        <div className="rounded-xl border-[0.5px] border-border bg-paper">
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
        </div>
      )}
    </div>
  )
}

function InboxTab({ label, count, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-[5px] px-3 py-1.5 text-[12px] font-medium transition-colors whitespace-nowrap',
        active
          ? 'bg-paper text-ink shadow-[0_0_0_0.5px_var(--border)]'
          : 'text-ink-3 hover:text-ink',
      )}
      aria-pressed={active}
    >
      <span>{label}</span>
      {count > 0 ? (
        <span className="font-mono text-[10px] tabular-nums text-ink-4">
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </button>
  )
}

// Count of items that match the current category tab + a read-state filter.
// Used to drive the read-state pill counters so they only ever reflect the
// rows the user is currently looking at.
function visibleCountFor(items, category, unreadOnly) {
  return items.reduce((total, item) => {
    if (category === 'MENTIONS' && item.type !== 'USER_MENTIONED') return total
    if (
      category !== 'ALL' &&
      category !== 'MENTIONS' &&
      item.category !== category
    ) {
      return total
    }
    if (unreadOnly && item.isRead) return total
    return total + 1
  }, 0)
}
