import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { FileText, Loader2, RefreshCw, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/app/empty-state'
import { PostCard } from '@/components/app/post-card'
import { QuestionFeedCard } from '@/components/app/question-feed-card'
import { ResearchCard } from '@/components/app/research-card'
import { useAuth } from '@/features/auth/auth-context'
import { getFeed, getForYouFeed } from '@/features/posts/posts.api'
import { getResearchFeed } from '@/features/research/research.api'
import { getQuestions } from '@/features/qna/qna.api'
import { useToast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import { extractApiMessage } from '@/lib/api-error'

const FILTERS = [
  { value: 'ALL', label: 'Everything' },
  { value: 'POSTS', label: 'Posts' },
  { value: 'RESEARCH', label: 'Research' },
  { value: 'QUESTIONS', label: 'Q&A' },
]

// Backend's FeedRankingService scores posts and caches the ordering in
// Redis for 60 s — only available to signed-in viewers (it needs the
// viewer id to compute the relationship signal). Guests fall back to
// the chronological public feed automatically.
const FEED_MODES = [
  { value: 'FOR_YOU', label: 'For you', authOnly: true },
  { value: 'LATEST',  label: 'Latest' },
]
const FOR_YOU_LIMIT = 25
const PAGE_SIZE = 10

function timestampOf(entry) {
  const item = entry.data
  const when =
    item.publishedAt ??
    item.createdAt ??
    item.updatedAt ??
    null
  return when ? new Date(when).getTime() : 0
}

function FeedSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((key) => (
        <Card key={key} className="border">
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-40 w-full rounded-lg" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

/**
 * Home feed that merges posts, research publications, and questions into a
 * single chronological stream. When the user is authenticated we use the
 * following-only endpoints; guests see the public feeds.
 */
export const UnifiedFeed = forwardRef(function UnifiedFeed(_props, ref) {
  const { isAuthenticated } = useAuth()
  const toast = useToast()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [pages, setPages] = useState({ posts: 0, research: 0, questions: 0 })
  const [hasMore, setHasMore] = useState({ posts: true, research: true, questions: true })
  const [filter, setFilter] = useState('ALL')
  // Default to the ranked For-You feed for signed-in viewers; guests
  // see chronological "Latest". Stored in component state so users can
  // flip between the two without rebuilding the page.
  const [mode, setMode] = useState(isAuthenticated ? 'FOR_YOU' : 'LATEST')

  const fetchPage = useCallback(
    (pageIndex) => {
      // For-You is a single-shot ranked endpoint (no per-page index —
      // the server caches the top-N in Redis and returns the same
      // ordering for 60 s). We fetch it on the first page and request
      // an empty list on subsequent pages so the ranked top-N stays
      // pinned at the top while pagination falls through to the
      // chronological streams below it.
      const wantForYou = mode === 'FOR_YOU' && isAuthenticated && pageIndex === 0
      const postPromise = wantForYou
        ? getForYouFeed({ limit: FOR_YOU_LIMIT })
            .then((data) => ({
              // Normalize the ranked response shape ({items, hasMore})
              // into the page shape the rest of this function expects
              // (`content`/`last`), so the downstream merge code stays
              // unchanged.
              data: { content: data?.items ?? [], last: !data?.hasMore },
              ok: true,
            }))
            .catch((error) => ({ error, ok: false }))
        : getFeed({ page: pageIndex, size: PAGE_SIZE })
            .then((data) => ({ data, ok: true }))
            .catch((error) => ({ error, ok: false }))
      return Promise.all([
        postPromise,
        getResearchFeed({ page: pageIndex, size: PAGE_SIZE })
          .then((data) => ({ data, ok: true }))
          .catch((error) => ({ error, ok: false })),
        getQuestions({ page: pageIndex, size: PAGE_SIZE })
          .then((data) => ({ data, ok: true }))
          .catch((error) => ({ error, ok: false })),
      ])
    },
    [mode, isAuthenticated],
  )

  const load = useCallback(
    async ({ append } = { append: false }) => {
      setLoading(true)
      const ranked = mode === 'FOR_YOU' && isAuthenticated
      try {
        const pageIndex = append
          ? { posts: pages.posts + 1, research: pages.research + 1, questions: pages.questions + 1 }
          : { posts: 0, research: 0, questions: 0 }

        const postEntries = []
        const otherEntries = []
        const nextHasMore = { ...hasMore }

        const [postResult, researchResult, questionResult] = await fetchPage(
          append
            ? Math.max(pageIndex.posts, pageIndex.research, pageIndex.questions)
            : 0,
        )

        if (postResult.ok) {
          const posts = postResult.data?.content ?? []
          // In ranked mode the server caches the top-N in Redis for
          // 60 s — there's no "next page" to ask for, so hasMore is
          // pinned false after the first load.
          nextHasMore.posts = ranked
            ? false
            : !postResult.data?.last && posts.length === PAGE_SIZE
          posts.forEach((p) => postEntries.push({ kind: 'post', id: `post:${p.id}`, data: p }))
        } else {
          nextHasMore.posts = false
        }

        if (researchResult.ok) {
          const research = researchResult.data?.content ?? []
          nextHasMore.research = !researchResult.data?.last && research.length === PAGE_SIZE
          research.forEach((r) => otherEntries.push({ kind: 'research', id: `research:${r.id}`, data: r }))
        } else {
          nextHasMore.research = false
        }

        if (questionResult.ok) {
          const questions = questionResult.data?.content ?? []
          nextHasMore.questions = !questionResult.data?.last && questions.length === PAGE_SIZE
          questions.forEach((q) => otherEntries.push({ kind: 'question', id: `question:${q.id}`, data: q }))
        } else {
          nextHasMore.questions = false
        }

        // Ranked mode: keep the server's ordering for posts (the score
        // is meaningful) and slot research + questions chronologically
        // among themselves. Chronological mode: one merged stream.
        otherEntries.sort((a, b) => timestampOf(b) - timestampOf(a))
        const nextEntries = ranked
          ? [...postEntries, ...otherEntries]
          : [...postEntries, ...otherEntries].sort(
              (a, b) => timestampOf(b) - timestampOf(a),
            )

        setPages(pageIndex)
        setHasMore(nextHasMore)
        setEntries((current) => {
          if (!append) return nextEntries
          const seen = new Set(current.map((e) => e.id))
          return [...current, ...nextEntries.filter((e) => !seen.has(e.id))]
        })
      } catch (error) {
        toast.error(extractApiMessage(error, 'Could not load the feed.'))
      } finally {
        setLoading(false)
        setInitializing(false)
      }
    },
    [fetchPage, hasMore, pages, toast, mode, isAuthenticated],
  )

  // Re-fetch whenever the viewer flips between signed-in/guest OR
  // toggles For-You ↔ Latest. The state reset is identical in both
  // cases, so they share one effect.
  useEffect(() => {
    setEntries([])
    setPages({ posts: 0, research: 0, questions: 0 })
    setHasMore({ posts: true, research: true, questions: true })
    setInitializing(true)
    load({ append: false })
  }, [isAuthenticated, mode])

  useImperativeHandle(
    ref,
    () => ({
      insertPost: (post) => {
        if (!post) return
        setEntries((current) => addPostToFeed(current, post))
      },
      insertResearch: (item) => {
        if (!item) return
        const entry = { kind: 'research', id: `research:${item.id}`, data: item }
        setEntries((current) => [entry, ...current.filter((e) => e.id !== entry.id)])
      },
      insertQuestion: (item) => {
        if (!item) return
        const entry = { kind: 'question', id: `question:${item.id}`, data: item }
        setEntries((current) => [entry, ...current.filter((e) => e.id !== entry.id)])
      },
      refresh: () => load({ append: false }),
    }),
    [load],
  )

  function handlePostChange(updated) {
    setEntries((current) =>
      current.map((entry) =>
        entry.kind === 'post' && entry.data.id === updated.id
          ? { ...entry, data: { ...entry.data, ...updated } }
          : entry,
      ),
    )
  }

  function handlePostDelete(postId) {
    setEntries((current) =>
      current.filter((entry) => !(entry.kind === 'post' && entry.data.id === postId)),
    )
  }

  function handleRepostCreated(newPost) {
    if (!newPost) return
    setEntries((current) => addPostToFeed(current, newPost))
  }

  const visibleEntries = entries.filter((entry) => {
    if (filter === 'ALL') return true
    if (filter === 'POSTS') return entry.kind === 'post'
    if (filter === 'RESEARCH') return entry.kind === 'research'
    if (filter === 'QUESTIONS') return entry.kind === 'question'
    return true
  })

  const canLoadMore =
    filter === 'ALL'
      ? hasMore.posts || hasMore.research || hasMore.questions
      : filter === 'POSTS'
        ? hasMore.posts
        : filter === 'RESEARCH'
          ? hasMore.research
          : hasMore.questions

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Your feed
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* For-You ↔ Latest toggle — only meaningful when signed in
              (ranking needs the viewer id to compute the relationship
              signal). Hidden for guests, who always see Latest. */}
          {isAuthenticated ? (
            <div className="flex items-center gap-1 rounded-full bg-muted p-1">
              {FEED_MODES.map((option) => {
                const active = mode === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setMode(option.value)}
                    className={cn(
                      'relative rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                      active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                    )}
                    title={
                      option.value === 'FOR_YOU'
                        ? 'Ranked by engagement, recency and who you follow'
                        : 'Newest first across the whole community'
                    }
                  >
                    {active ? (
                      <motion.span
                        layoutId="feedModePill"
                        className="absolute inset-0 rounded-full bg-background shadow-sm"
                        transition={{ type: 'spring', stiffness: 360, damping: 30 }}
                      />
                    ) : null}
                    <span className="relative">{option.label}</span>
                  </button>
                )
              })}
            </div>
          ) : null}
          <div className="flex items-center gap-1 rounded-full bg-muted p-1">
            {FILTERS.map((option) => {
              const active = filter === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFilter(option.value)}
                  className={cn(
                    'relative rounded-full px-3 py-1 text-xs font-medium transition-colors',
                    active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="feedFilterPill"
                      className="absolute inset-0 rounded-full bg-background shadow-sm"
                      transition={{ type: 'spring', stiffness: 360, damping: 30 }}
                    />
                  ) : null}
                  <span className="relative">{option.label}</span>
                </button>
              )
            })}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 rounded-full text-muted-foreground"
            onClick={() => load({ append: false })}
            disabled={loading}
          >
            <RefreshCw className={loading ? 'size-3.5 animate-spin' : 'size-3.5'} />
            Refresh
          </Button>
        </div>
      </div>

      {initializing ? (
        <FeedSkeleton />
      ) : visibleEntries.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nothing here yet"
          description={
            filter === 'ALL'
              ? 'No posts, research, or questions yet — be the first to share.'
              : 'Try changing the filter or check back soon.'
          }
        />
      ) : (
        <div className="space-y-5">
          <AnimatePresence initial={false}>
            {visibleEntries.map((entry, index) => {
              let child
              if (entry.kind === 'post') {
                child = (
                  <PostCard
                    post={entry.data}
                    onChange={handlePostChange}
                    onDelete={handlePostDelete}
                    onRepostCreated={handleRepostCreated}
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

          {canLoadMore ? (
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => load({ append: true })}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Loading
                  </>
                ) : (
                  'Load more'
                )}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </section>
  )
})

function addPostToFeed(entries, post) {
  if (!post) return entries
  const newEntry = { kind: 'post', id: `post:${post.id}`, data: post }
  return [newEntry, ...entries.filter((e) => e.id !== newEntry.id)]
}
