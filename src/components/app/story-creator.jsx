import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ImagePlus, Loader2, Lock, Send, Users, X } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { UserAvatar } from '@/components/app/user-avatar'
import { useAuth } from '@/features/auth/auth-context'
import { createMediaStory, createTextStory } from '@/features/stories/stories.api'
import { cn } from '@/lib/utils'
import { extractApiMessage } from '@/lib/api-error'
import { useToast } from '@/components/ui/toaster'
import { getFullName, getHandle } from '@/lib/format'

const BACKGROUNDS = [
  { label: 'Ocean', value: 'linear-gradient(165deg, #1E3A5F 0%, #2563EB 100%)' },
  { label: 'Cyan', value: 'linear-gradient(165deg, #0E5566 0%, #0891B2 100%)' },
  { label: 'Emerald', value: 'linear-gradient(165deg, #065F46 0%, #059669 100%)' },
  { label: 'Amber', value: 'linear-gradient(165deg, #7C2D12 0%, #B45309 100%)' },
  { label: 'Violet', value: 'linear-gradient(165deg, #4C1D95 0%, #7C3AED 100%)' },
  { label: 'Slate', value: 'linear-gradient(165deg, #1E293B 0%, #475569 100%)' },
  { label: 'Rose', value: 'linear-gradient(165deg, #881337 0%, #E11D48 100%)' },
  { label: 'Ink', value: 'linear-gradient(165deg, #0A0A0A 0%, #262626 100%)' },
]

const VISIBILITIES = [
  { value: 'PUBLIC', icon: null, label: 'Everyone' },
  { value: 'FOLLOWERS_ONLY', icon: Users, label: 'Followers' },
  { value: 'CLOSE_FRIENDS', icon: null, label: 'Close friends' },
  { value: 'ONLY_ME', icon: Lock, label: 'Only me' },
]

export function StoryCreator({ open, onOpenChange, onCreated }) {
  const { user } = useAuth()
  const toast = useToast()
  const fileRef = useRef(null)

  const [tab, setTab] = useState('text')
  const [text, setText] = useState('')
  const [bgIndex, setBgIndex] = useState(0)
  const [visibility, setVisibility] = useState('PUBLIC')
  const [mediaFile, setMediaFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  function reset() {
    setText('')
    setBgIndex(0)
    setVisibility('PUBLIC')
    setMediaFile(null)
    setPreview(null)
    setTab('text')
  }

  function handleClose() {
    reset()
    onOpenChange(false)
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setMediaFile(file)
    const url = URL.createObjectURL(file)
    setPreview({ url, type: file.type.startsWith('video/') ? 'video' : 'image' })
  }

  async function handleSubmit() {
    if (submitting) return
    setSubmitting(true)
    try {
      let story
      if (tab === 'text') {
        if (!text.trim()) {
          toast.error('Add some text first.')
          return
        }
        story = await createTextStory({
          textContent: text.trim(),
          visibility,
          backgroundType: 'gradient',
          backgroundValue: BACKGROUNDS[bgIndex].value,
        })
      } else {
        if (!mediaFile) {
          toast.error('Pick a photo or video.')
          return
        }
        story = await createMediaStory({
          data: {
            storyType: preview?.type === 'video' ? 'VIDEO' : 'IMAGE',
            visibility,
            textContent: text.trim() || undefined,
          },
          media: mediaFile,
        })
      }
      toast.success('Story shared.')
      onCreated?.(story)
      handleClose()
    } catch (err) {
      toast.error(extractApiMessage(err, 'Could not share story.'))
    } finally {
      setSubmitting(false)
    }
  }

  const authorName = getFullName(user) || getHandle(user) || 'You'
  const bg = BACKGROUNDS[bgIndex].value

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="max-w-[440px] gap-0 overflow-hidden rounded-lg p-0"
      >
        {/* ── Header ──────────────────────────────────────── */}
        <DialogHeader className="flex flex-row items-center justify-between border-b border-line px-5 py-3.5">
          <div className="space-y-0.5 text-left">
            <DialogTitle className="font-semibold text-[15px] font-semibold tracking-[-0.01em]">
              Share a story
            </DialogTitle>
            <p className="text-[11.5px] text-fg-muted">Disappears in 24 hours</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="grid size-8 place-items-center rounded-full text-fg-muted transition-colors hover:bg-bg-soft hover:text-ink"
            aria-label="Close"
          >
            <X className="size-4" strokeWidth={1.8} />
          </button>
        </DialogHeader>

        <div className="flex gap-4 p-5">
          {/* ── Phone preview ─────────────────────────────── */}
          <div className="shrink-0">
            <div
              className="relative flex h-[230px] w-[130px] flex-col overflow-hidden rounded-[20px] p-3"
              style={{
                background: tab === 'text' ? bg : '#1E293B',
                boxShadow: '0 8px 28px rgba(0,0,0,0.22)',
              }}
            >
              {/* Progress dots */}
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className={cn(
                      'h-[2.5px] flex-1 rounded-full',
                      i === 0 ? 'bg-white' : 'bg-white/35',
                    )}
                  />
                ))}
              </div>
              {/* Author chip */}
              <div className="mt-2.5 flex items-center gap-1.5">
                <UserAvatar
                  user={user}
                  className="size-[18px] rounded-full text-[8px] ring-1 ring-white/40"
                />
                <span className="text-[8.5px] font-medium text-white/85">
                  {authorName}
                </span>
              </div>
              {/* Body */}
              {tab === 'text' ? (
                <div className="flex flex-1 items-center justify-center px-1 py-4">
                  <p
                    className={cn(
                      'text-center font-semibold text-[15px] font-semibold leading-snug text-white',
                      !text && 'text-[12px] italic opacity-40',
                    )}
                    style={{ textShadow: '0 2px 8px rgba(0,0,0,0.45)' }}
                  >
                    {text || 'Your text…'}
                  </p>
                </div>
              ) : preview ? (
                <div className="absolute inset-0 -z-0">
                  {preview.type === 'video' ? (
                    <video
                      src={preview.url}
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                    />
                  ) : (
                    <img
                      src={preview.url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center">
                  <ImagePlus className="size-7 text-white/30" strokeWidth={1.4} />
                </div>
              )}
            </div>
          </div>

          {/* ── Editor ────────────────────────────────────── */}
          <div className="flex min-w-0 flex-1 flex-col">
            {/* Tabs */}
            <div className="flex gap-5 border-b border-line">
              {[
                { id: 'text', label: 'Text' },
                { id: 'media', label: 'Photo / Video' },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={cn(
                    'relative pb-2 text-[12.5px] font-medium transition-colors',
                    tab === id ? 'text-accent-indigo' : 'text-fg-muted hover:text-ink',
                  )}
                >
                  {label}
                  {tab === id ? (
                    <motion.span
                      layoutId="story-tab"
                      className="absolute inset-x-0 -bottom-px h-[2px] bg-fg"
                    />
                  ) : null}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait" initial={false}>
              {tab === 'text' ? (
                <motion.div
                  key="text"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16 }}
                  className="mt-3.5 space-y-3.5"
                >
                  <div>
                    <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-fg-muted">
                      Background
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {BACKGROUNDS.map((b, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setBgIndex(i)}
                          title={b.label}
                          className={cn(
                            'size-7 rounded-full transition-transform',
                            bgIndex === i
                              ? 'ring-2 ring-brand ring-offset-2 ring-offset-paper'
                              : 'opacity-75 hover:opacity-100',
                          )}
                          style={{ background: b.value }}
                        />
                      ))}
                    </div>
                  </div>
                  <Textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    maxLength={300}
                    rows={3}
                    placeholder="Write something beautiful…"
                    className="resize-none rounded-md text-[13.5px]"
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="media"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16 }}
                  className="mt-3.5 space-y-3.5"
                >
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex w-full flex-col items-center gap-2.5 rounded-md border-[1.5px] border-dashed border-line bg-bg-soft py-7 text-center transition-colors hover:border-fg/45 hover:bg-bg-soft"
                  >
                    <span className="grid size-12 place-items-center rounded-full bg-bg-muted text-fg-muted">
                      <ImagePlus className="size-5" strokeWidth={1.6} />
                    </span>
                    <span className="text-[13px] font-medium text-ink">
                      {preview ? 'Replace photo or video' : 'Pick a photo or video'}
                    </span>
                    <span className="text-[11px] text-fg-muted">
                      Videos are trimmed to 30 seconds
                    </span>
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,video/*"
                    className="sr-only"
                    onChange={handleFileChange}
                  />
                  <Textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    maxLength={200}
                    rows={2}
                    placeholder="Add a caption… (optional)"
                    className="resize-none rounded-md text-[13.5px]"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Audience */}
            <div className="mt-3.5">
              <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-fg-muted">
                Audience
              </p>
              <div className="flex flex-wrap gap-1.5">
                {VISIBILITIES.map(({ value, icon: Icon, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setVisibility(value)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-medium transition-colors',
                      visibility === value
                        ? 'bg-fg text-background'
                        : 'border border-line text-fg-muted hover:border-fg/40 hover:text-ink',
                    )}
                  >
                    {Icon ? <Icon className="size-3" strokeWidth={1.8} /> : null}
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Submit ──────────────────────────────────────── */}
        <div className="border-t border-line px-5 py-3.5">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand text-[13.5px] font-medium text-accent-indigo-foreground transition-colors hover:bg-fg-soft disabled:opacity-55"
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" strokeWidth={2} />
                Sharing…
              </>
            ) : (
              <>
                <Send className="size-4" strokeWidth={2} />
                Share to story
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
