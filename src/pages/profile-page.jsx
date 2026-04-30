import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Ban, Bookmark, MapPin, ShieldAlert, UserMinus, UserPlus } from 'lucide-react'
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
import { formatNumber, getFullName } from '@/lib/format'

function Stat({ label, value, to }) {
  const content = (
    <div>
      <p className="text-base font-semibold">{formatNumber(value ?? 0)}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
  if (to) {
    return (
      <Link to={to} className="rounded-lg px-2 py-1 transition-colors hover:bg-muted">
        {content}
      </Link>
    )
  }
  return content
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
      toast.success(`Following @${profile.username}`)
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
      toast.success(`Blocked @${profile.username}`)
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
        description={`We couldn't find @${username}.`}
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

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      >
      <Card className="overflow-hidden border bg-card shadow-sm">
        <div className="relative h-36 overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(circle at 20% 20%, oklch(0.82 0.12 285 / 0.35), transparent 45%), radial-gradient(circle at 80% 30%, oklch(0.85 0.14 75 / 0.35), transparent 50%), radial-gradient(circle at 50% 100%, oklch(0.82 0.1 220 / 0.35), transparent 55%), linear-gradient(135deg, oklch(0.96 0.005 250), oklch(0.92 0.008 250))',
            }}
          />
          <div className="absolute inset-0 bg-pattern opacity-20 mix-blend-multiply" />
        </div>
        <CardContent className="relative space-y-4 px-5 pb-5 pt-0">
          <div className="-mt-12 flex flex-wrap items-end justify-between gap-4">
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22, delay: 0.1 }}
            >
              <UserAvatar
                user={profile}
                className="size-24 border-4 border-background shadow-xl"
              />
            </motion.div>
            {!isMe && isAuthenticated ? (
              <div className="flex flex-wrap items-center gap-2">
                {status?.isBlocking ? (
                  <Button size="sm" variant="outline" className="rounded-full" onClick={handleUnblock} disabled={working}>
                    Unblock
                  </Button>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant={status?.isFollowing ? 'outline' : 'default'}
                      className="rounded-full"
                      onClick={status?.isFollowing ? handleUnfollow : handleFollow}
                      disabled={working}
                    >
                      {status?.isFollowing ? (
                        <>
                          <UserMinus className="size-4" /> Following
                        </>
                      ) : (
                        <>
                          <UserPlus className="size-4" /> Follow
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant={status?.isRestricting ? 'secondary' : 'ghost'}
                      className="rounded-full"
                      onClick={handleToggleRestrict}
                      disabled={working}
                      title={status?.isRestricting ? 'Unrestrict' : 'Restrict'}
                    >
                      <ShieldAlert className="size-4" />
                      {status?.isRestricting ? 'Restricted' : 'Restrict'}
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="rounded-full text-muted-foreground"
                      onClick={handleBlock}
                      disabled={working}
                      title="Block"
                    >
                      <Ban className="size-4" />
                    </Button>
                  </>
                )}
              </div>
            ) : null}
            {isMe ? (
              <Button asChild size="sm" variant="outline" className="rounded-full">
                <Link to="/settings">Edit profile</Link>
              </Button>
            ) : null}
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{getFullName(profile)}</h1>
              {profile.role ? <RoleBadge role={profile.role} size="sm" /> : null}
            </div>
            <p className="text-sm text-muted-foreground">@{profile.username}</p>
            {profile.profileBio ? (
              <p className="whitespace-pre-wrap text-sm leading-6">{profile.profileBio}</p>
            ) : null}
            {profile.location ? (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="size-3.5" />
                {profile.location}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Stat label="Followers" value={followerCount} to={`/profile/${profile.username}/followers`} />
            <Stat label="Following" value={followingCount} to={`/profile/${profile.username}/following`} />
          </div>
        </CardContent>
      </Card>
      </motion.div>

      <Tabs defaultValue="activity">
        <TabsList>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="posts">Posts</TabsTrigger>
          {showsResearch ? <TabsTrigger value="research">Research</TabsTrigger> : null}
          {isMe ? <TabsTrigger value="questions">Questions</TabsTrigger> : null}
          {isMe ? (
            <TabsTrigger value="saved">
              <Bookmark className="size-3.5" />
              Saved
            </TabsTrigger>
          ) : null}
          <TabsTrigger value="about">About</TabsTrigger>
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
