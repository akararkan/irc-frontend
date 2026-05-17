import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, FlaskConical, Search, SlidersHorizontal } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  { value: 'recent', label: 'Most recent', sort: 'publishedAt,desc' },
  { value: 'cited', label: 'Most cited', sort: 'citationCount,desc' },
  { value: 'read', label: 'Most read', sort: 'viewCount,desc' },
  { value: 'oldest', label: 'Oldest first', sort: 'publishedAt,asc' },
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

  const sort = useMemo(() => SORTS.find((s) => s.value === sortKey) ?? SORTS[1], [sortKey])

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

  const totalPapers = page?.totalElements ?? items.length
  const totalCitations = items.reduce((acc, item) => acc + (item.citationCount ?? 0), 0)
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
              className="gap-2 bg-[#0891B2] text-white transition-colors hover:bg-[#0E7490]"
            />
          ) : null
        }
        stats={[
          { value: formatNumber(totalPapers), label: 'Open papers' },
          { value: formatNumber(totalCitations), label: 'Citations' },
          { value: formatNumber(totalDisciplines), label: 'Disciplines' },
        ]}
      />

      {/* Search bar */}
      <form onSubmit={handleSearch} className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[15px] -translate-y-1/2 text-ink-4" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search papers, authors, topics…"
          className={cn(
            'h-11 w-full rounded-lg border border-border bg-paper pl-10 pr-24 text-[13.5px] text-ink outline-none',
            'placeholder:text-ink-4 transition-colors',
            'focus:border-[#0891B2]/50 focus:ring-[3px] focus:ring-[#0891B2]/15',
          )}
        />
        <button
          type="submit"
          className="absolute right-1.5 top-1/2 inline-flex h-8 -translate-y-1/2 items-center rounded-md bg-[#0891B2] px-3.5 text-[12.5px] font-medium text-white transition-colors hover:bg-[#0E7490]"
        >
          Search
        </button>
      </form>

      {/* Discipline filter row */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterPill active={activeTag === null} onClick={() => handleTagClick(null)}>
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
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border bg-paper px-3 py-1.5 text-[12.5px] font-medium text-ink-2 transition-colors hover:border-[#0891B2]/40 hover:text-[#0891B2]"
            >
              <SlidersHorizontal className="size-[13px]" />
              {sort.label}
              <ChevronDown className="size-3 text-ink-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={6} className="w-44 rounded-xl p-1">
            {SORTS.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                onSelect={() => setSortKey(opt.value)}
                className={cn(
                  'rounded-lg px-2.5 py-1.5 text-[13px]',
                  sortKey === opt.value && 'bg-[#ECFEFF] text-[#0891B2]',
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
        'inline-flex items-center rounded-lg border px-3 py-1.5 text-[12.5px] font-medium transition-colors',
        active
          ? 'border-[#0891B2] bg-[#0891B2] text-white'
          : 'border-border bg-paper text-ink-2 hover:border-[#0891B2]/40 hover:text-[#0891B2]',
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
