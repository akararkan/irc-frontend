import { useState } from 'react'
import { Outlet } from 'react-router-dom'

import { AppSidebar } from '@/components/app/app-sidebar'
import { AppTopbar } from '@/components/app/app-topbar'
import { MobileBottomTabs } from '@/components/app/mobile-bottom-tabs'
import { Sheet, SheetContent } from '@/components/ui/sheet'

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-60 shrink-0 border-r border-border bg-sidebar lg:block">
        <div className="sticky top-0 h-screen">
          <AppSidebar />
        </div>
      </aside>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-72 bg-sidebar p-0" showClose={false}>
          <AppSidebar onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <AppTopbar onMenuClick={() => setMenuOpen(true)} />
        {/* `pb-20` (80 px) leaves room for the mobile bottom tab bar
            (~64 px tall + safe-area inset). Reset on `lg` where the
            bar isn't rendered. */}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 sm:px-8 sm:pt-8 lg:py-10 lg:pb-10">
          <Outlet />
        </main>
      </div>

      <MobileBottomTabs />
    </div>
  )
}
