import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  ChevronRight,
  Hash,
  Loader2,
  Search as SearchIcon,
  SearchX,
} from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'

import { EmptyState } from '@/components/app/empty-state'
import { PageHeader } from '@/components/app/page-header'
import { RelativeTime } from '@/components/app/relative-time'
import { UserAvatar } from '@/components/app/user-avatar'
import {
  searchAnswers,
  searchByHashtag,
  searchPeople,
  searchPosts,
  searchQuestions,
  searchReels,
  searchResearch,
  unifiedSearch,
} from '@/features/search/search.api'
import { cn } from '@/lib/utils'
import { getHandle } from '@/lib/format'
import { getSearchTypeMeta, searchHitHref } from '@/lib/search'

// Tab order: All on the far left, then a flat list of corpora.
const TABS = [
  { value: 'ALL', label: 'All' },
  { value: 'POST', label: 'Posts' },
  { value: 'REEL', label: 'Reels' },
  { value: 'RESEARCH', label: 'Research' },
  { value: 'QUESTION', label: 'Questions' },
  { value: 'ANSWER', label: 'Answers' },
  { value: 'USER', label: 'People' },
]

const CORPUS_FETCHER = {
  POST: searchPosts,
  REEL: searchReels,
  RESEARCH: searchResearch,
  QUESTION: searchQuestions,
  ANSWER: searchAnswers,
  USER: searchPeople,
}

function SearchHitCard({ hit }) {
  const meta = getSearchTypeMeta(hit.type)
  const Icon = meta.icon
  const href = searchHitHref(hit) ?? '#'
  const isUser = hit.type === 'USER'

  return (
    <Link
      to={href}
      className={cn(
        'group flex items-start gap-3.5 rounded-2xl border border-border bg-card p-4 transition-all',
        'hover:border-brand/40 hover:shadow-soft',
      )}
    >
      {isUser ? (
        <UserAvatar
          user={{
            username: hit.username ?? hit.title,
            fullName: hit.title,
            profileImage: hit.thumbnailUrl,
          }}
          className="size-12 shrink-0"
        />
      ) : hit.thumbnailUrl ? (
        <div className="size-14 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
          <img
            src={hit.thumbnailUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <span
          className={cn(
            'grid size-12 shrink-0 place-items-center rounded-xl border',
            meta.accent,
          )}
          aria-hidden
        >
          <Icon className="size-5" />
        </span>
      )}

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]',
              meta.accent,
            )}
          >
            <Icon className="size-2.5" />
            {meta.label}
          </span>
          {hit.authorUsername && !isUser ? (
            <span className="text-[11.5px] text-muted-foreground">
              @{getHandle({ username: hit.authorUsername })}
            </span>
          ) : null}
          {hit.createdAt ? (
            <>
              <span className="text-muted-foreground" aria-hidden>
                ·
              </span>
              <RelativeTime
                value={hit.createdAt}
                className="text-[11.5px] text-muted-foreground"
              />
            </>
          ) : null}
        </div>

        <p className="line-clamp-2 text-[14.5px] font-semibold leading-snug text-foreground">
          {hit.title || hit.snippet || '(untitled)'}
        </p>

        {hit.snippet && hit.snippet !== hit.title ? (
          <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
            {hit.snippet}
          </p>
        ) : null}
      </div>

      <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
    </Link>
  )
}

function SearchResultsList({ hits }) {
  if (!hits || hits.length === 0) return null
  return (
    <div className="space-y-2.5">
      <AnimatePresence initial={false}>
        {hits.map((hit) => (
          <motion.div
            key={`${hit.type}-${hit.id ?? hit.title}-${hit.score ?? ''}`}
            layout="position"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          >
            <SearchHitCard hit={hit} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialQ = searchParams.get('q') ?? ''
  const initialTab = searchParams.get('type') ?? 'ALL'

  const [query, setQuery] = useState(initialQ)
  const [activeTab, setActiveTab] = useState(initialTab)
  const [unified, setUnified] = useState(null)
  const [scoped, setScoped] = useState(null)
  const [loading, setLoading] = useState(false)

  // The user types `#tag` → run a hashtag-specific lookup against the
  // posts corpus (the only one with hashtag literals indexed).
  const trimmed = query.trim()
  const hashtagMode = trimmed.startsWith('#') && trimmed.length > 1
  const term = hashtagMode ? trimmed.slice(1) : trimmed

  // Reflect the current input into the URL so reload / share works.
  useEffect(() => {
    if (!trimmed) {
      if (searchParams.get('q')) setSearchParams({}, { replace: true })
      return
    }
    const next = { q: trimmed }
    if (activeTab !== 'ALL') next.type = activeTab
    if (
      searchParams.get('q') !== next.q ||
      (searchParams.get('type') ?? 'ALL') !== (next.type ?? 'ALL')
    ) {
      setSearchParams(next, { replace: true })
    }
    // setSearchParams is referentially stable; deps capture intent.

  }, [trimmed, activeTab])

  // Run the appropriate query whenever the term, tab, or hashtag flag
  // changes. Debounced with a 200ms idle to keep typing snappy.
  useEffect(() => {
    if (!term || term.length < 2) {
      setUnified(null)
      setScoped(null)
      setLoading(false)
      return undefined
    }

    let cancelled = false
    setLoading(true)
    const handle = setTimeout(async () => {
      try {
        if (hashtagMode) {
          const hits = await searchByHashtag(term, { limit: 50 })
          if (cancelled) return
          setUnified(null)
          setScoped({ type: 'POST', hits })
        } else if (activeTab === 'ALL') {
          const data = await unifiedSearch({ q: term, limit: 12 })
          if (cancelled) return
          setUnified(data ?? null)
          setScoped(null)
        } else {
          const fetcher = CORPUS_FETCHER[activeTab]
          if (!fetcher) return
          const hits = await fetcher({ q: term, limit: 50 })
          if (cancelled) return
          setUnified(null)
          setScoped({ type: activeTab, hits })
        }
      } catch {
        if (!cancelled) {
          setUnified(null)
          setScoped(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 200)

    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [term, activeTab, hashtagMode])

  const allGroups = useMemo(() => {
    if (!unified) return []
    const groups = unified.groups ?? {}
    return TABS.filter((tab) => tab.value !== 'ALL')
      .map((tab) => ({
        ...tab,
        hits: Array.isArray(groups[tab.value]) ? groups[tab.value] : [],
      }))
      .filter((group) => group.hits.length > 0)
  }, [unified])

  const totalAcross = useMemo(() => {
    if (!unified) return 0
    return Object.values(unified.groups ?? {}).reduce(
      (sum, hits) => sum + (Array.isArray(hits) ? hits.length : 0),
      0,
    )
  }, [unified])

  const showEmpty =
    !loading &&
    term.length >= 2 &&
    ((activeTab === 'ALL' && totalAcross === 0 && !hashtagMode) ||
      (hashtagMode && (scoped?.hits?.length ?? 0) === 0) ||
      (activeTab !== 'ALL' && (scoped?.hits?.length ?? 0) === 0))

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Search"
        title={
          term
            ? hashtagMode
              ? `#${term}`
              : `Results for "${term}"`
            : 'Search the platform'
        }
        description={
          hashtagMode
            ? 'Posts tagged with this hashtag.'
            : 'Posts, reels, research, questions, answers, and people — full-text and typo-tolerant.'
        }
        action={
          loading ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Searching
            </span>
          ) : null
        }
      />

      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder='Try "ihsan", "#hadith", or @username'
          className="h-12 w-full rounded-xl border border-border bg-paper pl-10 pr-4 text-[14px] text-ink placeholder:text-ink-4 focus:border-brand/50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand/15"
          autoFocus
        />
      </div>

      {/* Type tabs (hidden in hashtag mode — that's always Post results). */}
      {!hashtagMode ? (
        <div className="-mx-1 flex flex-wrap items-center gap-1.5 overflow-x-auto px-1 pb-1">
          {TABS.map((tab) => {
            const active = activeTab === tab.value
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors',
                  active
                    ? 'border-brand bg-brand text-brand-foreground'
                    : 'border-border bg-paper text-ink-3 hover:border-brand/40 hover:text-brand',
                )}
                aria-pressed={active}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      ) : (
        <div className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/[0.06] px-3 py-1.5 text-[12.5px] font-semibold text-brand">
          <Hash className="size-3.5" />
          Hashtag · #{term}
        </div>
      )}

      {term.length < 2 ? (
        <EmptyState
          icon={SearchIcon}
          title="Start typing to search"
          description="Type at least two characters. Use #tag for hashtags, @username for people."
        />
      ) : showEmpty ? (
        <EmptyState
          icon={SearchX}
          title={`No matches for "${term}"`}
          description="Try simpler keywords, fix any typos, or switch to a different tab — fuzzy fallback may still find something close."
        />
      ) : activeTab === 'ALL' && !hashtagMode ? (
        <div className="space-y-8">
          {allGroups.map((group) => (
            <section key={group.value} className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {group.label}
                  <span className="ml-2 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
                    {group.hits.length}
                  </span>
                </h2>
                {group.hits.length >= 12 ? (
                  <button
                    type="button"
                    onClick={() => setActiveTab(group.value)}
                    className="inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    See all {group.label.toLowerCase()}
                    <ChevronRight className="size-3.5" />
                  </button>
                ) : null}
              </div>
              <SearchResultsList hits={group.hits} />
            </section>
          ))}
        </div>
      ) : (
        <SearchResultsList hits={scoped?.hits ?? []} />
      )}
    </div>
  )
}
