import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  Hash,
  Loader2,
  Lock,
  MessageCircleQuestion,
  Plus,
  RefreshCw,
  Send,
  Unlock,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/app/empty-state'
import { PageHeader } from '@/components/app/page-header'
import { QuestionFeedCard } from '@/components/app/question-feed-card'
import {
  createQuestion,
  getMyQuestions,
  getQuestions,
  getQuestionsFollowing,
} from '@/features/qna/qna.api'
import { useAuth } from '@/features/auth/auth-context'
import { useToast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import { extractApiMessage } from '@/lib/api-error'
import { canUseQna } from '@/lib/roles'

const TITLE_MAX = 500
const BODY_MAX = 10000

const TABS = [
  { value: 'PUBLIC', label: 'Everyone' },
  { value: 'FOLLOWING', label: 'Following', authOnly: true },
  { value: 'MINE', label: 'My questions', authOnly: true },
]

function FeedSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((key) => (
        <Card key={key} className="border">
          <CardContent className="flex gap-4 p-5">
            <Skeleton className="hidden size-16 rounded-xl sm:block" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="size-8 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-2.5 w-20" />
                </div>
              </div>
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function AskQuestionDialog({ onCreated }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [answersLocked, setAnswersLocked] = useState(false)
  const [maxAnswersText, setMaxAnswersText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function reset() {
    setTitle('')
    setBody('')
    setAnswersLocked(false)
    setMaxAnswersText('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting) return

    const trimmedTitle = title.trim()
    const trimmedBody = body.trim()
    if (!trimmedTitle || !trimmedBody) return

    const trimmedLimit = maxAnswersText.trim()
    let parsedLimit = null
    if (trimmedLimit) {
      parsedLimit = Number(trimmedLimit)
      if (!Number.isFinite(parsedLimit) || parsedLimit < 1) {
        toast.error('Answer limit must be a positive number.')
        return
      }
    }

    setSubmitting(true)
    try {
      const payload = {
        title: trimmedTitle,
        body: trimmedBody,
        answersLocked,
      }
      if (parsedLimit != null) payload.maxAnswers = parsedLimit
      const created = await createQuestion(payload)
      toast.success('Question posted.')
      onCreated?.(created)
      reset()
      setOpen(false)
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not post question.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="rounded-full">
          <Plus className="size-4" />
          Ask a question
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Ask a question</DialogTitle>
            <DialogDescription>
              Be specific. Add the context, what you tried, and what you expect
              — answers come faster.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="ask-title">Title *</Label>
              <Input
                id="ask-title"
                value={title}
                onChange={(event) =>
                  setTitle(event.target.value.slice(0, TITLE_MAX))
                }
                placeholder="What would you like to know?"
                maxLength={TITLE_MAX}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ask-body">Details *</Label>
              <Textarea
                id="ask-body"
                value={body}
                onChange={(event) =>
                  setBody(event.target.value.slice(0, BODY_MAX))
                }
                placeholder="Share the context, what you tried, and what you expect."
                rows={6}
                maxLength={BODY_MAX}
                required
                className="resize-y"
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
                <div>
                  <p className="text-sm font-semibold">
                    {answersLocked ? 'Lock answers' : 'Answers open'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {answersLocked
                      ? 'Posted but no replies allowed.'
                      : 'Anyone can answer.'}
                  </p>
                </div>
              </button>

              <div className="flex items-start gap-3 rounded-2xl border border-border bg-card px-3 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                  <Hash className="size-4" />
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <Label htmlFor="ask-limit" className="text-sm font-semibold">
                    Answer limit
                  </Label>
                  <Input
                    id="ask-limit"
                    value={maxAnswersText}
                    onChange={(event) =>
                      setMaxAnswersText(
                        event.target.value.replace(/[^\d]/g, ''),
                      )
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
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !title.trim() || !body.trim()}
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              {submitting ? 'Posting…' : 'Post question'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function QuestionsPage() {
  const { user, isAuthenticated } = useAuth()
  const toast = useToast()

  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState(isAuthenticated ? 'FOLLOWING' : 'PUBLIC')

  const allowedToAsk = canUseQna(user)
  const visibleTabs = TABS.filter((item) => !item.authOnly || isAuthenticated)

  const load = useCallback(
    async (which = tab, { silent = false } = {}) => {
      if (!silent) setLoading(true)
      else setRefreshing(true)
      try {
        const fetcher =
          which === 'FOLLOWING' && isAuthenticated
            ? getQuestionsFollowing
            : which === 'MINE' && isAuthenticated
              ? getMyQuestions
              : getQuestions
        const data = await fetcher({ page: 0, size: 20 })
        setQuestions(data?.content ?? [])
      } catch (error) {
        toast.error(extractApiMessage(error, 'Could not load questions.'))
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [isAuthenticated, tab, toast],
  )

  useEffect(() => {
    load(tab)
  }, [tab, isAuthenticated, load])

  const isEmpty = !loading && questions.length === 0
  const emptyCopy =
    tab === 'MINE'
      ? "You haven't asked any questions yet."
      : tab === 'FOLLOWING'
        ? 'Follow people to see their questions here, or switch to Everyone.'
        : 'Be the first to ask something. Questions surface answers from across the community.'

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Community Q&A"
        title="Questions"
        description="Ask questions, share answers, and learn together. The Q&A area is open for scholars to participate; everyone can read."
        action={
          allowedToAsk ? (
            <AskQuestionDialog
              onCreated={(q) => setQuestions((current) => [q, ...current])}
            />
          ) : null
        }
      />

      {isAuthenticated && !allowedToAsk ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          You can browse and read questions. Asking, answering, and giving
          feedback is reserved for <span className="font-medium text-foreground">scholars</span>.
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-full border border-border bg-muted/40 p-1">
          {visibleTabs.map((option) => {
            const active = tab === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setTab(option.value)}
                className={cn(
                  'relative rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                  active
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="questionsTab"
                    className="absolute inset-0 rounded-full bg-background shadow-sm ring-1 ring-border"
                    transition={{ type: 'spring', stiffness: 360, damping: 30 }}
                  />
                ) : null}
                <span className="relative">{option.label}</span>
              </button>
            )
          })}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5 rounded-full text-muted-foreground"
          onClick={() => load(tab, { silent: true })}
          disabled={refreshing || loading}
        >
          <RefreshCw
            className={cn(
              'size-3.5',
              (refreshing || loading) && 'animate-spin',
            )}
          />
          Refresh
        </Button>
      </div>

      {loading ? (
        <FeedSkeleton />
      ) : isEmpty ? (
        <EmptyState
          icon={MessageCircleQuestion}
          title="No questions yet"
          description={emptyCopy}
        />
      ) : (
        <div className="space-y-4">
          <AnimatePresence initial={false}>
            {questions.map((question, index) => (
              <motion.div
                key={question.id}
                layout="position"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{
                  type: 'spring',
                  stiffness: 320,
                  damping: 30,
                  delay: Math.min(index, 5) * 0.04,
                }}
              >
                <QuestionFeedCard question={question} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
