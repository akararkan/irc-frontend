import { useEffect, useMemo, useState } from 'react'
import { Bookmark, BookMarked, ChevronLeft, Loader2, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/app/empty-state'
import { UserAvatar } from '@/components/app/user-avatar'
import { getSavedPosts } from '@/features/posts/posts.api'
import { useAuth } from '@/features/auth/auth-context'
import { useToast } from '@/components/ui/toaster'
import { extractApiMessage } from '@/lib/api-error'
import { formatNumber, getFullName, getHandle } from '@/lib/format'
import { RelativeTime } from '@/components/app/relative-time'
import { cn } from '@/lib/utils'

const POST_TYPE_LABEL = {
  TEXT: 'Text', EMBEDDED: 'Post', VOICE_POST: 'Voice', REEL: 'Reel', REPOST: 'Repost',
}

/* ── Collection thumb (4-quadrant mosaic) ───────────────────────── */
function CollectionThumb({ posts = [] }) {
  const tones = ['bg-bg-muted', 'bg-line', 'bg-line-strong', 'bg-bg-soft']
  const show = posts.slice(0, 4)
  if (show.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-md bg-bg-muted">
        <BookMarked className="size-6 text-fg-faint" strokeWidth={1.5} />
      </div>
    )
  }
  return (
    <div className="grid aspect-square grid-cols-2 gap-[2px] overflow-hidden rounded-md bg-line">
      {[0, 1, 2, 3].map((i) => {
        const p = show[i]
        const mediaUrl = p?.mediaUrls?.[0] ?? p?.mediaUrl
        return (
          <div key={i} className={cn('overflow-hidden', tones[i])}>
            {mediaUrl ? (
              <img src={mediaUrl} alt="" className="h-full w-full object-cover" />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

/* ── Collection tile ────────────────────────────────────────────── */
function CollectionTile({ name, posts, onClick }) {
  return (
    <button type="button" onClick={onClick} className="group flex flex-col gap-2 text-left">
      <CollectionThumb posts={posts} />
      <div>
        <p className="text-[13.5px] font-semibold text-fg">{name}</p>
        <p className="font-mono text-[10.5px] text-fg-muted">{posts.length} items</p>
      </div>
    </button>
  )
}

/* ── Saved post row (list view) ─────────────────────────────────── */
function SavedPostRow({ post }) {
  const author = post.author ?? {
    fullName: [post.authorFname, post.authorLname].filter(Boolean).join(' ') || null,
    username: post.authorUsername,
    profileImage: post.authorProfileImage ?? post.authorAvatarUrl,
  }
  const displayName = getFullName(author) || getHandle(author) || 'Unknown'
  const typeLabel = POST_TYPE_LABEL[post.postType ?? 'TEXT'] ?? 'Post'
  const mediaUrl = post.mediaUrls?.[0] ?? post.mediaUrl

  return (
    <Link
      to={`/posts/${post.id}`}
      className="flex items-start gap-4 border-b border-line py-4 transition-colors last:border-0 hover:bg-bg-soft"
    >
      {mediaUrl ? (
        <div className="size-14 shrink-0 overflow-hidden rounded-md border border-line bg-bg-muted">
          <img src={mediaUrl} alt="" className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className="flex size-14 shrink-0 items-center justify-center rounded-md border border-line bg-bg-soft">
          <BookMarked className="size-5 text-fg-faint" strokeWidth={1.5} />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <UserAvatar user={author} className="size-5 shrink-0" />
          <span className="truncate text-[12.5px] font-semibold text-fg">{displayName}</span>
          <span className="inline-flex items-center rounded-[4px] border border-line px-1.5 py-px font-mono text-[9.5px] uppercase tracking-[0.04em] text-fg-muted">
            {typeLabel}
          </span>
        </div>
        {post.textContent ? (
          <p className="mt-1 line-clamp-2 text-[13px] leading-[1.45] text-fg-soft">{post.textContent}</p>
        ) : null}
        <div className="mt-1.5 flex items-center gap-3 font-mono text-[10.5px] text-fg-faint">
          <span>♥ {formatNumber(post.reactionCount ?? 0)}</span>
          <span>💬 {formatNumber(post.commentCount ?? 0)}</span>
          {post.savedAt ? (
            <span className="ml-auto">Saved <RelativeTime value={post.savedAt} /></span>
          ) : null}
        </div>
      </div>
    </Link>
  )
}

/* ── Main page ─────────────────────────────────────────────────── */
export function SavedPage() {
  const { user, isAuthenticated } = useAuth()
  const toast = useToast()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeCollection, setActiveCollection] = useState(null)

  useEffect(() => {
    if (!isAuthenticated || !user?.id) { setLoading(false); return }
    let cancelled = false
    setLoading(true)
    getSavedPosts(user.id, { pageSize: 100 })
      .then((data) => {
        if (cancelled) return
        const items = Array.isArray(data) ? data
          : Array.isArray(data?.items) ? data.items
          : Array.isArray(data?.content) ? data.content
          : []
        setPosts(items)
      })
      .catch((err) => { if (!cancelled) toast.error(extractApiMessage(err, 'Could not load saved posts.')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [isAuthenticated, user?.id, toast])

  const collections = useMemo(() => {
    const map = new Map()
    for (const p of posts) {
      const key = p.savedCollectionName ?? 'Default'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(p)
    }
    return [...map.entries()]
      .sort(([a], [b]) => (a === 'Default' ? -1 : b === 'Default' ? 1 : a.localeCompare(b)))
      .map(([name, items]) => ({ name, items }))
  }, [posts])

  const activeItems = useMemo(
    () => collections.find((c) => c.name === activeCollection)?.items ?? [],
    [collections, activeCollection],
  )

  if (!isAuthenticated) {
    return (
      <EmptyState
        icon={BookMarked}
        title="Sign in to view saved posts"
        description="Posts you bookmark appear here, organized into collections."
        action={
          <Button asChild variant="outline" size="sm" className="rounded-md">
            <Link to="/login">Sign in</Link>
          </Button>
        }
      />
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between gap-4 pb-6">
        <div>
          {activeCollection ? (
            <button
              type="button"
              onClick={() => setActiveCollection(null)}
              className="mb-2 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-fg-muted transition-colors hover:text-fg"
            >
              <ChevronLeft className="size-3.5" strokeWidth={1.8} />
              Collections
            </button>
          ) : (
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.04em] text-fg-muted">Library</p>
          )}
          <h1 className="text-[28px] font-semibold leading-none tracking-[-0.022em] text-fg">
            {activeCollection ?? 'Saved'}
          </h1>
        </div>
        {!activeCollection ? (
          <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-md border-line text-[12.5px] font-medium text-fg-muted">
            <Plus className="size-3.5" strokeWidth={2} />
            New collection
          </Button>
        ) : (
          <p className="font-mono text-[11px] text-fg-muted">
            {activeItems.length} {activeItems.length === 1 ? 'item' : 'items'}
          </p>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-5 animate-spin text-fg-muted" />
        </div>
      ) : posts.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="Nothing saved yet"
          description="Tap the bookmark icon on any post to save it here."
        />
      ) : activeCollection ? (
        <div className="rounded-lg border border-line bg-background">
          <div className="px-5">
            {activeItems.map((p) => <SavedPostRow key={p.id} post={p} />)}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4">
          {collections.map((col) => (
            <CollectionTile
              key={col.name}
              name={col.name}
              posts={col.items}
              onClick={() => setActiveCollection(col.name)}
            />
          ))}
          <button type="button" className="flex flex-col gap-2 text-left">
            <div className="flex aspect-square items-center justify-center rounded-md border border-dashed border-line-strong bg-bg-soft transition-colors hover:bg-bg-muted">
              <Plus className="size-6 text-fg-faint" strokeWidth={1.5} />
            </div>
            <p className="text-[12.5px] text-fg-faint">New collection</p>
          </button>
        </div>
      )}
    </div>
  )
}
