import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { FileText, Loader2, RefreshCw } from 'lucide-react'

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
    <div className="space-y-px">
      {[0, 1, 2].map((key) => (
        <div key={key} className="overflow-hidden rounded-lg border-[0.5px] border-line bg-background p-5">
          <div className="flex items-start gap-3.5">
            <div className="size-10 shrink-0 rounded-full shimmer" />
            <div className="flex-1 space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="h-3 w-28 rounded-full shimmer" />
                <div className="h-3 w-16 rounded-full shimmer" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-full rounded-full shimmer" />
                <div className="h-4 w-[85%] rounded-full shimmer" />
                <div className="h-4 w-[60%] rounded-full shimmer" />
              </div>
              <div className="flex gap-2 pt-1">
                <div className="h-8 w-20 rounded-full shimmer" />
                <div className="h-8 w-20 rounded-full shimmer" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Data fetcher per tab ───────────────────────────────────────────
//
// Each of the three streams normalises to:
//   { items: Array, hasMore: boolean, nextCursor: string|null, error: Error|null }
//
// Pagination shape can be EITHER a plain array (Cassandra-era returns
// `[FeedByUserEntity]`) OR a wrapped object (Spring `Page` for the
// research / QnA-following feeds, or cursor envelope for posts/QnA
// cursor). The normalisers below cover both so the merge loop only
// ever deals with one canonical shape.

function pickCursorFromTail(items) {
  const last = items?.[items.length - 1]
  return last?.createdAt ?? last?.publishedAt ?? last?.updatedAt ?? null
}

function normalizeCursorPage(data, pageSize) {
  if (Array.isArray(data)) {
    return {
      items: data,
      // Cassandra rows arrive in clustering order — if we got a full
      // page back, assume there's more and use the last row's
      // timestamp as the next cursor.
      hasMore: data.length >= pageSize,
      nextCursor: pickCursorFromTail(data),
    }
  }
  const items = data?.items ?? data?.content ?? []
  const hasMore = data?.hasMore ?? (data?.last != null ? !data.last : items.length >= pageSize)
  const nextCursor = data?.nextCursor ?? (hasMore ? pickCursorFromTail(items) : null)
  return { items, hasMore, nextCursor }
}

function normalizeSpringPage(data) {
  if (Array.isArray(data)) {
    return { items: data, hasMore: false }
  }
  const items = data?.content ?? data?.items ?? []
  return { items, hasMore: data?.last != null ? !data.last : false }
}

async function fetchTabPage(tab, cursors, append, userId) {
  const results = {
    posts: null,
    research: null,
    questions: null,
    errors: { posts: null, research: null, questions: null },
  }

  const promises = []

  if (tab.posts === 'for-you') {
    promises.push(
      getForYouFeed({ userId, limit: FOR_YOU_LIMIT })
        .then((data) => { results.posts = normalizeCursorPage(data, FOR_YOU_LIMIT) })
        .catch((error) => {
          results.posts = { items: [], hasMore: false, nextCursor: null }
          results.errors.posts = error
        }),
    )
  } else if (tab.posts === 'following') {
    promises.push(
      getFollowingFeedCursor({ userId, cursor: append ? cursors.posts : null, limit: PAGE_SIZE })
        .then((data) => { results.posts = normalizeCursorPage(data, PAGE_SIZE) })
        .catch((error) => {
          results.posts = { items: [], hasMore: false, nextCursor: null }
          results.errors.posts = error
        }),
    )
  } else if (tab.posts === 'public') {
    promises.push(
      getFeedCursor({ userId, cursor: append ? cursors.posts : null, limit: PAGE_SIZE })
        .then((data) => { results.posts = normalizeCursorPage(data, PAGE_SIZE) })
        .catch((error) => {
          results.posts = { items: [], hasMore: false, nextCursor: null }
          results.errors.posts = error
        }),
    )
  }

  if (tab.res === 'following') {
    promises.push(
      getResearchFollowingFeed({ page: append ? cursors.resPage : 0, size: PAGE_SIZE })
        .then((data) => { results.research = normalizeSpringPage(data) })
        .catch((error) => {
          results.research = { items: [], hasMore: false }
          results.errors.research = error
        }),
    )
  } else if (tab.res === 'public') {
    promises.push(
      getResearchFeed({ page: append ? cursors.resPage : 0, size: PAGE_SIZE })
        .then((data) => { results.research = normalizeSpringPage(data) })
        .catch((error) => {
          results.research = { items: [], hasMore: false }
          results.errors.research = error
        }),
    )
  }

  if (tab.qna === 'following') {
    promises.push(
      getQuestionsFollowing({ page: append ? cursors.qnaPage : 0, size: PAGE_SIZE })
        .then((data) => { results.questions = normalizeSpringPage(data) })
        .catch((error) => {
          results.questions = { items: [], hasMore: false }
          results.errors.questions = error
        }),
    )
  } else if (tab.qna === 'public') {
    promises.push(
      getQuestionsCursor({ cursor: append ? cursors.questions : null, limit: PAGE_SIZE })
        .then((data) => { results.questions = normalizeCursorPage(data, PAGE_SIZE) })
        .catch((error) => {
          results.questions = { items: [], hasMore: false, nextCursor: null }
          results.errors.questions = error
        }),
    )
  }

  await Promise.all(promises)
  return results
}

export const UnifiedFeed = forwardRef(function UnifiedFeed(_props, ref) {
  const { user, isAuthenticated } = useAuth()
  const userId = user?.id ?? null
  const toast = useToast()

  const defaultTab = 'FOR_YOU'
  const [activeTab, setActiveTab] = useState(defaultTab)
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  // Cursors — posts/questions use ISO cursors, research uses page index
  const cursors = useRef({ posts: null, questions: null, resPage: 0, qnaPage: 0 })
  const [hasMore, setHasMore] = useState({ posts: true, research: true, questions: true })
  // Per-stream failure flags so we can show "Posts couldn't load" without
  // blanking the whole feed when only one of three streams is down.
  const [streamErrors, setStreamErrors] = useState({ posts: false, research: false, questions: false })

  const currentTab = TABS.find((t) => t.value === activeTab) ?? TABS[0]

  const load = useCallback(
    async ({ append = false } = {}) => {
      setLoading(true)
      try {
        const tab = TABS.find((t) => t.value === activeTab) ?? TABS[0]
        const result = await fetchTabPage(tab, cursors.current, append, userId)

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
        setStreamErrors({
          posts: Boolean(result.errors?.posts),
          research: Boolean(result.errors?.research),
          questions: Boolean(result.errors?.questions),
        })
        setEntries((current) => {
          if (!append) return merged
          const seen = new Set(current.map((e) => e.id))
          return [...current, ...merged.filter((e) => !seen.has(e.id))]
        })
        // Only surface a toast if EVERY requested stream failed — a
        // partial outage stays silent in the toast layer and is shown
        // inline by the banner below instead.
        const requested = [tab.posts, tab.res, tab.qna].filter(Boolean)
        const failed = [result.errors?.posts, result.errors?.research, result.errors?.questions]
          .filter(Boolean)
        if (requested.length > 0 && failed.length === requested.length) {
          toast.error(extractApiMessage(failed[0], 'Could not load the feed.'))
        }
      } catch (error) {
        toast.error(extractApiMessage(error, 'Could not load the feed.'))
      } finally {
        setLoading(false)
        setInitializing(false)
      }
    },
    [activeTab, userId, toast],
  )

  // Reset + reload whenever tab or auth state changes
  useEffect(() => {
    cursors.current = { posts: null, questions: null, resPage: 0, qnaPage: 0 }
    setEntries([])
    setHasMore({ posts: true, research: true, questions: true })
    setStreamErrors({ posts: false, research: false, questions: false })
    setInitializing(true)
    load({ append: false })
  }, [activeTab, isAuthenticated, userId])

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
    <section className="space-y-4">
      {/* ── Feed header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: label */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
            Your Feed
          </span>
        </div>

        {/* Right: tabs + refresh */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="scrollbar-none flex items-center gap-0.5 overflow-x-auto rounded-full p-1"
            style={{
              background: 'var(--secondary)',
              boxShadow: 'inset 0 0 0 0.5px var(--border)',
            }}
          >
            {visibleTabs.map((tab) => {
              const active = activeTab === tab.value
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setActiveTab(tab.value)}
                  className={cn(
                    'relative shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors',
                    active ? 'text-ink' : 'text-fg-muted hover:text-ink',
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="feedTabPill"
                      className="absolute inset-0 rounded-full bg-background"
                      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08), 0 0 0 0.5px var(--border)' }}
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
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
            className="grid size-8 place-items-center rounded-full text-fg-muted transition-colors hover:bg-bg-soft hover:text-ink disabled:opacity-50"
            title="Refresh feed"
          >
            <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} strokeWidth={1.6} />
          </button>
        </div>
      </div>

      {/* ── Partial-failure banner ─────────────────────────────── */}
      {!initializing && (streamErrors.posts || streamErrors.research || streamErrors.questions) ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-line bg-bg-soft px-3 py-2 text-[12.5px] text-fg-soft">
          <span>
            {[
              streamErrors.posts && 'posts',
              streamErrors.research && 'research',
              streamErrors.questions && 'questions',
            ]
              .filter(Boolean)
              .join(' · ')}
            {' '}couldn't load — showing what's available.
          </span>
          <button
            type="button"
            onClick={() => load({ append: false })}
            className="rounded-full px-2.5 py-1 text-[12px] font-medium text-ink underline-offset-2 hover:underline"
          >
            Retry
          </button>
        </div>
      ) : null}

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
        <div className="space-y-3">
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
            <div className="flex justify-center py-8">
              <motion.button
                type="button"
                onClick={() => load({ append: true })}
                disabled={loading}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center gap-2 rounded-full border-[0.5px] border-line bg-background px-6 py-2.5 text-[13px] font-medium text-fg-soft transition-colors hover:bg-bg-soft hover:text-ink disabled:opacity-50"
                style={{ boxShadow: 'var(--shadow-xs)' }}
              >
                {loading
                  ? <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
                  : <RefreshCw className="size-3.5" strokeWidth={1.5} />
                }
                {loading ? 'Loading…' : 'Load more'}
              </motion.button>
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
