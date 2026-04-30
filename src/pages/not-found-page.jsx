import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="space-y-3 text-center">
        <p className="text-5xl font-semibold tracking-tight">404</p>
        <p className="text-muted-foreground">The page you're looking for doesn't exist.</p>
        <Button asChild className="mt-2 rounded-full">
          <Link to="/">Back home</Link>
        </Button>
      </div>
    </div>
  )
}
