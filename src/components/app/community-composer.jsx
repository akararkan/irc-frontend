import { forwardRef, useImperativeHandle, useState } from 'react'
import { motion } from 'motion/react'
import {
  Mic,
  Image as ImageIcon,
  Video,
  PenLine,
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

const POST_TYPES = [
  {
    id: 'TEXT',
    icon: PenLine,
    label: 'Note',
    tile: 'bg-[#EFF6FF] hover:bg-[#DBEAFE]',
    icon_color: 'text-[#2563EB]',
  },
  {
    id: 'EMBEDDED',
    icon: ImageIcon,
    label: 'Photo',
    tile: 'bg-[#ECFEFF] hover:bg-[#CFFAFE]',
    icon_color: 'text-[#0891B2]',
  },
  {
    id: 'REEL',
    icon: Video,
    label: 'Video',
    tile: 'bg-[#F5F3FF] hover:bg-[#EDE9FE]',
    icon_color: 'text-[#7C3AED]',
  },
  {
    id: 'VOICE_POST',
    icon: Mic,
    label: 'Voice',
    tile: 'bg-[#FFFBEB] hover:bg-[#FEF3C7]',
    icon_color: 'text-[#B45309]',
  },
]

const PROMPTS = [
  'Share a finding, citation, or question…',
  'What are you researching today?',
  'Share a scholarly insight…',
  'Start a discussion with the community…',
]

const TITLES = {
  TEXT: 'New post',
  EMBEDDED: 'New media post',
  VOICE_POST: 'New voice post',
  REEL: 'New reel',
}

export const CommunityComposer = forwardRef(function CommunityComposer(
  { onPosted },
  ref,
) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [startType, setStartType] = useState('TEXT')

  const prompt = PROMPTS[new Date().getDay() % PROMPTS.length]

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

  function launch(postType = 'TEXT') {
    setStartType(postType)
    setOpen(true)
  }

  return (
    <>
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 28, delay: 0.05 }}
        className="overflow-hidden rounded-2xl border border-border bg-paper"
        style={{ boxShadow: 'var(--shadow-sm)' }}
      >
        {/* ── Prompt row ──────────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 pt-4">
          <UserAvatar user={user} className="size-10 shrink-0 rounded-full" />
          <button
            type="button"
            onClick={() => launch('TEXT')}
            className="h-10 flex-1 rounded-full border border-border bg-secondary px-4 text-left text-[13.5px] text-ink-3 transition-colors hover:border-brand/40 hover:bg-paper"
          >
            {prompt}
          </button>
        </div>

        {/* ── Type tiles ──────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-2 p-3">
          {POST_TYPES.map((type) => {
            const Icon = type.icon
            return (
              <motion.button
                key={type.id}
                type="button"
                onClick={() => launch(type.id)}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 400, damping: 24 }}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-xl border border-border py-2.5 transition-colors',
                  type.tile,
                )}
              >
                <Icon
                  className={cn('size-[19px]', type.icon_color)}
                  strokeWidth={1.9}
                />
                <span className="text-[11.5px] font-medium text-ink-2">
                  {type.label}
                </span>
              </motion.button>
            )
          })}
        </div>
      </motion.section>

      {/* ── Studio dialog ───────────────────────────────────── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[90vh] max-w-xl flex-col gap-0 overflow-hidden rounded-2xl p-0">
          <DialogHeader className="shrink-0 border-b border-border px-5 py-3.5">
            <DialogTitle className="font-display text-[15px] font-semibold tracking-[-0.01em]">
              {TITLES[startType] ?? 'New post'}
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
