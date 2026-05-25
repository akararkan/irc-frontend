import { useCallback, useEffect, useState } from 'react'
import { Ban, Check, Search, ShieldAlert, UserPlus, Users } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'

import { Skeleton } from '@/components/ui/skeleton'
import { RoleBadge } from '@/components/app/role-badge'
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
import {
  formatNumber,
  getFollowerCount,
  getFullName,
  getHandle,
  getProfileBio,
  getRawUsername,
} from '@/lib/format'
import { cn } from '@/lib/utils'

/* ── Person card ─────────────────────────────────────────────── */
function PersonCard({ user, onFollow, onUnfollow, onBlock, onUnblock, currentUserId }) {
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

  const route = getRawUsername(user)
  const handle = getHandle(user)
  const bio = getProfileBio(user)
  const followerCount = getFollowerCount(user)

  return (
    <div className="flex items-start gap-3.5 rounded-lg border border-line bg-background p-4 transition-colors hover:border-fg/30 sm:gap-4">
      <Link to={`/profile/${route}`} className="shrink-0 transition-opacity hover:opacity-90">
        <UserAvatar user={user} className="size-11 rounded-full sm:size-12" />
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            to={`/profile/${route}`}
            className="font-semibold text-[15px] font-semibold tracking-[-0.005em] text-ink hover:underline"
          >
            {getFullName(user) || handle || 'Unknown'}
          </Link>
          {user.role ? <RoleBadge role={user.role} size="xs" /> : null}
        </div>
        {handle ? (
          <p className="mt-0.5 font-mono text-[11.5px] text-fg-muted">@{handle}</p>
        ) : null}
        {bio ? (
          <p className="mt-1.5 line-clamp-2 text-[13px] leading-[1.55] text-fg-soft">{bio}</p>
        ) : null}
        {followerCount > 0 ? (
          <p className="mt-2 font-mono text-[11px] text-fg-muted">
            <span className="font-semibold tabular-nums text-ink">
              {formatNumber(followerCount)}
            </span>{' '}
            <span className="uppercase tracking-[0.08em]">followers</span>
          </p>
        ) : null}
      </div>

      {!isMe ? (
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {blocked ? (
            <button
              type="button"
              disabled={working}
              onClick={() => run(onUnblock)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3.5 text-[12.5px] font-medium text-fg-soft transition-colors hover:border-fg/40 hover:text-ink disabled:opacity-50"
            >
              Unblock
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={working}
                onClick={() => run(following ? onUnfollow : onFollow)}
                className={cn(
                  'inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[12.5px] font-medium transition-colors disabled:opacity-50',
                  following
                    ? 'border border-line bg-background text-fg-soft hover:border-fg/40 hover:text-ink'
                    : 'bg-brand text-accent-indigo-foreground hover:bg-brand/90',
                )}
              >
                {following ? (
                  <>
                    <Check className="size-3.5" strokeWidth={2.2} />
                    Following
                  </>
                ) : (
                  <>
                    <UserPlus className="size-3.5" strokeWidth={2} />
                    Follow
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={working}
                onClick={() => run(onBlock)}
                title="Block"
                aria-label="Block this user"
                className="grid size-8 place-items-center rounded-lg border border-line text-fg-muted transition-colors hover:border-destructive/40 hover:text-destructive disabled:opacity-50"
              >
                <Ban className="size-3.5" strokeWidth={1.7} />
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}

/* ── Search tab ──────────────────────────────────────────────── */
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
      setItems((current) =>
        current.map((item) =>
          item.id === person.id ? { ...item, _isFollowing: true } : item,
        ),
      )
      toast.success(`Following ${getFullName(person) || getHandle(person)}`)
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not follow.'))
    }
  }

  async function handleUnfollow(person) {
    try {
      await unfollowUser(person.id)
      setItems((current) =>
        current.map((item) =>
          item.id === person.id ? { ...item, _isFollowing: false } : item,
        ),
      )
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not unfollow.'))
    }
  }

  async function handleBlock(person) {
    try {
      await blockUser(person.id)
      setItems((current) =>
        current.map((item) =>
          item.id === person.id ? { ...item, _isBlocked: true, _isFollowing: false } : item,
        ),
      )
      toast.success(`Blocked ${getFullName(person) || getHandle(person)}`)
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not block.'))
    }
  }

  async function handleUnblock(person) {
    try {
      await unblockUser(person.id)
      setItems((current) =>
        current.map((item) =>
          item.id === person.id ? { ...item, _isBlocked: false } : item,
        ),
      )
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
      {/* Search field */}
      <form onSubmit={handleSubmit} className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[15px] -translate-y-1/2 text-fg-faint" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search people by name, username, or interest…"
          className="h-11 w-full rounded-lg border border-line bg-background pl-10 pr-24 text-[13.5px] text-ink outline-none placeholder:text-fg-faint transition-colors focus:border-fg/50 focus:ring-[3px] focus:ring-brand/15"
        />
        <button
          type="submit"
          className="absolute right-1.5 top-1/2 inline-flex h-8 -translate-y-1/2 items-center rounded-md bg-brand px-3.5 text-[12.5px] font-medium text-accent-indigo-foreground transition-colors hover:bg-brand/90"
        >
          Search
        </button>
      </form>

      {/* Results */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : !hasSearched ? (
        <SearchEmptyState />
      ) : items.length === 0 ? (
        <SearchEmptyState
          title="No results"
          description="Try a different name, username, or interest."
        />
      ) : (
        <div className="space-y-3">
          {items.map((person) => (
            <PersonCard
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

/* ── Blocked tab ─────────────────────────────────────────────── */
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
      toast.success(`Unblocked ${getFullName(person) || getHandle(person)}`)
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not unblock.'))
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1].map((key) => (
          <Skeleton key={key} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line bg-background px-6 py-10 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-bg-soft text-fg-muted">
          <ShieldAlert className="size-5" strokeWidth={1.6} />
        </span>
        <p className="mt-4 font-semibold text-[17px] font-semibold text-ink">No blocked users</p>
        <p className="mx-auto mt-1.5 max-w-[38ch] text-[13px] leading-[1.6] text-fg-muted">
          Blocking someone prevents them from seeing your posts or reaching your inbox.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((person) => (
        <PersonCard
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

/* ── Search empty state ──────────────────────────────────────── */
function SearchEmptyState({
  title = 'Search the community',
  description = 'Type a name, username, or interest to discover scholars and researchers across the platform.',
}) {
  return (
    <div className="rounded-lg border border-line bg-background px-6 py-10 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-brand-soft text-accent-indigo">
        <Users className="size-5" strokeWidth={1.6} />
      </span>
      <p className="mt-4 font-semibold text-[17px] font-semibold tracking-[-0.01em] text-ink">
        {title}
      </p>
      <p className="mx-auto mt-1.5 max-w-[38ch] text-[13px] leading-[1.6] text-fg-muted">
        {description}
      </p>
    </div>
  )
}

/* ─── PeoplePage ─────────────────────────────────────────────── */
export function PeoplePage() {
  const { isAuthenticated } = useAuth()
  const [tab, setTab] = useState('search')

  return (
    <div className="space-y-5">
      {/* Editorial header card */}
      <div className="rounded-lg border border-line bg-background p-5 sm:p-6">
        <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-accent-indigo">
          Community
        </p>
        <h1 className="mt-1 font-semibold text-[30px] font-semibold leading-[1.1] tracking-[-0.018em] text-ink sm:text-[36px]">
          People
        </h1>
        <p className="mt-2 max-w-[56ch] text-[13.5px] leading-[1.6] text-fg-soft">
          Find scholars and researchers across the community, follow them, and manage your social
          graph.
        </p>
      </div>

      {/* Tabs + content */}
      {isAuthenticated ? (
        <div className="space-y-4">
          {/* Segmented tab control */}
          <div className="flex items-center gap-1 rounded-md border border-line bg-bg-soft p-1 w-fit">
            {['search', 'blocked'].map((value) => {
              const active = tab === value
              const label = value === 'search' ? 'Search' : 'Blocked'
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTab(value)}
                  className={cn(
                    'relative rounded-lg px-4 py-1.5 text-[13px] font-medium transition-colors',
                    active ? 'text-accent-indigo' : 'text-fg-muted hover:text-ink',
                  )}
                >
                  {active ? (
                    <span
                      className="absolute inset-0 rounded-lg bg-background"
                      style={{ boxShadow: 'var(--shadow-xs)' }}
                    />
                  ) : null}
                  <span className="relative">{label}</span>
                </button>
              )
            })}
          </div>

          {tab === 'search' ? <DirectorySearch /> : <BlockedList />}
        </div>
      ) : (
        <DirectorySearch />
      )}
    </div>
  )
}
