import { forwardRef, useImperativeHandle, useState } from 'react'
import { motion } from 'motion/react'
import {
  Clapperboard,
  FileText,
  Image as ImageIcon,
  Mic,
  Send,
  Sparkles,
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
// upload step directly, no extra click. The accent classes paint the
// chip's icon tile in a tone that hints at the medium (parchment for
// notes, sky for media, gold for voice, rust for reels).
const TYPES = [
  {
    id: 'text',
    label: 'Note',
    icon: FileText,
    postType: 'TEXT',
    iconTone: 'bg-brand-soft text-brand',
  },
  {
    id: 'media',
    label: 'Media',
    icon: ImageIcon,
    postType: 'EMBEDDED',
    iconTone:
      'bg-[color-mix(in_oklch,var(--accent-sky)_18%,var(--paper))] text-accent-sky',
  },
  {
    id: 'voice',
    label: 'Voice',
    icon: Mic,
    postType: 'VOICE_POST',
    iconTone: 'bg-gold-soft text-gold-2',
  },
  {
    id: 'reel',
    label: 'Reel',
    icon: Clapperboard,
    postType: 'REEL',
    iconTone:
      'bg-[color-mix(in_oklch,var(--accent-rust)_18%,var(--paper))] text-accent-rust',
  },
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
          'group/composer relative isolate overflow-hidden rounded-3xl border border-border bg-paper p-1.5 shadow-soft transition-all duration-200',
          'focus-within:border-brand/40 focus-within:ring-[4px] focus-within:ring-brand/10',
          'hover:-translate-y-px hover:border-brand/25 hover:shadow-soft-lg',
        )}
      >
        {/* Soft brand wash on hover — keeps the composer feeling alive
            without competing with the feed below. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-300 group-hover/composer:opacity-100"
          style={{
            background:
              'radial-gradient(120% 80% at 0% 0%, color-mix(in oklch, var(--brand) 8%, transparent), transparent 60%), radial-gradient(80% 60% at 100% 100%, color-mix(in oklch, var(--gold) 10%, transparent), transparent 70%)',
          }}
        />

        <div className="flex items-center gap-3 rounded-2xl bg-paper px-4 pt-3.5 pb-3 sm:px-5">
          <span className="ring-conic shrink-0">
            <UserAvatar
              user={user}
              className="size-11 ring-2 ring-paper"
            />
          </span>
          <button
            type="button"
            onClick={() => trigger('TEXT')}
            className={cn(
              'group/input flex flex-1 items-center gap-2 truncate rounded-2xl border border-dashed border-border bg-muted/40 px-4 py-2.5 text-left',
              'font-display text-[15.5px] leading-[1.4] tracking-[-0.005em] text-ink-3',
              'transition-all hover:border-brand/30 hover:bg-brand-soft/30 hover:text-ink-2',
            )}
          >
            <Sparkles className="size-3.5 shrink-0 text-gold-2 transition-transform group-hover/input:rotate-12" />
            <span className="truncate italic">
              Share a thought, a citation, or a question for the community…
            </span>
          </button>
        </div>

        <div className="mx-3 mt-1 flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-border px-1 py-2 sm:mx-4">
          <div className="flex flex-wrap items-center gap-0.5 sm:gap-1">
            {TYPES.map((item) => {
              const Icon = item.icon
              return (
                <motion.button
                  key={item.id}
                  type="button"
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.96 }}
                  transition={{ type: 'spring', stiffness: 460, damping: 26 }}
                  onClick={() => trigger(item.postType)}
                  className={cn(
                    'group/chip inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[12px] font-semibold text-ink-2 transition-colors',
                    'hover:bg-muted',
                  )}
                >
                  <span
                    className={cn(
                      'grid size-7 place-items-center rounded-full ring-1 ring-border/60 transition-transform group-hover/chip:scale-110',
                      item.iconTone,
                    )}
                  >
                    <Icon className="size-[13px]" strokeWidth={2} />
                  </span>
                  <span className="hidden pr-1 sm:inline">{item.label}</span>
                </motion.button>
              )
            })}
          </div>

          <motion.button
            type="button"
            onClick={() => trigger('TEXT')}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 480, damping: 26 }}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[12.5px] font-semibold',
              'bg-gradient-to-br from-brand via-brand to-brand/85 text-brand-foreground shadow-soft',
              'transition-shadow hover:shadow-soft-lg',
            )}
          >
            <Send className="size-[13px]" strokeWidth={2} />
            Post
          </motion.button>
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
