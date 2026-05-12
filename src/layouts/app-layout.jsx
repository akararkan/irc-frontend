import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import { AppSidebar } from '@/components/app/app-sidebar'
import { AppTopbar } from '@/components/app/app-topbar'
import { MobileBottomTabs } from '@/components/app/mobile-bottom-tabs'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  // Reels is an immersive vertical-video experience. On mobile/tablet
  // it owns the entire viewport — topbar and bottom tabs collapse so
  // the reel fills the screen edge-to-edge (TikTok / Instagram model).
  // The reels page itself renders its own floating close button and
  // chrome so navigation isn't lost.
  const isReels = location.pathname.startsWith('/reels')
  const hideMobileChrome = isReels

  return (
    <div className="flex min-h-[100dvh] bg-background text-foreground">
      <aside className="hidden w-60 shrink-0 border-r border-border bg-sidebar lg:block">
        <div className="sticky top-0 h-screen">
          <AppSidebar />
        </div>
      </aside>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-72 max-w-[85vw] bg-sidebar p-0" showClose={false}>
          <AppSidebar onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-h-[100dvh] min-w-0 flex-1 flex-col">
        {/* Topbar hides on mobile reels so the reel goes full-bleed.
            Desktop still keeps the sidebar; reels detail chrome lives
            inside the page on lg. */}
        <div className={cn(hideMobileChrome && 'hidden lg:block')}>
          <AppTopbar onMenuClick={() => setMenuOpen(true)} />
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
