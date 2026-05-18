import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  BellOff,
  BellRing,
  Check,
  MoreHorizontal,
  Plus,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/app/empty-state'
import { MentionText } from '@/components/app/mention-text'
import { UserAvatar } from '@/components/app/user-avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  actorDisplayName,
  getNotificationCategoryMeta,
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

/* ── Notification row ────────────────────────────────────────── */
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
    'group/notif relative flex items-start gap-3 border-b border-border px-0 py-4 transition-colors sm:gap-4 sm:py-5',
    'hover:bg-secondary/30',
    unread && 'bg-paper',
  )

  const inner = (
    <>
      {/* Unread dot */}
      <div className="flex w-4 shrink-0 justify-center pt-1.5">
        {unread ? (
          <span
            aria-hidden
            className="size-2 rounded-full bg-brand"
            title="Unread"
          />
        ) : (
          <span className="size-2" />
        )}
      </div>

      {/* Actor avatar */}
      <div className="relative shrink-0">
        <UserAvatar user={actor ?? {}} className="size-9 rounded-full sm:size-10" />
        {notification.aggregateCount > 1 ? (
          <span
            aria-hidden
            className="absolute -bottom-1 -right-1 inline-flex h-[18px] min-w-[20px] items-center justify-center rounded-full bg-brand px-1 font-mono text-[10px] font-semibold tabular-nums text-brand-foreground ring-2 ring-paper"
            title={`${notification.aggregateCount} contributors`}
          >
            {notification.aggregateCount > 99 ? '99+' : notification.aggregateCount}
          </span>
        ) : null}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-[14px] leading-[1.5] text-ink sm:text-[15px]">
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
              <span className="font-semibold">
                {notification.title.replace(name, '').replace(meta.verb, '').trim()}
              </span>
            </>
          ) : null}
        </p>

        {/* Body quote */}
        {notification.body ? (
          <p className="border-l-2 border-brand pl-3 font-display text-[13.5px] italic leading-[1.6] text-ink-3">
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

      {/* Right side */}
      <div
        className="flex shrink-0 items-center gap-1.5 self-center"
        onClick={(e) => e.stopPropagation()}
      >
        {isFollowNotif ? (
          <Link
            to={actorLink ?? '#'}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-paper px-3 py-2 text-[12.5px] font-medium text-brand transition-colors hover:border-brand/40 hover:bg-brand-soft/50 sm:px-4 sm:py-2.5 sm:text-[13px]"
          >
            <Plus className="size-3.5" strokeWidth={2} />
            <span>Follow back</span>
          </Link>
        ) : (
          <button
            type="button"
            className="rounded-full p-1.5 text-ink-3 opacity-0 transition-colors hover:text-destructive group-hover/notif:opacity-100 focus-visible:opacity-100"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onDelete(notification.id)
            }}
            title="Delete"
            aria-label="Delete notification"
          >
            <X className="size-3.5" />
          </button>
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

/* ── Push permission banner ──────────────────────────────────── */
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
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/25 bg-[#EFF6FF] px-4 py-3.5">
      <div className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-full bg-brand/15 text-brand">
          <BellRing className="size-4" strokeWidth={1.8} />
        </span>
        <div className="leading-tight">
          <p className="text-[13.5px] font-semibold text-ink">Get notified anywhere</p>
          <p className="mt-0.5 text-[12px] text-brand">
            Allow browser notifications even when this tab is in the background.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded-lg px-3 py-1.5 text-[12.5px] font-medium text-ink-3 transition-colors hover:bg-brand/10 hover:text-ink"
          onClick={() => setDismissed(true)}
          disabled={working}
        >
          Not now
        </button>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-4 text-[13px] font-semibold text-brand-foreground transition-colors hover:bg-brand/90 disabled:opacity-60"
          onClick={handleEnable}
          disabled={working}
        >
          Enable
        </button>
      </div>
    </div>
  )
}

/* ── Sound toggle ────────────────────────────────────────────── */
function SoundToggle() {
  const [enabled, setEnabled] = useNotificationSoundPreference()
  const Icon = enabled ? Volume2 : VolumeX
  return (
    <button
      type="button"
      onClick={() => setEnabled(!enabled)}
      title={enabled ? 'Sound on — click to mute' : 'Sound off — click to unmute'}
      aria-pressed={enabled}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[12.5px] font-medium transition-colors',
        enabled
          ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
          : 'border-border text-ink-2 hover:border-brand/40 hover:text-ink',
      )}
    >
      <Icon className="size-[15px]" strokeWidth={1.8} />
      <span className="hidden sm:inline">{enabled ? 'Sound on' : 'Muted'}</span>
    </button>
  )
}

/* ── Underlined tab ──────────────────────────────────────────── */
function InboxTab({ label, count, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'relative shrink-0 whitespace-nowrap pb-3 pr-6 text-[14px] font-medium transition-colors',
        active ? 'text-brand' : 'text-ink-3 hover:text-ink',
      )}
      aria-pressed={active}
    >
      {label}
      {count > 0 ? (
        <span className="ml-1.5 font-mono text-[10.5px] tabular-nums text-ink-4">
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
      {active ? (
        <motion.span
          layoutId="notif-tab-underline"
          className="absolute bottom-0 left-0 h-[2px] w-[calc(100%-1.5rem)] rounded-full bg-brand"
          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        />
      ) : null}
    </button>
  )
}

/* ─── NotificationsPage ──────────────────────────────────────── */
export function NotificationsPage() {
  const { isAuthenticated } = useAuth()
  const {
    items,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    removeNotification,
    purgeReadNotifications,
  } = useNotifications()
  const [category, setCategory] = useState('ALL')

  const counts = useMemo(() => {
    const all = items.length
    const mentions = items.filter((item) => item.type === 'USER_MENTIONED').length
    const follows = items.filter(
      (item) => item.type === 'USER_FOLLOWED' || item.type === 'NEW_FOLLOWER',
    ).length
    return { all, mentions, follows }
  }, [items])

  const visible = useMemo(() => {
    if (category === 'MENTIONS') return items.filter((item) => item.type === 'USER_MENTIONED')
    if (category === 'FOLLOWS')
      return items.filter(
        (item) => item.type === 'USER_FOLLOWED' || item.type === 'NEW_FOLLOWER',
      )
    return items
  }, [items, category])

  const activeCategoryLabel =
    category === 'MENTIONS' ? 'Mentions' : category === 'FOLLOWS' ? 'Follows' : 'All'

  if (!isAuthenticated) {
    return (
      <div className="space-y-6">
        <EmptyState
          icon={BellOff}
          title="Sign in to view notifications"
          description="Your follower activity, reactions, comments, and system messages appear here in real time."
          action={
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm" className="rounded-full">
                <Link to="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm" className="rounded-full bg-brand text-brand-foreground hover:bg-brand/90">
                <Link to="/signup">Create account</Link>
              </Button>
            </div>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3 pb-5 sm:pb-6">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
          <h1 className="font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.018em] text-ink sm:text-[32px]">
            Notifications
          </h1>
          {unreadCount > 0 ? (
            <span className="inline-flex shrink-0 items-center rounded-full bg-brand px-2.5 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-wider text-brand-foreground sm:px-3">
              {unreadCount} New
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <SoundToggle />
          <button
            type="button"
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-paper px-3 text-[12.5px] font-medium text-ink-2 transition-colors hover:border-brand/40 hover:bg-secondary hover:text-ink disabled:opacity-40 sm:px-4"
            title="Mark all read"
          >
            <Check className="size-3.5" strokeWidth={2} />
            <span className="hidden sm:inline">Mark all read</span>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-paper px-2.5 text-[13px] font-medium text-ink-2 transition-colors hover:bg-secondary disabled:opacity-40"
                disabled={items.length === 0}
                title="More options"
              >
                <MoreHorizontal className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-xl">
              <DropdownMenuItem
                onSelect={purgeReadNotifications}
                className="text-destructive focus:text-destructive"
                disabled={items.every((i) => !i.isRead)}
              >
                <Trash2 className="mr-2 size-4" />
                Delete all read
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <PushPermissionBanner />

      {/* ── Tabs ────────────────────────────────────────────── */}
      <div className="mt-5 flex items-end border-b border-border">
        <InboxTab
          label="All"
          count={counts.all}
          active={category === 'ALL'}
          onSelect={() => setCategory('ALL')}
        />
        <InboxTab
          label="Mentions"
          count={counts.mentions}
          active={category === 'MENTIONS'}
          onSelect={() => setCategory('MENTIONS')}
        />
        <InboxTab
          label="Follows"
          count={counts.follows}
          active={category === 'FOLLOWS'}
          onSelect={() => setCategory('FOLLOWS')}
        />
      </div>

      {/* ── List ────────────────────────────────────────────── */}
      <div className="pt-1">
        {isLoading && items.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-ink-3">Loading…</p>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={BellOff}
            title={`Nothing in ${activeCategoryLabel}`}
            description={
              category === 'MENTIONS'
                ? 'Tag colleagues with @username and mentions land here when someone tags you back.'
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
