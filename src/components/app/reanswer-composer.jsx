import { useEffect, useRef, useState } from 'react'
import {
  CornerDownLeft,
  Image as ImageIcon,
  Loader2,
  X,
} from 'lucide-react'

import { Textarea } from '@/components/ui/textarea'
import { UserAvatar } from '@/components/app/user-avatar'
import { useAuth } from '@/features/auth/auth-context'
import {
  createAnswer,
  createReanswerWithMedia,
} from '@/features/qna/qna.api'
import { useToast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import { friendlyApiMessage } from '@/lib/api-error'

const REANSWER_MAX = 4000

/**
 * Inline composer for a reanswer (reply to a top-level answer).
 *
 * Mirrors the post-comment composer 1:1: textarea + a single
 * image/video pick. Heavier extras (sources, document attachments,
 * accept-as-best, feedback) live on the top-level AnswerComposer only.
 *
 * If the user attaches a file, the multipart `/reanswers/upload`
 * endpoint is used; otherwise the JSON `/answers` endpoint is.
 */
export function ReanswerComposer({
  questionId,
  parentAnswerId,
  parentAuthor,
  onCreated,
  onCancel,
}) {
  const { user, isAuthenticated } = useAuth()
  const toast = useToast()
  const textareaRef = useRef(null)

  // Prefill the parent author's @username so the backend's MentionService
  // notifies them — same affordance as a comment reply box. Skipped when
  // the scholar is reanswering their own answer (don't ping yourself).
  const parentUsername = parentAuthor?.username ?? null
  const isSelfReply =
    Boolean(parentUsername) &&
    Boolean(user?.username) &&
    user.username.toLowerCase() === parentUsername.toLowerCase()
  const initialBody =
    parentUsername && !isSelfReply ? `@${parentUsername} ` : ''

  const [body, setBody] = useState(initialBody)
  const [media, setMedia] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.focus()
    if (initialBody) {
      const end = initialBody.length
      try {
        el.setSelectionRange(end, end)
      } catch {
        // Non-fatal — some inputs disallow setSelectionRange.
      }
    }
    // initialBody is stable for the composer's lifetime; run-once focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!isAuthenticated) return null

  const trimmed = body.trim()
  const charactersLeft = REANSWER_MAX - body.length
  const canSubmit = (trimmed.length > 0 || Boolean(media)) && !submitting
  const placeholder = parentAuthor
    ? `Reanswer ${parentAuthor.username ?? 'scholar'}…`
    : 'Add a reanswer…'

  async function handleSubmit(event) {
    event.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const data = { body: trimmed, parentAnswerId }
      const created = media
        ? await createReanswerWithMedia(questionId, parentAnswerId, {
            data,
            media,
          })
        : await createAnswer(questionId, data)
      onCreated?.(created)
      setBody('')
      setMedia(null)
      toast.success('Reanswer posted.')
    } catch (error) {
      toast.error(friendlyApiMessage(error, 'Could not post reanswer.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex gap-2.5 rounded-xl border border-border bg-background/60 px-3 py-2.5"
    >
      <UserAvatar user={user} className="size-7 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={body}
            onChange={(event) => setBody(event.target.value.slice(0, REANSWER_MAX))}
            placeholder={placeholder}
            rows={2}
            className="min-h-[56px] resize-none rounded-lg border-0 bg-muted/40 px-3 py-2 text-[13.5px] leading-relaxed shadow-none focus-visible:ring-1"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                handleSubmit(event)
              }
            }}
          />
          {body.length > REANSWER_MAX - 200 ? (
            <span
              className={cn(
                'absolute bottom-1.5 right-2 font-mono text-[10.5px] tabular-nums',
                charactersLeft < 0 ? 'text-destructive' : 'text-muted-foreground',
              )}
            >
              {charactersLeft}
            </span>
          ) : null}
        </div>

        {media ? (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-xs">
            <ImageIcon className="size-3.5 text-muted-foreground" />
            <span className="truncate">{media.name}</span>
            <button
              type="button"
              onClick={() => setMedia(null)}
              className="ml-auto text-muted-foreground hover:text-foreground"
              aria-label="Remove attachment"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <label
              className={cn(
                'inline-flex cursor-pointer items-center gap-1 rounded-full px-2 py-1 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                media && 'bg-muted text-foreground',
              )}
              title="Attach image or video"
            >
              <ImageIcon className="size-3.5" />
              <span>Photo / Video</span>
              <input
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={(event) => {
                  const picked = event.target.files?.[0]
                  if (picked) setMedia(picked)
                  event.target.value = ''
                }}
              />
            </label>
            <span className="text-[10.5px] text-muted-foreground">
              ⌘/Ctrl + Enter to post
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {onCancel ? (
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-3" />
                Cancel
              </button>
            ) : null}
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex h-7 items-center gap-1 rounded-full bg-foreground px-3 text-[11.5px] font-semibold text-background transition-colors hover:bg-foreground/85 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <CornerDownLeft className="size-3" />
              )}
              {submitting ? 'Posting…' : 'Reanswer'}
            </button>
          </div>
        </div>
      </div>
    </form>
  )
}
