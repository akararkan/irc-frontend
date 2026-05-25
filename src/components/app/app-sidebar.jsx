import {
  Activity,
  BookMarked,
  BookOpenText,
  Clapperboard,
  Home,
  LogOut,
  MessageCircleQuestion,
  Settings,
  User2,
  Users,
  Bell,
} from 'lucide-react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { ResearchComposerButton } from '@/components/app/research-composer'
import { canPublishResearch } from '@/lib/roles'
import { UserAvatar } from '@/components/app/user-avatar'
import { IrcWordmark } from '@/components/app/irc-mark'
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

// Active nav row = emerald gradient fill with a brass icon — the
// "Modern Manuscript" selected state.
const NAV_BTN = cn(
  'h-11 rounded-2xl px-3 text-[14px] font-bold text-fg-soft transition-all',
  'hover:bg-card hover:text-fg',
  'data-[active=true]:bg-[linear-gradient(135deg,var(--accent-indigo),var(--primary))]',
  'data-[active=true]:text-white data-[active=true]:shadow-soft',
  'data-[active=true]:[&_svg]:text-[#D8B463]',
)

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
          <SidebarMenuButton asChild isActive={isActive} tooltip={label} className={NAV_BTN}>
            <span className="flex w-full items-center gap-3">
              <Icon className="size-[18px] shrink-0 text-fg-muted transition-colors" strokeWidth={1.9} />
              <span className="flex-1 truncate">{label}</span>
            </span>
          </SidebarMenuButton>
        )}
      </NavLink>
      {badge > 0 ? (
        <SidebarMenuBadge className="right-2.5 inline-flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-warn px-1.5 text-[10.5px] font-extrabold text-[#3A2C0C]">
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
    <Sidebar collapsible="icon" className="border-r border-line bg-background" {...props}>
      {/* Brand — geometric star mark + serif wordmark */}
      <SidebarHeader className="px-3 py-5">
        <Link to="/" onClick={closeMobile} className="flex items-center rounded-xl transition-colors">
          <IrcWordmark className="group-data-[collapsible=icon]:[&>span:last-child]:hidden" />
        </Link>
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent className="px-2.5">
        <SidebarGroup className="px-1 py-2">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {PRIMARY_ROUTES.map((item) => (
                <NavRow key={item.to} item={item} onNavigate={closeMobile} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="px-1 py-2">
          <SidebarGroupLabel className="px-3 text-[10.5px] font-bold uppercase tracking-[0.1em] text-fg-faint">
            Activity
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {SOCIAL_ROUTES.map((item) => (
                <NavRow key={item.to} item={item} onNavigate={closeMobile} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAuthenticated ? (
          <SidebarGroup className="px-1 py-2">
            <SidebarGroupLabel className="px-3 text-[10.5px] font-bold uppercase tracking-[0.1em] text-fg-faint">
              {t('nav.workspaceLabel', 'Workspace')}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {profileHref ? (
                  <NavRow item={{ to: profileHref, icon: User2, label: t('nav.profile') }} onNavigate={closeMobile} />
                ) : null}
                {canPublishResearch(user) ? (
                  <NavRow item={{ to: '/my-research', icon: BookMarked, label: t('nav.myResearch') }} onNavigate={closeMobile} />
                ) : null}
                <NavRow item={{ to: '/settings', icon: Settings, label: t('nav.settings') }} onNavigate={closeMobile} />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}

        {canPublishResearch(user) ? (
          <SidebarGroup className="px-1 py-2">
            <SidebarGroupContent className="group-data-[collapsible=icon]:hidden">
              <ResearchComposerButton
                className={cn(
                  'h-12 w-full justify-center gap-2 rounded-2xl text-[14px] font-extrabold text-primary-foreground',
                  'bg-[linear-gradient(135deg,var(--accent-indigo),var(--primary))] shadow-soft hover:-translate-y-px',
                )}
              />
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>

      {/* Footer / account */}
      <SidebarFooter className="border-t border-line p-2.5">
        {isAuthenticated && user ? (
          <div className="flex items-center gap-2 rounded-2xl px-2 py-2 transition-colors hover:bg-card group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-stretch group-data-[collapsible=icon]:gap-1 group-data-[collapsible=icon]:px-0">
            <Link to={profileHref ?? '#'} onClick={closeMobile} className="flex min-w-0 flex-1 items-center gap-3" title="View profile">
              <UserAvatar user={user} className="size-9 shrink-0 ring-2 ring-brand/25" />
              <div className="min-w-0 flex-1 leading-tight group-data-[collapsible=icon]:hidden">
                <p className="truncate text-[13px] font-bold text-fg">
                  {getFullName(user) || getHandle(user) || 'Account'}
                </p>
                {getHandle(user) ? (
                  <p className="mt-0.5 truncate text-[11px] text-fg-muted">@{getHandle(user)}</p>
                ) : null}
              </div>
            </Link>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-9 rounded-xl text-fg-muted hover:bg-bg-muted hover:text-destructive"
              onClick={handleSignOut}
              title="Sign out"
            >
              <LogOut className="size-[16px]" strokeWidth={1.8} />
            </Button>
          </div>
        ) : (
          <div className="grid gap-2 px-1 group-data-[collapsible=icon]:hidden">
            <Button
              asChild
              className="h-11 w-full justify-center rounded-2xl bg-[linear-gradient(135deg,var(--accent-indigo),var(--primary))] text-[13.5px] font-extrabold text-primary-foreground shadow-soft hover:-translate-y-px"
            >
              <Link to="/login" onClick={closeMobile}>Sign in</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-11 w-full justify-center rounded-2xl border-line bg-card text-[13.5px] font-bold text-fg hover:bg-bg-soft"
            >
              <Link to="/signup" onClick={closeMobile}>Create account</Link>
            </Button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}
