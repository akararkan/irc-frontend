import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { FileText, Loader2, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/app/empty-state'
import { PostCard } from '@/components/app/post-card'
import { useAuth } from '@/features/auth/auth-context'
import { getFeedCursor, getFollowingFeedCursor } from '@/features/posts/posts.api'
import { useToast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import { extractApiMessage } from '@/lib/api-error'

const FILTERS = [
  { value: 'FOLLOWING', label: 'Following', authOnly: true },
  { value: 'PUBLIC', label: 'Everyone' },
]

const PAGE_SIZE = 15

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
 * Posts-only feed used by the Community page. Stories are always filtered out
 * (they live in the strip). Signed-in users can toggle between Following and
 * Everyone; guests always see the public feed.
 */
export const PostsFeed = forwardRef(function PostsFeed(_props, ref) {
  const { isAuthenticated } = useAuth()
  const toast = useToast()
  const [posts, setPosts] = useState([])
  // Both PUBLIC and FOLLOWING use cursor pagination — stable under
  // concurrent inserts, flat performance past the first ~50 rows.
  const [cursor, setCursor] = useState(null)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [filter, setFilter] = useState(isAuthenticated ? 'FOLLOWING' : 'PUBLIC')

  const loadFirst = useCallback(
    async (filterValue) => {
      const chosenFilter = filterValue ?? filter
      const useFollowing = chosenFilter === 'FOLLOWING' && isAuthenticated
      const fetcher = useFollowing ? getFollowingFeedCursor : getFeedCursor
      setLoading(true)
      try {
        const data = await fetcher({ limit: PAGE_SIZE })
        const items = data?.items ?? []
        setPosts(items)
        setHasMore(Boolean(data?.hasMore))
        setCursor(data?.nextCursor ?? null)
      } catch (error) {
        toast.error(extractApiMessage(error, 'Could not load the feed.'))
      } finally {
        setLoading(false)
        setInitializing(false)
      }
    },
    [filter, isAuthenticated, toast],
  )

  const loadMore = useCallback(async () => {
    if (!cursor) {
      setHasMore(false)
      return
    }
    const useFollowing = filter === 'FOLLOWING' && isAuthenticated
    const fetcher = useFollowing ? getFollowingFeedCursor : getFeedCursor
    setLoading(true)
    try {
      const data = await fetcher({ cursor, limit: PAGE_SIZE })
      const items = data?.items ?? []
      setPosts((current) => [...current, ...items])
      setHasMore(Boolean(data?.hasMore))
      setCursor(data?.nextCursor ?? null)
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not load more posts.'))
    } finally {
      setLoading(false)
    }
  }, [filter, isAuthenticated, cursor, toast])

  useEffect(() => {
    setInitializing(true)
    loadFirst(filter)
  }, [filter, isAuthenticated])

  function handlePostChange(updated) {
    setPosts((current) =>
      current.map((post) => (post.id === updated.id ? { ...post, ...updated } : post)),
    )
  }

  function handlePostDelete(postId) {
    setPosts((current) => current.filter((post) => post.id !== postId))
  }

  function handleRepostCreated(newPost) {
    if (!newPost) return
    setPosts((current) => [
      newPost,
      ...current.filter((post) => post.id !== newPost.id),
    ])
  }

  useImperativeHandle(
    ref,
    () => ({
      insertPost: (post) => {
        if (!post) return
        setPosts((current) => [post, ...current.filter((p) => p.id !== post.id)])
      },
      refresh: () => loadFirst(filter),
    }),
    [loadFirst, filter],
  )

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold tracking-tight">
          {filter === 'FOLLOWING' && isAuthenticated ? 'Following' : 'Community'}
        </h2>
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <div className="flex items-center gap-0.5 rounded-full border border-border bg-secondary/60 p-1">
              {FILTERS.map((option) => {
                const active = filter === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFilter(option.value)}
                    className={cn(
                      'relative rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-colors',
                      active ? 'text-brand' : 'text-ink-3 hover:text-ink',
                    )}
                  >
                    {active ? (
                      <motion.span
                        layoutId="postsFilterPill"
                        className="absolute inset-0 rounded-full bg-paper"
                        style={{ boxShadow: 'var(--shadow-xs)' }}
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      />
                    ) : null}
                    <span className="relative">{option.label}</span>
                  </button>
                )
              })}
            </div>
          ) : null}
          <button
            type="button"
            className="grid size-8 place-items-center rounded-full text-ink-3 transition-colors hover:bg-secondary hover:text-ink disabled:opacity-50"
            onClick={() => loadFirst(filter)}
            disabled={loading}
            aria-label="Refresh"
            title="Refresh"
          >
            <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} />
          </button>
        </div>
      </div>

      {initializing ? (
        <FeedSkeleton />
      ) : posts.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No posts yet"
          description={
            filter === 'FOLLOWING' && isAuthenticated
              ? 'Follow people to see their posts here. Or switch to Everyone.'
              : 'Be the first to share something.'
          }
        />
      ) : (
        <div className="space-y-4">
          <AnimatePresence initial={false}>
            {posts.map((post, index) => (
              <motion.div
                key={post.id}
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
                <PostCard
                  post={post}
                  onChange={handlePostChange}
                  onDelete={handlePostDelete}
                  onRepostCreated={handleRepostCreated}
                />
              </motion.div>
            ))}
          </AnimatePresence>

          {hasMore ? (
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={loadMore}
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
