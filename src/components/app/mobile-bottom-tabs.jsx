import { motion } from 'motion/react'
import { Bell, BookOpenText, Clapperboard, Home, User2 } from 'lucide-react'
import { NavLink } from 'react-router-dom'

import { UserAvatar } from '@/components/app/user-avatar'
import { useAuth } from '@/features/auth/auth-context'
import { useNotifications } from '@/features/notifications/notifications-context'
import { cn } from '@/lib/utils'

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
      className="absolute -right-1.5 -top-1.5 inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-warn px-1 text-[9.5px] font-extrabold text-[#3A2C0C] ring-2 ring-background"
    >
      {unreadCount > 99 ? '99+' : unreadCount}
    </span>
  )
}

function MeTab() {
  const { user, isAuthenticated } = useAuth()
  const to = isAuthenticated && user?.username ? `/profile/${user.username}` : '/login'
  const label = isAuthenticated ? 'Me' : 'Sign in'

  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        cn(
          'group relative flex flex-1 flex-col items-center justify-center gap-1 px-2 py-2 transition-colors',
          isActive ? 'text-brand' : 'text-fg-muted hover:text-fg',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isAuthenticated && user ? (
            <span className="relative">
              <UserAvatar
                user={user}
                className={cn('size-7 ring-2 transition-all', isActive ? 'ring-brand' : 'ring-line')}
              />
            </span>
          ) : (
            <User2 className="size-[23px]" strokeWidth={isActive ? 2.3 : 1.8} />
          )}
          <span className={cn('text-[10.5px] tracking-tight', isActive ? 'font-extrabold' : 'font-bold')}>
            {label}
          </span>
          {isActive ? (
            <motion.span
              layoutId="bottomTabIndicator"
              className="absolute top-0 h-[3px] w-9 rounded-full bg-[linear-gradient(90deg,var(--warn),var(--accent-indigo))]"
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
          'group relative flex flex-1 flex-col items-center justify-center gap-1 px-2 py-2 transition-colors',
          isActive ? 'text-brand' : 'text-fg-muted hover:text-fg',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span className="relative">
            <Icon className="size-[23px]" strokeWidth={isActive ? 2.3 : 1.8} />
            {badge === 'notifications' ? <NotificationBadge /> : null}
          </span>
          <span className={cn('text-[10.5px] tracking-tight', isActive ? 'font-extrabold' : 'font-bold')}>
            {label}
          </span>
          {isActive ? (
            <motion.span
              layoutId="bottomTabIndicator"
              className="absolute top-0 h-[3px] w-9 rounded-full bg-[linear-gradient(90deg,var(--warn),var(--accent-indigo))]"
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            />
          ) : null}
        </>
      )}
    </NavLink>
  )
}

export function MobileBottomTabs() {
  return (
    <nav
      aria-label="Primary"
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 lg:hidden',
        'border-t border-line glass-panel',
        'pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_18px_-6px_rgba(12,31,26,0.12)]',
      )}
    >
      <div className="flex items-stretch">
        {TABS.map((tab, index) => {
          if (tab.kind === 'me') return <MeTab key="me" />
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
