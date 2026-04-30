import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '@/features/auth/auth-context'

function FullPageLoader({ label }) {
  return (
    <div className="grid min-h-screen place-items-center bg-background">
      <div className="flex items-center gap-3 rounded-full border bg-card px-4 py-2 text-sm text-muted-foreground shadow-sm">
        <span className="size-2.5 animate-pulse rounded-full bg-primary" />
        {label}
      </div>
    </div>
  )
}

export function RequireAuth() {
  const { isLoading, isAuthenticated } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <FullPageLoader label="Loading your session…" />
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return <Outlet />
}

export function GuestOnly() {
  const { isLoading, isAuthenticated } = useAuth()
  if (isLoading) {
    return <FullPageLoader label="Checking your session…" />
  }
  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }
  return <Outlet />
}
