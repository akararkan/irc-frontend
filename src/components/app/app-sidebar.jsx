import {
  Bell,
  BookMarked,
  BookOpenText,
  Clapperboard,
  LogOut,
  MessageCircleQuestion,
  Settings,
  Sparkles,
  User2,
  Users,
} from 'lucide-react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { ResearchComposerButton } from '@/components/app/research-composer'
import { RoleBadge } from '@/components/app/role-badge'
import { canPublishResearch } from '@/lib/roles'
import { UserAvatar } from '@/components/app/user-avatar'
import { useAuth } from '@/features/auth/auth-context'
import { useNotifications } from '@/features/notifications/notifications-context'
import { cn } from '@/lib/utils'
import { getFullName, getHandle } from '@/lib/format'
import { useTranslation } from 'react-i18next'

const PRIMARY_ROUTES = [
  { to: '/', icon: Sparkles, key: 'nav.home', end: true },
  { to: '/research', icon: BookOpenText, key: 'nav.research' },
  { to: '/questions', icon: MessageCircleQuestion, key: 'nav.questions' },
  { to: '/reels', icon: Clapperboard, key: 'nav.reels' },
]

const SOCIAL_ROUTES = [
  { to: '/notifications', icon: Bell, key: 'nav.notifications', badge: 'notifications' },
  { to: '/saved', icon: BookMarked, key: 'nav.saved' },
  { to: '/people', icon: Users, key: 'nav.people' },
]

function SectionLabel({ children }) {
  return (
    <p className="px-3 pb-1.5 pt-4 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-ink-4">
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
          'group/nav relative flex items-center gap-[11px] rounded-md px-3 py-2 text-[13px] transition-colors',
          isActive
            ? 'bg-secondary font-medium text-ink'
            : 'text-ink-3 hover:bg-secondary hover:text-ink',
        )
      }
    >
      <Icon className="size-[16px] shrink-0" strokeWidth={1.6} />
      <span className="flex-1 truncate">{item.label}</span>
      {count > 0 ? (
        <span className="ml-auto inline-flex items-center justify-center rounded-full pill-danger px-1.5 py-0.5 font-mono text-[10px] tabular-nums">
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
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
  const { t } = useTranslation()

  return (
    <aside className="flex h-full w-full flex-col bg-sidebar text-sidebar-foreground">
      {/* ── Brand ─────────────────────────────────────────── */}
      <Link
        to="/"
        onClick={onNavigate}
        className="flex items-center gap-[10px] px-5 pb-4 pt-[18px]"
      >
        <div className="grid size-[30px] place-items-center rounded-md bg-ink font-display text-[12px] font-medium tracking-[0.04em] text-background">
          IRC
        </div>
        <div className="min-w-0 leading-tight">
          <p className="truncate font-display text-[15px] font-medium tracking-[-0.01em] text-ink">
            Scholar
          </p>
          <p className="truncate text-[11px] text-ink-3">{t('nav.researchNetwork')}</p>
        </div>
      </Link>

      {/* ── Nav ───────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-3 pb-2">
        <div className="space-y-[2px]">
          {PRIMARY_ROUTES.map((item) => (
            <NavItem key={item.to} item={{ ...item, label: t(item.key) }} onNavigate={onNavigate} />
          ))}
        </div>

        <div className="space-y-[2px]">
          {SOCIAL_ROUTES.map((item) => (
            <NavItem key={item.to} item={{ ...item, label: t(item.key) }} onNavigate={onNavigate} />
          ))}
        </div>

        {isAuthenticated ? (
          <>
            <SectionLabel>Workspace</SectionLabel>
            <div className="space-y-[2px]">
              {profileHref ? (
                <NavItem
                  item={{ to: profileHref, icon: User2, label: t('nav.profile') }}
                  onNavigate={onNavigate}
                />
              ) : null}
              {canPublishResearch(user) ? (
                <NavItem
                  item={{ to: '/my-research', icon: BookMarked, label: t('nav.myResearch') }}
                  onNavigate={onNavigate}
                />
              ) : null}
              <NavItem
                item={{ to: '/settings', icon: Settings, label: t('nav.settings') }}
                onNavigate={onNavigate}
              />
            </div>
          </>
        ) : null}

        {canPublishResearch(user) ? (
          <div className="px-1 pb-1 pt-4">
            <ResearchComposerButton
              className={cn(
                'w-full justify-center gap-2 rounded-md',
                'bg-brand text-brand-foreground hover:bg-[var(--accent-2,var(--brand))]',
              )}
            />
          </div>
        ) : null}
      </nav>

      {/* ── Footer / account ─────────────────────────────── */}
      <div className="border-t border-[var(--sidebar-border)] p-3">
        {isAuthenticated && user ? (
          <div className="flex items-center gap-[10px] rounded-md px-2 py-2 transition-colors hover:bg-secondary">
            <Link
              to={profileHref ?? '#'}
              onClick={onNavigate}
              className="flex min-w-0 flex-1 items-center gap-[10px]"
              title="View profile"
            >
              <UserAvatar user={user} className="size-[34px] shrink-0" />
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-[13px] font-medium text-ink">
                  {getFullName(user) || getHandle(user) || 'Account'}
                </p>
                {user.role ? (
                  <p className="mt-0.5 truncate text-[11px] text-info-fg">
                    {user.role === 'SCHOLAR'
                      ? 'Scholar'
                      : user.role === 'RESEARCHER'
                        ? 'Researcher'
                        : user.role === 'ADMIN'
                          ? 'Admin'
                          : user.role === 'SUPER_ADMIN'
                            ? 'Super admin'
                            : 'Member'}
                  </p>
                ) : getHandle(user) ? (
                  <p className="truncate font-mono text-[10.5px] text-ink-3">
                    @{getHandle(user)}
                  </p>
                ) : null}
              </div>
            </Link>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="rounded-md text-ink-3 hover:text-ink"
              onClick={handleSignOut}
              title="Sign out"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        ) : (
          <div className="grid gap-2 px-1">
            <Button asChild size="lg" className="w-full rounded-md bg-brand text-brand-foreground hover:bg-brand/90">
              <Link to="/login" onClick={onNavigate}>
                Sign in
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full rounded-md" size="lg">
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
