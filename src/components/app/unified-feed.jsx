import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { FileText, Loader2, RefreshCw, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/app/empty-state'
import { PostCard } from '@/components/app/post-card'
import { QuestionFeedCard } from '@/components/app/question-feed-card'
import { ResearchCard } from '@/components/app/research-card'
import { useAuth } from '@/features/auth/auth-context'
import {
  getFeedCursor,
  getFollowingFeedCursor,
  getForYouFeed,
} from '@/features/posts/posts.api'
import {
  getResearchFeed,
  getResearchFollowingFeed,
} from '@/features/research/research.api'
import {
  getQuestionsCursor,
  getQuestionsFollowing,
} from '@/features/qna/qna.api'
import { useToast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import { extractApiMessage } from '@/lib/api-error'

// ─── Tab definitions ────────────────────────────────────────────────
//
// Each tab encodes three signals:
//   • which posts API to call
//   • which content kinds to include (posts / research / questions)
//   • whether the tab requires an authenticated viewer
const TABS = [
  {
    value: 'FOR_YOU',
    label: 'For you',
    kinds: ['post', 'research', 'question'],
    posts: 'public',   // all people's posts (public chronological)
    res: 'public',
    qna: 'public',
  },
  {
    value: 'FOLLOWING',
    label: 'Following',
    authOnly: true,
    kinds: ['post', 'research', 'question'],
    posts: 'following',
    res: 'following',
    qna: 'following',
  },
]

const PAGE_SIZE = 10
const FOR_YOU_LIMIT = 25

function timestampOf(entry) {
  const item = entry.data
  const when = item.publishedAt ?? item.createdAt ?? item.updatedAt ?? null
  return when ? new Date(when).getTime() : 0
}

function FeedSkeleton() {
  return (
    <div className="space-y-0">
      {[0, 1, 2].map((key) => (
        <div key={key} className="border-b-[0.5px] border-border bg-paper py-5">
          <div className="flex items-start gap-4 px-0">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-36" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-3 h-5 w-full" />
              <Skeleton className="h-5 w-4/5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Data fetcher per tab ───────────────────────────────────────────
async function fetchTabPage(tab, cursors, append) {
  const results = { posts: null, research: null, questions: null }

  const promises = []

  if (tab.posts === 'for-you') {
    promises.push(
      getForYouFeed({ limit: FOR_YOU_LIMIT })
        .then((data) => { results.posts = { items: data?.items ?? [], hasMore: data?.hasMore ?? false, nextCursor: null } })
        .catch(() => { results.posts = { items: [], hasMore: false, nextCursor: null } }),
    )
  } else if (tab.posts === 'following') {
    promises.push(
      getFollowingFeedCursor({ cursor: append ? cursors.posts : null, limit: PAGE_SIZE })
        .then((data) => { results.posts = { items: data?.items ?? data?.content ?? [], hasMore: data?.hasMore ?? false, nextCursor: data?.nextCursor ?? null } })
        .catch(() => { results.posts = { items: [], hasMore: false, nextCursor: null } }),
    )
  } else if (tab.posts === 'public') {
    promises.push(
      getFeedCursor({ cursor: append ? cursors.posts : null, limit: PAGE_SIZE })
        .then((data) => { results.posts = { items: data?.items ?? data?.content ?? [], hasMore: data?.hasMore ?? false, nextCursor: data?.nextCursor ?? null } })
        .catch(() => { results.posts = { items: [], hasMore: false, nextCursor: null } }),
    )
  }

  if (tab.res === 'following') {
    promises.push(
      getResearchFollowingFeed({ page: append ? cursors.resPage : 0, size: PAGE_SIZE })
        .then((data) => { results.research = { items: data?.content ?? [], hasMore: !data?.last } })
        .catch(() => { results.research = { items: [], hasMore: false } }),
    )
  } else if (tab.res === 'public') {
    promises.push(
      getResearchFeed({ page: append ? cursors.resPage : 0, size: PAGE_SIZE })
        .then((data) => { results.research = { items: data?.content ?? [], hasMore: !data?.last } })
        .catch(() => { results.research = { items: [], hasMore: false } }),
    )
  }

  if (tab.qna === 'following') {
    promises.push(
      getQuestionsFollowing({ page: append ? cursors.qnaPage : 0, size: PAGE_SIZE })
        .then((data) => { results.questions = { items: data?.content ?? [], hasMore: !data?.last } })
        .catch(() => { results.questions = { items: [], hasMore: false } }),
    )
  } else if (tab.qna === 'public') {
    promises.push(
      getQuestionsCursor({ cursor: append ? cursors.questions : null, limit: PAGE_SIZE })
        .then((data) => { results.questions = { items: data?.items ?? data?.content ?? [], hasMore: data?.hasMore ?? false, nextCursor: data?.nextCursor ?? null } })
        .catch(() => { results.questions = { items: [], hasMore: false, nextCursor: null } }),
    )
  }

  await Promise.all(promises)
  return results
}

export const UnifiedFeed = forwardRef(function UnifiedFeed(_props, ref) {
  const { isAuthenticated } = useAuth()
  const toast = useToast()

  const defaultTab = 'FOR_YOU'
  const [activeTab, setActiveTab] = useState(defaultTab)
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  // Cursors — posts/questions use ISO cursors, research uses page index
  const cursors = useRef({ posts: null, questions: null, resPage: 0, qnaPage: 0 })
  const [hasMore, setHasMore] = useState({ posts: true, research: true, questions: true })

  const currentTab = TABS.find((t) => t.value === activeTab) ?? TABS[0]

  const load = useCallback(
    async ({ append = false } = {}) => {
      setLoading(true)
      try {
        const tab = TABS.find((t) => t.value === activeTab) ?? TABS[0]
        const result = await fetchTabPage(tab, cursors.current, append)

        const postEntries = []
        const otherEntries = []
        const nextHasMore = { ...hasMore }

        if (result.posts) {
          const { items, hasMore: more, nextCursor } = result.posts
          nextHasMore.posts = tab.posts === 'for-you' ? false : more
          items.forEach((p) => postEntries.push({ kind: 'post', id: `post:${p.id}`, data: p }))
          if (!append) cursors.current.posts = nextCursor
          else if (nextCursor) cursors.current.posts = nextCursor
        } else {
          nextHasMore.posts = false
        }

        if (result.research) {
          const { items, hasMore: more } = result.research
          nextHasMore.research = more
          items.forEach((r) => otherEntries.push({ kind: 'research', id: `research:${r.id}`, data: r }))
          if (!append) cursors.current.resPage = 1
          else cursors.current.resPage += 1
        } else {
          nextHasMore.research = false
        }

        if (result.questions) {
          const { items, hasMore: more, nextCursor } = result.questions
          nextHasMore.questions = more
          items.forEach((q) => otherEntries.push({ kind: 'question', id: `question:${q.id}`, data: q }))
          if (!append) cursors.current.questions = nextCursor
          else if (nextCursor) cursors.current.questions = nextCursor
          if (!append) cursors.current.qnaPage = 1
          else cursors.current.qnaPage += 1
        } else {
          nextHasMore.questions = false
        }

        // For-you keeps server's ranking for posts; everything else merges chronologically
        otherEntries.sort((a, b) => timestampOf(b) - timestampOf(a))
        const isRanked = tab.posts === 'for-you'
        const merged = isRanked
          ? [...postEntries, ...otherEntries]
          : [...postEntries, ...otherEntries].sort((a, b) => timestampOf(b) - timestampOf(a))

        setHasMore(nextHasMore)
        setEntries((current) => {
          if (!append) return merged
          const seen = new Set(current.map((e) => e.id))
          return [...current, ...merged.filter((e) => !seen.has(e.id))]
        })
      } catch (error) {
        toast.error(extractApiMessage(error, 'Could not load the feed.'))
      } finally {
        setLoading(false)
        setInitializing(false)
      }
    },
    [activeTab, toast], // eslint-disable-line react-hooks/exhaustive-deps
  )

  // Reset + reload whenever tab or auth state changes
  useEffect(() => {
    cursors.current = { posts: null, questions: null, resPage: 0, qnaPage: 0 }
    setEntries([])
    setHasMore({ posts: true, research: true, questions: true })
    setInitializing(true)
    load({ append: false })
  }, [activeTab, isAuthenticated]) // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({
    insertPost: (post) => {
      if (!post) return
      setEntries((c) => addPostToFeed(c, post))
    },
    insertResearch: (item) => {
      if (!item) return
      const e = { kind: 'research', id: `research:${item.id}`, data: item }
      setEntries((c) => [e, ...c.filter((x) => x.id !== e.id)])
    },
    insertQuestion: (item) => {
      if (!item) return
      const e = { kind: 'question', id: `question:${item.id}`, data: item }
      setEntries((c) => [e, ...c.filter((x) => x.id !== e.id)])
    },
    refresh: () => load({ append: false }),
  }), [load])

  function handlePostChange(updated) {
    setEntries((c) =>
      c.map((e) =>
        e.kind === 'post' && e.data.id === updated.id
          ? { ...e, data: { ...e.data, ...updated } }
          : e,
      ),
    )
  }

  function handlePostDelete(postId) {
    setEntries((c) => c.filter((e) => !(e.kind === 'post' && e.data.id === postId)))
  }

  function handleRepostCreated(newPost) {
    if (!newPost) return
    setEntries((c) => addPostToFeed(c, newPost))
  }

  const canLoadMore = currentTab.kinds.some((k) => {
    if (k === 'post') return hasMore.posts
    if (k === 'research') return hasMore.research
    if (k === 'question') return hasMore.questions
    return false
  })

  const visibleTabs = TABS.filter((t) => !t.authOnly || isAuthenticated)

  return (
    <section className="space-y-0">
      {/* ── Feed header ────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-ink-3" strokeWidth={1.5} />
          <span className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
            Your Feed
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* All tabs in one pill container */}
          <div className="scrollbar-none flex items-center gap-0.5 overflow-x-auto rounded-full bg-secondary p-1">
            {visibleTabs.map((tab) => {
              const active = activeTab === tab.value
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setActiveTab(tab.value)}
                  className={cn(
                    'relative shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors',
                    active ? 'text-ink' : 'text-ink-3 hover:text-ink',
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="feedTabPill"
                      className="absolute inset-0 rounded-full bg-paper shadow-[0_0_0_0.5px_var(--border)]"
                      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                    />
                  ) : null}
                  <span className="relative">{tab.label}</span>
                </button>
              )
            })}
          </div>

          <button
            type="button"
            onClick={() => load({ append: false })}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium text-ink-3 transition-colors hover:bg-secondary hover:text-ink disabled:opacity-50"
          >
            <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} strokeWidth={1.5} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Feed content ───────────────────────────────────────── */}
      {initializing ? (
        <FeedSkeleton />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nothing here yet"
          description={
            activeTab === 'FOLLOWING'
              ? 'Follow people to see their posts, research, and questions here.'
              : 'No content yet — be the first to share something.'
          }
        />
      ) : (
        <div className="space-y-0">
          <AnimatePresence initial={false}>
            {entries.map((entry, index) => {
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
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
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
            <div className="flex justify-center py-6">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => load({ append: true })}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
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
