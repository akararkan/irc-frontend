import { motion } from 'motion/react'
import {
  Bell,
  BookOpenText,
  Clapperboard,
  Home,
  User2,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'

import { UserAvatar } from '@/components/app/user-avatar'
import { useAuth } from '@/features/auth/auth-context'
import { useNotifications } from '@/features/notifications/notifications-context'
import { cn } from '@/lib/utils'

// The five primary destinations for mobile, picked to mirror the
// platforms users already know:
//   - Home (unified Posts + Research + Q&A feed)
//   - Research (publications hub)
//   - Reels (vertical video)
//   - Notifications (with live unread badge)
//   - Me (own profile, or Sign in when guest)
//
// The hamburger menu in the topbar still surfaces secondary items
// (Q&A, People, My research, Saved, Settings) via the existing Sheet
// — keeps the bottom bar focused.
const TABS = [
  { to: '/', icon: Home, label: 'Home', end: true },
  { to: '/research', icon: BookOpenText, label: 'Research' },
  { to: '/reels', icon: Clapperboard, label: 'Reels' },
  { to: '/notifications', icon: Bell, label: 'Alerts', badge: 'notifications' },
  { kind: 'me' },
]

function NotificationBadge() {
  const { unreadCount } = useNotifications()
  if (!unreadCount) return null
  return (
    <span
      aria-hidden
      className="absolute -right-1 -top-1 inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-fg px-1 text-[9.5px] font-bold text-background ring-2 ring-background"
    >
      {unreadCount > 99 ? '99+' : unreadCount}
    </span>
  )
}

function MeTab() {
  const { user, isAuthenticated } = useAuth()
  const to = isAuthenticated && user?.username
    ? `/profile/${user.username}`
    : '/login'
  const label = isAuthenticated ? 'Me' : 'Sign in'

  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        cn(
          'group relative flex flex-1 flex-col items-center justify-center gap-1 px-2 py-1.5 transition-colors',
          isActive
            ? 'text-accent-indigo'
            : 'text-muted-foreground hover:text-foreground',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isAuthenticated && user ? (
            <span className="relative">
              <UserAvatar
                user={user}
                className={cn(
                  'size-6 ring-1 transition-all',
                  isActive ? 'ring-brand ring-2' : 'ring-border',
                )}
              />
            </span>
          ) : (
            <User2
              className="size-[22px]"
              strokeWidth={isActive ? 2.2 : 1.7}
            />
          )}
          <span
            className={cn(
              'text-[10.5px] font-medium tracking-tight',
              isActive ? 'font-semibold' : '',
            )}
          >
            {label}
          </span>
          {isActive ? (
            <motion.span
              layoutId="bottomTabIndicator"
              className="absolute -top-px h-[2px] w-8 rounded-full bg-brand"
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            />
          ) : null}
        </>
      )}
    </NavLink>
  )
}

function NavTab({ to, end, Icon, label, badge }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'group relative flex flex-1 flex-col items-center justify-center gap-1 px-2 py-1.5 transition-colors',
          isActive
            ? 'text-accent-indigo'
            : 'text-muted-foreground hover:text-foreground',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span className="relative">
            <Icon
              className="size-[22px]"
              strokeWidth={isActive ? 2.2 : 1.7}
            />
            {badge === 'notifications' ? <NotificationBadge /> : null}
          </span>
          <span
            className={cn(
              'text-[10.5px] tracking-tight',
              isActive ? 'font-semibold' : 'font-medium',
            )}
          >
            {label}
          </span>
          {isActive ? (
            <motion.span
              layoutId="bottomTabIndicator"
              className="absolute -top-px h-[2px] w-8 rounded-full bg-brand"
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            />
          ) : null}
        </>
      )}
    </NavLink>
  )
}

/**
 * Mobile-only bottom tab bar. Hidden on `lg` and up — the desktop
 * sidebar covers those breakpoints.
 *
 * The wrapper uses `env(safe-area-inset-bottom)` so it doesn't sit
 * under the iOS home indicator. Pages don't need extra padding because
 * `app-layout.jsx` adds a matching `pb-20 lg:pb-0` to the `<main>`.
 */
export function MobileBottomTabs() {
  return (
    <nav
      aria-label="Primary"
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 lg:hidden',
        'border-t border-line bg-background/95 backdrop-blur-md',
        'pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_12px_rgba(0,0,0,0.04)]',
      )}
    >
      <div className="flex items-stretch">
        {TABS.map((tab, index) => {
          if (tab.kind === 'me') {
            return <MeTab key="me" />
          }
          return (
            <NavTab
              key={tab.to ?? index}
              to={tab.to}
              end={tab.end}
              Icon={tab.icon}
              label={tab.label}
              badge={tab.badge}
            />
          )
        })}
      </div>
    </nav>
  )
}
