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
import { getFeed, getFollowingFeed } from '@/features/posts/posts.api'
import {
  getResearchFeed,
  getResearchFollowingFeed,
} from '@/features/research/research.api'
import { getQuestions, getQuestionsFollowing } from '@/features/qna/qna.api'
import { useToast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import { extractApiMessage } from '@/lib/api-error'

const FILTERS = [
  { value: 'ALL', label: 'Everything' },
  { value: 'POSTS', label: 'Posts' },
  { value: 'RESEARCH', label: 'Research' },
  { value: 'QUESTIONS', label: 'Q&A' },
]

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

  // Authenticated viewers see following-first, falling back to the
  // public feed whenever the following result is empty *or* errors —
  // a 200 with `content: []` looks identical to a user who follows
  // nobody, so we can't rely on the catch alone.
  const fetchWithFallback = useCallback(
    async (followingFn, publicFn, pageIndex) => {
      const isEmpty = (data) =>
        !data || !Array.isArray(data.content) || data.content.length === 0
      try {
        if (isAuthenticated) {
          const followingData = await followingFn({ page: pageIndex, size: PAGE_SIZE })
          if (!isEmpty(followingData)) {
            return { data: followingData, ok: true }
          }
        }
        const publicData = await publicFn({ page: pageIndex, size: PAGE_SIZE })
        return { data: publicData, ok: true }
      } catch (error) {
        if (isAuthenticated) {
          try {
            const publicData = await publicFn({ page: pageIndex, size: PAGE_SIZE })
            return { data: publicData, ok: true }
          } catch (innerError) {
            return { error: innerError, ok: false }
          }
        }
        return { error, ok: false }
      }
    },
    [isAuthenticated],
  )

  const fetchPage = useCallback(
    (pageIndex) =>
      Promise.all([
        fetchWithFallback(getFollowingFeed, getFeed, pageIndex),
        fetchWithFallback(getResearchFollowingFeed, getResearchFeed, pageIndex),
        fetchWithFallback(getQuestionsFollowing, getQuestions, pageIndex),
      ]),
    [fetchWithFallback],
  )

  const load = useCallback(
    async ({ append } = { append: false }) => {
      setLoading(true)
      try {
        const pageIndex = append
          ? { posts: pages.posts + 1, research: pages.research + 1, questions: pages.questions + 1 }
          : { posts: 0, research: 0, questions: 0 }

        const nextEntries = []
        const nextHasMore = { ...hasMore }

        const [postResult, researchResult, questionResult] = await fetchPage(
          append
            ? Math.max(pageIndex.posts, pageIndex.research, pageIndex.questions)
            : 0,
        )

        if (postResult.ok) {
          const posts = postResult.data?.content ?? []
          nextHasMore.posts = !postResult.data?.last && posts.length === PAGE_SIZE
          posts.forEach((p) => nextEntries.push({ kind: 'post', id: `post:${p.id}`, data: p }))
        } else {
          nextHasMore.posts = false
        }

        if (researchResult.ok) {
          const research = researchResult.data?.content ?? []
          nextHasMore.research = !researchResult.data?.last && research.length === PAGE_SIZE
          research.forEach((r) => nextEntries.push({ kind: 'research', id: `research:${r.id}`, data: r }))
        } else {
          nextHasMore.research = false
        }

        if (questionResult.ok) {
          const questions = questionResult.data?.content ?? []
          nextHasMore.questions = !questionResult.data?.last && questions.length === PAGE_SIZE
          questions.forEach((q) => nextEntries.push({ kind: 'question', id: `question:${q.id}`, data: q }))
        } else {
          nextHasMore.questions = false
        }

        nextEntries.sort((a, b) => timestampOf(b) - timestampOf(a))

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
    [fetchPage, hasMore, pages, toast],
  )

  useEffect(() => {
    setEntries([])
    setPages({ posts: 0, research: 0, questions: 0 })
    setHasMore({ posts: true, research: true, questions: true })
    setInitializing(true)
    load({ append: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated])

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
        <div className="flex items-center gap-2">
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
              ? "Follow people to see their posts, research, and questions here."
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

export function addPostToFeed(entries, post) {
  if (!post) return entries
  const newEntry = { kind: 'post', id: `post:${post.id}`, data: post }
  return [newEntry, ...entries.filter((e) => e.id !== newEntry.id)]
}
