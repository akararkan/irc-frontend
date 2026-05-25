import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, Loader2, Menu, PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react'
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
import { NotificationBell } from '@/components/app/notification-bell'
import { UserAvatar } from '@/components/app/user-avatar'
import { useAuth } from '@/features/auth/auth-context'
import { instantSearch, unifiedSearch } from '@/features/search/search.api'
import { cn } from '@/lib/utils'
import { getFullName, getHandle } from '@/lib/format'
import { getSearchTypeMeta, searchHitHref } from '@/lib/search'
import { useLanguage } from '@/lib/theme'
import { LANGUAGES } from '@/i18n'

// Compact language switcher — always visible in the topbar.
function LangSwitcher() {
  const { lang, setLang } = useLanguage()
  const current = LANGUAGES.find((l) => l.code === (lang ?? 'en')) ?? LANGUAGES[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 rounded-md px-2.5 font-mono text-[11.5px] font-medium text-fg-muted hover:bg-bg-soft hover:text-fg"
          title="Change language"
        >
          {current.nativeLabel}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-40 rounded-md border-line bg-card shadow-sm"
      >
        {LANGUAGES.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onSelect={() => setLang(l.code)}
            className={cn(
              'flex items-center gap-2.5 rounded-sm text-[12.5px]',
              l.code === current.code && 'font-semibold text-fg',
            )}
            dir={l.dir}
          >
            <span className="w-5 shrink-0 text-center font-mono text-[11px] font-semibold">
              {l.code === 'en' ? 'A' : l.code === 'ar' ? 'ع' : 'ک'}
            </span>
            {l.nativeLabel}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function isMacLike() {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || '')
}

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
      className="flex items-start gap-2.5 rounded-sm px-2.5 py-2 text-left transition-colors hover:bg-bg-soft focus-visible:bg-bg-soft focus-visible:outline-none"
    >
      {isUser ? (
        <UserAvatar
          user={{
            username: hit.username ?? hit.title,
            fullName: hit.title,
            profileImage: hit.thumbnailUrl,
          }}
          className="size-7 shrink-0"
        />
      ) : (
        <span
          className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md border border-line bg-bg-soft text-fg-muted"
          aria-hidden
        >
          <Icon className="size-[14px]" strokeWidth={1.7} />
        </span>
      )}
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-[13px] font-semibold text-fg">{userPrimary}</p>
        {isUser && cleanHandle ? (
          <p className="truncate font-mono text-[11px] text-fg-muted">@{cleanHandle}</p>
        ) : hit.snippet && hit.snippet !== hit.title ? (
          <p className="line-clamp-1 text-[11.5px] text-fg-muted">{hit.snippet}</p>
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
    const fastTimer = setTimeout(async () => {
      try {
        const data = await instantSearch({ q: term, limit: 5 })
        if (!cancelled) setUnified(data ?? null)
      } catch { /* ignore */ }
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
      <Search className="pointer-events-none absolute left-3 top-1/2 size-[14px] -translate-y-1/2 text-fg-muted" strokeWidth={1.7} />
      <Input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setIsOpen(true)
        }}
        onFocus={() => setIsOpen(true)}
        placeholder="Search scholars, posts, questions, #tags…"
        className={cn(
          'h-8 rounded-md border border-line bg-bg-soft pl-9 pr-14 text-[12.5px] text-fg placeholder:text-fg-faint',
          'transition focus-visible:border-line-strong focus-visible:bg-background focus-visible:ring-0',
        )}
        aria-label="Search"
      />
      <kbd
        className="pointer-events-none absolute right-2 top-1/2 inline-flex h-[18px] -translate-y-1/2 items-center gap-0.5 rounded-[4px] border border-line bg-background px-1.5 font-mono text-[10px] text-fg-muted"
        aria-hidden
      >
        {isMac ? '⌘' : 'Ctrl'}K
      </kbd>
      {isOpen && term.length >= 2 ? (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-md border border-line bg-card shadow-md">
          {isLoading && !hasResults ? (
            <p className="flex items-center gap-2 px-4 py-3 text-[12.5px] text-fg-muted">
              <Loader2 className="size-3.5 animate-spin" />
              Searching…
            </p>
          ) : !hasResults ? (
            <p className="px-4 py-3 text-[12.5px] text-fg-muted">
              No results for "{term}".
            </p>
          ) : (
            <div className="max-h-[480px] overflow-y-auto p-1.5">
              {groups.map(({ type, hits }) => {
                const meta = getSearchTypeMeta(type)
                const Icon = meta.icon
                return (
                  <section key={type} className="px-1 pb-2 last:pb-0">
                    <header className="flex items-center gap-1.5 px-2 pb-1 pt-2 font-mono text-[10px] font-medium uppercase tracking-[0.04em] text-fg-faint">
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
          <footer className="border-t border-line bg-bg-soft p-1.5">
            <Link
              to={`/search?q=${encodeURIComponent(term)}`}
              onClick={() => setIsOpen(false)}
              className="flex w-full items-center justify-between rounded-sm px-3 py-2 text-[12px] font-semibold text-fg transition-colors hover:bg-bg-muted"
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
        <Button variant="ghost" size="icon" className="size-8 rounded-full p-0 hover:bg-bg-soft">
          <UserAvatar
            user={user}
            className="size-7 ring-1 ring-line"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-60 rounded-md border-line bg-card shadow-sm"
      >
        <DropdownMenuLabel>
          <div className="leading-tight">
            <p className="truncate text-[13px] font-semibold text-fg">
              {getFullName(user) || getHandle(user) || 'Account'}
            </p>
            {getHandle(user) ? (
              <p className="truncate font-mono text-[11px] font-normal text-fg-muted">
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

export function AppTopbar({ onMenuClick, onToggleSidebar, sidebarCollapsed, title, className }) {
  const { isAuthenticated } = useAuth()

  return (
    <header
      className={cn(
        'glass-panel sticky top-0 z-20 flex h-12 items-center gap-2 border-b border-line px-3 sm:gap-3 sm:px-6',
        className,
      )}
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 rounded-md text-fg-muted hover:bg-bg-soft hover:text-fg lg:hidden"
        onClick={onMenuClick}
        aria-label="Open navigation"
      >
        <Menu className="size-[18px]" strokeWidth={1.7} />
      </Button>

      {onToggleSidebar ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="hidden size-8 rounded-md text-fg-muted hover:bg-bg-soft hover:text-fg lg:inline-flex"
          onClick={onToggleSidebar}
          aria-label={sidebarCollapsed ? 'Open sidebar' : 'Close sidebar'}
          title={sidebarCollapsed ? 'Open sidebar' : 'Close sidebar'}
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen className="size-[16px]" strokeWidth={1.7} />
          ) : (
            <PanelLeftClose className="size-[16px]" strokeWidth={1.7} />
          )}
        </Button>
      ) : null}

      <Link to="/" className="flex items-center gap-2 lg:hidden">
        <div className="grid size-[20px] shrink-0 place-items-center rounded-[4px] bg-fg font-mono text-[10px] font-semibold text-background">
          i
        </div>
        <span className="text-[13px] font-semibold tracking-[-0.01em] text-fg">irc</span>
      </Link>

      {title ? (
        <h1 className="truncate text-[14px] font-semibold leading-none tracking-[-0.01em] text-fg">
          {title}
        </h1>
      ) : null}

      <div className="hidden flex-1 md:block">
        <SearchBar />
      </div>

      <Link
        to="/search"
        aria-label="Search"
        className="ml-auto grid size-8 place-items-center rounded-md text-fg-muted transition-colors hover:bg-bg-soft hover:text-fg md:hidden"
      >
        <Search className="size-[16px]" strokeWidth={1.7} />
      </Link>

      <div className="flex items-center gap-1 md:ml-auto md:gap-1.5">
        {isAuthenticated ? (
          <>
            <LangSwitcher />
            <NotificationBell />
            <AccountMenu />
          </>
        ) : (
          <>
            <LangSwitcher />
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-8 rounded-md text-[12.5px] font-medium text-fg-muted hover:bg-bg-soft hover:text-fg"
            >
              <Link to="/login">Sign in</Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="h-8 rounded-md bg-fg px-3 text-[12.5px] font-medium text-background hover:bg-fg-soft"
            >
              <Link to="/signup">Sign up</Link>
            </Button>
          </>
        )}
      </div>
    </header>
  )
}
