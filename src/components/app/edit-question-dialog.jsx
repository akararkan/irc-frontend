import { useEffect, useState } from 'react'
import { Hash, Loader2, Lock, Save, Unlock } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { editQuestion } from '@/features/qna/qna.api'
import { useToast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import { extractApiMessage } from '@/lib/api-error'

const TITLE_MAX = 500
const BODY_MAX = 10000

export function EditQuestionDialog({ question, open, onOpenChange, onUpdated }) {
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [answersLocked, setAnswersLocked] = useState(false)
  const [maxAnswersText, setMaxAnswersText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open && question) {
      setTitle(question.title ?? '')
      setBody(question.body ?? '')
      setAnswersLocked(Boolean(question.answersLocked))
      setMaxAnswersText(
        question.maxAnswers != null ? String(question.maxAnswers) : '',
      )
    }
  }, [open, question])

  if (!question) return null

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting) return

    const payload = {}
    const trimmedTitle = title.trim()
    const trimmedBody = body.trim()

    if (trimmedTitle && trimmedTitle !== (question.title ?? '')) {
      payload.title = trimmedTitle
    }
    if (trimmedBody !== (question.body ?? '')) {
      payload.body = trimmedBody
    }
    if (answersLocked !== Boolean(question.answersLocked)) {
      payload.answersLocked = answersLocked
    }

    const trimmedLimit = maxAnswersText.trim()
    const parsedLimit = trimmedLimit === '' ? null : Number(trimmedLimit)
    if (trimmedLimit !== '' && (!Number.isFinite(parsedLimit) || parsedLimit < 1)) {
      toast.error('Answer limit must be a positive number.')
      return
    }
    if ((parsedLimit ?? null) !== (question.maxAnswers ?? null)) {
      payload.maxAnswers = parsedLimit
    }

    if (Object.keys(payload).length === 0) {
      onOpenChange?.(false)
      return
    }

    setSubmitting(true)
    try {
      const updated = await editQuestion(question.id, payload)
      toast.success('Question updated.')
      onUpdated?.(updated)
      onOpenChange?.(false)
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not update question.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit question</DialogTitle>
            <DialogDescription>
              Refine the title, body, or answer policy. Existing answers are
              kept.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-question-title">Title</Label>
              <Input
                id="edit-question-title"
                value={title}
                onChange={(event) =>
                  setTitle(event.target.value.slice(0, TITLE_MAX))
                }
                placeholder="What would you like to know?"
                maxLength={TITLE_MAX}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-question-body">Body</Label>
              <Textarea
                id="edit-question-body"
                value={body}
                onChange={(event) =>
                  setBody(event.target.value.slice(0, BODY_MAX))
                }
                rows={6}
                maxLength={BODY_MAX}
                className="resize-y"
                placeholder="Share the context, what you tried, and what you expect."
              />
              <p className="text-right text-[11px] font-mono tabular-nums text-muted-foreground">
                {body.length} / {BODY_MAX}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setAnswersLocked((v) => !v)}
                className={cn(
                  'flex items-start gap-3 rounded-2xl border px-3 py-3 text-left transition-colors',
                  answersLocked
                    ? 'border-foreground/30 bg-foreground/5'
                    : 'border-border bg-card hover:bg-muted',
                )}
              >
                <span
                  className={cn(
                    'grid size-9 shrink-0 place-items-center rounded-full',
                    answersLocked
                      ? 'bg-foreground text-background'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {answersLocked ? (
                    <Lock className="size-4" />
                  ) : (
                    <Unlock className="size-4" />
                  )}
                </span>
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold">
                    {answersLocked ? 'Answers are locked' : 'Answers are open'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {answersLocked
                      ? 'No new answers will be accepted.'
                      : 'People can still submit answers.'}
                  </p>
                </div>
              </button>

              <div className="flex items-start gap-3 rounded-2xl border border-border bg-card px-3 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                  <Hash className="size-4" />
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <Label
                    htmlFor="edit-question-limit"
                    className="text-sm font-semibold"
                  >
                    Answer limit
                  </Label>
                  <Input
                    id="edit-question-limit"
                    value={maxAnswersText}
                    onChange={(event) =>
                      setMaxAnswersText(event.target.value.replace(/[^\d]/g, ''))
                    }
                    inputMode="numeric"
                    placeholder="Unlimited"
                    className="h-8 px-2"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange?.(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {submitting ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
