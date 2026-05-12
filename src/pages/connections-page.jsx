import { useEffect, useState } from 'react'
import { UserMinus, Users } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/app/empty-state'
import { PageHeader } from '@/components/app/page-header'
import { UserRow } from '@/components/app/user-row'
import { getUserByUsername } from '@/features/users/users.api'
import {
  followUser,
  getFollowers,
  getFollowing,
  unfollowUser,
} from '@/features/social/social.api'
import { useAuth } from '@/features/auth/auth-context'
import { useToast } from '@/components/ui/toaster'
import { extractApiMessage } from '@/lib/api-error'
import { getFullName, getHandle, getRawUsername } from '@/lib/format'

function List({ items, onFollow, onUnfollow, currentUserId }) {
  if (items.length === 0) {
    return <EmptyState icon={Users} title="No one here yet" description="Come back later." />
  }
  return (
    <div className="space-y-3">
      {items.map((person) => {
        const isMe = currentUserId && person.id === currentUserId
        const following = person._isFollowing
        return (
          <UserRow
            key={person.id}
            user={person}
            trailing={
              isMe ? null : following ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => onUnfollow(person)}
                >
                  <UserMinus className="size-4" />
                  Following
                </Button>
              ) : (
                <Button size="sm" className="rounded-full" onClick={() => onFollow(person)}>
                  Follow
                </Button>
              )
            }
          />
        )
      })}
    </div>
  )
}

export function ConnectionsPage({ initialTab = 'followers' }) {
  const { username } = useParams()
  const { user: currentUser } = useAuth()
  const toast = useToast()
  const [profile, setProfile] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [followers, setFollowers] = useState([])
  const [following, setFollowing] = useState([])
  const [loadingFollowers, setLoadingFollowers] = useState(true)
  const [loadingFollowing, setLoadingFollowing] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoadingProfile(true)
      try {
        const data = await getUserByUsername(username)
        if (!cancelled) setProfile(data)
      } catch {
        if (!cancelled) setProfile(null)
      } finally {
        if (!cancelled) setLoadingProfile(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [username])

  useEffect(() => {
    if (!profile?.id) return undefined
    let cancelled = false
    async function load() {
      setLoadingFollowers(true)
      setLoadingFollowing(true)
      try {
        const [followersPage, followingPage] = await Promise.all([
          getFollowers(profile.id, { page: 0, size: 50 }),
          getFollowing(profile.id, { page: 0, size: 50 }),
        ])
        if (!cancelled) {
          setFollowers((followersPage?.content ?? []).map((user) => ({ ...user, _isFollowing: false })))
          setFollowing((followingPage?.content ?? []).map((user) => ({ ...user, _isFollowing: true })))
        }
      } catch {
        if (!cancelled) {
          setFollowers([])
          setFollowing([])
        }
      } finally {
        if (!cancelled) {
          setLoadingFollowers(false)
          setLoadingFollowing(false)
        }
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [profile?.id])

  async function handleFollow(person) {
    try {
      await followUser(person.id)
      const updater = (list) =>
        list.map((item) => (item.id === person.id ? { ...item, _isFollowing: true } : item))
      setFollowers(updater)
      setFollowing((current) =>
        current.find((item) => item.id === person.id)
          ? current.map((item) => (item.id === person.id ? { ...item, _isFollowing: true } : item))
          : current,
      )
      toast.success(`Following ${getFullName(person) || getHandle(person)}`)
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not follow.'))
    }
  }

  async function handleUnfollow(person) {
    try {
      await unfollowUser(person.id)
      const updater = (list) =>
        list.map((item) => (item.id === person.id ? { ...item, _isFollowing: false } : item))
      setFollowers(updater)
      setFollowing(updater)
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not unfollow.'))
    }
  }

  if (loadingProfile) return <Skeleton className="h-10 w-full" />
  if (!profile) {
    return (
      <EmptyState
        title="Profile not found"
        action={
          <Button asChild size="sm" variant="outline" className="rounded-full">
            <Link to="/people">Search people</Link>
          </Button>
        }
      />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Connections of ${getFullName(profile) || getHandle(profile)}`}
        description={getHandle(profile) ? `@${getHandle(profile)}` : null}
        action={
          <Button asChild size="sm" variant="outline" className="rounded-full">
            <Link to={`/profile/${getRawUsername(profile)}`}>View profile</Link>
          </Button>
        }
      />

      <Tabs defaultValue={initialTab}>
        <TabsList>
          <TabsTrigger value="followers">Followers · {followers.length}</TabsTrigger>
          <TabsTrigger value="following">Following · {following.length}</TabsTrigger>
        </TabsList>
        <TabsContent value="followers">
          {loadingFollowers ? (
            <Skeleton className="h-20 rounded-lg" />
          ) : (
            <List
              items={followers}
              onFollow={handleFollow}
              onUnfollow={handleUnfollow}
              currentUserId={currentUser?.id}
            />
          )}
        </TabsContent>
        <TabsContent value="following">
          {loadingFollowing ? (
            <Skeleton className="h-20 rounded-lg" />
          ) : (
            <List
              items={following}
              onFollow={handleFollow}
              onUnfollow={handleUnfollow}
              currentUserId={currentUser?.id}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
