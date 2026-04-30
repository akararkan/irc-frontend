import { useCallback, useEffect, useState } from 'react'
import { FlaskConical, Search, TrendingUp } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/app/empty-state'
import { PageHeader } from '@/components/app/page-header'
import { ResearchCard } from '@/components/app/research-card'
import { ResearchComposerButton } from '@/components/app/research-composer'
import {
  getResearchFeed,
  getTrendingTags,
  searchResearch,
  searchResearchByTags,
} from '@/features/research/research.api'
import { useToast } from '@/components/ui/toaster'
import { canPublishResearch } from '@/lib/roles'
import { useAuth } from '@/features/auth/auth-context'
import { extractApiMessage } from '@/lib/api-error'

export function ResearchPage() {
  const toast = useToast()
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState(null)

  const loadFeed = useCallback(async () => {
    setLoading(true)
    try {
      const [feed, trending] = await Promise.all([
        getResearchFeed({ page: 0, size: 20 }),
        getTrendingTags({ limit: 12 }).catch(() => []),
      ])
      setItems(feed?.content ?? [])
      setTags(Array.isArray(trending) ? trending : [])
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not load research feed.'))
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadFeed()
  }, [loadFeed])

  async function handleSearch(event) {
    event.preventDefault()
    const term = query.trim()
    if (!term) {
      setActiveTag(null)
      loadFeed()
      return
    }
    setLoading(true)
    try {
      const data = await searchResearch({ q: term, page: 0, size: 20 })
      setItems(data?.content ?? [])
      setActiveTag(null)
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not search research.'))
    } finally {
      setLoading(false)
    }
  }

  async function handleTagClick(tag) {
    if (activeTag === tag) {
      setActiveTag(null)
      loadFeed()
      return
    }
    setActiveTag(tag)
    setLoading(true)
    try {
      const data = await searchResearchByTags({ tags: [tag], page: 0, size: 20 })
      setItems(data?.content ?? [])
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not filter by tag.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Research archive"
        title="Research"
        description="Published research from scholars and researchers across the community — peer-reviewed, open, and indexed for discovery."
        action={
          canPublishResearch(user) ? (
            <ResearchComposerButton
              onCreated={(created) => {
                if (created) setItems((current) => [created, ...current])
              }}
            />
          ) : null
        }
      />

      <form onSubmit={handleSearch} className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search research by keyword, author, or topic"
          className="h-11 rounded-full pl-9 pr-20"
        />
        <Button
          type="submit"
          size="sm"
          className="absolute right-1.5 top-1/2 h-8 -translate-y-1/2 rounded-full"
        >
          Search
        </Button>
      </form>

      {tags.length ? (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <TrendingUp className="size-3" />
            Trending tags
          </div>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => handleTagClick(tag)}
                className={
                  activeTag === tag
                    ? 'inline-flex items-center rounded-full bg-foreground px-3 py-1 text-xs font-medium text-background'
                    : 'inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground'
                }
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((key) => (
            <Skeleton key={key} className="h-72 w-full rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="No research published yet"
          description="Published research from the community will appear here."
          action={
            canPublishResearch(user) ? (
              <ResearchComposerButton
                onCreated={(created) => created && setItems((current) => [created, ...current])}
              />
            ) : null
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
