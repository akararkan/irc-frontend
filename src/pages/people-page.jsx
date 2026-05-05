import { useCallback, useEffect, useState } from 'react'
import { Ban, Search, ShieldAlert, UserMinus, UserPlus, Users } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/app/empty-state'
import { PageHeader } from '@/components/app/page-header'
import { UserAvatar } from '@/components/app/user-avatar'
import {
  blockUser,
  followUser,
  getBlockedUsers,
  unblockUser,
  unfollowUser,
} from '@/features/social/social.api'
import { searchUsers } from '@/features/users/users.api'
import { useAuth } from '@/features/auth/auth-context'
import { useToast } from '@/components/ui/toaster'
import { extractApiMessage } from '@/lib/api-error'
import { formatNumber, getFullName } from '@/lib/format'

function UserRow({ user, onFollow, onUnfollow, onBlock, onUnblock, currentUserId }) {
  const [working, setWorking] = useState(false)
  const isMe = currentUserId && user.id === currentUserId
  const following = user._isFollowing
  const blocked = user._isBlocked

  async function run(action) {
    if (working) return
    setWorking(true)
    try {
      await action(user)
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3 sm:flex-nowrap">
      <Link to={`/profile/${user.username}`}>
        <UserAvatar user={user} className="size-11" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link to={`/profile/${user.username}`} className="block truncate font-medium hover:underline">
          {getFullName(user)}
        </Link>
        <p className="truncate text-xs text-muted-foreground">{user.username}</p>
        {user.profileBio ? (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{user.profileBio}</p>
        ) : null}
        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          <span>{formatNumber(user.followerCount ?? 0)} followers</span>
          {user.role ? <span className="uppercase tracking-wide">{user.role}</span> : null}
        </div>
      </div>

      {!isMe ? (
        <div className="flex shrink-0 items-center gap-1.5">
          {blocked ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-full"
              disabled={working}
              onClick={() => run(onUnblock)}
            >
              Unblock
            </Button>
          ) : (
            <>
              <Button
                type="button"
                size="sm"
                variant={following ? 'outline' : 'default'}
                className="rounded-full"
                disabled={working}
                onClick={() => run(following ? onUnfollow : onFollow)}
              >
                {following ? <UserMinus className="size-4" /> : <UserPlus className="size-4" />}
                {following ? 'Following' : 'Follow'}
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                className="rounded-full text-muted-foreground"
                disabled={working}
                onClick={() => run(onBlock)}
                title="Block"
              >
                <Ban className="size-4" />
              </Button>
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}

function DirectorySearch() {
  const { user: currentUser } = useAuth()
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialQuery = searchParams.get('q') ?? ''
  const [query, setQuery] = useState(initialQuery)
  const [submitted, setSubmitted] = useState(initialQuery)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(Boolean(initialQuery))

  const runSearch = useCallback(
    async (term) => {
      const trimmed = term.trim()
      if (!trimmed) {
        setItems([])
        return
      }
      setLoading(true)
      setHasSearched(true)
      try {
        const data = await searchUsers({ q: trimmed, page: 0, size: 30 })
        setItems(data?.content ?? [])
      } catch (error) {
        toast.error(extractApiMessage(error, 'Could not search people.'))
      } finally {
        setLoading(false)
      }
    },
    [toast],
  )

  useEffect(() => {
    if (submitted) runSearch(submitted)
  }, [submitted, runSearch])

  async function handleFollow(person) {
    try {
      await followUser(person.id)
      setItems((current) => current.map((item) => (item.id === person.id ? { ...item, _isFollowing: true } : item)))
      toast.success(`Following ${person.username}`)
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not follow.'))
    }
  }

  async function handleUnfollow(person) {
    try {
      await unfollowUser(person.id)
      setItems((current) => current.map((item) => (item.id === person.id ? { ...item, _isFollowing: false } : item)))
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not unfollow.'))
    }
  }

  async function handleBlock(person) {
    try {
      await blockUser(person.id)
      setItems((current) => current.map((item) => (item.id === person.id ? { ...item, _isBlocked: true, _isFollowing: false } : item)))
      toast.success(`Blocked ${person.username}`)
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not block.'))
    }
  }

  async function handleUnblock(person) {
    try {
      await unblockUser(person.id)
      setItems((current) => current.map((item) => (item.id === person.id ? { ...item, _isBlocked: false } : item)))
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not unblock.'))
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    setSubmitted(query)
    setSearchParams((params) => {
      const next = new URLSearchParams(params)
      if (query) next.set('q', query)
      else next.delete('q')
      return next
    })
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search people by name, username, or interest"
          className="h-11 rounded-full pl-9"
        />
      </form>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : !hasSearched ? (
        <EmptyState
          icon={Users}
          title="Search the community"
          description="Type a name, username, or interest to discover people across the platform."
        />
      ) : items.length === 0 ? (
        <EmptyState icon={Users} title="No results" description="Try another search term." />
      ) : (
        <div className="space-y-3">
          {items.map((person) => (
            <UserRow
              key={person.id}
              user={person}
              currentUserId={currentUser?.id}
              onFollow={handleFollow}
              onUnfollow={handleUnfollow}
              onBlock={handleBlock}
              onUnblock={handleUnblock}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function BlockedList() {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getBlockedUsers({ page: 0, size: 30 })
      setItems((data?.content ?? []).map((user) => ({ ...user, _isBlocked: true })))
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not load blocked list.'))
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  async function handleUnblock(person) {
    try {
      await unblockUser(person.id)
      setItems((current) => current.filter((item) => item.id !== person.id))
      toast.success(`Unblocked ${person.username}`)
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not unblock.'))
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1].map((key) => (
          <Skeleton key={key} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="No blocked users"
        description="Blocking someone prevents them from seeing your posts or reaching your inbox."
      />
    )
  }

  return (
    <div className="space-y-3">
      {items.map((person) => (
        <UserRow
          key={person.id}
          user={person}
          onUnblock={handleUnblock}
          onFollow={() => {}}
          onUnfollow={() => {}}
          onBlock={() => {}}
        />
      ))}
    </div>
  )
}

export function PeoplePage() {
  const { isAuthenticated } = useAuth()

  return (
    <div className="space-y-6">
      <PageHeader
        title="People"
        description="Find people across the community, follow them, and manage your social graph."
      />

      {isAuthenticated ? (
        <Tabs defaultValue="search">
          <TabsList>
            <TabsTrigger value="search">Search</TabsTrigger>
            <TabsTrigger value="blocked">Blocked</TabsTrigger>
          </TabsList>
          <TabsContent value="search">
            <DirectorySearch />
          </TabsContent>
          <TabsContent value="blocked">
            <BlockedList />
          </TabsContent>
        </Tabs>
      ) : (
        <DirectorySearch />
      )}
    </div>
  )
}
