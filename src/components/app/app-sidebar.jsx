import {
  Activity,
  Bell,
  BookMarked,
  BookOpenText,
  Clapperboard,
  Home,
  LogOut,
  MessageCircleQuestion,
  Settings,
  User2,
  Users,
} from 'lucide-react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { ResearchComposerButton } from '@/components/app/research-composer'
import { canPublishResearch } from '@/lib/roles'
import { UserAvatar } from '@/components/app/user-avatar'
import { useAuth } from '@/features/auth/auth-context'
import { useNotifications } from '@/features/notifications/notifications-context'
import { cn } from '@/lib/utils'
import { getFullName, getHandle } from '@/lib/format'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'

const PRIMARY_ROUTES = [
  { to: '/', icon: Home, key: 'nav.home', end: true },
  { to: '/research', icon: BookOpenText, key: 'nav.research' },
  { to: '/questions', icon: MessageCircleQuestion, key: 'nav.questions' },
  { to: '/reels', icon: Clapperboard, key: 'nav.reels' },
]

const SOCIAL_ROUTES = [
  { to: '/notifications', icon: Bell, key: 'nav.notifications', badge: 'notifications' },
  { to: '/saved', icon: BookMarked, key: 'nav.saved' },
  { to: '/activity', icon: Activity, key: 'nav.activity' },
  { to: '/people', icon: Users, key: 'nav.people' },
]

function NavRow({ item, onNavigate }) {
  const Icon = item.icon
  const { unreadCount } = useNotifications()
  const badge = item.badge === 'notifications' ? unreadCount : 0
  const { t } = useTranslation()
  const label = item.label ?? (item.key ? t(item.key) : '')

  return (
    <SidebarMenuItem>
      <NavLink to={item.to} end={item.end} onClick={onNavigate}>
        {({ isActive }) => (
          <SidebarMenuButton
            asChild
            isActive={isActive}
            tooltip={label}
            className={cn(
              'h-8 rounded-md text-[13px] font-medium text-fg-muted',
              'hover:bg-bg-soft hover:text-fg',
              'data-[active=true]:bg-bg-soft data-[active=true]:font-semibold data-[active=true]:text-fg',
            )}
          >
            <span className="flex w-full items-center gap-2.5">
              <Icon className="size-[15px] shrink-0" strokeWidth={1.7} />
              <span className="flex-1 truncate">{label}</span>
            </span>
          </SidebarMenuButton>
        )}
      </NavLink>
      {badge > 0 ? (
        <SidebarMenuBadge className="right-2 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-line bg-bg-soft px-1.5 font-mono text-[10px] font-semibold text-fg">
          {badge > 99 ? '99+' : badge}
        </SidebarMenuBadge>
      ) : null}
    </SidebarMenuItem>
  )
}

export function AppSidebar(props) {
  const { user, isAuthenticated, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  const { setOpenMobile } = useSidebar()

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true, state: { from: location } })
    setOpenMobile(false)
  }

  const profileHref = user?.username ? `/profile/${user.username}` : null
  const closeMobile = () => setOpenMobile(false)

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-line bg-background"
      {...props}
    >
      {/* Brand — editorial mark + wordmark */}
      <SidebarHeader className="px-3 py-4">
        <Link
          to="/"
          onClick={closeMobile}
          className="flex items-center gap-2.5 rounded-md transition-colors"
        >
          <div className="grid size-[22px] shrink-0 place-items-center rounded-[4px] bg-fg font-mono text-[11px] font-semibold text-background">
            i
          </div>
          <div className="min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
            <p className="truncate text-[14px] font-semibold tracking-[-0.01em] text-fg">
              irc
            </p>
          </div>
        </Link>
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent className="px-2">
        <SidebarGroup className="px-1 py-2">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {PRIMARY_ROUTES.map((item) => (
                <NavRow key={item.to} item={item} onNavigate={closeMobile} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="px-1 py-2">
          <SidebarGroupLabel className="px-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.04em] text-fg-faint">
            Activity
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {SOCIAL_ROUTES.map((item) => (
                <NavRow key={item.to} item={item} onNavigate={closeMobile} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAuthenticated ? (
          <SidebarGroup className="px-1 py-2">
            <SidebarGroupLabel className="px-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.04em] text-fg-faint">
              {t('nav.workspaceLabel', 'Workspace')}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {profileHref ? (
                  <NavRow
                    item={{ to: profileHref, icon: User2, label: t('nav.profile') }}
                    onNavigate={closeMobile}
                  />
                ) : null}
                {canPublishResearch(user) ? (
                  <NavRow
                    item={{
                      to: '/my-research',
                      icon: BookMarked,
                      label: t('nav.myResearch'),
                    }}
                    onNavigate={closeMobile}
                  />
                ) : null}
                <NavRow
                  item={{ to: '/settings', icon: Settings, label: t('nav.settings') }}
                  onNavigate={closeMobile}
                />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}

        {canPublishResearch(user) ? (
          <SidebarGroup className="px-1 py-2">
            <SidebarGroupContent className="group-data-[collapsible=icon]:hidden">
              <ResearchComposerButton
                className={cn(
                  'h-8 w-full justify-center gap-1.5 rounded-md',
                  'bg-fg text-background hover:bg-fg-soft',
                  'text-[12.5px] font-medium',
                )}
              />
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>

      {/* Footer / account */}
      <SidebarFooter className="border-t border-line p-2">
        {isAuthenticated && user ? (
          <div className="flex items-center gap-2 rounded-md px-1.5 py-1.5 transition-colors hover:bg-bg-soft group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-stretch group-data-[collapsible=icon]:gap-1 group-data-[collapsible=icon]:px-0">
            <Link
              to={profileHref ?? '#'}
              onClick={closeMobile}
              className="flex min-w-0 flex-1 items-center gap-2.5"
              title="View profile"
            >
              <UserAvatar user={user} className="size-7 shrink-0" />
              <div className="min-w-0 flex-1 leading-tight group-data-[collapsible=icon]:hidden">
                <p className="truncate text-[12.5px] font-semibold text-fg">
                  {getFullName(user) || getHandle(user) || 'Account'}
                </p>
                {getHandle(user) ? (
                  <p className="mt-0.5 truncate font-mono text-[10.5px] text-fg-muted">
                    @{getHandle(user)}
                  </p>
                ) : null}
              </div>
            </Link>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-7 rounded-md text-fg-muted hover:bg-bg-muted hover:text-fg"
              onClick={handleSignOut}
              title="Sign out"
            >
              <LogOut className="size-[14px]" strokeWidth={1.7} />
            </Button>
          </div>
        ) : (
          <div className="grid gap-2 px-1 group-data-[collapsible=icon]:hidden">
            <Button
              asChild
              className="h-8 w-full justify-center rounded-md bg-fg text-[12.5px] font-medium text-background hover:bg-fg-soft"
            >
              <Link to="/login" onClick={closeMobile}>
                Sign in
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-8 w-full justify-center rounded-md border-line bg-background text-[12.5px] font-medium text-fg hover:bg-bg-soft"
            >
              <Link to="/signup" onClick={closeMobile}>
                Create account
              </Link>
            </Button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}
