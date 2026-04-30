import { useCallback, useEffect, useState } from 'react'
import { Bookmark, Library } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/app/empty-state'
import { PageHeader } from '@/components/app/page-header'
import { ResearchCard } from '@/components/app/research-card'
import {
  getSavedByCollection,
  getSavedCollections,
  getSavedResearch,
} from '@/features/research/research.api'
import { useToast } from '@/components/ui/toaster'
import { useAuth } from '@/features/auth/auth-context'
import { cn } from '@/lib/utils'
import { extractApiMessage } from '@/lib/api-error'

export function SavedPage() {
  const { isAuthenticated } = useAuth()
  const toast = useToast()
  const [items, setItems] = useState([])
  const [collections, setCollections] = useState([])
  const [activeCollection, setActiveCollection] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [saved, names] = await Promise.all([
        activeCollection
          ? getSavedByCollection(activeCollection, { page: 0, size: 20 })
          : getSavedResearch({ page: 0, size: 20 }),
        getSavedCollections().catch(() => []),
      ])
      setItems(saved?.content ?? [])
      setCollections(Array.isArray(names) ? names : [])
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not load your library.'))
    } finally {
      setLoading(false)
    }
  }, [activeCollection, toast])

  useEffect(() => {
    if (isAuthenticated) load()
  }, [isAuthenticated, load])

  if (!isAuthenticated) {
    return (
      <div className="space-y-6">
        <PageHeader title="Library" description="Research you've saved for later." />
        <EmptyState
          icon={Library}
          title="Sign in to build your library"
          description="Save research to return to it later. Organise saves by collection."
          action={
            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline" className="rounded-full">
                <Link to="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm" className="rounded-full">
                <Link to="/signup">Create account</Link>
              </Button>
            </div>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Library" description="Research and collections you've saved." />

      {collections.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveCollection(null)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              activeCollection === null
                ? 'border-transparent bg-islamic-gradient text-white shadow-sm'
                : 'border-border bg-background text-muted-foreground hover:text-foreground',
            )}
          >
            All saved
          </button>
          {collections.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setActiveCollection(name)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                activeCollection === name
                  ? 'border-transparent bg-islamic-gradient text-white shadow-sm'
                  : 'border-border bg-background text-muted-foreground hover:text-foreground',
              )}
            >
              {name}
            </button>
          ))}
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="Nothing saved yet"
          description="Open any research and tap Save to keep it here."
          action={
            <Button asChild size="sm" className="rounded-full">
              <Link to="/research">Browse research</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <ResearchCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
