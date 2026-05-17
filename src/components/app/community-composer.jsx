import { forwardRef, useImperativeHandle, useState } from 'react'
import { motion } from 'motion/react'
import {
  ChevronDown,
  Globe,
  Image as ImageIcon,
  Lock,
  MapPin,
  Mic,
  Quote,
  Users,
  Video,
} from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PostComposer } from '@/components/app/post-composer'
import { UserAvatar } from '@/components/app/user-avatar'
import { useAuth } from '@/features/auth/auth-context'
import { cn } from '@/lib/utils'

const TOOLS = [
  { id: 'image',    icon: ImageIcon, postType: 'EMBEDDED',   label: 'Image',    color: 'text-sky-500' },
  { id: 'video',    icon: Video,     postType: 'REEL',        label: 'Video',    color: 'text-violet-500' },
  { id: 'voice',    icon: Mic,       postType: 'VOICE_POST',  label: 'Voice',    color: 'text-amber-500' },
  { id: 'quote',    icon: Quote,     postType: 'TEXT',        label: 'Quote',    color: 'text-brand' },
  { id: 'location', icon: MapPin,    postType: 'EMBEDDED',    label: 'Location', color: 'text-rose-500' },
]

const VISIBILITY = [
  { value: 'PUBLIC',         label: 'Public',    icon: Globe },
  { value: 'FOLLOWERS_ONLY', label: 'Followers', icon: Users },
  { value: 'ONLY_ME',        label: 'Only me',   icon: Lock  },
]

const PROMPTS = [
  'Share a thought, citation, or finding…',
  'What are you researching today?',
  'Share a scholarly insight…',
  'Start a discussion…',
]

export const CommunityComposer = forwardRef(function CommunityComposer(
  { onPosted },
  ref,
) {
  const { user } = useAuth()
  const [open,       setOpen]       = useState(false)
  const [startType,  setStartType]  = useState('TEXT')
  const [visibility, setVisibility] = useState('PUBLIC')

  const prompt = PROMPTS[new Date().getDay() % PROMPTS.length]

  useImperativeHandle(ref, () => ({
    openWith(postType) {
      setStartType(postType ?? 'TEXT')
      setOpen(true)
    },
  }), [])

  if (!user) return null

  function trigger(postType = 'TEXT') {
    setStartType(postType)
    setOpen(true)
  }

  const activeVisibility = VISIBILITY.find((v) => v.value === visibility) ?? VISIBILITY[0]
  const VisibilityIcon = activeVisibility.icon

  return (
    <>
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 28, delay: 0.05 }}
        className="overflow-hidden rounded-2xl border-[0.5px] border-border bg-paper"
        style={{ boxShadow: 'var(--shadow-sm)' }}
      >
        {/* ── Writing surface ── */}
        <button
          type="button"
          onClick={() => trigger('TEXT')}
          className="flex w-full items-start gap-3.5 px-5 pt-5 pb-4 text-left transition-colors hover:bg-muted/30"
        >
          {/* Avatar with gradient ring */}
          <div
            className="mt-0.5 shrink-0 rounded-full p-[2px]"
            style={{ background: 'linear-gradient(135deg, var(--brand), var(--gold))' }}
          >
            <div className="rounded-full bg-paper p-[1.5px]">
              <UserAvatar user={user} className="size-9 rounded-full" />
            </div>
          </div>

          {/* Prompt text */}
          <div className="flex-1 py-1.5">
            <p className="font-display text-[15.5px] italic leading-[1.45] tracking-[-0.005em] text-ink-3 transition-colors">
              {prompt}
            </p>
          </div>
        </button>

        {/* ── Divider ── */}
        <div
          className="mx-5 h-px"
          style={{
            background:
              'linear-gradient(90deg, transparent, var(--border), transparent)',
          }}
        />

        {/* ── Bottom action row ── */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3.5">
          {/* Tool chips */}
          <div className="flex items-center gap-1">
            {TOOLS.map((tool) => {
              const Icon = tool.icon
              return (
                <motion.button
                  key={tool.id}
                  type="button"
                  onClick={() => trigger(tool.postType)}
                  title={tool.label}
                  aria-label={tool.label}
                  whileHover={{ scale: 1.1, y: -1 }}
                  whileTap={{ scale: 0.9 }}
                  className={cn(
                    'group relative flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-medium transition-colors hover:bg-secondary',
                    tool.color,
                  )}
                >
                  <Icon className="size-[15px]" strokeWidth={1.7} />
                  <span className="hidden text-ink-3 sm:inline">{tool.label}</span>
                </motion.button>
              )
            })}
          </div>

          {/* Visibility + Post */}
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-full border-[0.5px] border-border px-3 py-1.5 text-[12px] font-medium text-ink-2 transition-colors hover:bg-secondary hover:text-ink"
                >
                  <VisibilityIcon className="size-3" strokeWidth={1.6} />
                  {activeVisibility.label}
                  <ChevronDown className="size-2.5 opacity-60" strokeWidth={1.8} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                {VISIBILITY.map((option) => {
                  const ItemIcon = option.icon
                  return (
                    <DropdownMenuItem
                      key={option.value}
                      onSelect={() => setVisibility(option.value)}
                      className={cn(option.value === visibility && 'font-semibold text-ink')}
                    >
                      <ItemIcon className="mr-2 size-3.5" strokeWidth={1.6} />
                      {option.label}
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            <motion.button
              type="button"
              onClick={() => trigger('TEXT')}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="rounded-full px-5 py-1.5 text-[12.5px] font-semibold text-paper transition-opacity hover:opacity-90"
              style={{ background: 'var(--ink)' }}
            >
              Post
            </motion.button>
          </div>
        </div>
      </motion.section>

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
              initialVisibility={visibility}
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
