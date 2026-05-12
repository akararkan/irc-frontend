import { forwardRef, useImperativeHandle, useState } from 'react'
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

// Each tool both opens the dialog and tells the composer which
// post-type to start in — so a click on the mic lands the user on
// the voice step directly, no extra click.
const TOOLS = [
  { id: 'image', icon: ImageIcon, postType: 'EMBEDDED', label: 'Image' },
  { id: 'video', icon: Video, postType: 'REEL', label: 'Video' },
  { id: 'voice', icon: Mic, postType: 'VOICE_POST', label: 'Voice' },
  { id: 'quote', icon: Quote, postType: 'TEXT', label: 'Quote' },
  { id: 'location', icon: MapPin, postType: 'EMBEDDED', label: 'Location' },
]

const VISIBILITY = [
  { value: 'PUBLIC', label: 'Public', icon: Globe },
  { value: 'FOLLOWERS_ONLY', label: 'Followers', icon: Users },
  { value: 'ONLY_ME', label: 'Only me', icon: Lock },
]

/**
 * Single-line composer trigger inspired by the design spec.
 *
 * Tapping anywhere — the input, an icon, or the Post button — opens
 * the full PostComposer in a dialog. Each icon remembers which
 * post-type should be selected when the dialog opens.
 *
 * Forwards an imperative `openWith(postType)` ref so other surfaces
 * (the reel-strip "Create reel" tile, story shortcuts, etc.) can
 * launch the dialog into a specific mode without duplicating wiring.
 */
export const CommunityComposer = forwardRef(function CommunityComposer(
  { onPosted },
  ref,
) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [startType, setStartType] = useState('TEXT')
  const [visibility, setVisibility] = useState('PUBLIC')

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

  const activeVisibility =
    VISIBILITY.find((v) => v.value === visibility) ?? VISIBILITY[0]
  const VisibilityIcon = activeVisibility.icon

  return (
    <>
      <section className="rounded-2xl border-[0.5px] border-border bg-paper">
        <div className="flex items-start gap-3 px-5 pt-5">
          <UserAvatar user={user} className="size-10 shrink-0" />
          <button
            type="button"
            onClick={() => trigger('TEXT')}
            className="flex flex-1 items-center py-2 text-left font-display text-[15.5px] italic leading-[1.4] tracking-[-0.005em] text-ink-3 transition-colors hover:text-ink-2"
          >
            Share a thought, citation, or finding…
          </button>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-4 pb-4">
          <div className="flex items-center gap-0.5">
            {TOOLS.map((tool) => {
              const Icon = tool.icon
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => trigger(tool.postType)}
                  title={tool.label}
                  aria-label={tool.label}
                  className="grid size-9 place-items-center rounded-full text-ink-3 transition-colors hover:bg-secondary hover:text-ink"
                >
                  <Icon className="size-[17px]" strokeWidth={1.6} />
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-full border-[0.5px] border-border px-3 py-1.5 text-[12.5px] font-medium text-ink-2 transition-colors hover:bg-secondary hover:text-ink"
                >
                  <VisibilityIcon className="size-3.5" strokeWidth={1.5} />
                  {activeVisibility.label}
                  <ChevronDown className="size-3 opacity-60" strokeWidth={1.5} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {VISIBILITY.map((option) => {
                  const ItemIcon = option.icon
                  return (
                    <DropdownMenuItem
                      key={option.value}
                      onSelect={() => setVisibility(option.value)}
                      className={cn(
                        option.value === visibility && 'font-medium text-ink',
                      )}
                    >
                      <ItemIcon className="mr-2 size-4" strokeWidth={1.5} />
                      {option.label}
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              type="button"
              onClick={() => trigger('TEXT')}
              className="rounded-full bg-ink px-5 py-1.5 text-[12.5px] font-semibold text-paper transition-colors hover:bg-ink/90"
            >
              Post
            </button>
          </div>
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
