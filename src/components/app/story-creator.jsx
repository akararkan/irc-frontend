import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ImagePlus, Loader2, Lock, Users, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { UserAvatar } from '@/components/app/user-avatar'
import { useAuth } from '@/features/auth/auth-context'
import {
  createMediaStory,
  createTextStory,
} from '@/features/stories/stories.api'
import { cn } from '@/lib/utils'
import { extractApiMessage } from '@/lib/api-error'
import { useToast } from '@/components/ui/toaster'
import { getFullName, getHandle } from '@/lib/format'

const BACKGROUNDS = [
  { label: 'Teal',    value: 'linear-gradient(160deg, #0A3D3E 0%, #1B7A7F 50%, #0F6E56 100%)' },
  { label: 'Gold',    value: 'linear-gradient(160deg, #4A2106 0%, #9A6B14 50%, #C9A227 100%)' },
  { label: 'Violet',  value: 'linear-gradient(160deg, #1E1648 0%, #514999 50%, #7B68EE 100%)' },
  { label: 'Rose',    value: 'linear-gradient(160deg, #5A0A0A 0%, #9A1A4A 50%, #DB2777 100%)' },
  { label: 'Slate',   value: 'linear-gradient(160deg, #0F172A 0%, #1E293B 50%, #334155 100%)' },
  { label: 'Forest',  value: 'linear-gradient(160deg, #052E16 0%, #166534 50%, #16A34A 100%)' },
  { label: 'Ink',     value: 'linear-gradient(160deg, #0A0A0A 0%, #1A1A1A 100%)' },
  { label: 'Flame',   value: 'linear-gradient(160deg, #431407 0%, #9A3412 50%, #EA580C 100%)' },
]

const VISIBILITIES = [
  { value: 'PUBLIC',         icon: null,  label: 'Everyone' },
  { value: 'FOLLOWERS_ONLY', icon: Users, label: 'Followers' },
  { value: 'CLOSE_FRIENDS',  icon: null,  label: 'Close friends' },
  { value: 'ONLY_ME',        icon: Lock,  label: 'Only me' },
]

export function StoryCreator({ open, onOpenChange, onCreated }) {
  const { user } = useAuth()
  const toast = useToast()
  const fileRef = useRef(null)

  const [tab,        setTab]        = useState('text')
  const [text,       setText]       = useState('')
  const [bgIndex,    setBgIndex]    = useState(0)
  const [visibility, setVisibility] = useState('PUBLIC')
  const [mediaFile,  setMediaFile]  = useState(null)
  const [preview,    setPreview]    = useState(null)
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
        if (!text.trim()) { toast.error('Add some text first.'); return }
        story = await createTextStory({
          textContent: text.trim(),
          visibility,
          backgroundType: 'gradient',
          backgroundValue: BACKGROUNDS[bgIndex].value,
        })
      } else {
        if (!mediaFile) { toast.error('Pick a photo or video.'); return }
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
      <DialogContent className="max-w-[420px] overflow-hidden p-0 gap-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b-[0.5px] border-border px-5 py-4">
          <div>
            <DialogTitle className="text-[15px] font-semibold text-ink">Share a story</DialogTitle>
            <p className="mt-0.5 text-[11px] text-ink-3">Disappears in 24 hours</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="grid size-8 place-items-center rounded-full text-ink-3 transition-colors hover:bg-secondary hover:text-ink"
          >
            <X className="size-4" strokeWidth={1.8} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b-[0.5px] border-border">
          {[
            { id: 'text',  label: 'Text' },
            { id: 'media', label: 'Photo / Video' },
          ].map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                'relative flex-1 py-3 text-[13px] font-medium transition-colors',
                tab === id ? 'text-ink' : 'text-ink-3 hover:text-ink',
              )}
            >
              {label}
              {tab === id ? (
                <motion.div
                  layoutId="story-tab-indicator"
                  className="absolute bottom-0 inset-x-6 h-[2px] rounded-full bg-ink"
                />
              ) : null}
            </button>
          ))}
        </div>

        <div className="space-y-5 p-5">
          <AnimatePresence mode="wait" initial={false}>
            {tab === 'text' ? (
              <motion.div
                key="text-tab"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="space-y-4"
              >
                {/* Phone-like preview */}
                <div
                  className="relative mx-auto h-64 w-44 overflow-hidden rounded-3xl"
                  style={{
                    background: bg,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.28), 0 2px 8px rgba(0,0,0,0.16)',
                  }}
                >
                  {/* Status bar dots */}
                  <div className="flex items-center justify-between px-4 pt-3">
                    <div className="h-[3px] w-14 rounded-full bg-white/30" />
                    <div className="h-[3px] w-8 rounded-full bg-white/30" />
                  </div>

                  {/* Author chip */}
                  <div className="mt-2 flex items-center gap-1.5 px-3">
                    <div className="size-5 overflow-hidden rounded-full ring-1 ring-white/40">
                      <UserAvatar user={user} className="size-full text-[8px]" />
                    </div>
                    <span className="text-[9px] font-semibold text-white/80">{authorName}</span>
                  </div>

                  {/* Story text */}
                  <div className="flex flex-1 items-center justify-center px-4 py-6">
                    <p
                      className={cn(
                        'text-center font-display text-[16px] font-semibold leading-snug text-white',
                        !text && 'opacity-30 italic text-[13px]',
                      )}
                      style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}
                    >
                      {text || 'Your text…'}
                    </p>
                  </div>
                </div>

                {/* Background picker */}
                <div>
                  <p className="mb-2.5 text-[10.5px] font-semibold uppercase tracking-widest text-ink-3">
                    Background
                  </p>
                  <div className="flex flex-wrap gap-2.5">
                    {BACKGROUNDS.map((b, i) => (
                      <motion.button
                        key={i}
                        type="button"
                        onClick={() => setBgIndex(i)}
                        title={b.label}
                        whileHover={{ scale: 1.12 }}
                        whileTap={{ scale: 0.92 }}
                        className={cn(
                          'size-8 rounded-full ring-offset-[var(--card)] transition-all duration-150',
                          bgIndex === i ? 'ring-2 ring-offset-2 ring-ink scale-110' : 'opacity-75 hover:opacity-100',
                        )}
                        style={{ background: b.value }}
                      />
                    ))}
                  </div>
                </div>

                {/* Text input */}
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={300}
                  rows={3}
                  placeholder="Write something beautiful…"
                  className="resize-none rounded-xl text-sm"
                />
              </motion.div>
            ) : (
              <motion.div
                key="media-tab"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="space-y-4"
              >
                {/* Drop zone */}
                <motion.div
                  onClick={() => fileRef.current?.click()}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className={cn(
                    'relative flex h-56 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition-colors',
                    preview ? 'border-transparent' : 'border-border hover:border-brand/50 bg-muted/30 hover:bg-brand-soft/15',
                  )}
                >
                  {preview ? (
                    <>
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
                          alt="Preview"
                          className="h-full w-full object-cover"
                        />
                      )}
                      {/* Replace overlay */}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity hover:opacity-100">
                        <p className="rounded-full bg-white/20 px-4 py-2 text-[12px] font-semibold text-white backdrop-blur">
                          Tap to replace
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-ink-3">
                      <div className="grid size-14 place-items-center rounded-2xl bg-muted">
                        <ImagePlus className="size-7" strokeWidth={1.3} />
                      </div>
                      <div className="text-center">
                        <p className="text-[13px] font-medium text-ink-2">Tap to pick a photo or video</p>
                        <p className="mt-0.5 text-[11px] text-ink-4">Videos are automatically trimmed to 30s</p>
                      </div>
                    </div>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,video/*"
                    className="sr-only"
                    onChange={handleFileChange}
                  />
                </motion.div>

                {/* Optional caption */}
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={200}
                  rows={2}
                  placeholder="Add a caption… (optional)"
                  className="resize-none rounded-xl text-sm"
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Audience */}
          <div>
            <p className="mb-2.5 text-[10.5px] font-semibold uppercase tracking-widest text-ink-3">Audience</p>
            <div className="flex flex-wrap gap-1.5">
              {VISIBILITIES.map(({ value, icon: Icon, label }) => (
                <motion.button
                  key={value}
                  type="button"
                  onClick={() => setVisibility(value)}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-all duration-150',
                    visibility === value
                      ? 'bg-ink text-paper shadow-md'
                      : 'border-[0.5px] border-border text-ink-3 hover:border-ink/30 hover:text-ink',
                  )}
                >
                  {Icon ? <Icon className="size-3" strokeWidth={1.8} /> : null}
                  {label}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <motion.button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink py-3 text-[14px] font-semibold text-paper transition-opacity disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" strokeWidth={2} />
                Sharing…
              </>
            ) : (
              'Share to story'
            )}
          </motion.button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
