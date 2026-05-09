import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, Loader2, Menu, Search, Sliders } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { BrandWordmark } from '@/components/app/brand-mark'
import { NotificationBell } from '@/components/app/notification-bell'
import { TweaksMenu } from '@/components/app/tweaks-menu'
import { UserAvatar } from '@/components/app/user-avatar'
import { useAuth } from '@/features/auth/auth-context'
import { instantSearch, unifiedSearch } from '@/features/search/search.api'
import { cn } from '@/lib/utils'
import { getFullName, getHandle } from '@/lib/format'
import { getSearchTypeMeta, searchHitHref } from '@/lib/search'

function isMacLike() {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || '')
}

// The order results render in the typeahead. People first because we
// want exact-match `@handle` lookups to land at the top; then the most
// content-rich corpora.
const TYPEAHEAD_GROUP_ORDER = [
  'USER',
  'POST',
  'REEL',
  'QUESTION',
  'ANSWER',
  'RESEARCH',
]

function flattenGroups(unified) {
  if (!unified) return []
  const groups = unified.groups ?? {}
  const out = []
  for (const type of TYPEAHEAD_GROUP_ORDER) {
    const hits = Array.isArray(groups[type]) ? groups[type] : []
    if (hits.length === 0) continue
    out.push({ type, hits })
  }
  // Catch-all for any type the FE doesn't know about yet.
  for (const [type, hits] of Object.entries(groups)) {
    if (TYPEAHEAD_GROUP_ORDER.includes(type)) continue
    if (Array.isArray(hits) && hits.length > 0) out.push({ type, hits })
  }
  return out
}

function SearchHitRow({ hit, onActivate }) {
  const meta = getSearchTypeMeta(hit.type)
  const Icon = meta.icon
  const href = searchHitHref(hit) ?? '#'
  const author = hit.authorUsername
    ? {
        username: hit.authorUsername,
        fullName: hit.authorFullName,
        profileImage: hit.authorProfileImage ?? hit.thumbnailUrl,
      }
    : null

  // For USER hits the API returns the full name in `title` and the
  // handle in `username`. Show name as primary, `@handle` as secondary.
  // The handle is sanitized so a legacy email-shaped username never
  // renders as `@user@gmail.com`.
  const isUser = hit.type === 'USER'
  const cleanHandle = isUser
    ? getHandle({ username: hit.username || hit.snippet })
    : null
  const userPrimary = isUser
    ? hit.title || cleanHandle || '(unknown)'
    : hit.title || hit.snippet || '(untitled)'

  return (
    <Link
      to={href}
      onClick={() => onActivate?.(hit)}
      className="flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted/70 focus-visible:bg-muted/70 focus-visible:outline-none"
    >
      {isUser ? (
        <UserAvatar
          user={{
            username: hit.username ?? hit.title,
            fullName: hit.title,
            profileImage: hit.thumbnailUrl,
          }}
          className="size-8 shrink-0"
        />
      ) : (
        <span
          className={cn(
            'mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border',
            meta.accent,
          )}
          aria-hidden
        >
          <Icon className="size-4" />
        </span>
      )}
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-[13px] font-semibold text-ink">{userPrimary}</p>
        {isUser && cleanHandle ? (
          <p className="truncate font-mono text-[11px] text-ink-3">@{cleanHandle}</p>
        ) : hit.snippet && hit.snippet !== hit.title ? (
          <p className="line-clamp-1 text-[11.5px] text-ink-3">{hit.snippet}</p>
        ) : author?.username ? (
          <p className="truncate text-[11.5px] text-ink-3">
            {author.fullName || `@${getHandle(author)}`}
          </p>
        ) : null}
      </div>
    </Link>
  )
}

function SearchBar() {
  const [query, setQuery] = useState('')
  const [unified, setUnified] = useState(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const navigate = useNavigate()
  const isMac = useMemo(isMacLike, [])

  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) {
      setUnified(null)
      setIsLoading(false)
      return undefined
    }

    setIsLoading(true)
    let cancelled = false
    // First request: hit /search/instant — prefix-only, no FTS, sub-5ms
    // warm. The dropdown stays responsive even on slow networks. After
    // a brief settle, fall back to the heavier /search for full ranked
    // results (FTS + trigram fallback) so deeper matches surface too.
    const fastTimer = setTimeout(async () => {
      try {
        const data = await instantSearch({ q: term, limit: 5 })
        if (!cancelled) setUnified(data ?? null)
      } catch {
        // ignore — let the unified pass below cover it
      }
    }, 60)

    const richTimer = setTimeout(async () => {
      try {
        const data = await unifiedSearch({ q: term, limit: 5 })
        if (!cancelled) setUnified(data ?? null)
      } catch {
        if (!cancelled) setUnified((current) => current ?? null)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }, 280)

    return () => {
      cancelled = true
      clearTimeout(fastTimer)
      clearTimeout(richTimer)
    }
  }, [query])

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ⌘K / Ctrl+K — focus the search bar like Linear / Vercel.
  useEffect(() => {
    function handleKeyDown(event) {
      const meta = event.metaKey || event.ctrlKey
      if (meta && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
        setIsOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  function handleHitActivate() {
    setQuery('')
    setUnified(null)
    setIsOpen(false)
  }

  function handleSubmit(event) {
    event.preventDefault()
    const term = query.trim()
    if (!term) return
    navigate(`/search?q=${encodeURIComponent(term)}`)
    setIsOpen(false)
  }

  const groups = useMemo(() => flattenGroups(unified), [unified])
  const hasResults = groups.length > 0
  const term = query.trim()

  return (
    <form ref={containerRef} onSubmit={handleSubmit} className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-[15px] -translate-y-1/2 text-ink-4" />
      <Input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setIsOpen(true)
        }}
        onFocus={() => setIsOpen(true)}
        placeholder="Search posts, reels, research, scholars…"
        className={cn(
          'h-10 rounded-lg border border-border bg-paper pl-9 pr-16 text-[13px] text-ink placeholder:text-ink-4',
          'transition focus:border-brand/50 focus-visible:bg-paper focus-visible:ring-[3px] focus-visible:ring-brand/15',
        )}
        aria-label="Search"
      />
      <kbd
        className="pointer-events-none absolute right-2 top-1/2 inline-flex h-5 -translate-y-1/2 items-center gap-0.5 rounded-md border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-ink-3"
        aria-hidden
      >
        {isMac ? '⌘' : 'Ctrl'}K
      </kbd>
      {isOpen && term.length >= 2 ? (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-2xl border border-border bg-popover/95 shadow-soft-lg backdrop-blur">
          {isLoading && !hasResults ? (
            <p className="flex items-center gap-2 px-4 py-3 text-sm text-ink-3">
              <Loader2 className="size-3.5 animate-spin" />
              Searching…
            </p>
          ) : !hasResults ? (
            <p className="px-4 py-3 text-sm text-ink-3">
              No results for "{term}".
            </p>
          ) : (
            <div className="max-h-[480px] overflow-y-auto p-1.5">
              {groups.map(({ type, hits }) => {
                const meta = getSearchTypeMeta(type)
                const Icon = meta.icon
                return (
                  <section key={type} className="px-1 pb-2 last:pb-0">
                    <header className="flex items-center gap-1.5 px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">
                      <Icon className="size-3" />
                      {meta.plural}
                    </header>
                    <div className="space-y-0.5">
                      {hits.map((hit) => (
                        <SearchHitRow
                          key={`${type}-${hit.id ?? hit.title}-${hit.score ?? ''}`}
                          hit={hit}
                          onActivate={handleHitActivate}
                        />
                      ))}
                    </div>
                  </section>
                )
              })}
            </div>
          )}
          <footer className="border-t border-border bg-muted/40 p-1.5">
            <Link
              to={`/search?q=${encodeURIComponent(term)}`}
              onClick={() => setIsOpen(false)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-[12.5px] font-semibold text-ink transition-colors hover:bg-muted"
            >
              See all results for "{term}"
              <ChevronRight className="size-3.5" />
            </Link>
          </footer>
        </div>
      ) : null}
    </form>
  )
}

function AccountMenu() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const profileHref = useMemo(
    () => (user?.username ? `/profile/${user.username}` : null),
    [user?.username],
  )

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  if (!user) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full p-0">
          <UserAvatar
            user={user}
            className="size-9 ring-2 ring-background transition-transform hover:scale-105"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          <div className="leading-tight">
            <p className="truncate text-sm font-semibold text-foreground">
              {getFullName(user) || getHandle(user) || 'Account'}
            </p>
            {getHandle(user) ? (
              <p className="truncate font-mono text-[11px] font-normal text-muted-foreground">
                @{getHandle(user)}
              </p>
            ) : null}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {profileHref ? (
          <DropdownMenuItem asChild>
            <Link to={profileHref}>Profile</Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem asChild>
          <Link to="/saved">Saved</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/settings">Settings</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleSignOut}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AppTopbar({ onMenuClick, title, className }) {
  const { isAuthenticated } = useAuth()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 4)
    }
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header
      className={cn(
        'glass-panel sticky top-0 z-20 flex h-14 items-center gap-3 border-b px-4 transition-shadow sm:px-6',
        scrolled
          ? 'border-border/80 shadow-soft'
          : 'border-transparent',
        className,
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="rounded-full lg:hidden"
        onClick={onMenuClick}
        aria-label="Open navigation"
      >
        <Menu className="size-5" />
      </Button>

      <Link to="/" className="flex items-center gap-2 lg:hidden">
        <BrandWordmark size="md" />
      </Link>

      {title ? (
        <h1 className="font-display truncate text-[18px] font-semibold leading-none tracking-[-0.012em] text-ink md:text-[20px]">
          {title}
        </h1>
      ) : null}

      <div className="hidden flex-1 md:block">
        <SearchBar />
      </div>

      <div className="ml-auto flex items-center gap-1 md:gap-2">
        {isAuthenticated ? (
          <>
            <NotificationBell />
            <TweaksMenu
              trigger={
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full text-ink-2 hover:bg-accent hover:text-ink"
                  title="Tweaks · theme, accent, font"
                >
                  <Sliders className="size-[17px]" strokeWidth={1.75} />
                </Button>
              }
            />
            <AccountMenu />
          </>
        ) : (
          <>
            <Button asChild variant="ghost" size="sm" className="rounded-full">
              <Link to="/login">Sign in</Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="rounded-full bg-brand text-brand-foreground hover:bg-brand/90"
            >
              <Link to="/signup">Sign up</Link>
            </Button>
          </>
        )}
      </div>
    </header>
  )
}
