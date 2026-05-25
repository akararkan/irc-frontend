import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft,
  Eye,
  FileQuestion,
  Loader2,
  MessageCircle,
  Repeat2,
  BookMarked,
  Heart,
  Share2,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/app/empty-state'
import { PostCard } from '@/components/app/post-card'
import { UserAvatar } from '@/components/app/user-avatar'
import { getPost, listPostShares } from '@/features/posts/posts.api'
import { useToast } from '@/components/ui/toaster'
import { useAuth } from '@/features/auth/auth-context'
import { extractApiMessage } from '@/lib/api-error'
import { formatNumber, getFullName, getHandle } from '@/lib/format'
import { RelativeTime } from '@/components/app/relative-time'
import { usePostStream } from '@/hooks/use-post-stream'
import { bumpCounter, getCounter, useCounter } from '@/lib/counter-store'

/* ── Stat chip ─────────────────────────────────────────────────── */
function StatChip({ icon: Icon, count, label }) {
  return (
    <div className="flex items-center gap-1.5" title={label}>
      <span className="font-mono text-[22px] font-semibold leading-none tracking-[-0.02em] text-fg">
        {formatNumber(count)}
      </span>
      <span className="text-[12.5px] text-fg-muted">{label}</span>
    </div>
  )
}

/* ── Live counter stats row ────────────────────────────────────── */
function PostStatsRow({ post }) {
  const storedReactions = useCounter('post', post.id, 'rc', post.reactionCount ?? 0)
  const storedComments  = useCounter('post', post.id, 'cc', post.commentCount  ?? 0)
  const storedSaves     = useCounter('post', post.id, 'sv', post.saveCount      ?? 0)
  const storedShares    = useCounter('post', post.id, 'sh', post.shareCount     ?? 0)
  const storedViews     = useCounter('post', post.id, 'vc', post.viewCount      ?? 0)

  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-line py-4">
      <StatChip icon={Heart}         count={storedReactions} label={storedReactions === 1 ? 'reaction' : 'reactions'} />
      <StatChip icon={MessageCircle} count={storedComments}  label={storedComments  === 1 ? 'comment'  : 'comments'}  />
      <StatChip icon={BookMarked}    count={storedSaves}     label={storedSaves     === 1 ? 'save'     : 'saves'}     />
      <StatChip icon={Repeat2}       count={storedShares}    label={storedShares    === 1 ? 'share'    : 'shares'}    />
      <div className="ml-auto flex items-center gap-1.5">
        <Eye className="size-3.5 text-fg-faint" strokeWidth={1.6} />
        <span className="font-mono text-[13px] text-fg-muted">
          {formatNumber(storedViews)} {storedViews === 1 ? 'view' : 'views'}
        </span>
      </div>
    </div>
  )
}

/* ── Recent shares rail ────────────────────────────────────────── */
function RecentSharesRail({ postId }) {
  const [shares, setShares] = useState([])

  useEffect(() => {
    listPostShares(postId, { pageSize: 5 })
      .then((data) => setShares(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [postId])

  if (shares.length === 0) return null

  return (
    <aside className="rounded-lg border border-line bg-background">
      <div className="border-b border-line px-4 py-3">
        <p className="text-[13px] font-semibold text-fg">Recent shares</p>
      </div>
      <div className="divide-y divide-line-faint">
        {shares.map((s) => (
          <div key={s.shareId} className="flex items-center gap-3 px-4 py-3">
            <UserAvatar
              user={{ username: s.sharerId }}
              className="size-7 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-medium text-fg">
                {s.sharerId?.slice(0, 8)}
              </p>
              {s.caption ? (
                <p className="truncate text-[11.5px] text-fg-muted">
                  "{s.caption}"
                </p>
              ) : null}
            </div>
            <span className="shrink-0 font-mono text-[10.5px] text-fg-faint">
              <RelativeTime value={s.createdAt} />
            </span>
          </div>
        ))}
      </div>
    </aside>
  )
}

/* ── SSE live indicator ────────────────────────────────────────── */
function LiveBadge({ connected }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`size-1.5 rounded-full ${connected ? 'bg-pos animate-pulse' : 'bg-line-strong'}`}
      />
      <span className="font-mono text-[10.5px] uppercase tracking-[0.04em] text-fg-faint">
        {connected ? 'Live' : 'Offline'}
      </span>
    </div>
  )
}

/* ── Main page ─────────────────────────────────────────────────── */
export function PostDetailPage() {
  const { postId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [sseConnected, setSseConnected] = useState(false)

  // Wire SSE for live counter updates
  usePostStream(
    postId,
    {
      onConnected: () => setSseConnected(true),
      onDisconnected: () => setSseConnected(false),
      onReactionAdded:    () => bumpCounter('post', postId, 'rc', getCounter('post', postId, 'rc') ?? 0,  1),
      onReactionRemoved:  () => bumpCounter('post', postId, 'rc', getCounter('post', postId, 'rc') ?? 0, -1),
      onCommentCreated:   () => bumpCounter('post', postId, 'cc', getCounter('post', postId, 'cc') ?? 0,  1),
      onViewCountUpdated: () => bumpCounter('post', postId, 'vc', getCounter('post', postId, 'vc') ?? 0,  1),
      onSaveCountUpdated: () => {},
      onShareCountUpdated:() => bumpCounter('post', postId, 'sh', getCounter('post', postId, 'sh') ?? 0,  1),
    },
    { enabled: !!postId },
  )

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
        setNotFound(true)
      } else {
        toast.error(extractApiMessage(error, 'Could not load post.'))
        setNotFound(true)
      }
    } finally {
      setLoading(false)
    }
  }, [postId, toast])

  useEffect(() => { load() }, [load])

  function handleDelete(deletedId) {
    if (deletedId !== postId) return
    toast.info('Post deleted.')
    navigate('/', { replace: true })
  }

  function handleRepostCreated(newPost) {
    if (!newPost) return
    navigate(`/posts/${newPost.id}`, { replace: false })
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <BackBar />
        <div className="flex items-center justify-center py-20 text-fg-muted">
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
            <Button asChild size="sm" variant="outline" className="rounded-md">
              <Link to="/">Back home</Link>
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-0 pb-16">
      {/* Back + live indicator */}
      <div className="flex items-center justify-between gap-3 pb-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-fg-muted transition-colors hover:text-fg"
        >
          <ArrowLeft className="size-3.5" strokeWidth={1.8} />
          Feed
        </Link>
        <LiveBadge connected={sseConnected} />
      </div>

      {/* Two-column layout on wide screens */}
      <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
        {/* Main column */}
        <div className="min-w-0 space-y-0">
          <PostCard
            post={post}
            defaultCommentsOpen
            onChange={(updated) => setPost((cur) => ({ ...cur, ...updated }))}
            onDelete={handleDelete}
            onRepostCreated={handleRepostCreated}
          />
          <PostStatsRow post={post} />
        </div>

        {/* Right rail — desktop only */}
        <aside className="hidden space-y-4 lg:block">
          <RecentSharesRail postId={post.id} />
        </aside>
      </div>
    </div>
  )
}

function BackBar() {
  return (
    <div className="pb-4">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-fg-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="size-3.5" strokeWidth={1.8} />
        Feed
      </Link>
    </div>
  )
}
