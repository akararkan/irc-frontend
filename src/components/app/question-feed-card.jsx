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
import { formatNumber, getFullName } from '@/lib/format'
import { RelativeTime } from '@/components/app/relative-time'

const STATUS_META = {
  OPEN: {
    label: 'Open',
    className:
      'bg-[color-mix(in_oklch,var(--accent-sky)_12%,transparent)] text-accent-sky ring-[color-mix(in_oklch,var(--accent-sky)_25%,transparent)]',
  },
  ANSWERED: {
    label: 'Answered',
    className:
      'bg-[color-mix(in_oklch,var(--accent-sage)_14%,transparent)] text-accent-sage ring-[color-mix(in_oklch,var(--accent-sage)_25%,transparent)]',
  },
  CLOSED: {
    label: 'Closed',
    className: 'bg-muted text-ink-3 ring-border',
  },
  ARCHIVED: {
    label: 'Archived',
    className:
      'bg-[color-mix(in_oklch,var(--accent-amber)_14%,transparent)] text-accent-amber ring-[color-mix(in_oklch,var(--accent-amber)_25%,transparent)]',
  },
}

/**
 * QuestionFeedCard — editorial Q&A row.
 * Vertical stat rail on the left (answers count + optional limit),
 * Fraunces title and prose, dashed-rule footer with status pills.
 */
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
        'group/card relative isolate block overflow-hidden rounded-2xl border border-border bg-paper',
        'p-4 transition-colors hover:border-brand/25 sm:p-[18px]',
      )}
    >
      <div className="flex gap-4">
        {/* Stat rail */}
        <div className="hidden shrink-0 flex-col items-end gap-2 border-r border-border/70 pr-4 text-right sm:flex">
          <Stat
            value={formatNumber(answers)}
            label={answers === 1 ? 'answer' : 'answers'}
            tone={isAnswered ? 'gold' : 'brand'}
          />
          {question.maxAnswers != null ? (
            <Stat
              value={formatNumber(question.maxAnswers)}
              label="limit"
              tone="muted"
            />
          ) : null}
        </div>

        {/* Body */}
        <div className="min-w-0 flex-1">
          {/* Title */}
          <h3 className="font-display text-[18px] font-semibold leading-[1.3] tracking-[-0.012em] text-ink text-balance">
            <span className="group-hover/card:text-brand">{question.title}</span>
          </h3>

          {/* Excerpt */}
          {question.body ? (
            <p className="mt-1.5 line-clamp-2 text-[13.5px] leading-[1.55] text-ink-3">
              {question.body}
            </p>
          ) : null}

          {/* Author row */}
          <div className="mt-3 flex items-center gap-2.5 text-[12px] text-ink-3">
            <UserAvatar user={author} className="size-7" />
            <span className="min-w-0 truncate">
              <span className="font-semibold text-ink-2">
                {getFullName(author) || author.username}
              </span>{' '}
              <span className="text-ink-3">
                asked <RelativeTime entity={question} />
              </span>
            </span>
            {author.role ? <RoleBadge role={author.role} size="xs" /> : null}
          </div>

          {/* Footer */}
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-dashed border-border pt-2.5 text-xs text-ink-3">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] ring-1',
                status.className,
              )}
            >
              {isAnswered ? <CheckCircle2 className="size-3" /> : null}
              {status.label}
            </span>

            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-3">
              <MessageCircleQuestion className="size-3" />
              Question
            </span>

            {question.answersLocked ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-3">
                <Lock className="size-3" />
                Locked
              </span>
            ) : null}

            {limitReached ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-[color-mix(in_oklch,var(--accent-amber)_14%,transparent)] px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] text-accent-amber">
                <Hash className="size-3" />
                Limit
              </span>
            ) : null}

            <span className="sm:hidden">
              {formatNumber(answers)} {answers === 1 ? 'answer' : 'answers'}
            </span>

            <span className="ml-auto inline-flex items-center gap-1 text-[12px] font-semibold text-brand transition-all group-hover/card:gap-2">
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

function Stat({ value, label, tone = 'default' }) {
  const toneClasses = {
    default: 'text-ink',
    brand:   'text-brand',
    gold:    'text-gold-2',
    muted:   'text-ink-3',
  }
  return (
    <div>
      <div
        className={cn(
          'font-display text-[19px] font-semibold leading-none tracking-[-0.01em] tabular-nums',
          toneClasses[tone],
        )}
      >
        {value ?? 0}
      </div>
      <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">
        {label}
      </div>
    </div>
  )
}
