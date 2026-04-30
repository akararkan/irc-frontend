import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Compass, Loader2, Search, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/app/empty-state'
import { PageHeader } from '@/components/app/page-header'
import { PostCard } from '@/components/app/post-card'
import { QuestionFeedCard } from '@/components/app/question-feed-card'
import { ResearchCard } from '@/components/app/research-card'
import { UnifiedFeed } from '@/components/app/unified-feed'
import { searchPosts } from '@/features/posts/posts.api'
import { searchResearch } from '@/features/research/research.api'
import { getQuestions } from '@/features/qna/qna.api'
import { useToast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import { extractApiMessage } from '@/lib/api-error'

function timestampOf(entry) {
  const when = entry.data.publishedAt ?? entry.data.createdAt ?? entry.data.updatedAt
  return when ? new Date(when).getTime() : 0
}

function SearchResults({ query }) {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState([])

  useEffect(() => {
    if (!query) {
      setEntries([])
      setLoading(false)
      return undefined
    }
    let cancelled = false
    async function run() {
      setLoading(true)
      try {
        const [postsData, researchData] = await Promise.all([
          searchPosts({ q: query, page: 0, size: 15 }).catch(() => null),
          searchResearch({ q: query, page: 0, size: 15 }).catch(() => null),
        ])
        if (cancelled) return

        const needle = query.toLowerCase()
        const questionsData = await getQuestions({ page: 0, size: 40 }).catch(() => null)
        const filteredQuestions = (questionsData?.content ?? []).filter((q) => {
          const haystack = `${q.title ?? ''} ${q.body ?? ''}`.toLowerCase()
          return haystack.includes(needle)
        })

        const merged = []
        ;(postsData?.content ?? []).forEach((p) =>
          merged.push({ kind: 'post', id: `post:${p.id}`, data: p }),
        )
        ;(researchData?.content ?? []).forEach((r) =>
          merged.push({ kind: 'research', id: `research:${r.id}`, data: r }),
        )
        filteredQuestions.slice(0, 15).forEach((q) =>
          merged.push({ kind: 'question', id: `question:${q.id}`, data: q }),
        )
        merged.sort((a, b) => timestampOf(b) - timestampOf(a))
        setEntries(merged)
      } catch (error) {
        if (!cancelled) toast.error(extractApiMessage(error, 'Could not run the search.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [query, toast])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={Compass}
        title="Nothing matched"
        description={`No posts, research, or questions matched "${query}".`}
      />
    )
  }

  return (
    <div className="space-y-5">
      <AnimatePresence initial={false}>
        {entries.map((entry, index) => {
          let child
          if (entry.kind === 'post') {
            child = (
              <PostCard
                post={entry.data}
                onChange={() => {}}
                onDelete={() => {}}
              />
            )
          } else if (entry.kind === 'research') {
            child = <ResearchCard item={entry.data} />
          } else {
            child = <QuestionFeedCard question={entry.data} />
          }
          return (
            <motion.div
              key={entry.id}
              layout="position"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 30,
                delay: Math.min(index, 5) * 0.04,
              }}
            >
              {child}
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

export function ExplorePage() {
  const [query, setQuery] = useState('')
  const [submitted, setSubmitted] = useState('')
  const [searching, setSearching] = useState(false)

  function handleSubmit(event) {
    event.preventDefault()
    const term = query.trim()
    setSubmitted(term)
    setSearching(Boolean(term))
  }

  function clearSearch() {
    setQuery('')
    setSubmitted('')
    setSearching(false)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Explore"
        title="Discover"
        description="A single stream of posts, research, and questions from across the community."
      />

      <form onSubmit={handleSubmit} className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search posts, research, or questions"
          className="h-11 rounded-full pl-9 pr-28"
        />
        <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {searching ? (
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className={cn('rounded-full text-muted-foreground')}
              onClick={clearSearch}
              title="Clear search"
            >
              <X className="size-4" />
            </Button>
          ) : null}
          <Button type="submit" size="sm" className="h-8 rounded-full">
            {searching ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Searching
              </>
            ) : (
              'Search'
            )}
          </Button>
        </div>
      </form>

      {searching ? <SearchResults query={submitted} /> : <UnifiedFeed />}
    </div>
  )
}
