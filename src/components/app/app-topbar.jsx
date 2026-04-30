import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, Menu, Search } from 'lucide-react'
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
import { UserAvatar } from '@/components/app/user-avatar'
import { useAuth } from '@/features/auth/auth-context'
import { useNotifications } from '@/features/notifications/notifications-context'
import { searchUsers } from '@/features/users/users.api'
import { cn } from '@/lib/utils'
import { getFullName } from '@/lib/format'

function isMacLike() {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || '')
}

function SearchBar() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const navigate = useNavigate()
  const isMac = useMemo(isMacLike, [])

  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) {
      setResults([])
      setIsLoading(false)
      return undefined
    }

    setIsLoading(true)
    const controller = new AbortController()
    const timeout = setTimeout(async () => {
      try {
        const page = await searchUsers({ q: term, page: 0, size: 6 })
        if (!controller.signal.aborted) {
          setResults(page?.content ?? [])
        }
      } catch {
        if (!controller.signal.aborted) setResults([])
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }, 220)

    return () => {
      controller.abort()
      clearTimeout(timeout)
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

  function handleSelect(user) {
    setQuery('')
    setResults([])
    setIsOpen(false)
    navigate(`/profile/${user.username}`)
  }

  function handleSubmit(event) {
    event.preventDefault()
    const term = query.trim()
    if (!term) return
    navigate(`/people?q=${encodeURIComponent(term)}`)
    setIsOpen(false)
  }

  return (
    <form ref={containerRef} onSubmit={handleSubmit} className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setIsOpen(true)
        }}
        onFocus={() => setIsOpen(true)}
        placeholder="Search people, research, posts…"
        className="h-10 rounded-full border-border/70 bg-muted/50 pl-9 pr-16 text-[13.5px] transition-colors focus-visible:bg-background"
        aria-label="Search"
      />
      <kbd
        className="pointer-events-none absolute right-3 top-1/2 inline-flex h-5 -translate-y-1/2 items-center gap-0.5 rounded-md border border-border bg-background/70 px-1.5 font-mono text-[10px] font-medium text-muted-foreground"
        aria-hidden
      >
        {isMac ? '⌘' : 'Ctrl'}K
      </kbd>
      {isOpen && query.trim().length >= 2 ? (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-2xl border border-border bg-popover/95 shadow-soft-lg backdrop-blur">
          {isLoading ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">No people found.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1.5">
              {results.map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(user)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                  >
                    <UserAvatar user={user} className="size-8" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{getFullName(user)}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        @{user.username}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </form>
  )
}

function NotificationBellButton() {
  const { unreadCount } = useNotifications()
  return (
    <Button
      asChild
      variant="ghost"
      size="icon"
      className="relative rounded-full hover:bg-accent"
    >
      <Link to="/notifications" aria-label="Notifications">
        <Bell className="size-[18px]" strokeWidth={1.75} />
        {unreadCount > 0 ? (
          <>
            <span
              aria-hidden
              className="absolute right-1.5 top-1.5 size-2 rounded-full bg-brand"
            />
            <span
              aria-hidden
              className="absolute right-1.5 top-1.5 size-2 animate-ping rounded-full bg-brand opacity-60"
            />
          </>
        ) : null}
      </Link>
    </Button>
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
              {getFullName(user)}
            </p>
            <p className="truncate text-xs font-normal text-muted-foreground">
              @{user.username}
            </p>
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
        <h1 className="font-display truncate text-lg leading-none text-foreground md:text-xl">
          {title}
        </h1>
      ) : null}

      <div className="hidden flex-1 md:block">
        <SearchBar />
      </div>

      <div className="ml-auto flex items-center gap-1 md:gap-2">
        {isAuthenticated ? (
          <>
            <NotificationBellButton />
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
