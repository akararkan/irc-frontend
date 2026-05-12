import { useCallback, useEffect, useState } from 'react'
import { Bookmark, Library } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/app/empty-state'
import { PageHeader } from '@/components/app/page-header'
import { PostCard } from '@/components/app/post-card'
import { ResearchCard } from '@/components/app/research-card'
import {
  getSavedByCollection,
  getSavedCollections,
  getSavedResearch,
} from '@/features/research/research.api'
import {
  getMyPostCollections,
  getSavedPosts,
  getSavedPostsByCollection,
} from '@/features/posts/posts.api'
import { useToast } from '@/components/ui/toaster'
import { useAuth } from '@/features/auth/auth-context'
import { cn } from '@/lib/utils'
import { extractApiMessage } from '@/lib/api-error'

// One-row filter pill list — used by both Research and Posts tabs to
// switch between "All saved" and a named collection. Same visual
// language so the user doesn't have to learn two controls.
function CollectionFilter({ collections, active, onSelect }) {
  if (!collections.length) return null
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
          active === null
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
          onClick={() => onSelect(name)}
          className={cn(
            'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
            active === name
              ? 'border-transparent bg-islamic-gradient text-white shadow-sm'
              : 'border-border bg-background text-muted-foreground hover:text-foreground',
          )}
        >
          {name}
        </button>
      ))}
    </div>
  )
}

function ResearchPanel() {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [collections, setCollections] = useState([])
  const [active, setActive] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [saved, names] = await Promise.all([
        active
          ? getSavedByCollection(active, { page: 0, size: 20 })
          : getSavedResearch({ page: 0, size: 20 }),
        getSavedCollections().catch(() => []),
      ])
      setItems(saved?.content ?? [])
      setCollections(Array.isArray(names) ? names : [])
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not load research saves.'))
    } finally {
      setLoading(false)
    }
  }, [active, toast])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-4">
      <CollectionFilter
        collections={collections}
        active={active}
        onSelect={setActive}
      />
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="No research saved yet"
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

function PostsPanel() {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [collections, setCollections] = useState([])
  const [active, setActive] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [saved, names] = await Promise.all([
        active
          ? getSavedPostsByCollection(active, { page: 0, size: 20 })
          : getSavedPosts({ page: 0, size: 20 }),
        getMyPostCollections().catch(() => []),
      ])
      // Every row in this list is, by definition, saved by the viewer.
      // The list endpoint doesn't always echo `isSaved`, so we force
      // it on here — guarantees the PostCard bookmark renders filled
      // (and unsaving from here flips it off as usual).
      const rows = (saved?.content ?? []).map((post) => ({
        ...post,
        isSaved: true,
      }))
      setItems(rows)
      setCollections(Array.isArray(names) ? names : [])
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not load saved posts.'))
    } finally {
      setLoading(false)
    }
  }, [active, toast])

  useEffect(() => {
    load()
  }, [load])

  // When a card flips its bookmark off via PostCard's onChange we drop
  // it from the local list immediately — keeps the saved view tidy
  // without waiting for the SSE echo to refresh.
  function handlePostChange(updated) {
    if (updated.isSaved === false) {
      setItems((current) => current.filter((item) => item.id !== updated.id))
      return
    }
    setItems((current) =>
      current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
    )
  }

  function handlePostDelete(id) {
    setItems((current) => current.filter((item) => item.id !== id))
  }

  return (
    <div className="space-y-4">
      <CollectionFilter
        collections={collections}
        active={active}
        onSelect={setActive}
      />
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="No posts saved yet"
          description="Tap the bookmark on any post to keep it here."
          action={
            <Button asChild size="sm" className="rounded-full">
              <Link to="/">Browse the feed</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {items.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onChange={handlePostChange}
              onDelete={handlePostDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function SavedPage() {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return (
      <div className="space-y-6">
        <PageHeader title="Library" description="Posts and research you've saved." />
        <EmptyState
          icon={Library}
          title="Sign in to build your library"
          description="Save posts and research to return to them later. Organise saves by collection."
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
      <PageHeader title="Library" description="Posts and research you've saved." />
      <Tabs defaultValue="posts">
        <TabsList>
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="research">Research</TabsTrigger>
        </TabsList>
        <TabsContent value="posts" className="mt-4">
          <PostsPanel />
        </TabsContent>
        <TabsContent value="research" className="mt-4">
          <ResearchPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
