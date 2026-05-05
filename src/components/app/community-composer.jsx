import { forwardRef, useImperativeHandle, useState } from 'react'
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

// Each chip both opens the dialog and tells the composer which post-type
// to start in — so a click on "Reel" lands the user on the reel
// upload step directly, no extra click.
const TYPES = [
  { id: 'text',  label: 'Note',   icon: FileText,    postType: 'TEXT' },
  { id: 'media', label: 'Media',  icon: ImageIcon,   postType: 'EMBEDDED' },
  { id: 'voice', label: 'Voice',  icon: Mic,         postType: 'VOICE_POST' },
  { id: 'reel',  label: 'Reel',   icon: Clapperboard, postType: 'REEL' },
]

/**
 * Single-line composer trigger inspired by Twitter / Threads.
 *
 * Tapping anywhere — the input, an avatar, or a type chip — opens the
 * full PostComposer in a dialog. Each chip remembers which post-type
 * should be selected when the dialog opens.
 *
 * Forwards an imperative `openWith(postType)` ref so other surfaces
 * (the reel-strip "Create reel" tile, story shortcuts, etc.) can launch
 * the dialog into a specific mode without duplicating the wiring.
 */
export const CommunityComposer = forwardRef(function CommunityComposer(
  { onPosted },
  ref,
) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  // The starting post-type is held alongside open-state so opening
  // and re-opening with different types both work cleanly.
  const [startType, setStartType] = useState('TEXT')

  useImperativeHandle(
    ref,
    () => ({
      openWith(postType) {
        setStartType(postType ?? 'TEXT')
        setOpen(true)
      },
    }),
    [],
  )

  if (!user) return null

  function trigger(postType = 'TEXT') {
    setStartType(postType)
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
            onClick={() => trigger('TEXT')}
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
                  onClick={() => trigger(item.postType)}
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
            onClick={() => trigger('TEXT')}
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
              {startType === 'REEL'
                ? 'New reel'
                : startType === 'VOICE_POST'
                  ? 'New voice post'
                  : startType === 'EMBEDDED'
                    ? 'New media post'
                    : 'New post'}
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <PostComposer
              bare
              key={startType}
              initialType={startType}
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
})
