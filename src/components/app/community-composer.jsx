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
      <section
        className={cn(
          'rounded-2xl border border-border bg-paper transition-colors',
          'focus-within:border-brand/40 focus-within:ring-[4px] focus-within:ring-brand/10',
          'hover:border-brand/25',
        )}
      >
        <div className="flex items-start gap-3 px-4 pt-3.5">
          <UserAvatar user={user} className="size-10 shrink-0" />
          <button
            type="button"
            onClick={trigger}
            className={cn(
              'flex-1 truncate rounded-md bg-transparent px-1 py-2 text-left',
              'font-display text-[17px] leading-[1.45] tracking-[-0.005em] text-ink-3',
              'transition-colors hover:text-ink-2',
            )}
          >
            Share a thought, a citation, or a question for the community…
          </button>
        </div>

        <div className="mx-4 mt-2 flex items-center justify-between gap-1 border-t border-dashed border-border py-2">
          <div className="flex items-center gap-0.5 sm:gap-1">
            {TYPES.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={trigger}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-ink-3 transition-colors',
                    'hover:bg-muted hover:text-ink',
                  )}
                >
                  <Icon className="size-[15px]" strokeWidth={1.75} />
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
              )
            })}
          </div>

          <button
            type="button"
            onClick={trigger}
            className={cn(
              'rounded-lg bg-gradient-to-br from-brand to-brand/85 px-3.5 py-1.5 text-[12px] font-semibold text-brand-foreground shadow-soft',
              'transition-transform hover:-translate-y-px hover:from-brand hover:to-brand/90',
            )}
          >
            Post
          </button>
        </div>
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[90vh] max-w-xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b border-border px-5 py-4">
            <DialogTitle className="text-base font-semibold">
              New post
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
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
