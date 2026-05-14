import { useEffect, useState } from 'react'
import { Bookmark, Library } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/app/empty-state'
import { UserAvatar } from '@/components/app/user-avatar'
import { ResearchCard } from '@/components/app/research-card'
import { QuestionFeedCard } from '@/components/app/question-feed-card'
import {
  getSavedResearch,
} from '@/features/research/research.api'
import {
  getSavedPosts,
} from '@/features/posts/posts.api'
import {
  getSavedQuestions,
} from '@/features/qna/qna.api'
import { useToast } from '@/components/ui/toaster'
import { useAuth } from '@/features/auth/auth-context'
import { cn } from '@/lib/utils'
import { extractApiMessage } from '@/lib/api-error'
import { formatNumber, getFullName, getHandle } from '@/lib/format'

// Post type → readable label
const POST_TYPE_LABEL = {
  TEXT: 'Post',
  EMBEDDED: 'Embedded Post',
  VOICE_POST: 'Voice Post',
  REEL: 'Reel',
}

function formatSavedDate(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// ─── Compact saved post row ─────────────────────────────────────────
function SavedPostRow({ post }) {
  const author = post.author ?? {
    fullName: [post.authorFname, post.authorLname].filter(Boolean).join(' ') || null,
    username: post.authorUsername,
    profileImage: post.authorProfileImage ?? post.authorAvatarUrl,
    role: post.authorRole,
  }
  const displayName = getFullName(author) || getHandle(author) || 'Unknown'
  const typeLabel = POST_TYPE_LABEL[post.postType ?? 'TEXT'] ?? 'Post'
  const savedDate = formatSavedDate(post.savedAt)
  const href = `/posts/${post.id}`

  return (
    <Link
      to={href}
      className="flex items-start gap-4 border-b-[0.5px] border-border bg-paper py-5 transition-colors hover:bg-secondary/30"
    >
      <UserAvatar user={author} className="size-10 shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <span className="font-display text-[15px] font-semibold text-ink">
            {displayName}
          </span>
          <span className="font-mono text-[10.5px] uppercase tracking-wider text-ink-3">
            {typeLabel}
            {savedDate ? ` · Saved ${savedDate}` : ''}
          </span>
        </div>
        {post.textContent ? (
          <p
            dir="auto"
            className="line-clamp-2 font-display text-[17px] leading-[1.5] tracking-[-0.005em] text-ink"
          >
            {post.textContent}
          </p>
        ) : null}
      </div>
    </Link>
  )
}

// ─── Tab button — flat underline style ─────────────────────────────
function SavedTab({ label, count, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'relative shrink-0 whitespace-nowrap pb-3 pr-7 text-[15px] font-medium transition-colors',
        active ? 'text-ink' : 'text-ink-3 hover:text-ink',
      )}
      aria-pressed={active}
    >
      {label}
      {count != null ? (
        <span className="ml-2 font-mono text-[12px] text-ink-4">{formatNumber(count)}</span>
      ) : null}
      {active ? (
        <span className="absolute bottom-0 left-0 h-[2px] w-[calc(100%-1.75rem)] rounded-full bg-ink" />
      ) : null}
    </button>
  )
}

// ─── Posts panel ────────────────────────────────────────────────────
function PostsPanel({ onCount }) {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const saved = await getSavedPosts({ page: 0, size: 40 })
        if (!cancelled) {
          const rows = (saved?.content ?? []).map((p) => ({ ...p, isSaved: true }))
          setItems(rows)
          onCount?.(rows.length)
        }
      } catch (error) {
        if (!cancelled) toast.error(extractApiMessage(error, 'Could not load saved posts.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [toast]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleChange(updated) {
    if (updated.isSaved === false) {
      setItems((c) => c.filter((item) => item.id !== updated.id))
      return
    }
    setItems((c) => c.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)))
  }

  if (loading) {
    return (
      <div className="space-y-0">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="my-5 h-16 w-full rounded-none" />)}
      </div>
    )
  }
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Bookmark}
        title="No posts saved yet"
        description="Tap the bookmark on any post to keep it here."
        action={
          <Button asChild size="sm" className="rounded-xl">
            <Link to="/">Browse the feed</Link>
          </Button>
        }
      />
    )
  }
  return (
    <div>
      {items.map((post) => (
        <SavedPostRow key={post.id} post={post} onChange={handleChange} />
      ))}
    </div>
  )
}

// ─── Research panel ─────────────────────────────────────────────────
function ResearchPanel({ onCount }) {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const saved = await getSavedResearch({ page: 0, size: 20 })
        if (!cancelled) {
          const rows = saved?.content ?? []
          setItems(rows)
          onCount?.(rows.length)
        }
      } catch (error) {
        if (!cancelled) toast.error(extractApiMessage(error, 'Could not load saved research.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [toast]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="grid gap-4 pt-6 md:grid-cols-2">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    )
  }
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Bookmark}
        title="No research saved yet"
        description="Open any research and tap Save to keep it here."
        action={
          <Button asChild size="sm" className="rounded-xl">
            <Link to="/research">Browse research</Link>
          </Button>
        }
      />
    )
  }
  return (
    <div className="grid gap-4 pt-6 md:grid-cols-2">
      {items.map((item) => (
        <ResearchCard key={item.id} item={item} />
      ))}
    </div>
  )
}

// ─── Questions panel ─────────────────────────────────────────────────
function QuestionsPanel({ onCount }) {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const saved = await getSavedQuestions({ page: 0, size: 20 })
        if (!cancelled) {
          const rows = saved?.content ?? []
          setItems(rows)
          onCount?.(rows.length)
        }
      } catch (error) {
        if (!cancelled) toast.error(extractApiMessage(error, 'Could not load saved questions.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [toast]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="grid gap-4 pt-6 md:grid-cols-2">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    )
  }
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Bookmark}
        title="No questions saved yet"
        description="Save any question to find it here later."
        action={
          <Button asChild size="sm" className="rounded-xl">
            <Link to="/questions">Browse questions</Link>
          </Button>
        }
      />
    )
  }
  return (
    <div className="grid gap-4 pt-6 md:grid-cols-2">
      {items.map((question) => (
        <QuestionFeedCard key={question.id} question={question} />
      ))}
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────
export function SavedPage() {
  const { isAuthenticated } = useAuth()
  const [tab, setTab] = useState('posts')
  const [counts, setCounts] = useState({ posts: null, research: null, questions: null })

  function setCount(key, value) {
    setCounts((prev) => ({ ...prev, [key]: value }))
  }

  if (!isAuthenticated) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-wider text-ink-3">Section 11</p>
          <h1 className="font-display text-[40px] font-semibold leading-[1.05] tracking-[-0.02em] text-ink sm:text-[52px]">
            Saved.
          </h1>
          <p className="font-display text-[16px] italic leading-[1.6] text-ink-3">
            Posts, research, and questions you've bookmarked across the network.
          </p>
        </div>
        <EmptyState
          icon={Library}
          title="Sign in to build your library"
          description="Save posts and research to return to them later."
          action={
            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline" className="rounded-xl">
                <Link to="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm" className="rounded-xl">
                <Link to="/signup">Create account</Link>
              </Button>
            </div>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {/* ── Editorial header ───────────────────────────────────── */}
      <div className="space-y-2 pb-8">
        <p className="font-mono text-[11px] uppercase tracking-wider text-ink-3">Section 11</p>
        <h1 className="font-display text-[40px] font-semibold leading-[1.05] tracking-[-0.02em] text-ink sm:text-[52px]">
          Saved.
        </h1>
        <p className="font-display text-[16px] italic leading-[1.6] text-ink-3">
          Posts, research, and questions you've bookmarked across the network.
        </p>
      </div>

      {/* ── Flat underline tabs ────────────────────────────────── */}
      <div className="flex flex-nowrap items-end overflow-x-auto border-b-[0.5px] border-border scrollbar-none">
        <SavedTab
          label="Posts"
          count={counts.posts}
          active={tab === 'posts'}
          onSelect={() => setTab('posts')}
        />
        <SavedTab
          label="Research"
          count={counts.research}
          active={tab === 'research'}
          onSelect={() => setTab('research')}
        />
        <SavedTab
          label="Questions"
          count={counts.questions}
          active={tab === 'questions'}
          onSelect={() => setTab('questions')}
        />
      </div>

      {/* ── Tab panels ─────────────────────────────────────────── */}
      <div>
        {tab === 'posts' ? (
          <PostsPanel onCount={(n) => setCount('posts', n)} />
        ) : tab === 'research' ? (
          <ResearchPanel onCount={(n) => setCount('research', n)} />
        ) : (
          <QuestionsPanel onCount={(n) => setCount('questions', n)} />
        )}
      </div>
    </div>
  )
}
