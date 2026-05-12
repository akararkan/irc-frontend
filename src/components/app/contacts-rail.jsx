import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Compass, Search, Sparkles, Users, X } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { RoleBadge } from '@/components/app/role-badge'
import { UserAvatar } from '@/components/app/user-avatar'
import { useAuth } from '@/features/auth/auth-context'
import { getFollowing } from '@/features/social/social.api'
import { searchUsers } from '@/features/users/users.api'
import { cn } from '@/lib/utils'
import { getFullName, getHandle, getRawUsername } from '@/lib/format'

/**
 * Right-rail "Companions" panel: the people the current user follows,
 * with a "Discover" suggestions block when their list is short. Editorial
 * styling — eyebrow caps, paper-tinted card, role badges, no presence dot.
 */
export function ContactsRail() {
  const { user, isAuthenticated } = useAuth()
  const [following, setFollowing] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setLoading(false)
      return undefined
    }
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const followingData = await getFollowing(user.id, { page: 0, size: 30 }).catch(() => null)
        const followingItems = followingData?.content ?? []
        if (!cancelled) setFollowing(followingItems)

        if (followingItems.length < 6) {
          // Pull a larger discover pool so the panel has enough rows
          // to scroll through. The inner container caps height and
          // owns its own scrollbar, so a long list doesn't push the
          // sticky rail past the viewport.
          const discover = await searchUsers({ q: '', page: 0, size: 30 }).catch(() => null)
          const discoverItems = (discover?.content ?? []).filter(
            (candidate) =>
              candidate.id !== user.id &&
              !followingItems.some((followed) => followed.id === candidate.id),
          )
          if (!cancelled) setSuggestions(discoverItems)
        } else {
          if (!cancelled) setSuggestions([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [isAuthenticated, user?.id])

  const visibleFollowing = useMemo(() => {
    if (!filter.trim()) return following
    const needle = filter.trim().toLowerCase()
    return following.filter((person) => {
      const name = getFullName(person).toLowerCase()
      const handle = (person.username ?? '').toLowerCase()
      return name.includes(needle) || handle.includes(needle)
    })
  }, [following, filter])

  if (!isAuthenticated) return null

  return (
    <aside className="space-y-5">
      <SectionEyebrow icon={Users} title="Companions" />

      <div className="space-y-3">
        {following.length > 0 ? (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Filter…"
              className="h-9 rounded-full border-border bg-card pl-8 pr-8 text-sm shadow-none focus-visible:ring-1"
            />
            {filter ? (
              <button
                type="button"
                onClick={() => setFilter('')}
                className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Clear"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-0.5">
          {loading ? (
            [0, 1, 2, 3, 4].map((key) => (
              <div key={key} className="flex items-center gap-3 px-2 py-2">
                <Skeleton className="size-9 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-32 rounded-full" />
                  <Skeleton className="h-2.5 w-20 rounded-full" />
                </div>
              </div>
            ))
          ) : visibleFollowing.length > 0 ? (
            visibleFollowing.map((person, index) => (
              <CompanionRow key={person.id} person={person} index={index} />
            ))
          ) : following.length > 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              No companion matches “{filter}”.
            </p>
          ) : (
            <p className="rounded-2xl border border-dashed border-border bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
              You aren’t following anyone yet. Discover scholars and thinkers below.
            </p>
          )}
        </div>
      </div>

      {suggestions.length > 0 ? (
        <div className="space-y-3">
          <SectionEyebrow icon={Compass} title="Discover" />
          {/* Discover list owns its own scroll — caps at ~5.5 rows on
              the desktop rail so the user can browse the full
              suggestion pool without the parent sticky rail growing
              past the viewport. Hairline mask at the bottom hints
              there's more to scroll. */}
          <div className="relative">
            <div className="scrollbar-none max-h-[360px] space-y-0.5 overflow-y-auto pr-1">
              {suggestions.map((person, index) => (
                <CompanionRow
                  key={person.id}
                  person={person}
                  index={index}
                  muted
                />
              ))}
            </div>
            {suggestions.length > 6 ? (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 h-8 rounded-b bg-gradient-to-t from-background to-transparent"
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </aside>
  )
}

// ─── Section eyebrow (small caps + thin rule) ──────────────────────
function SectionEyebrow({ icon: Icon, title }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-3.5 text-muted-foreground" />
      <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </h2>
      <span className="ml-1 h-px flex-1 bg-border" aria-hidden />
    </div>
  )
}

// ─── Companion row ────────────────────────────────────────────────
function CompanionRow({ person, index, muted = false }) {
  const handle = getHandle(person)
  const route = getRawUsername(person)
  return (
    <motion.div
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        type: 'spring',
        stiffness: 320,
        damping: 28,
        delay: Math.min(index, 8) * 0.025,
      }}
    >
      <Link
        to={`/profile/${route}`}
        className={cn(
          'group/row flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted/60',
        )}
      >
        <UserAvatar
          user={person}
          className="size-9 shrink-0 ring-1 ring-border transition-shadow group-hover/row:ring-foreground/30"
        />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-medium">
              {getFullName(person) || handle}
            </p>
            {person.role ? <RoleBadge role={person.role} size="xs" /> : null}
          </div>
          {handle ? (
            <p className="truncate text-[11px] text-muted-foreground">
              @{handle}
            </p>
          ) : null}
        </div>
        {muted ? (
          <Sparkles className="size-3 shrink-0 text-muted-foreground/60 transition-colors group-hover/row:text-foreground" />
        ) : null}
      </Link>
    </motion.div>
  )
}
