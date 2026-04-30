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
import { BrandWordmark } from '@/components/app/brand-mark'
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
    <p className="px-3 pb-1.5 pt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80">
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
          'group relative flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13.5px] transition-colors',
          isActive
            ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground'
            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/55 hover:text-sidebar-foreground',
        )
      }
    >
      {({ isActive }) => (
        <>
          {/* Active indicator — a subtle inset accent bar on the left */}
          <span
            aria-hidden
            className={cn(
              'absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-sidebar-primary transition-opacity',
              isActive ? 'opacity-100' : 'opacity-0',
            )}
          />
          <Icon
            className={cn(
              'size-[17px] shrink-0 transition-colors',
              isActive ? 'text-sidebar-primary' : 'text-current',
            )}
            strokeWidth={isActive ? 2.1 : 1.7}
          />
          <span className="flex-1 truncate">{item.label}</span>
          {count > 0 ? (
            <span className="ml-auto inline-flex h-[18px] min-w-[20px] items-center justify-center rounded-full bg-sidebar-primary px-1.5 font-mono text-[10px] font-semibold leading-none text-sidebar-primary-foreground tabular-nums">
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
          <span className="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-soft">
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-50"
              style={{
                background:
                  'radial-gradient(120% 120% at 0% 0%, oklch(1 0 0 / 0.18), transparent 60%)',
              }}
            />
            <span className="relative font-display text-[17px] leading-none">إ</span>
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[14.5px] font-semibold tracking-tight">
              <BrandWordmark size="sm" />
            </p>
            <p className="truncate text-[10.5px] text-muted-foreground">
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
            <ResearchComposerButton className="w-full justify-center bg-brand text-brand-foreground hover:bg-brand/90" />
          </div>
        ) : null}
      </nav>

      {/* ── Footer / account ─────────────────────────────── */}
      <div className="border-t border-sidebar-border p-2.5">
        {isAuthenticated && user ? (
          <div className="group/account flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-sidebar-accent/60">
            <Link
              to={profileHref ?? '#'}
              onClick={onNavigate}
              className="flex min-w-0 flex-1 items-center gap-2.5"
              title="View profile"
            >
              <UserAvatar
                user={user}
                className="size-8 shrink-0 ring-2 ring-sidebar transition-transform group-hover/account:scale-105"
              />
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-[13px] font-semibold text-sidebar-foreground">
                  {getFullName(user)}
                </p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <p className="truncate text-[11px] text-muted-foreground">
                    @{user.username}
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
              className="rounded-lg text-muted-foreground hover:text-foreground"
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
              className="w-full bg-brand text-brand-foreground hover:bg-brand/90"
              size="lg"
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
