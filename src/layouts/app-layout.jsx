import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import { AppSidebar } from '@/components/app/app-sidebar'
import { AppTopbar } from '@/components/app/app-topbar'
import { MobileBottomTabs } from '@/components/app/mobile-bottom-tabs'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { RTL_LANGS } from '@/i18n'
import { useTweaks } from '@/features/tweaks/tweaks-context'

const SIDEBAR_COLLAPSED_KEY = 'sidebar:collapsed'

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof localStorage === 'undefined') return false
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
  })
  const location = useLocation()
  const { lang } = useTweaks()
  const isRtl = RTL_LANGS.has(lang ?? 'en')

  useEffect(() => {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? '1' : '0')
  }, [sidebarCollapsed])

  // Reels is an immersive vertical-video experience. On mobile/tablet
  // it owns the entire viewport — topbar and bottom tabs collapse so
  // the reel fills the screen edge-to-edge (TikTok / Instagram model).
  // The reels page itself renders its own floating close button and
  // chrome so navigation isn't lost.
  const isReels = location.pathname.startsWith('/reels')
  const hideMobileChrome = isReels

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="flex min-h-[100dvh] bg-background text-foreground">
      {/* Desktop sidebar — animates its own width so the main column
          reflows alongside. Inner wrapper stays at the natural width
          so the nav links don't squeeze mid-animation; clipping is
          handled by overflow-hidden on the aside. The cubic-bezier
          matches the mobile Sheet so both surfaces feel consistent. */}
      <aside
        className={cn(
          'hidden shrink-0 overflow-hidden border-r border-border bg-sidebar transition-[width] duration-[400ms] ease-[cubic-bezier(0.32,0.72,0,1)] lg:block',
          sidebarCollapsed ? 'w-0 border-r-0' : 'w-60',
        )}
      >
        <div className="sticky top-0 h-screen w-60">
          <AppSidebar />
        </div>
      </aside>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side={isRtl ? 'right' : 'left'} className="w-72 max-w-[85vw] bg-sidebar p-0" showClose={false}>
          <AppSidebar onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-h-[100dvh] min-w-0 flex-1 flex-col">
        {/* Topbar hides on mobile reels so the reel goes full-bleed.
            Desktop still keeps the sidebar; reels detail chrome lives
            inside the page on lg. */}
        <div className={cn(hideMobileChrome && 'hidden lg:block')}>
          <AppTopbar
            onMenuClick={() => setMenuOpen(true)}
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
          />
        </div>
        {/* Main padding tightens on phones (px-3) and stretches out on
            tablets / desktops. `pb-[calc(...)]` leaves room for the
            mobile bottom tab bar (~64 px) plus the iOS home-indicator
            safe-area; lg drops that bottom pad since the bar isn't
            rendered. Reels owns its own viewport so it gets zero pad. */}
        <main
          className={cn(
            'mx-auto w-full max-w-6xl flex-1',
            isReels
              ? 'p-0'
              : 'px-3 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pb-10 lg:pt-10',
          )}
        >
          <Outlet />
        </main>
      </div>

      <div className={cn(hideMobileChrome && 'hidden')}>
        <MobileBottomTabs />
      </div>
    </div>
  )
}
