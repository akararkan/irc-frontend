import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  Bell,
  BookMarked,
  BookOpenText,
  Clapperboard,
  Home,
  LogOut,
  MessageCircleQuestion,
  Search as SearchIcon,
  Settings,
  Sun,
  User2,
  Users,
} from 'lucide-react'

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import { useAuth } from '@/features/auth/auth-context'
import { useTheme } from '@/lib/theme'

/**
 * App-wide ⌘J Command palette.
 *
 * Pure-navigation surface. Search-as-you-type lives in the inline
 * topbar SearchBar (typeahead grouped by entity type) — the
 * Command palette is for fast keyboard navigation between pages
 * and tweaks without hunting for the sidebar.
 *
 * Shortcut: ⌘+J / Ctrl+J (⌘+K is already wired to focus the inline
 * search; the palette gets its own chord so both UX paths coexist).
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { user, isAuthenticated, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    function onKey(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'j') {
        event.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function go(path) {
    return () => {
      setOpen(false)
      navigate(path)
    }
  }

  const profileHref = user?.username ? `/profile/${user.username}` : null

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Quick navigate"
      description="Type to filter; press Enter to go."
    >
      <CommandInput placeholder="Type a page, command, or setting…" />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>

        <CommandGroup heading="Navigate">
          <CommandItem onSelect={go('/')}>
            <Home className="size-4" />
            Home
            <CommandShortcut>g h</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={go('/research')}>
            <BookOpenText className="size-4" />
            Research
            <CommandShortcut>g r</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={go('/questions')}>
            <MessageCircleQuestion className="size-4" />
            Questions
            <CommandShortcut>g q</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={go('/reels')}>
            <Clapperboard className="size-4" />
            Reels
          </CommandItem>
          <CommandItem onSelect={go('/notifications')}>
            <Bell className="size-4" />
            Notifications
          </CommandItem>
          <CommandItem onSelect={go('/saved')}>
            <BookMarked className="size-4" />
            Saved
          </CommandItem>
          <CommandItem onSelect={go('/activity')}>
            <Activity className="size-4" />
            Activity
          </CommandItem>
          <CommandItem onSelect={go('/people')}>
            <Users className="size-4" />
            People
          </CommandItem>
          <CommandItem onSelect={go('/search')}>
            <SearchIcon className="size-4" />
            Full search
            <CommandShortcut>⌘K</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        {isAuthenticated ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Workspace">
              {profileHref ? (
                <CommandItem onSelect={go(profileHref)}>
                  <User2 className="size-4" />
                  Profile
                </CommandItem>
              ) : null}
              <CommandItem onSelect={go('/my-research')}>
                <BookMarked className="size-4" />
                My research
              </CommandItem>
              <CommandItem onSelect={go('/settings')}>
                <Settings className="size-4" />
                Settings
              </CommandItem>
            </CommandGroup>
          </>
        ) : null}

        <CommandSeparator />
        <CommandGroup heading="Appearance">
          <CommandItem
            onSelect={() => {
              toggleTheme()
              setOpen(false)
            }}
          >
            <Sun className="size-4" />
            Toggle {theme === 'dark' ? 'light' : 'dark'} theme
          </CommandItem>
        </CommandGroup>

        {isAuthenticated ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Account">
              <CommandItem
                onSelect={async () => {
                  setOpen(false)
                  await signOut()
                  navigate('/login', { replace: true })
                }}
              >
                <LogOut className="size-4" />
                Sign out
              </CommandItem>
            </CommandGroup>
          </>
        ) : null}
      </CommandList>
    </CommandDialog>
  )
}
