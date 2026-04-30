import { Link, Outlet } from 'react-router-dom'

import { BrandWordmark } from '@/components/app/brand-mark'
import { APP_FULL_NAME, APP_TAGLINE } from '@/config/env'

export function AuthLayout() {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex flex-col items-center gap-2 text-center">
          <span className="grid size-12 place-items-center rounded-xl bg-primary text-primary-foreground">
            <span className="text-base font-bold tracking-tight">IRC</span>
          </span>
          <div className="space-y-0.5">
            <BrandWordmark size="lg" className="text-foreground" />
            <p className="text-sm font-medium text-foreground">{APP_FULL_NAME}</p>
            <p className="max-w-xs text-xs text-muted-foreground">{APP_TAGLINE}</p>
          </div>
        </Link>
        <Outlet />
      </div>
    </div>
  )
}
