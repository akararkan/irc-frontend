import { useState } from 'react'
import {
  Clapperboard,
  FileText,
  Image as ImageIcon,
  Mic,
} from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PostComposer } from '@/components/app/post-composer'
import { UserAvatar } from '@/components/app/user-avatar'
import { useAuth } from '@/features/auth/auth-context'
import { cn } from '@/lib/utils'

const TYPES = [
  { id: 'text',  label: 'Note',   icon: FileText },
  { id: 'media', label: 'Media',  icon: ImageIcon },
  { id: 'voice', label: 'Voice',  icon: Mic },
  { id: 'reel',  label: 'Reel',   icon: Clapperboard },
]

/**
 * A clean, single-line composer trigger inspired by Twitter / Threads.
 * Tapping anywhere — the input, an avatar, or a type chip — opens the full
 * PostComposer in a dialog.
 */
export function CommunityComposer({ onPosted }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)

  if (!user) return null

  const greeting = user.fname || user.username || 'friend'

  function trigger() {
    setOpen(true)
  }

  return (
    <>
      <section className="rounded-2xl border border-border bg-card transition-colors hover:border-foreground/15">
        <div className="flex items-center gap-3 px-4 py-3">
          <UserAvatar user={user} className="size-10 shrink-0" />
          <button
            type="button"
            onClick={trigger}
            className="flex-1 truncate rounded-full bg-muted/60 px-4 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            What's on your mind, {greeting}?
          </button>
        </div>

        <div className="flex items-center justify-between gap-1 border-t border-border px-2 py-1.5">
          <div className="flex items-center gap-0.5 sm:gap-1">
            {TYPES.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={trigger}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors',
                    'hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Icon className="size-4" strokeWidth={1.75} />
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
              )
            })}
          </div>

          <button
            type="button"
            onClick={trigger}
            className="rounded-full bg-foreground px-3.5 py-1.5 text-[12px] font-semibold text-background transition-colors hover:bg-foreground/85"
          >
            Post
          </button>
        </div>
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl overflow-hidden p-0">
          <DialogHeader className="border-b border-border px-5 py-4">
            <DialogTitle className="text-base font-semibold">
              New post
            </DialogTitle>
          </DialogHeader>
          <div className="px-5 py-4">
            <PostComposer
              bare
              onPosted={(created) => {
                onPosted?.(created)
                setOpen(false)
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
