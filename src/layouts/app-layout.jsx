import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import { AppSidebar } from '@/components/app/app-sidebar'
import { AppTopbar } from '@/components/app/app-topbar'
import { CommandPalette } from '@/components/app/command-palette'
import { MobileBottomTabs } from '@/components/app/mobile-bottom-tabs'
import {
  SidebarInset,
  SidebarProvider,
  useSidebar,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/theme'

const SIDEBAR_COLLAPSED_KEY = 'sidebar:collapsed'

// Inside SidebarProvider so we can read state + drive the topbar's
// collapse toggle.  The shadcn Sidebar primitive is `position: fixed`
// internally, so it stays put while the SidebarInset (the main
// column) scrolls naturally with the document.  No manual sticky/
// overflow plumbing required at this level.
function AppFrame() {
  const location = useLocation()
  const { open, toggleSidebar, setOpenMobile } = useSidebar()

  useEffect(() => {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, open ? '0' : '1')
  }, [open])

  const isReels = location.pathname.startsWith('/reels')
  const hideMobileChrome = isReels

  return (
    <>
      <AppSidebar />
      <SidebarInset>
        <div className={cn('shrink-0', hideMobileChrome && 'hidden lg:block')}>
          <AppTopbar
            onMenuClick={() => setOpenMobile(true)}
            sidebarCollapsed={!open}
            onToggleSidebar={toggleSidebar}
          />
        </div>
        <main
          className={cn(
            'flex-1',
            isReels
              ? 'overflow-hidden p-0'
              : 'px-3 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pb-10 lg:pt-10',
          )}
        >
          <div
            className={cn(
              'mx-auto w-full max-w-6xl',
              isReels ? 'h-full' : null,
            )}
          >
            <Outlet />
          </div>
        </main>
      </SidebarInset>

      <div className={cn(hideMobileChrome && 'hidden')}>
        <MobileBottomTabs />
      </div>

      {/* ⌘J Quick-navigate palette. Inline ⌘K search lives in the
          topbar; this palette is the keyboard-first nav surface. */}
      <CommandPalette />
    </>
  )
}

export function AppLayout() {
  const { isRtl } = useLanguage()
  const [defaultOpen] = useState(() => {
    if (typeof localStorage === 'undefined') return true
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) !== '1'
  })

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="bg-background text-foreground">
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppFrame />
      </SidebarProvider>
    </div>
  )
}
