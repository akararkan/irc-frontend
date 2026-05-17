import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  AtSign,
  Award,
  Ban,
  Bookmark,
  Calendar,
  Eye,
  Globe,
  Mail,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  Plus,
  ShieldAlert,
  UserMinus,
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

// Spec §09 — single stat cell. Big tabular number on top, mono micro
// caption beneath. Lives inside the .profile-stats strip.
function Stat({ label, value, to }) {
  const content = (
    <>
      <div className="font-display text-[26px] font-semibold tabular-nums leading-[1.1] tracking-[-0.012em] text-ink sm:text-[30px]">
        {formatNumber(value ?? 0)}
      </div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3">
        {label}
      </div>
    </>
  )
  if (to) {
    return (
      <Link to={to} className="shrink-0 transition-opacity hover:opacity-70">
        {content}
      </Link>
    )
  }
  return <div className="shrink-0">{content}</div>
}

// Profile-link pill — outlined rounded pill matching the spec reference.
function ProfileLink({ href, icon: Icon, children, title }) {
  const inner = (
    <span className="inline-flex items-center gap-1.5 rounded-full border-[0.5px] border-border px-3 py-1.5 text-[12px] text-ink-2 transition-colors hover:bg-secondary">
      {Icon ? <Icon className="size-3.5" strokeWidth={1.5} /> : null}
      {children}
    </span>
  )
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" title={title || href}>
        {inner}
      </a>
    )
  }
  return inner
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
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
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
                  current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
                )
              }
              onDelete={(id) => setPosts((current) => current.filter((item) => item.id !== id))}
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
    return <EmptyState title="No research published yet" description="Published research will show up here." />
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
          <button
            type="button"
            onClick={() => setActiveCollection(null)}
            className={
              activeCollection === null
                ? 'rounded-full border border-foreground bg-foreground px-3 py-1 text-xs font-semibold text-background'
                : 'rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground'
            }
          >
            All saved
          </button>
          {collections.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setActiveCollection(name)}
              className={
                activeCollection === name
                  ? 'rounded-full border border-foreground bg-foreground px-3 py-1 text-xs font-semibold text-background'
                  : 'rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground'
              }
            >
              {name}
            </button>
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

export function ProfilePage() {
  const { username } = useParams()
  const toast = useToast()
  const { user: currentUser, isAuthenticated } = useAuth()
  const [profile,        setProfile]        = useState(null)
  const [status,         setStatus]         = useState(null)
  const [loading,        setLoading]        = useState(true)
  const [working,        setWorking]        = useState(false)
  const [profileStories, setProfileStories] = useState([])
  const [storyViewerOpen, setStoryViewerOpen] = useState(false)

  useEffect(() => {
    if (!username) return
    let cancelled = false
    // Clear any previous profile immediately so stale data never flashes
    // while fetching the new one.
    setProfile(null)
    setStatus(null)
    setLoading(true)

    async function load() {
      try {
        const user = await getUserByUsername(username)
        if (cancelled) return
        setProfile(user)
        if (isAuthenticated && user?.id && user.id !== currentUser?.id) {
          try {
            const socialStatus = await getSocialStatus(user.id)
            if (!cancelled) setStatus(socialStatus)
          } catch {
            if (!cancelled) setStatus(null)
          }
        } else {
          if (!cancelled) setStatus(null)
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

  // Fetch active stories for this profile so we can show the story ring on the avatar
  useEffect(() => {
    if (!profile?.id || !isAuthenticated) return
    let cancelled = false
    getStoriesByUser(profile.id)
      .then((data) => { if (!cancelled) setProfileStories(Array.isArray(data) ? data : []) })
      .catch(() => {})
    return () => { cancelled = true }
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
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
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

  // Display-safe handle — strips an email-shaped username down to its
  // local-part so other viewers never see a profile's email address.
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
  const postsCount = profile.postsCount ?? profile.postCount ?? 0
  const researchCount = profile.profile?.researchCount ?? profile.researchCount ?? profile.publicationsCount ?? 0
  const answersCount = profile.answersCount ?? profile.answerCount ?? 0
  const reelsCount = profile.reelsCount ?? 0
  // eslint-disable-next-line no-unused-vars
  const profileViewsLabel =
    profile.profileViewsThisWeek != null
      ? `${formatNumber(profile.profileViewsThisWeek)} profile views this week`
      : null

  // Identity links from the spec — handle / ORCID / website / email.
  const linkList = []
  if (handle) linkList.push({ icon: AtSign, label: `@${handle}`, href: null })
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
  // Privacy: only the user themselves ever sees their own email. We
  // ignore profile.showEmail on purpose — even if the backend ships it
  // as true, we never expose an email address to other viewers.
  if (profile.email && isMe) {
    linkList.push({ icon: Mail, label: profile.email, href: `mailto:${profile.email}` })
  }
  ;(getProfileLinks(profile)).forEach((link) => {
    if (!link?.url) return
    linkList.push({
      icon: Globe,
      label: link.description || link.url.replace(/^https?:\/\//, ''),
      href: link.url,
    })
  })

  return (
    <div className="space-y-8">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      >
        {/* ── 3-column hero: avatar | info | actions ──────────── */}
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">

          {/* Avatar — large square, with story ring when active stories exist */}
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 280, damping: 22, delay: 0.05 }}
            className="shrink-0"
          >
            {profileStories.length > 0 ? (
              <button
                type="button"
                onClick={() => setStoryViewerOpen(true)}
                className="block rounded-[18px] p-[3px] focus:outline-none"
                style={{ background: 'linear-gradient(135deg, var(--brand), var(--gold), var(--accent-violet))' }}
              >
                <div className="rounded-2xl bg-card p-[2px]">
                  <UserAvatar
                    user={profile}
                    className="size-28 rounded-2xl text-[40px] sm:size-32"
                  />
                </div>
              </button>
            ) : (
              <UserAvatar
                user={profile}
                className="size-28 rounded-2xl text-[40px] sm:size-32"
              />
            )}
          </motion.div>

          {/* Info column */}
          <div className="min-w-0 flex-1 space-y-3">
            {/* Role + location + joined meta */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] uppercase tracking-wider text-ink-3">
              {profile.role ? <span>{profile.role}</span> : null}
              {getLocation(profile) ? (
                <>
                  {profile.role ? <span aria-hidden>·</span> : null}
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3" strokeWidth={1.5} />
                    {getLocation(profile)}
                  </span>
                </>
              ) : null}
              {joinedLabel ? (
                <>
                  <span aria-hidden>·</span>
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="size-3" strokeWidth={1.5} />
                    {joinedLabel}
                  </span>
                </>
              ) : null}
            </div>

            {/* Name */}
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-display text-[32px] font-semibold leading-[1.05] tracking-[-0.022em] text-ink sm:text-[38px]">
                {getFullName(profile) || handle}
              </h1>
              {verified ? (
                <span
                  aria-hidden
                  title="Verified"
                  className="grid size-[22px] place-items-center rounded-full text-paper"
                  style={{ background: 'var(--info-fg)' }}
                >
                  <Award className="size-3" strokeWidth={2} />
                </span>
              ) : null}
            </div>

            {/* Handle */}
            {handle ? (
              <p className="text-[14px] text-ink-3">@{handle}</p>
            ) : null}

            {/* Bio — italic serif */}
            {getProfileBio(profile) ? (
              <p className="font-display text-[16px] italic leading-[1.6] tracking-[-0.005em] text-ink-2">
                {getProfileBio(profile)}
              </p>
            ) : null}

            {/* Tagline / self-describer */}
            {getSelfDescriber(profile) ? (
              <p className="text-[15px] leading-[1.65] text-ink-2">
                {getSelfDescriber(profile)}
              </p>
            ) : null}

            {/* Profile links — outlined rounded pills */}
            {linkList.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {linkList.map((link, idx) => (
                  <ProfileLink key={idx} href={link.href} icon={link.icon}>
                    {link.label}
                  </ProfileLink>
                ))}
              </div>
            ) : null}
          </div>

          {/* Actions column — stacked vertical on desktop */}
          <div className="flex flex-row flex-wrap gap-2 sm:w-36 sm:flex-col">
            {!isMe && isAuthenticated ? (
              status?.isBlocking ? (
                <button
                  type="button"
                  onClick={handleUnblock}
                  disabled={working}
                  className="rx w-full justify-center"
                >
                  Unblock
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={status?.isFollowing ? handleUnfollow : handleFollow}
                    disabled={working}
                    className={cn(
                      'rx w-full justify-center',
                      status?.isFollowing && 'border-ink/40 bg-secondary text-ink',
                    )}
                  >
                    <Plus className="size-4" strokeWidth={2} />
                    {status?.isFollowing ? 'Following' : 'Follow'}
                  </button>
                  <button type="button" className="rx w-full justify-center">
                    <MessageSquare className="size-4" strokeWidth={1.5} />
                    Contact
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" className="rx justify-center" title="More options">
                        <MoreHorizontal className="size-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onSelect={handleToggleRestrict} disabled={working}>
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
            {isMe ? (
              <Link to="/settings" className="rx w-full justify-center text-center">
                Edit profile
              </Link>
            ) : null}
          </div>
        </div>

        {/* ── Stats row — flat, hairline separator above ──────── */}
        <div className="mt-8 border-t-[0.5px] border-border pt-6">
          <div className="scrollbar-none flex items-start gap-x-8 gap-y-4 overflow-x-auto">
            <Stat label="Followers" value={followerCount} to={`/profile/${profile.username}/followers`} />
            <Stat label="Following" value={followingCount} to={`/profile/${profile.username}/following`} />
            {showsResearch ? <Stat label="Research" value={researchCount} /> : null}
            <Stat label="Posts" value={postsCount} />
            <Stat label="Answers" value={answersCount} />
            {reelsCount > 0 ? <Stat label="Reels" value={reelsCount} /> : null}
          </div>
        </div>
      </motion.section>

      {/* ── Story highlights — shown when user has highlights or it's own profile ── */}
      <StoryHighlightBar userId={profile.id} isMe={isMe} />

      <Tabs defaultValue={showsResearch ? 'research' : 'activity'}>
        <TabsList className="scrollbar-none flex w-full justify-start gap-0 overflow-x-auto rounded-none border-0 border-b-[0.5px] border-border bg-transparent p-0">
          {showsResearch ? (
            <TabsTrigger
              value="research"
              className="rounded-none border-b-[1.5px] border-transparent bg-transparent px-0 py-2.5 mr-6 font-medium text-ink-3 data-[state=active]:border-ink data-[state=active]:text-ink data-[state=active]:shadow-none"
            >
              Research <span className="ml-1 font-mono text-[10px] text-ink-4">{researchCount}</span>
            </TabsTrigger>
          ) : null}
          <TabsTrigger
            value="posts"
            className="rounded-none border-b-[1.5px] border-transparent bg-transparent px-0 py-2.5 mr-6 font-medium text-ink-3 data-[state=active]:border-ink data-[state=active]:text-ink data-[state=active]:shadow-none"
          >
            Posts <span className="ml-1 font-mono text-[10px] text-ink-4">{postsCount}</span>
          </TabsTrigger>
          <TabsTrigger
            value="activity"
            className="rounded-none border-b-[1.5px] border-transparent bg-transparent px-0 py-2.5 mr-6 font-medium text-ink-3 data-[state=active]:border-ink data-[state=active]:text-ink data-[state=active]:shadow-none"
          >
            Activity
          </TabsTrigger>
          {isMe ? (
            <TabsTrigger
              value="questions"
              className="rounded-none border-b-[1.5px] border-transparent bg-transparent px-0 py-2.5 mr-6 font-medium text-ink-3 data-[state=active]:border-ink data-[state=active]:text-ink data-[state=active]:shadow-none"
            >
              Questions
            </TabsTrigger>
          ) : null}
          {isMe ? (
            <TabsTrigger
              value="saved"
              className="rounded-none border-b-[1.5px] border-transparent bg-transparent px-0 py-2.5 mr-6 font-medium text-ink-3 data-[state=active]:border-ink data-[state=active]:text-ink data-[state=active]:shadow-none"
            >
              Saved
            </TabsTrigger>
          ) : null}
          <TabsTrigger
            value="about"
            className="rounded-none border-b-[1.5px] border-transparent bg-transparent px-0 py-2.5 mr-6 font-medium text-ink-3 data-[state=active]:border-ink data-[state=active]:text-ink data-[state=active]:shadow-none"
          >
            About
          </TabsTrigger>
        </TabsList>
        <TabsContent value="activity">
          <ProfileActivity userId={profile.id} includeQuestions={isMe} />
        </TabsContent>
        <TabsContent value="posts">
          <ProfilePosts userId={profile.id} />
        </TabsContent>
        {showsResearch ? (
          <TabsContent value="research">
            <ProfileResearch userId={profile.id} />
          </TabsContent>
        ) : null}
        {isMe ? (
          <TabsContent value="questions">
            <ProfileQuestions />
          </TabsContent>
        ) : null}
        {isMe ? (
          <TabsContent value="saved">
            <ProfileSaved />
          </TabsContent>
        ) : null}
        <TabsContent value="about">
          <Card>
            <CardContent className="space-y-3 p-5 text-sm">
              {getSelfDescriber(profile) ? (
                <p className="whitespace-pre-wrap leading-6">{getSelfDescriber(profile)}</p>
              ) : (
                <p className="text-muted-foreground">No description provided.</p>
              )}
              {getProfileLinks(profile).length ? (
                <div className="space-y-1.5 pt-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Links
                  </p>
                  {getProfileLinks(profile).map((link) => (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-primary hover:underline"
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

      {/* Story viewer — opens when avatar ring is clicked */}
      <AnimatePresence>
        {storyViewerOpen && profileStories.length > 0 ? (
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
