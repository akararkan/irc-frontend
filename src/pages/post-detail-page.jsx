import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, FileQuestion, Loader2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/app/empty-state'
import { PostCard } from '@/components/app/post-card'
import { getPost } from '@/features/posts/posts.api'
import { useToast } from '@/components/ui/toaster'
import { extractApiMessage } from '@/lib/api-error'

/**
 * Public post permalink. Reached from:
 *
 *   - Notifications → POST_REACTED / POST_COMMENTED / POST_SHARED rows
 *     whose `deepLink` is `/posts/{id}`.
 *   - Search hits with type=POST.
 *   - Bell preview rows.
 *
 * Renders the same `PostCard` the feed uses, with comments open by
 * default — that's what the user came here to read. The card already
 * subscribes to the per-post realtime stream via `usePostStream`, so
 * counters / comments / deletes flow in live without extra wiring.
 */
export function PostDetailPage() {
  const { postId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const load = useCallback(async () => {
    if (!postId) return
    setLoading(true)
    setNotFound(false)
    try {
      const data = await getPost(postId)
      setPost(data ?? null)
      if (!data) setNotFound(true)
    } catch (error) {
      const status = error?.response?.status
      if (status === 404 || status === 403) {
        // 403 covers the SocialGuard "blocked viewer" case — the
        // server intentionally returns 404/403 to avoid leaking the
        // block. Either way, "this post isn't here" is the honest UI.
        setNotFound(true)
      } else {
        toast.error(extractApiMessage(error, 'Could not load post.'))
        setNotFound(true)
      }
    } finally {
      setLoading(false)
    }
  }, [postId, toast])

  useEffect(() => {
    load()
  }, [load])

  function handleDelete(deletedId) {
    if (deletedId !== postId) return
    toast.info('Post deleted.')
    navigate('/', { replace: true })
  }

  function handleRepostCreated(newPost) {
    if (!newPost) return
    // Land the user on their fresh repost so they can see what they
    // just published.
    navigate(`/posts/${newPost.id}`, { replace: false })
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <BackBar />
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      </div>
    )
  }

  if (notFound || !post) {
    return (
      <div className="space-y-6">
        <BackBar />
        <EmptyState
          icon={FileQuestion}
          title="Post not found"
          description="It may have been removed by its author, or you don't have permission to view it."
          action={
            <Button asChild size="sm" variant="outline" className="rounded-full">
              <Link to="/">Back home</Link>
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-12">
      <BackBar />
      <PostCard
        post={post}
        defaultCommentsOpen
        onChange={(updated) => setPost((current) => ({ ...current, ...updated }))}
        onDelete={handleDelete}
        onRepostCreated={handleRepostCreated}
      />
    </div>
  )
}

function BackBar() {
  return (
    <div className="flex items-center justify-between gap-3">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to feed
      </Link>
    </div>
  )
}
