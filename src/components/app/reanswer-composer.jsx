import { useEffect, useRef, useState } from 'react'
import { CornerDownLeft, Loader2, X } from 'lucide-react'

import { Textarea } from '@/components/ui/textarea'
import { UserAvatar } from '@/components/app/user-avatar'
import { useAuth } from '@/features/auth/auth-context'
import { createAnswer } from '@/features/qna/qna.api'
import { useToast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import { extractApiMessage } from '@/lib/api-error'

const REANSWER_MAX = 4000

/**
 * Lightweight inline composer for a reanswer (reply to a top-level answer).
 * Intentionally text-only: scholars who need attachments or sources should
 * post a top-level answer instead. The compact UX keeps the discussion
 * thread fast to skim.
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
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  if (!isAuthenticated) return null

  const trimmed = body.trim()
  const charactersLeft = REANSWER_MAX - body.length
  const placeholder = parentAuthor
    ? `Reanswer @${parentAuthor.username ?? 'scholar'}…`
    : 'Add a reanswer…'

  async function handleSubmit(event) {
    event.preventDefault()
    if (!trimmed || submitting) return
    setSubmitting(true)
    try {
      const created = await createAnswer(questionId, {
        body: trimmed,
        parentAnswerId,
      })
      onCreated?.(created)
      setBody('')
      toast.success('Reanswer posted.')
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not post reanswer.'))
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

        <div className="flex items-center justify-between gap-2">
          <span className="text-[10.5px] text-muted-foreground">
            ⌘/Ctrl + Enter to post
          </span>
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
              disabled={!trimmed || submitting}
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
