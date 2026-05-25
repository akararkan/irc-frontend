import { forwardRef, useImperativeHandle, useState } from 'react'
import { PenLine } from 'lucide-react'

import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { PostComposer } from '@/components/app/post-composer'
import { UserAvatar } from '@/components/app/user-avatar'
import { useAuth } from '@/features/auth/auth-context'

const PROMPTS = [
  'Share a finding, citation, or question…',
  'What are you researching today?',
  'Share a scholarly insight…',
  'Start a discussion with the community…',
]

export const CommunityComposer = forwardRef(function CommunityComposer(
  { onPosted },
  ref,
) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [startType, setStartType] = useState('TEXT')

  const prompt = PROMPTS[new Date().getDay() % PROMPTS.length]

  useImperativeHandle(ref, () => ({
    openWith(postType) {
      setStartType(postType ?? 'TEXT')
      setOpen(true)
    },
  }), [])

  if (!user) return null

  return (
    <>
      {/* ── Trigger card ── */}
      <div
        className="overflow-hidden rounded-lg border border-line bg-background"
      >
        {/* Prompt row — click to open the full composer */}
        <div className="flex items-center gap-3 px-4 py-3.5">
          <UserAvatar user={user} className="size-8 shrink-0 rounded-full" />
          <button
            type="button"
            onClick={() => { setStartType('TEXT'); setOpen(true) }}
            className="h-9 flex-1 rounded-md border border-line bg-bg-soft px-4 text-left text-[13px] text-fg-faint transition-colors hover:bg-bg-muted hover:text-fg-muted"
          >
            {prompt}
          </button>
        </div>

        {/* Quick type tab strip */}
        <div className="flex border-t border-line bg-bg-soft">
          {[
            { id: 'TEXT',       icon: PenLine,  label: 'Text' },
            { id: 'EMBEDDED',   icon: null,     label: 'Photo' },
            { id: 'VOICE_POST', icon: null,     label: 'Voice' },
            { id: 'REEL',       icon: null,     label: 'Reel' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { setStartType(t.id); setOpen(true) }}
              className="flex flex-1 items-center justify-center py-2.5 text-[12px] font-medium text-fg-muted transition-colors hover:bg-background hover:text-fg"
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Full composer dialog ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[90vh] max-w-xl flex-col gap-0 overflow-hidden rounded-lg border-line p-0">
          <PostComposer
            bare
            key={startType}
            initialType={startType}
            onPosted={(created) => {
              onPosted?.(created)
              setOpen(false)
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  )
})
