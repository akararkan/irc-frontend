import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  AtSign,
  Award,
  Ban,
  Bookmark,
  Calendar,
  CheckCircle2,
  Globe,
  Mail,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  ShieldAlert,
  UserCheck,
  UserPlus,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/app/empty-state'
import { PostCard } from '@/components/app/post-card'
import { QuestionFeedCard } from '@/components/app/question-feed-card'
import { ResearchCard } from '@/components/app/research-card'
import { RoleBadge } from '@/components/app/role-badge'
import { StoryHighlightBar } from '@/components/app/story-highlight-bar'
import { StoryViewer } from '@/components/app/story-viewer'
import { UserAvatar } from '@/components/app/user-avatar'
import { cn } from '@/lib/utils'
import { getUserByUsername } from '@/features/users/users.api'
import {
  blockUser,
  followUser,
  getSocialStatus,
  restrictUser,
  unblockUser,
  unfollowUser,
  unrestrictUser,
} from '@/features/social/social.api'
import { getUserPosts } from '@/features/posts/posts.api'
import {
  getResearcherPublications,
  getSavedByCollection,
  getSavedCollections,
  getSavedResearch,
} from '@/features/research/research.api'
import { getMyQuestions } from '@/features/qna/qna.api'
import { getStoriesByUser } from '@/features/stories/stories.api'
import { useAuth } from '@/features/auth/auth-context'
import { useToast } from '@/components/ui/toaster'
import { canPublishResearch } from '@/lib/roles'
import { extractApiMessage } from '@/lib/api-error'
import {
  formatNumber,
  getFollowerCount,
  getFollowingCount,
  getFullName,
  getHandle,
  getLocation,
  getProfileBio,
  getProfileLinks,
  getSelfDescriber,
  getWebsiteUrl,
} from '@/lib/format'

function Stat({ label, value, to }) {
  const body = (
    <>
      <span className="font-display text-[19px] font-semibold tabular-nums leading-none tracking-[-0.01em] text-ink">
        {formatNumber(value ?? 0)}
      </span>
      <span className="text-[11px] text-ink-3">{label}</span>
    </>
  )
  const className = 'flex shrink-0 items-baseline gap-1.5 transition-opacity'
  if (to) {
    return (
      <Link to={to} className={cn(className, 'hover:opacity-65')}>
        {body}
      </Link>
    )
  }
  return <div className={className}>{body}</div>
}

function ProfileLink({ href, icon: Icon, children }) {
  const inner = (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-paper px-2.5 py-1 text-[12px] text-ink-2 transition-colors hover:border-brand/40 hover:text-ink">
      {Icon ? <Icon className="size-3.5 text-ink-3" strokeWidth={1.6} /> : null}
      {children}
    </span>
  )
  return href ? (
    <a href={href} target="_blank" rel="noreferrer">
      {inner}
    </a>
  ) : (
    inner
  )
}

function ProfilePosts({ userId }) {
  const toast = useToast()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const data = await getUserPosts(userId, { page: 0, size: 20 })
        if (!cancelled) setPosts(data?.content ?? [])
      } catch (error) {
        if (!cancelled) toast.error(extractApiMessage(error, 'Could not load posts.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [userId, toast])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    )
  }
  if (posts.length === 0) {
    return <EmptyState title="No posts yet" description="This person hasn't posted anything." />
  }

  return (
    <div className="space-y-4">
      <AnimatePresence initial={false}>
        {posts.map((post, index) => (
          <motion.div
            key={post.id}
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
            <PostCard
              post={post}
              onChange={(updated) =>
                setPosts((current) =>
                  current.map((item) =>
                    item.id === updated.id ? { ...item, ...updated } : item,
                  ),
                )
              }
              onDelete={(id) =>
                setPosts((current) => current.filter((item) => item.id !== id))
              }
              onRepostCreated={(newPost) =>
                setPosts((current) => [
                  newPost,
                  ...current.filter((item) => item.id !== newPost.id),
                ])
              }
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

function ProfileResearch({ userId }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const data = await getResearcherPublications(userId, { page: 0, size: 20 })
        if (!cancelled) setItems(data?.content ?? [])
      } catch {
        if (!cancelled) setItems([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [userId])

  if (loading) return <Skeleton className="h-72 w-full rounded-xl" />
  if (items.length === 0) {
    return (
      <EmptyState
        title="No research published yet"
        description="Published research will show up here."
      />
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {items.map((item, index) => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            type: 'spring',
            stiffness: 300,
            damping: 30,
            delay: Math.min(index, 5) * 0.04,
          }}
        >
          <ResearchCard item={item} />
        </motion.div>
      ))}
    </div>
  )
}

function ProfileQuestions() {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const data = await getMyQuestions({ page: 0, size: 20 })
        if (!cancelled) setItems(data?.content ?? [])
      } catch (error) {
        if (!cancelled) toast.error(extractApiMessage(error, 'Could not load questions.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [toast])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    )
  }
  if (items.length === 0) {
    return (
      <EmptyState
        title="No questions asked yet"
        description="Your questions will appear here once you post one."
      />
    )
  }
  return (
    <div className="space-y-4">
      {items.map((question) => (
        <QuestionFeedCard key={question.id} question={question} />
      ))}
    </div>
  )
}

function ProfileSaved() {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [collections, setCollections] = useState([])
  const [activeCollection, setActiveCollection] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [saved, names] = await Promise.all([
        activeCollection
          ? getSavedByCollection(activeCollection, { page: 0, size: 20 })
          : getSavedResearch({ page: 0, size: 20 }),
        getSavedCollections().catch(() => []),
      ])
      setItems(saved?.content ?? [])
      setCollections(Array.isArray(names) ? names : [])
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not load your library.'))
    } finally {
      setLoading(false)
    }
  }, [activeCollection, toast])

  useEffect(() => {
    load()
  }, [load])

  if (loading && items.length === 0) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {collections.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <CollectionChip
            active={activeCollection === null}
            onClick={() => setActiveCollection(null)}
          >
            All saved
          </CollectionChip>
          {collections.map((name) => (
            <CollectionChip
              key={name}
              active={activeCollection === name}
              onClick={() => setActiveCollection(name)}
            >
              {name}
            </CollectionChip>
          ))}
        </div>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="Nothing saved yet"
          description="Open any research and tap Save to keep it here."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <ResearchCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}

function CollectionChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-[12px] font-medium transition-colors',
        active
          ? 'border-brand bg-brand text-brand-foreground'
          : 'border-border text-ink-3 hover:border-brand/40 hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}

function timeOf(entry) {
  const item = entry.data
  const when = item.publishedAt ?? item.createdAt ?? item.updatedAt
  return when ? new Date(when).getTime() : 0
}

function ProfileActivity({ userId, includeQuestions = false }) {
  const toast = useToast()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const requests = [
          getUserPosts(userId, { page: 0, size: 20 }).catch(() => null),
          getResearcherPublications(userId, { page: 0, size: 20 }).catch(() => null),
        ]
        if (includeQuestions) {
          requests.push(getMyQuestions({ page: 0, size: 20 }).catch(() => null))
        }
        const [postsData, researchData, questionsData] = await Promise.all(requests)
        if (cancelled) return

        const merged = []
        ;(postsData?.content ?? []).forEach((p) =>
          merged.push({ kind: 'post', id: `post:${p.id}`, data: p }),
        )
        ;(researchData?.content ?? []).forEach((r) =>
          merged.push({ kind: 'research', id: `research:${r.id}`, data: r }),
        )
        if (includeQuestions) {
          ;(questionsData?.content ?? []).forEach((q) =>
            merged.push({ kind: 'question', id: `question:${q.id}`, data: q }),
          )
        }
        merged.sort((a, b) => timeOf(b) - timeOf(a))
        setEntries(merged)
      } catch (error) {
        if (!cancelled) toast.error(extractApiMessage(error, 'Could not load activity.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [userId, includeQuestions, toast])

  function handlePostChange(updated) {
    setEntries((current) =>
      current.map((entry) =>
        entry.kind === 'post' && entry.data.id === updated.id
          ? { ...entry, data: { ...entry.data, ...updated } }
          : entry,
      ),
    )
  }

  function handlePostDelete(id) {
    setEntries((current) =>
      current.filter((entry) => !(entry.kind === 'post' && entry.data.id === id)),
    )
  }

  function handleRepostCreated(newPost) {
    if (!newPost) return
    const entry = { kind: 'post', id: `post:${newPost.id}`, data: newPost }
    setEntries((current) => [entry, ...current.filter((e) => e.id !== entry.id)])
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    )
  }
  if (entries.length === 0) {
    return (
      <EmptyState
        title="No activity yet"
        description="Posts, research, and questions will appear here as they're shared."
      />
    )
  }

  return (
    <div className="space-y-5">
      {entries.map((entry) => {
        if (entry.kind === 'post') {
          return (
            <PostCard
              key={entry.id}
              post={entry.data}
              onChange={handlePostChange}
              onDelete={handlePostDelete}
              onRepostCreated={handleRepostCreated}
            />
          )
        }
        if (entry.kind === 'research') {
          return <ResearchCard key={entry.id} item={entry.data} />
        }
        return <QuestionFeedCard key={entry.id} question={entry.data} />
      })}
    </div>
  )
}

function TabPill({ value, children, count }) {
  return (
    <TabsTrigger
      value={value}
      className={cn(
        'relative rounded-none border-0 bg-transparent px-0 py-3 text-[13.5px] font-medium text-ink-3 shadow-none',
        'data-[state=active]:text-ink data-[state=active]:shadow-none',
        'after:absolute after:inset-x-0 after:-bottom-px after:h-[2px] after:rounded-full after:bg-transparent',
        'data-[state=active]:after:bg-brand transition-colors',
      )}
    >
      {children}
      {count != null ? (
        <span className="ml-1.5 font-mono text-[10.5px] text-ink-4">{count}</span>
      ) : null}
    </TabsTrigger>
  )
}

export function ProfilePage() {
  const { username } = useParams()
  const toast = useToast()
  const { user: currentUser, isAuthenticated } = useAuth()
  const [profile, setProfile] = useState(null)
  const [status, setStatus] = useState(null)
  const [counts, setCounts] = useState({ posts: null, research: null, saved: null })
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [profileStories, setProfileStories] = useState([])
  const [storyViewerOpen, setStoryViewerOpen] = useState(false)

  useEffect(() => {
    if (!username) return
    let cancelled = false
    setProfile(null)
    setStatus(null)
    setCounts({ posts: null, research: null, saved: null })
    setLoading(true)

    async function load() {
      try {
        const user = await getUserByUsername(username)
        if (cancelled) return
        setProfile(user)

        // The UserResponse DTO ships no counter fields, so post/research
        // totals come from the first page of each paged endpoint
        // (Spring Page<T>.totalElements). Social status carries the real
        // follower/following counts — fetched for own-profile too so the
        // header shows them when viewing yourself, not just strangers.
        if (user?.id) {
          const userId = user.id
          if (isAuthenticated) {
            getSocialStatus(userId)
              .then((socialStatus) => {
                if (!cancelled) setStatus(socialStatus)
              })
              .catch(() => {
                if (!cancelled) setStatus(null)
              })
          }
          // Saved library is private — only fetch its size when viewing
          // your own profile. The endpoint already requires auth, but
          // skipping the request avoids a 403 on other users' pages.
          const isOwnProfile = isAuthenticated && currentUser?.id === userId
          Promise.all([
            getUserPosts(userId, { page: 0, size: 1 }).catch(() => null),
            getResearcherPublications(userId, { page: 0, size: 1 }).catch(() => null),
            isOwnProfile
              ? getSavedResearch({ page: 0, size: 1 }).catch(() => null)
              : Promise.resolve(null),
          ]).then(([postsPage, researchPage, savedPage]) => {
            if (cancelled) return
            setCounts({
              posts: postsPage?.totalElements ?? null,
              research: researchPage?.totalElements ?? null,
              saved: savedPage?.totalElements ?? null,
            })
          })
        }
      } catch (error) {
        if (cancelled) return
        toast.error(extractApiMessage(error, 'Could not load profile.'))
        setProfile(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [username, isAuthenticated, currentUser?.id, toast])

  useEffect(() => {
    if (!profile?.id || !isAuthenticated) return
    let cancelled = false
    getStoriesByUser(profile.id)
      .then((data) => {
        if (!cancelled) setProfileStories(Array.isArray(data) ? data : [])
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [profile?.id, isAuthenticated])

  const isMe = currentUser && profile && currentUser.id === profile.id

  async function run(action) {
    if (working) return
    setWorking(true)
    try {
      await action()
    } catch (error) {
      toast.error(extractApiMessage(error, 'Action failed.'))
    } finally {
      setWorking(false)
    }
  }

  async function handleFollow() {
    await run(async () => {
      const response = await followUser(profile.id)
      setStatus((current) => ({
        ...(current ?? {}),
        ...(response?.updatedStatus ?? {}),
        isFollowing: true,
      }))
      toast.success(`Following ${getFullName(profile) || getHandle(profile)}`)
    })
  }

  async function handleUnfollow() {
    await run(async () => {
      const response = await unfollowUser(profile.id)
      setStatus((current) => ({
        ...(current ?? {}),
        ...(response?.updatedStatus ?? {}),
        isFollowing: false,
      }))
    })
  }

  async function handleBlock() {
    await run(async () => {
      const response = await blockUser(profile.id)
      setStatus((current) => ({
        ...(current ?? {}),
        ...(response?.updatedStatus ?? {}),
        isBlocking: true,
        isFollowing: false,
      }))
      toast.success(`Blocked ${getFullName(profile) || getHandle(profile)}`)
    })
  }

  async function handleUnblock() {
    await run(async () => {
      const response = await unblockUser(profile.id)
      setStatus((current) => ({
        ...(current ?? {}),
        ...(response?.updatedStatus ?? {}),
        isBlocking: false,
      }))
    })
  }

  async function handleToggleRestrict() {
    await run(async () => {
      if (status?.isRestricting) {
        const response = await unrestrictUser(profile.id)
        setStatus((current) => ({
          ...(current ?? {}),
          ...(response?.updatedStatus ?? {}),
          isRestricting: false,
        }))
      } else {
        const response = await restrictUser(profile.id)
        setStatus((current) => ({
          ...(current ?? {}),
          ...(response?.updatedStatus ?? {}),
          isRestricting: true,
        }))
      }
    })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }
  if (!profile) {
    return (
      <EmptyState
        title="Profile not found"
        description={`We couldn't find ${username}.`}
        action={
          <Button asChild size="sm" variant="outline" className="rounded-full">
            <Link to="/people">Search people</Link>
          </Button>
        }
      />
    )
  }

  const followerCount = status?.followerCount ?? getFollowerCount(profile)
  const followingCount = status?.followingCount ?? getFollowingCount(profile)
  const showsResearch = canPublishResearch(profile)
  const handle = getHandle(profile)
  const verified = Boolean(profile.verified ?? profile.isVerified)
  const joinedDate = profile.createdAt
    ? new Date(profile.createdAt)
    : profile.joinedAt
      ? new Date(profile.joinedAt)
      : null
  const joinedLabel = joinedDate
    ? joinedDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : null
  // Prefer the live totals fetched from the paged endpoints; the DTO
  // counter fields are kept as a fallback in case the backend starts
  // shipping them on UserResponse later.
  const postsCount =
    counts.posts ?? profile.postsCount ?? profile.postCount ?? 0
  const researchCount =
    counts.research ??
    profile.profile?.researchCount ??
    profile.researchCount ??
    profile.publicationsCount ??
    0
  // No backend endpoint lists answers by user yet, so this stays at the
  // DTO-provided value if any (today: always 0).
  const answersCount = profile.answersCount ?? profile.answerCount ?? 0
  const savedCount = counts.saved
  const reelsCount = profile.reelsCount ?? 0
  const hasStories = profileStories.length > 0

  const linkList = []
  if (handle) linkList.push({ icon: AtSign, label: handle, href: null })
  const profileOrcid = profile.orcidId ?? profile.orcid
  if (profileOrcid) {
    linkList.push({
      icon: Award,
      label: `ORCID: ${profileOrcid}`,
      href: `https://orcid.org/${profileOrcid}`,
    })
  }
  const websiteUrl = getWebsiteUrl(profile)
  if (websiteUrl) {
    linkList.push({
      icon: Globe,
      label: websiteUrl.replace(/^https?:\/\//, ''),
      href: websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`,
    })
  }
  if (profile.email && isMe) {
    linkList.push({ icon: Mail, label: profile.email, href: `mailto:${profile.email}` })
  }
  getProfileLinks(profile).forEach((link) => {
    if (!link?.url) return
    linkList.push({
      icon: Globe,
      label: link.description || link.url.replace(/^https?:\/\//, ''),
      href: link.url,
    })
  })

  return (
    <div className="space-y-7">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        className="overflow-hidden rounded-2xl border border-border bg-paper"
        style={{ boxShadow: 'var(--shadow-sm)' }}
      >
        {/* ── Cover banner ─────────────────────────────────── */}
        <div
          className="relative h-32 sm:h-40"
          style={{ background: 'var(--brand-deep, #1E3A5F)' }}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.05]"
            style={{
              background:
                'repeating-linear-gradient(115deg, transparent 0 22px, #FFFFFF 22px 23px)',
            }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -right-12 -top-16 size-48 rounded-full"
            style={{ background: 'var(--brand-dark, #15243B)' }}
          />

          <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
            {isMe ? (
              <Button
                asChild
                size="sm"
                className="h-9 gap-1.5 rounded-lg bg-white/95 text-[13px] font-medium text-[#15243B] hover:bg-white"
              >
                <Link to="/settings">
                  <Pencil className="size-3.5" strokeWidth={2} />
                  Edit profile
                </Link>
              </Button>
            ) : null}
            {!isMe && isAuthenticated ? (
              status?.isBlocking ? (
                <Button
                  size="sm"
                  onClick={handleUnblock}
                  disabled={working}
                  className="h-9 rounded-lg bg-white/95 text-[13px] font-medium text-[#15243B] hover:bg-white"
                >
                  Unblock
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    onClick={status?.isFollowing ? handleUnfollow : handleFollow}
                    disabled={working}
                    className={cn(
                      'h-9 gap-1.5 rounded-lg text-[13px] font-medium',
                      status?.isFollowing
                        ? 'bg-white/95 text-[#15243B] hover:bg-white'
                        : 'bg-brand text-brand-foreground hover:bg-brand/90',
                    )}
                  >
                    {status?.isFollowing ? (
                      <>
                        <UserCheck className="size-3.5" strokeWidth={2} />
                        Following
                      </>
                    ) : (
                      <>
                        <UserPlus className="size-3.5" strokeWidth={2} />
                        Follow
                      </>
                    )}
                  </Button>
                  <Button
                    size="icon"
                    className="size-9 rounded-lg bg-white/95 text-[#15243B] hover:bg-white"
                    title="Contact"
                  >
                    <MessageSquare className="size-4" strokeWidth={1.7} />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon"
                        className="size-9 rounded-lg bg-white/95 text-[#15243B] hover:bg-white"
                        title="More options"
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem
                        onSelect={handleToggleRestrict}
                        disabled={working}
                      >
                        <ShieldAlert className="mr-2 size-4" />
                        {status?.isRestricting ? 'Unrestrict' : 'Restrict'}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={handleBlock}
                        disabled={working}
                        className="text-destructive focus:text-destructive"
                      >
                        <Ban className="mr-2 size-4" />
                        Block
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )
            ) : null}
          </div>
        </div>

        {/* ── Identity block ───────────────────────────────── */}
        <div className="px-5 pb-5 sm:px-7 sm:pb-6">
          <div className="-mt-12 mb-3 sm:-mt-14">
            {hasStories ? (
              <button
                type="button"
                onClick={() => setStoryViewerOpen(true)}
                className="block w-fit rounded-[20px] p-[3px] focus:outline-none"
                style={{
                  background:
                    'linear-gradient(135deg, var(--brand), var(--accent-sky, #0891B2), #7C3AED)',
                }}
              >
                <div className="rounded-[17px] bg-paper p-[2px]">
                  <UserAvatar
                    user={profile}
                    className="size-[88px] rounded-2xl text-[32px] sm:size-24"
                  />
                </div>
              </button>
            ) : (
              <div className="w-fit rounded-2xl bg-paper p-[3px] ring-1 ring-border">
                <UserAvatar
                  user={profile}
                  className="size-[88px] rounded-xl text-[32px] sm:size-24"
                />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-[24px] font-semibold leading-tight tracking-[-0.018em] text-ink sm:text-[28px]">
              {getFullName(profile) || handle}
            </h1>
            {verified ? (
              <span
                title="Verified"
                className="grid size-5 place-items-center rounded-full bg-brand text-brand-foreground"
              >
                <CheckCircle2 className="size-3.5" strokeWidth={2.4} />
              </span>
            ) : null}
            {profile.role ? <RoleBadge role={profile.role} size="md" /> : null}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-ink-3">
            {handle ? (
              <span className="font-mono text-ink-3">@{handle}</span>
            ) : null}
            {getLocation(profile) ? (
              <>
                <span aria-hidden className="text-ink-4">·</span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" strokeWidth={1.6} />
                  {getLocation(profile)}
                </span>
              </>
            ) : null}
            {joinedLabel ? (
              <>
                <span aria-hidden className="text-ink-4">·</span>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="size-3.5" strokeWidth={1.6} />
                  Joined {joinedLabel}
                </span>
              </>
            ) : null}
          </div>

          {getProfileBio(profile) ? (
            <p className="mt-3 max-w-2xl font-display text-[15px] italic leading-[1.6] text-ink-2">
              “{getProfileBio(profile)}”
            </p>
          ) : null}

          {getSelfDescriber(profile) ? (
            <p className="mt-2 max-w-2xl text-[14px] leading-[1.6] text-ink-2">
              {getSelfDescriber(profile)}
            </p>
          ) : null}

          {linkList.length > 0 ? (
            <div className="mt-3.5 flex flex-wrap gap-2">
              {linkList.map((link, idx) => (
                <ProfileLink key={idx} href={link.href} icon={link.icon}>
                  {link.label}
                </ProfileLink>
              ))}
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center gap-x-7 gap-y-3 border-t border-border pt-4">
            <Stat
              label="Followers"
              value={followerCount}
              to={`/profile/${profile.username}/followers`}
            />
            <Stat
              label="Following"
              value={followingCount}
              to={`/profile/${profile.username}/following`}
            />
            {showsResearch ? <Stat label="Research" value={researchCount} /> : null}
            <Stat label="Posts" value={postsCount} />
            <Stat label="Answers" value={answersCount} />
            {reelsCount > 0 ? <Stat label="Reels" value={reelsCount} /> : null}
          </div>
        </div>
      </motion.section>

      <StoryHighlightBar userId={profile.id} isMe={isMe} />

      <Tabs defaultValue={showsResearch ? 'research' : 'activity'}>
        <TabsList className="flex w-full justify-start gap-7 overflow-x-auto rounded-none border-0 border-b border-border bg-transparent p-0 scrollbar-none">
          {showsResearch ? (
            <TabPill value="research" count={researchCount}>
              Research
            </TabPill>
          ) : null}
          <TabPill value="posts" count={postsCount}>
            Posts
          </TabPill>
          <TabPill value="activity">Activity</TabPill>
          {isMe ? <TabPill value="questions">Questions</TabPill> : null}
          {isMe ? (
            <TabPill value="saved" count={savedCount ?? undefined}>
              Saved
            </TabPill>
          ) : null}
          <TabPill value="about">About</TabPill>
        </TabsList>

        <TabsContent value="activity" className="mt-5">
          <ProfileActivity userId={profile.id} includeQuestions={isMe} />
        </TabsContent>
        <TabsContent value="posts" className="mt-5">
          <ProfilePosts userId={profile.id} />
        </TabsContent>
        {showsResearch ? (
          <TabsContent value="research" className="mt-5">
            <ProfileResearch userId={profile.id} />
          </TabsContent>
        ) : null}
        {isMe ? (
          <TabsContent value="questions" className="mt-5">
            <ProfileQuestions />
          </TabsContent>
        ) : null}
        {isMe ? (
          <TabsContent value="saved" className="mt-5">
            <ProfileSaved />
          </TabsContent>
        ) : null}
        <TabsContent value="about" className="mt-5">
          <Card className="rounded-xl border-border">
            <CardContent className="space-y-3 p-5 text-[14px]">
              {getSelfDescriber(profile) ? (
                <p className="whitespace-pre-wrap leading-[1.65] text-ink-2">
                  {getSelfDescriber(profile)}
                </p>
              ) : (
                <p className="text-ink-3">No description provided.</p>
              )}
              {getProfileLinks(profile).length ? (
                <div className="space-y-1.5 border-t border-border pt-3">
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-3">
                    Links
                  </p>
                  {getProfileLinks(profile).map((link) => (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-brand hover:underline"
                    >
                      {link.description || link.url}
                    </a>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AnimatePresence>
        {storyViewerOpen && hasStories ? (
          <StoryViewer
            groups={[{ author: profile, stories: profileStories, hasUnseen: true }]}
            initialGroupIndex={0}
            onClose={() => setStoryViewerOpen(false)}
          />
        ) : null}
      </AnimatePresence>
    </div>
  )
}
