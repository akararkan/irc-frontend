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
import { EmptyState } from '@/components/app/empty-state'
import { MentionTextarea } from '@/components/app/mention-textarea'
import { PageHeader } from '@/components/app/page-header'
import { QuestionFeedCard } from '@/components/app/question-feed-card'
import { RoleBadge } from '@/components/app/role-badge'
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
import { canAskQuestion } from '@/lib/roles'
import { formatNumber } from '@/lib/format'

const TITLE_MAX = 500
const BODY_MAX = 10000

const TABS = [
  { value: 'PUBLIC', label: 'Everyone' },
  { value: 'FOLLOWING', label: 'Following', authOnly: true },
  { value: 'MINE', label: 'My questions', authOnly: true },
]

const SORTS = [
  { value: 'hottest', label: 'Hottest' },
  { value: 'newest', label: 'Newest' },
  { value: 'votes', label: 'Most voted' },
  { value: 'unanswered', label: 'Unanswered first' },
]

function FeedSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((key) => (
        <Card key={key} className="rounded-lg border border-line bg-background">
          <CardContent className="flex gap-4 p-5">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="size-9 rounded-full" />
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
  const { user } = useAuth()
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
      const payload = { title: trimmedTitle, body: trimmedBody, answersLocked }
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
      <DialogContent className="flex max-h-[90vh] max-w-xl flex-col gap-0 overflow-hidden rounded-lg border border-line bg-background p-0">
        <DialogHeader className="shrink-0 border-b border-line px-6 pb-3 pt-5 text-left">
          <div className="inline-flex items-center gap-2 text-[10.5px] font-medium uppercase tracking-[0.16em] text-accent-indigo">
            <span className="size-[5px] rounded-full bg-brand" />
            New question
          </div>
          <DialogTitle className="mt-1.5 flex flex-wrap items-center gap-2 font-semibold text-[20px] font-semibold leading-[1.15] tracking-[-0.018em] text-ink">
            <span>Ask a question</span>
            {user?.role ? <RoleBadge role={user.role} size="sm" /> : null}
          </DialogTitle>
          <DialogDescription className="text-[13px] text-fg-muted">
            Be specific. Add the context, what you tried, and what you expect — answers come faster.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="ask-title"
                className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-fg-muted"
              >
                Title
              </Label>
              <Input
                id="ask-title"
                value={title}
                onChange={(event) => setTitle(event.target.value.slice(0, TITLE_MAX))}
                placeholder="What would you like to know?"
                maxLength={TITLE_MAX}
                required
                className="h-10 rounded-lg border-line bg-background text-[14px] text-ink placeholder:text-fg-faint focus-visible:border-fg/50 focus-visible:ring-[3px] focus-visible:ring-brand/15"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="ask-body"
                className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-fg-muted"
              >
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
                className="resize-y rounded-lg border-line bg-background text-[14px] leading-[1.55] text-ink placeholder:text-fg-faint focus-visible:border-fg/50 focus-visible:ring-[3px] focus-visible:ring-brand/15"
              />
              <p className="text-right font-mono text-[11px] tabular-nums text-fg-faint">
                {body.length} / {BODY_MAX}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setAnswersLocked((v) => !v)}
                className={cn(
                  'flex items-start gap-3 rounded-md border px-3 py-3 text-left transition-colors',
                  answersLocked
                    ? 'border-fg/40 bg-brand-soft/50'
                    : 'border-line bg-background hover:bg-bg-soft',
                )}
              >
                <span
                  className={cn(
                    'grid size-9 shrink-0 place-items-center rounded-full',
                    answersLocked ? 'bg-brand text-accent-indigo-foreground' : 'bg-secondary text-fg-muted',
                  )}
                >
                  {answersLocked ? <Lock className="size-4" /> : <Unlock className="size-4" />}
                </span>
                <div>
                  <p className="font-semibold text-[14px] font-semibold tracking-[-0.005em] text-ink">
                    {answersLocked ? 'Lock answers' : 'Answers open'}
                  </p>
                  <p className="text-[11.5px] text-fg-muted">
                    {answersLocked
                      ? 'Posted but no replies allowed.'
                      : 'Anyone qualified can answer.'}
                  </p>
                </div>
              </button>

              <div className="flex items-start gap-3 rounded-md border border-line bg-background px-3 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-bg-soft text-fg-muted">
                  <Hash className="size-4" />
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <Label
                    htmlFor="ask-limit"
                    className="font-semibold text-[14px] font-semibold tracking-[-0.005em] text-ink"
                  >
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
                    className="h-8 rounded-md border-line bg-background px-2 text-[13px] placeholder:text-fg-faint"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t border-line bg-background px-6 py-3">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="rounded-lg">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !title.trim() || !body.trim()}
              className="gap-1.5 rounded-lg bg-brand px-4 text-accent-indigo-foreground transition-colors hover:bg-brand/90 disabled:opacity-60"
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

  const allowedToAsk = canAskQuestion(user)
  const visibleTabs = TABS.filter((item) => !item.authOnly || isAuthenticated)
  const sort = useMemo(() => SORTS.find((s) => s.value === sortKey) ?? SORTS[0], [sortKey])

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

  const totalQuestions = page?.totalElements ?? questions.length
  const totalAnswers = questions.reduce((sum, q) => sum + (q.answerCount ?? 0), 0)

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Questions & answers"
        title="Ask a question. Wait for the right answer."
        description="A focused Q&A space where every answer is rated by the community and reviewed by qualified scholars before earning a gilt seal."
        stats={[
          { value: formatNumber(totalQuestions), label: 'Questions' },
          { value: formatNumber(totalAnswers), label: 'Answers' },
        ]}
      />

      {isAuthenticated && !allowedToAsk ? (
        <div className="rounded-md border border-dashed border-line bg-bg-soft px-4 py-3 text-[13px] text-fg-muted">
          {user?.role === 'RESEARCHER' ? (
            <>
              Browse, read, and <span className="font-medium text-ink">post answers</span> on any
              open question. Opening new questions and giving feedback is reserved for{' '}
              <span className="font-medium text-ink">scholars</span>.
            </>
          ) : (
            <>
              You can browse and read questions. Asking, answering, and giving feedback is reserved
              for <span className="font-medium text-ink">scholars</span> and{' '}
              <span className="font-medium text-ink">researchers</span>.
            </>
          )}
        </div>
      ) : null}

      {/* Primary action row */}
      <div className="flex flex-wrap items-center gap-2.5">
        {allowedToAsk ? (
          <AskQuestionDialog
            onCreated={(q) => setQuestions((current) => [q, ...current])}
            trigger={
              <Button
                size="lg"
                className="h-11 gap-2 rounded-md bg-brand px-5 text-[13.5px] font-semibold text-accent-indigo-foreground transition-colors hover:bg-brand/90"
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
          className="h-11 gap-2 rounded-md border-line bg-background px-4 text-[13.5px] font-semibold text-fg-soft hover:border-fg/40 hover:text-accent-indigo"
        >
          <Tags className="size-[15px]" />
          Browse by tag
        </Button>

        {/* Segmented tab control */}
        <div className="ml-auto flex items-center gap-1 rounded-md border border-line bg-bg-soft p-1">
          {visibleTabs.map((option) => {
            const active = tab === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setTab(option.value)}
                className={cn(
                  'relative rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors',
                  active ? 'text-accent-indigo' : 'text-fg-muted hover:text-ink',
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="questionsTab"
                    className="absolute inset-0 rounded-lg bg-background"
                    style={{ boxShadow: 'var(--shadow-xs)' }}
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
        <FilterPill>Sealed</FilterPill>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-1 gap-1.5 rounded-lg text-fg-muted hover:bg-bg-soft hover:text-ink"
          onClick={() => load(tab, { silent: true })}
          disabled={refreshing || loading}
          title="Refresh"
        >
          <RefreshCw className={cn('size-3.5', (refreshing || loading) && 'animate-spin')} />
          <span className="hidden sm:inline">Refresh</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-line bg-background px-3 py-1.5 text-[12.5px] font-medium text-fg-soft transition-colors hover:border-fg/40 hover:text-accent-indigo"
            >
              <SlidersHorizontal className="size-[13px]" />
              {sort.label}
              <ChevronDown className="size-3 text-fg-muted" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={6} className="w-48 rounded-md p-1">
            {SORTS.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                onSelect={() => setSortKey(opt.value)}
                className={cn(
                  'rounded-lg px-2.5 py-1.5 text-[13px]',
                  sortKey === opt.value && 'bg-brand-soft/60 text-accent-indigo',
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
        'inline-flex items-center rounded-lg border px-3 py-1.5 text-[12.5px] font-medium transition-colors',
        active
          ? 'border-fg bg-brand text-accent-indigo-foreground'
          : 'border-line bg-background text-fg-soft hover:border-fg/40 hover:text-accent-indigo',
      )}
    >
      {children}
    </button>
  )
}
