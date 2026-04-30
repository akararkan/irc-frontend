import { useEffect, useState } from 'react'
import { Loader2, Save } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { editAnswer } from '@/features/qna/qna.api'
import { useToast } from '@/components/ui/toaster'
import { extractApiMessage } from '@/lib/api-error'

const ANSWER_MAX = 5000

export function EditAnswerDialog({
  questionId,
  answer,
  open,
  onOpenChange,
  onUpdated,
}) {
  const toast = useToast()
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open && answer) setBody(answer.body ?? '')
  }, [open, answer])

  if (!answer) return null

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting) return

    const trimmed = body.trim()
    if (!trimmed) {
      toast.error('Answer body cannot be empty.')
      return
    }
    if (trimmed === (answer.body ?? '')) {
      onOpenChange?.(false)
      return
    }

    setSubmitting(true)
    try {
      const updated = await editAnswer(questionId, answer.id, { body: trimmed })
      toast.success('Answer updated.')
      onUpdated?.(updated)
      onOpenChange?.(false)
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not update answer.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit answer</DialogTitle>
            <DialogDescription>
              Refine the body of your answer. Attached media, voice, and links
              can&apos;t be changed after posting.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="edit-answer-body">Answer</Label>
            <Textarea
              id="edit-answer-body"
              value={body}
              onChange={(event) => setBody(event.target.value.slice(0, ANSWER_MAX))}
              rows={8}
              maxLength={ANSWER_MAX}
              className="resize-y"
              placeholder="Share what you know, grounded in evidence and respect."
              autoFocus
            />
            <p className="text-right text-[11px] font-mono tabular-nums text-muted-foreground">
              {body.length} / {ANSWER_MAX}
            </p>
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
