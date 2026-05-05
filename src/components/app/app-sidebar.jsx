import {
  Bell,
  BookMarked,
  BookOpenText,
  Clapperboard,
  Compass,
  LogOut,
  MessageCircleQuestion,
  Settings,
  Sparkles,
  User2,
  Users,
} from 'lucide-react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { BrandMark, BrandWordmark } from '@/components/app/brand-mark'
import { ResearchComposerButton } from '@/components/app/research-composer'
import { RoleBadge } from '@/components/app/role-badge'
import { canPublishResearch } from '@/lib/roles'
import { UserAvatar } from '@/components/app/user-avatar'
import { useAuth } from '@/features/auth/auth-context'
import { useNotifications } from '@/features/notifications/notifications-context'
import { cn } from '@/lib/utils'
import { getFullName } from '@/lib/format'

// ─── Navigation groups (Linear/Vercel-style sections) ─────────────
const PRIMARY_ITEMS = [
  { to: '/', icon: Sparkles, label: 'Community', end: true },
  { to: '/explore', icon: Compass, label: 'Explore' },
  { to: '/research', icon: BookOpenText, label: 'Research' },
  { to: '/questions', icon: MessageCircleQuestion, label: 'Q & A' },
  { to: '/reels', icon: Clapperboard, label: 'Reels' },
]

const SOCIAL_ITEMS = [
  { to: '/people', icon: Users, label: 'People' },
  { to: '/notifications', icon: Bell, label: 'Notifications', badge: 'notifications' },
]

function SectionLabel({ children }) {
  return (
    <p className="px-3 pb-1.5 pt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-4">
      {children}
    </p>
  )
}

function NavItem({ item, onNavigate }) {
  const Icon = item.icon
  const { unreadCount } = useNotifications()
  const count = item.badge === 'notifications' ? unreadCount : 0

  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-2.5 rounded-lg px-2.5 py-1.5',
          'text-[13.5px] transition-colors',
          isActive
            ? 'bg-brand/10 font-semibold text-brand'
            : 'text-ink-2 hover:bg-brand/[0.07] hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            aria-hidden
            className={cn(
              'absolute left-0 top-1/2 h-[18px] w-[2.5px] -translate-y-1/2 rounded-full bg-brand transition-opacity',
              isActive ? 'opacity-100' : 'opacity-0',
            )}
          />
          <Icon
            className="size-[17px] shrink-0 transition-colors"
            strokeWidth={isActive ? 2.1 : 1.7}
          />
          <span className="flex-1 truncate">{item.label}</span>
          {count > 0 ? (
            <span className="ml-auto inline-flex h-[18px] min-w-[20px] items-center justify-center rounded-full bg-brand px-1.5 font-mono text-[10px] font-bold leading-none text-brand-foreground tabular-nums">
              {count > 99 ? '99+' : count}
            </span>
          ) : null}
        </>
      )}
    </NavLink>
  )
}

export function AppSidebar({ onNavigate }) {
  const { user, isAuthenticated, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true, state: { from: location } })
    onNavigate?.()
  }

  const profileHref = user?.username ? `/profile/${user.username}` : null

  return (
    <aside className="flex h-full w-full flex-col bg-sidebar text-sidebar-foreground">
      {/* ── Brand ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-5 pb-4 pt-5">
        <Link
          to="/"
          onClick={onNavigate}
          className="flex min-w-0 items-center gap-2.5"
        >
          <BrandMark />
          <div className="min-w-0 leading-tight">
            <p className="truncate">
              <BrandWordmark size="sm" />
            </p>
            <p className="truncate text-[10.5px] text-ink-3">
              Islamic Research Center
            </p>
          </div>
        </Link>
      </div>

      {/* Hairline accent under brand */}
      <span
        aria-hidden
        className="mx-5 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent, color-mix(in oklch, var(--brand) 30%, transparent), transparent)',
        }}
      />

      {/* ── Nav ───────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-2">
        <SectionLabel>Discover</SectionLabel>
        <div className="space-y-0.5">
          {PRIMARY_ITEMS.map((item) => (
            <NavItem key={item.to} item={item} onNavigate={onNavigate} />
          ))}
        </div>

        <SectionLabel>Social</SectionLabel>
        <div className="space-y-0.5">
          {SOCIAL_ITEMS.map((item) => (
            <NavItem key={item.to} item={item} onNavigate={onNavigate} />
          ))}
        </div>

        {isAuthenticated ? (
          <>
            <SectionLabel>Workspace</SectionLabel>
            <div className="space-y-0.5">
              {profileHref ? (
                <NavItem
                  item={{ to: profileHref, icon: User2, label: 'Profile' }}
                  onNavigate={onNavigate}
                />
              ) : null}
              {canPublishResearch(user) ? (
                <NavItem
                  item={{ to: '/my-research', icon: BookMarked, label: 'My research' }}
                  onNavigate={onNavigate}
                />
              ) : null}
              <NavItem
                item={{ to: '/settings', icon: Settings, label: 'Settings' }}
                onNavigate={onNavigate}
              />
            </div>
          </>
        ) : null}

        {canPublishResearch(user) ? (
          <div className="px-1 pb-1 pt-4">
            <ResearchComposerButton
              className={cn(
                'w-full justify-center gap-2',
                'bg-gradient-to-br from-brand to-brand/85 text-brand-foreground',
                'shadow-soft hover:from-brand hover:to-brand/90',
                'transition-transform hover:-translate-y-px',
              )}
            />
          </div>
        ) : null}
      </nav>

      {/* ── Footer / account ─────────────────────────────── */}
      <div className="border-t border-sidebar-border p-2.5">
        {isAuthenticated && user ? (
          <div className="group/account flex items-center gap-2.5 rounded-xl border border-border bg-paper px-2.5 py-2 transition-colors hover:bg-brand/5">
            <Link
              to={profileHref ?? '#'}
              onClick={onNavigate}
              className="flex min-w-0 flex-1 items-center gap-2.5"
              title="View profile"
            >
              <UserAvatar
                user={user}
                className="size-9 shrink-0 ring-2 ring-paper transition-transform group-hover/account:scale-105"
              />
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-[13px] font-semibold text-ink">
                  {getFullName(user)}
                </p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <p className="truncate text-[11px] text-ink-3">
                    {user.username}
                  </p>
                  {user.role ? (
                    <RoleBadge role={user.role} size="xs" showIcon={false} />
                  ) : null}
                </div>
              </div>
            </Link>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="rounded-lg text-ink-3 hover:text-ink"
              onClick={handleSignOut}
              title="Sign out"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        ) : (
          <div className="grid gap-2 px-1">
            <Button
              asChild
              size="lg"
              className={cn(
                'w-full bg-gradient-to-br from-brand to-brand/85 text-brand-foreground',
                'shadow-soft hover:from-brand hover:to-brand/90',
              )}
            >
              <Link to="/login" onClick={onNavigate}>
                Sign in
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full" size="lg">
              <Link to="/signup" onClick={onNavigate}>
                Create account
              </Link>
            </Button>
          </div>
        )}
      </div>
    </aside>
  )
}
