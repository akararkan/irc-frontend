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
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/app/empty-state'
import { PostCard } from '@/components/app/post-card'
import { QuestionFeedCard } from '@/components/app/question-feed-card'
import { ResearchCard } from '@/components/app/research-card'
import { RoleBadge } from '@/components/app/role-badge'
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
import { useAuth } from '@/features/auth/auth-context'
import { useToast } from '@/components/ui/toaster'
import { canPublishResearch } from '@/lib/roles'
import { extractApiMessage } from '@/lib/api-error'
import { formatNumber, getFullName, getHandle } from '@/lib/format'

// Spec §09 — single stat cell. Big tabular number on top, mono micro
// caption beneath. Lives inside the .profile-stats strip.
function Stat({ label, value, to }) {
  const content = (
    <>
      <div className="text-[20px] font-medium tabular-nums leading-[1.1] text-ink">
        {formatNumber(value ?? 0)}
      </div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-3">
        {label}
      </div>
    </>
  )
  if (to) {
    return (
      <Link
        to={to}
        className="min-w-0 flex-1 rounded-md px-2 py-1 transition-colors hover:bg-paper"
      >
        {content}
      </Link>
    )
  }
  return <div className="min-w-0 flex-1 px-2 py-1">{content}</div>
}

// Profile-link pill — used for handle / ORCID / website / email rows.
function ProfileLink({ href, icon: Icon, children, title }) {
  const inner = (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-info-fg transition-colors hover:bg-info-bg/60"
      style={{ color: 'var(--info-fg)' }}
    >
      {Icon ? <Icon className="size-[13px]" strokeWidth={1.5} /> : null}
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
  const [profile, setProfile] = useState(null)
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)

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

  const followerCount = status?.followerCount ?? profile.followerCount ?? 0
  const followingCount = status?.followingCount ?? profile.followingCount ?? 0
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
  const researchCount = profile.researchCount ?? profile.publicationsCount ?? 0
  const answersCount = profile.answersCount ?? profile.answerCount ?? 0
  const reelsCount = profile.reelsCount ?? 0
  const profileViewsLabel =
    profile.profileViewsThisWeek != null
      ? `${formatNumber(profile.profileViewsThisWeek)} profile views this week`
      : null

  // Identity links from the spec — handle / ORCID / website / email.
  const linkList = []
  if (handle) linkList.push({ icon: AtSign, label: `@${handle}`, href: null })
  if (profile.orcid) {
    linkList.push({
      icon: Award,
      label: `ORCID: ${profile.orcid}`,
      href: `https://orcid.org/${profile.orcid}`,
    })
  }
  if (profile.website) {
    linkList.push({
      icon: Globe,
      label: profile.website.replace(/^https?:\/\//, ''),
      href: profile.website.startsWith('http') ? profile.website : `https://${profile.website}`,
    })
  }
  // Privacy: only the user themselves ever sees their own email. We
  // ignore profile.showEmail on purpose — even if the backend ships it
  // as true, we never expose an email address to other viewers.
  if (profile.email && isMe) {
    linkList.push({ icon: Mail, label: profile.email, href: `mailto:${profile.email}` })
  }
  ;(profile.links ?? []).forEach((link) => {
    if (!link?.url) return
    linkList.push({
      icon: Globe,
      label: link.description || link.url.replace(/^https?:\/\//, ''),
      href: link.url,
    })
  })

  return (
    <div className="space-y-6">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        className="overflow-hidden rounded-xl border-[0.5px] border-border bg-paper"
      >
        {/* Cover — green-to-blue soft wash (spec §09 .profile-cover) */}
        <div className="relative h-[120px] overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(135deg, var(--brand-soft) 0%, var(--info-bg) 100%)',
            }}
          />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at 20% 30%, color-mix(in oklch, var(--brand) 15%, transparent) 0, transparent 50%), radial-gradient(circle at 80% 70%, color-mix(in oklch, var(--info-fg) 15%, transparent) 0, transparent 50%)',
            }}
          />
          <button
            type="button"
            className="absolute right-3 top-3 grid size-8 place-items-center rounded-md border-[0.5px] border-white/40 bg-white/80 text-ink-2 backdrop-blur transition-colors hover:bg-white"
            aria-label="More"
          >
            <MoreHorizontal className="size-4" />
          </button>
        </div>

        {/* Inner content — avatar overflows, name + actions */}
        <div className="relative px-6 pb-6 pt-0 sm:px-7">
          <div className="-mt-11 flex flex-wrap items-end justify-between gap-4">
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22, delay: 0.1 }}
            >
              <UserAvatar
                user={profile}
                className="size-[88px] border-4 border-paper text-[30px]"
              />
            </motion.div>

            {/* Right-side actions */}
            <div className="mb-1 flex flex-wrap items-center gap-2">
              {!isMe && isAuthenticated ? (
                status?.isBlocking ? (
                  <Button size="sm" variant="outline" className="rounded-md" onClick={handleUnblock} disabled={working}>
                    Unblock
                  </Button>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-md gap-1.5"
                      title="Message"
                    >
                      <Mail className="size-4" strokeWidth={1.5} />
                      Message
                    </Button>
                    <Button
                      size="sm"
                      className={cn(
                        'rounded-md gap-1.5',
                        status?.isFollowing
                          ? 'bg-secondary text-ink hover:bg-muted'
                          : 'bg-ink text-paper hover:bg-ink-2',
                      )}
                      onClick={status?.isFollowing ? handleUnfollow : handleFollow}
                      disabled={working}
                    >
                      {status?.isFollowing ? (
                        <>
                          <UserMinus className="size-4" strokeWidth={1.5} /> Following
                        </>
                      ) : (
                        <>
                          <Plus className="size-4" strokeWidth={1.5} /> Follow
                        </>
                      )}
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="rounded-md text-ink-3"
                      onClick={handleToggleRestrict}
                      disabled={working}
                      title={status?.isRestricting ? 'Unrestrict' : 'Restrict'}
                    >
                      <ShieldAlert className="size-4" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="rounded-md text-ink-3"
                      onClick={handleBlock}
                      disabled={working}
                      title="Block"
                    >
                      <Ban className="size-4" />
                    </Button>
                  </>
                )
              ) : null}
              {isMe ? (
                <Button asChild size="sm" variant="outline" className="rounded-md">
                  <Link to="/settings">Edit profile</Link>
                </Button>
              ) : null}
            </div>
          </div>

          {/* Name row — Newsreader serif, verified rosette, role pill */}
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-[28px] font-medium leading-[1.1] tracking-[-0.02em] text-ink sm:text-[30px]">
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
            {profile.role ? <RoleBadge role={profile.role} size="sm" /> : null}
          </div>

          {/* @handle */}
          {handle ? (
            <p className="mt-1 text-[14px] text-ink-3">@{handle}</p>
          ) : null}

          {/* Bio */}
          {profile.profileBio ? (
            <p className="mt-3 max-w-[58ch] whitespace-pre-wrap text-[14px] leading-[1.65] text-ink-2">
              {profile.profileBio}
            </p>
          ) : null}

          {/* Meta row — location · joined · views */}
          {(profile.location || joinedLabel || profileViewsLabel) ? (
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-3">
              {profile.location ? (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-3" strokeWidth={1.5} />
                  {profile.location}
                </span>
              ) : null}
              {joinedLabel ? (
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="size-3" strokeWidth={1.5} />
                  Joined {joinedLabel}
                </span>
              ) : null}
              {profileViewsLabel ? (
                <span className="inline-flex items-center gap-1.5">
                  <Eye className="size-3" strokeWidth={1.5} />
                  {profileViewsLabel}
                </span>
              ) : null}
            </div>
          ) : null}

          {/* Profile links — info-blue chips */}
          {linkList.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-1">
              {linkList.map((link, idx) => (
                <ProfileLink key={idx} href={link.href} icon={link.icon}>
                  {link.label}
                </ProfileLink>
              ))}
            </div>
          ) : null}

          {/* Stats strip — 5 cells in a muted block (spec §09) */}
          <div className="mt-5 flex items-center rounded-md border-[0.5px] border-border bg-secondary px-2 py-3">
            <Stat label="Followers" value={followerCount} to={`/profile/${profile.username}/followers`} />
            <Stat label="Following" value={followingCount} to={`/profile/${profile.username}/following`} />
            <Stat label="Posts" value={postsCount} />
            {showsResearch ? <Stat label="Research" value={researchCount} /> : null}
            <Stat label="Answers" value={answersCount} />
            {reelsCount > 0 ? <Stat label="Reels" value={reelsCount} /> : null}
          </div>
        </div>
      </motion.section>

      <Tabs defaultValue={showsResearch ? 'research' : 'activity'}>
        <TabsList className="flex w-full justify-start gap-0 rounded-none border-0 border-b-[0.5px] border-border bg-transparent p-0">
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
              {profile.selfDescriber ? (
                <p className="whitespace-pre-wrap leading-6">{profile.selfDescriber}</p>
              ) : (
                <p className="text-muted-foreground">No description provided.</p>
              )}
              {profile.links?.length ? (
                <div className="space-y-1.5 pt-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Links
                  </p>
                  {profile.links.map((link) => (
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
    </div>
  )
}
