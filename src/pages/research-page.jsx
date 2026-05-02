import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, FlaskConical, Search, SlidersHorizontal } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/format'

const SORTS = [
  { value: 'recent',   label: 'Most recent',   sort: 'publishedAt,desc' },
  { value: 'cited',    label: 'Most cited',    sort: 'citationCount,desc' },
  { value: 'read',     label: 'Most read',     sort: 'viewCount,desc' },
  { value: 'oldest',   label: 'Oldest first',  sort: 'publishedAt,asc' },
]

export function ResearchPage() {
  const toast = useToast()
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [page, setPage] = useState(null)
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState(null)
  const [sortKey, setSortKey] = useState('cited')

  const sort = useMemo(
    () => SORTS.find((s) => s.value === sortKey) ?? SORTS[1],
    [sortKey],
  )

  const loadFeed = useCallback(async () => {
    setLoading(true)
    try {
      const [feed, trending] = await Promise.all([
        getResearchFeed({ page: 0, size: 20, sort: sort.sort }),
        getTrendingTags({ limit: 12 }).catch(() => []),
      ])
      setItems(feed?.content ?? [])
      setPage(feed)
      setTags(Array.isArray(trending) ? trending : [])
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not load research feed.'))
    } finally {
      setLoading(false)
    }
  }, [sort.sort, toast])

  useEffect(() => {
    if (!activeTag && !query.trim()) loadFeed()
  }, [loadFeed, activeTag, query])

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
      setPage(data)
      setActiveTag(null)
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not search research.'))
    } finally {
      setLoading(false)
    }
  }

  async function handleTagClick(tag) {
    if (activeTag === tag || tag === null) {
      setActiveTag(null)
      loadFeed()
      return
    }
    setActiveTag(tag)
    setLoading(true)
    try {
      const data = await searchResearchByTags({ tags: [tag], page: 0, size: 20 })
      setItems(data?.content ?? [])
      setPage(data)
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not filter by tag.'))
    } finally {
      setLoading(false)
    }
  }

  // Editorial stats — prefer Spring page totals, fall back to loaded items.
  const totalPapers = page?.totalElements ?? items.length
  const totalCitations = items.reduce(
    (acc, item) => acc + (item.citationCount ?? 0),
    0,
  )
  const totalDisciplines = tags.length

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Research library"
        title="Peer-reviewed scholarship, made readable"
        description="Browse open-access papers, monographs, and dissertations. Every submission is reviewed by two scholars before it appears here."
        action={
          canPublishResearch(user) ? (
            <ResearchComposerButton
              onCreated={(created) => {
                if (created) setItems((current) => [created, ...current])
              }}
              className={cn(
                'gap-2 bg-gradient-to-br from-brand to-brand/85 text-brand-foreground shadow-soft',
                'transition-transform hover:-translate-y-px hover:from-brand hover:to-brand/90',
              )}
            />
          ) : null
        }
        stats={[
          { value: formatNumber(totalPapers),    label: 'Open papers' },
          { value: formatNumber(totalCitations), label: 'Citations' },
          { value: formatNumber(totalDisciplines), label: 'Disciplines', tone: 'gold' },
        ]}
      />

      {/* Search bar */}
      <form onSubmit={handleSearch} className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[15px] -translate-y-1/2 text-ink-4" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search papers, authors, topics…"
          className={cn(
            'h-11 rounded-lg border-border bg-paper pl-10 pr-24 text-[13.5px] text-ink placeholder:text-ink-4',
            'focus-visible:border-brand/50 focus-visible:ring-[3px] focus-visible:ring-brand/15',
          )}
        />
        <Button
          type="submit"
          size="sm"
          className={cn(
            'absolute right-1.5 top-1/2 h-8 -translate-y-1/2 rounded-md px-3 text-[12.5px] font-semibold',
            'bg-gradient-to-br from-brand to-brand/85 text-brand-foreground shadow-soft',
          )}
        >
          Search
        </Button>
      </form>

      {/* Discipline / tag filter row */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterPill
          active={activeTag === null}
          onClick={() => handleTagClick(null)}
        >
          All disciplines
        </FilterPill>
        {tags.slice(0, 8).map((tag) => (
          <FilterPill
            key={tag}
            active={activeTag === tag}
            onClick={() => handleTagClick(tag)}
          >
            {capitalize(tag)}
          </FilterPill>
        ))}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                'ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border bg-paper px-3 py-1.5 text-[12.5px] font-semibold text-ink-2',
                'transition-colors hover:border-brand/40 hover:text-brand',
              )}
            >
              <SlidersHorizontal className="size-[13px]" />
              {sort.label}
              <ChevronDown className="size-3 text-ink-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={6}
            className="w-44 rounded-xl border-border bg-paper p-1 shadow-soft-lg"
          >
            {SORTS.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                onSelect={() => setSortKey(opt.value)}
                className={cn(
                  'rounded-lg px-2.5 py-1.5 text-[13px]',
                  sortKey === opt.value && 'bg-brand-soft/60 text-brand',
                )}
              >
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Feed */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((key) => (
            <Skeleton key={key} className="h-72 w-full rounded-2xl" />
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

function FilterPill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold transition-colors',
        active
          ? 'border-brand bg-ink text-paper shadow-soft'
          : 'border-border bg-paper text-ink-2 hover:border-brand/40 hover:bg-brand-soft/40 hover:text-brand',
      )}
    >
      {children}
    </button>
  )
}

function capitalize(s) {
  if (!s) return ''
  return s.charAt(0).toUpperCase() + s.slice(1)
}
