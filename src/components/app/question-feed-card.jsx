import {
  ArrowRight,
  CheckCircle2,
  Hash,
  Lock,
  MessageCircleQuestion,
  Sparkles,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { RoleBadge } from '@/components/app/role-badge'
import { UserAvatar } from '@/components/app/user-avatar'
import { cn } from '@/lib/utils'
import { displayTime, formatNumber, getFullName } from '@/lib/format'

const STATUS_META = {
  OPEN: {
    label: 'Open',
    className: 'bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-300',
  },
  ANSWERED: {
    label: 'Answered',
    className:
      'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300',
  },
  CLOSED: {
    label: 'Closed',
    className: 'bg-zinc-500/10 text-zinc-700 ring-zinc-500/20 dark:text-zinc-300',
  },
  ARCHIVED: {
    label: 'Archived',
    className: 'bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-300',
  },
}

export function QuestionFeedCard({ question }) {
  const author = {
    id: question.authorId,
    username: question.authorUsername,
    fullName: question.authorFullName,
    profileImage: question.authorProfileImage,
    role: question.authorRole,
  }
  const answers = question.answerCount ?? 0
  const status = STATUS_META[question.status] ?? STATUS_META.OPEN
  const isAnswered = question.status === 'ANSWERED'
  const limitReached =
    question.maxAnswers != null && answers >= question.maxAnswers

  return (
    <Link
      to={`/questions/${question.id}`}
      className={cn(
        'group/card relative isolate block overflow-hidden rounded-3xl border border-border bg-card p-5 transition-all',
        'hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-[0_22px_60px_-30px_oklch(0_0_0/0.18)]',
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.03]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, oklch(0 0 0) 1px, transparent 0)',
          backgroundSize: '18px 18px',
        }}
      />

      <div className="flex gap-4">
        {/* Stats column */}
        <div className="hidden shrink-0 flex-col items-stretch gap-1.5 sm:flex">
          <div
            className={cn(
              'grid w-16 place-items-center rounded-xl border border-border px-2 py-2 text-center',
              isAnswered && 'border-emerald-500/30 bg-emerald-500/5',
            )}
          >
            <span className="font-mono text-xl font-semibold tabular-nums">
              {formatNumber(answers)}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {answers === 1 ? 'answer' : 'answers'}
            </span>
          </div>
          {question.maxAnswers != null ? (
            <div className="grid w-16 place-items-center rounded-xl border border-dashed border-border px-2 py-1.5 text-center">
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                limit {question.maxAnswers}
              </span>
            </div>
          ) : null}
        </div>

        {/* Body */}
        <div className="min-w-0 flex-1 space-y-2">
          {/* Author row */}
          <div className="flex items-center gap-2.5">
            <UserAvatar user={author} className="size-8" />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="truncate text-[13px] font-semibold">
                  {getFullName(author) || `@${author.username}`}
                </span>
                {author.role ? <RoleBadge role={author.role} size="xs" /> : null}
              </div>
              <p className="text-[11px] text-muted-foreground">
                asked {displayTime(question)}
              </p>
            </div>

            {/* Type pill */}
            <span className="inline-flex items-center gap-1 rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground">
              <MessageCircleQuestion className="size-3" />
              Question
            </span>
          </div>

          {/* Title + body preview */}
          <div className="space-y-1">
            <h3 className="line-clamp-2 text-[17px] font-semibold leading-snug tracking-[-0.005em] text-foreground group-hover/card:underline">
              {question.title}
            </h3>
            {question.body ? (
              <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
                {question.body}
              </p>
            ) : null}
          </div>

          {/* Footer row */}
          <div className="flex flex-wrap items-center gap-2 pt-2 text-xs text-muted-foreground">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1',
                status.className,
              )}
            >
              {isAnswered ? <CheckCircle2 className="size-3" /> : null}
              {status.label}
            </span>

            {question.answersLocked ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Lock className="size-3" />
                Locked
              </span>
            ) : null}

            {limitReached ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                <Hash className="size-3" />
                Limit reached
              </span>
            ) : null}

            <span className="sm:hidden">
              {formatNumber(answers)} {answers === 1 ? 'answer' : 'answers'}
            </span>

            <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-foreground transition-all group-hover/card:gap-2">
              {isAnswered ? (
                <>
                  <Sparkles className="size-3.5" />
                  Read answers
                </>
              ) : (
                'Answer this'
              )}
              <ArrowRight className="size-3.5" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
