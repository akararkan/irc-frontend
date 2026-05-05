import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  ChevronDown,
  Hash,
  Loader2,
  Lock,
  MessageCircleQuestion,
  Plus,
  RefreshCw,
  Send,
  SlidersHorizontal,
  Tags,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/app/empty-state'
import { MentionTextarea } from '@/components/app/mention-textarea'
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
import { formatNumber } from '@/lib/format'

const TITLE_MAX = 500
const BODY_MAX = 10000

const TABS = [
  { value: 'PUBLIC',    label: 'Everyone' },
  { value: 'FOLLOWING', label: 'Following',     authOnly: true },
  { value: 'MINE',      label: 'My questions',  authOnly: true },
]

const SORTS = [
  { value: 'hottest', label: 'Hottest' },
  { value: 'newest',  label: 'Newest' },
  { value: 'votes',   label: 'Most voted' },
  { value: 'unanswered', label: 'Unanswered first' },
]

function FeedSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((key) => (
        <Card key={key} className="rounded-2xl border border-border bg-paper">
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

function AskQuestionDialog({ onCreated, trigger }) {
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
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="flex max-h-[90vh] max-w-xl flex-col gap-0 overflow-hidden rounded-2xl border border-border bg-paper p-0">
        <DialogHeader className="shrink-0 border-b border-border px-6 pb-3 pt-5 text-left">
          <div className="inline-flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.18em] text-brand">
            <span
              aria-hidden
              className="size-[5px] rounded-full"
              style={{
                background: 'var(--gold)',
                boxShadow:
                  '0 0 0 3px color-mix(in oklch, var(--gold) 25%, transparent)',
              }}
            />
            New question
          </div>
          <DialogTitle className="mt-1.5 font-display text-[20px] font-semibold leading-[1.15] tracking-[-0.018em] text-ink">
            Ask a question
          </DialogTitle>
          <DialogDescription className="text-[13px] text-ink-3">
            Be specific. Add the context, what you tried, and what you expect — answers come faster.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="ask-title" className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-3">
                Title
              </Label>
              <Input
                id="ask-title"
                value={title}
                onChange={(event) => setTitle(event.target.value.slice(0, TITLE_MAX))}
                placeholder="What would you like to know?"
                maxLength={TITLE_MAX}
                required
                className="h-10 rounded-lg border-border bg-paper text-[14px] text-ink placeholder:text-ink-4 focus-visible:border-brand/50 focus-visible:ring-[3px] focus-visible:ring-brand/15"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ask-body" className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-3">
                Details
              </Label>
              <MentionTextarea
                id="ask-body"
                value={body}
                onChange={(next) => setBody(next.slice(0, BODY_MAX))}
                placeholder="Share the context, what you tried, and what you expect."
                rows={6}
                maxLength={BODY_MAX}
                required
                allowFollowersToken
                className="resize-y rounded-lg border-border bg-paper text-[14px] leading-[1.55] text-ink placeholder:text-ink-4 focus-visible:border-brand/50 focus-visible:ring-[3px] focus-visible:ring-brand/15"
              />
              <p className="text-right font-mono text-[11px] tabular-nums text-ink-4">
                {body.length} / {BODY_MAX}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setAnswersLocked((v) => !v)}
                className={cn(
                  'flex items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors',
                  answersLocked
                    ? 'border-brand/35 bg-brand-soft/40'
                    : 'border-border bg-paper hover:bg-muted',
                )}
              >
                <span
                  className={cn(
                    'grid size-9 shrink-0 place-items-center rounded-full',
                    answersLocked
                      ? 'bg-gradient-to-br from-brand to-brand/85 text-brand-foreground'
                      : 'bg-muted text-ink-3',
                  )}
                >
                  {answersLocked ? <Lock className="size-4" /> : <Unlock className="size-4" />}
                </span>
                <div>
                  <p className="font-display text-[14px] font-semibold tracking-[-0.005em] text-ink">
                    {answersLocked ? 'Lock answers' : 'Answers open'}
                  </p>
                  <p className="text-[11.5px] text-ink-3">
                    {answersLocked
                      ? 'Posted but no replies allowed.'
                      : 'Anyone qualified can answer.'}
                  </p>
                </div>
              </button>

              <div className="flex items-start gap-3 rounded-xl border border-border bg-paper px-3 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-ink-3">
                  <Hash className="size-4" />
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <Label htmlFor="ask-limit" className="font-display text-[14px] font-semibold tracking-[-0.005em] text-ink">
                    Answer limit
                  </Label>
                  <Input
                    id="ask-limit"
                    value={maxAnswersText}
                    onChange={(event) =>
                      setMaxAnswersText(event.target.value.replace(/[^\d]/g, ''))
                    }
                    inputMode="numeric"
                    placeholder="Unlimited"
                    className="h-8 rounded-md border-border bg-paper px-2 text-[13px] placeholder:text-ink-4"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t border-border bg-paper px-6 py-3">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="rounded-lg">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !title.trim() || !body.trim()}
              className={cn(
                'gap-1.5 rounded-lg bg-gradient-to-br from-brand to-brand/85 px-4 text-brand-foreground shadow-soft',
                'transition-transform hover:-translate-y-px hover:from-brand hover:to-brand/90',
                'disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none',
              )}
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
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
  const [page, setPage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState(isAuthenticated ? 'FOLLOWING' : 'PUBLIC')
  const [sortKey, setSortKey] = useState('hottest')

  const allowedToAsk = canUseQna(user)
  const visibleTabs = TABS.filter((item) => !item.authOnly || isAuthenticated)
  const sort = useMemo(
    () => SORTS.find((s) => s.value === sortKey) ?? SORTS[0],
    [sortKey],
  )

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
        setPage(data)
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

  // Editorial stats
  const totalQuestions = page?.totalElements ?? questions.length
  const answeredCount = questions.filter(
    (q) => q.status === 'ANSWERED' || q.hasAcceptedAnswer,
  ).length
  const answeredPct =
    questions.length > 0
      ? Math.round((answeredCount / questions.length) * 100)
      : 0
  const sealedAnswers = questions.filter((q) => q.hasAcceptedAnswer).length

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Questions & answers"
        title="Ask a question. Wait for the right answer."
        description="A focused Q&A space where every answer is rated by the community and reviewed by qualified scholars before earning a gilt seal."
        stats={[
          { value: formatNumber(totalQuestions), label: 'Questions' },
          { value: `${answeredPct}%`,           label: 'Answered' },
          { value: formatNumber(sealedAnswers), label: 'Sealed answers', tone: 'gold' },
        ]}
      />

      {isAuthenticated && !allowedToAsk ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/40 px-4 py-3 text-[13px] text-ink-3">
          You can browse and read questions. Asking, answering, and giving
          feedback is reserved for{' '}
          <span className="font-semibold text-ink">scholars</span>.
        </div>
      ) : null}

      {/* Primary action row — gradient Ask + outlined Browse by tag */}
      <div className="flex flex-wrap items-center gap-2.5">
        {allowedToAsk ? (
          <AskQuestionDialog
            onCreated={(q) => setQuestions((current) => [q, ...current])}
            trigger={
              <Button
                size="lg"
                className={cn(
                  'h-11 gap-2 rounded-xl px-5 text-[13.5px] font-semibold',
                  'bg-gradient-to-br from-brand to-brand/85 text-brand-foreground shadow-soft',
                  'transition-transform hover:-translate-y-px hover:from-brand hover:to-brand/90',
                )}
              >
                <Plus className="size-[15px]" />
                Ask a question
              </Button>
            }
          />
        ) : null}

        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-11 gap-2 rounded-xl border-border bg-paper px-4 text-[13.5px] font-semibold text-ink-2 hover:border-brand/40 hover:bg-brand-soft/30 hover:text-brand"
        >
          <Tags className="size-[15px]" />
          Browse by tag
        </Button>

        {/* Visible-tab segmented control */}
        <div className="ml-auto flex items-center gap-1 rounded-xl border border-border bg-muted/50 p-1">
          {visibleTabs.map((option) => {
            const active = tab === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setTab(option.value)}
                className={cn(
                  'relative rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors',
                  active ? 'text-brand' : 'text-ink-3 hover:text-ink',
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="questionsTab"
                    className="absolute inset-0 rounded-lg border border-brand/25 bg-paper shadow-soft"
                    transition={{ type: 'spring', stiffness: 360, damping: 30 }}
                  />
                ) : null}
                <span className="relative">{option.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Filter chips + sort */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterPill active>All</FilterPill>
        <FilterPill>Unanswered</FilterPill>
        <FilterPill>Bounty</FilterPill>
        <FilterPill>Followed tags</FilterPill>
        <FilterPill>Sealed</FilterPill>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-1 gap-1.5 rounded-lg text-ink-3 hover:bg-muted hover:text-ink"
          onClick={() => load(tab, { silent: true })}
          disabled={refreshing || loading}
          title="Refresh"
        >
          <RefreshCw
            className={cn(
              'size-3.5',
              (refreshing || loading) && 'animate-spin',
            )}
          />
          <span className="hidden sm:inline">Refresh</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                'ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border bg-paper px-3 py-1.5 text-[12.5px] font-semibold text-ink-2',
                'transition-colors hover:border-brand/40 hover:text-brand',
              )}
            >
              <SlidersHorizontal className="size-[13px]" />
              {sort.label}
              <ChevronDown className="size-3 text-ink-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={6}
            className="w-48 rounded-xl border-border bg-paper p-1 shadow-soft-lg"
          >
            {SORTS.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                onSelect={() => setSortKey(opt.value)}
                className={cn(
                  'rounded-lg px-2.5 py-1.5 text-[13px]',
                  sortKey === opt.value && 'bg-brand-soft/60 text-brand',
                )}
              >
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Feed */}
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

function FilterPill({ active = false, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold transition-colors',
        active
          ? 'border-brand bg-ink text-paper shadow-soft'
          : 'border-border bg-paper text-ink-2 hover:border-brand/40 hover:bg-brand-soft/40 hover:text-brand',
      )}
    >
      {children}
    </button>
  )
}
