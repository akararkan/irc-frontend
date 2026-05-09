import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowRight,
  Award,
  CheckCircle2,
  Hash,
  Lock,
  MessageCircleQuestion,
  Sparkles,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { LiveCount } from '@/components/app/research-card'
import { RoleBadge } from '@/components/app/role-badge'
import { UserAvatar } from '@/components/app/user-avatar'
import { useInView } from '@/hooks/use-in-view'
import { useQuestionStream } from '@/hooks/use-question-stream'
import { cn } from '@/lib/utils'
import {
  formatNumber,
  getFullName,
  getHandle,
  getRawUsername,
} from '@/lib/format'
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
 *
 * Layout: vertical stat rail on the left (answer count + scholar-seal
 * count when present), Fraunces title and prose on the right, dashed-
 * rule footer with status pills. Hovering the card paints a thin
 * brand-tinted left edge so the eye knows the row is interactive.
 */
export function QuestionFeedCard({ question: incoming }) {
  // Local mirror so SSE-driven counter updates re-render the card.
  // Re-syncs on a parent prop change, but only when the row id flips
  // — otherwise an incoming snapshot might clobber a fresher SSE patch.
  const [question, setQuestion] = useState(incoming)
  useEffect(() => {
    setQuestion((current) =>
      current?.id === incoming?.id ? { ...current, ...incoming } : incoming,
    )
  }, [incoming])

  const [setLiveRef, inView] = useInView({
    rootMargin: '300px 0px 300px 0px',
  })

  // Live updates: every viewport-card subscribes to the question's
  // per-id SSE channel. We patch answer count + seal count + view
  // count + status the moment the backend emits them, so even a feed
  // open in the background stays accurate when scholars are voting,
  // someone deletes a question, or fresh answers land.
  useQuestionStream(
    question?.id,
    {
      QUESTION_UPDATED: (payload) => {
        if (!payload?.id) return
        setQuestion((current) => ({ ...current, ...payload }))
      },
      QUESTION_LOCKED: () =>
        setQuestion((current) => ({ ...current, answersLocked: true })),
      QUESTION_UNLOCKED: () =>
        setQuestion((current) => ({ ...current, answersLocked: false })),
      ANSWER_CREATED: (payload) => {
        setQuestion((current) => ({
          ...current,
          answerCount:
            payload?.answerCount ?? (current.answerCount ?? 0) + 1,
          status:
            current.status === 'OPEN' ? 'ANSWERED' : current.status,
        }))
      },
      ANSWER_DELETED: (payload) => {
        setQuestion((current) => ({
          ...current,
          answerCount:
            payload?.answerCount ??
            Math.max(0, (current.answerCount ?? 0) - 1),
        }))
      },
      ANSWER_ACCEPTED: () =>
        setQuestion((current) => ({
          ...current,
          hasAcceptedAnswer: true,
          status: 'ANSWERED',
        })),
      BEST_ANSWER_VOTED: (payload) => {
        setQuestion((current) => ({
          ...current,
          bestAnswerVoteCount:
            payload?.questionVoteCount ??
            (current.bestAnswerVoteCount ?? 0) + 1,
          hasAcceptedAnswer: true,
        }))
      },
      BEST_ANSWER_UNVOTED: (payload) => {
        setQuestion((current) => {
          const next =
            payload?.questionVoteCount ??
            Math.max(0, (current.bestAnswerVoteCount ?? 0) - 1)
          return {
            ...current,
            bestAnswerVoteCount: next,
            hasAcceptedAnswer: next > 0 ? current.hasAcceptedAnswer : false,
          }
        })
      },
    },
    { enabled: inView },
  )

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
  // Backend rolls up the per-answer scholar votes onto the question so
  // listings can surface the seal without a per-answer fetch.
  const sealVotes =
    question.bestAnswerVoteCount ??
    question.scholarVoteCount ??
    (question.hasAcceptedAnswer ? 1 : 0)
  const sealed = sealVotes > 0 || question.hasAcceptedAnswer

  return (
    <Link
      ref={setLiveRef}
      to={`/questions/${question.id}`}
      className={cn(
        'group/card relative isolate block overflow-hidden rounded-2xl border border-border bg-paper',
        'p-4 transition-all duration-200 hover:-translate-y-px hover:border-brand/30 hover:shadow-soft sm:p-[18px]',
      )}
    >
      {/* Hover-activated accent rail on the left edge */}
      <span
        aria-hidden
        className={cn(
          'absolute inset-y-3 left-0 w-[3px] rounded-full transition-opacity duration-200',
          'opacity-0 group-hover/card:opacity-100',
        )}
        style={{
          background: sealed
            ? 'linear-gradient(180deg, var(--gold), var(--accent-sage))'
            : 'linear-gradient(180deg, var(--brand), var(--brand-muted))',
        }}
      />

      <div className="flex gap-4">
        {/* Stat rail */}
        <div className="hidden shrink-0 flex-col items-end gap-2.5 border-r border-border/70 pr-4 text-right sm:flex">
          <Stat
            value={answers}
            label={answers === 1 ? 'answer' : 'answers'}
            tone={isAnswered ? 'gold' : 'brand'}
          />
          {sealed ? (
            <Stat
              value={sealVotes}
              label={sealVotes === 1 ? 'seal' : 'seals'}
              tone="gold"
              icon={Award}
            />
          ) : null}
          {question.maxAnswers != null && !sealed ? (
            <Stat
              value={question.maxAnswers}
              label="limit"
              tone="muted"
            />
          ) : null}
        </div>

        {/* Body */}
        <div className="min-w-0 flex-1">
          {/* Title */}
          <h3 className="font-display text-[18px] font-semibold leading-[1.3] tracking-[-0.012em] text-ink text-balance">
            <span className="bg-[length:0%_2px] bg-bottom bg-no-repeat transition-[background-size] duration-200 group-hover/card:bg-[length:100%_2px] group-hover/card:text-brand"
              style={{
                backgroundImage:
                  'linear-gradient(transparent, transparent), linear-gradient(var(--brand), var(--brand))',
              }}
            >
              {question.title}
            </span>
          </h3>

          {/* Excerpt */}
          {question.body ? (
            <p className="mt-1.5 line-clamp-2 text-[13.5px] leading-[1.55] text-ink-3">
              {question.body}
            </p>
          ) : null}

          {/* Author row */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-ink-3">
            <UserAvatar user={author} className="size-7 ring-1 ring-border" />
            <span className="min-w-0 leading-tight">
              <span className="block truncate font-semibold text-ink-2">
                {getFullName(author) || getHandle(author) || 'Unknown'}
              </span>
              {getHandle(author) ? (
                <span className="block truncate font-mono text-[10.5px] text-ink-3">
                  @{getHandle(author)}{' · '}
                  <RelativeTime entity={question} />
                </span>
              ) : (
                <span className="block truncate text-[10.5px] text-ink-3">
                  asked <RelativeTime entity={question} />
                </span>
              )}
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

            {sealed ? (
              <span
                className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.1em]"
                style={{
                  background:
                    'color-mix(in oklch, var(--gold) 14%, transparent)',
                  color: 'var(--gold-2)',
                  boxShadow:
                    '0 0 0 1px color-mix(in oklch, var(--gold) 28%, transparent) inset',
                }}
                title={`${sealVotes} ${
                  sealVotes === 1 ? 'scholar has' : 'scholars have'
                } voted a best answer`}
              >
                <Award className="size-3" />
                {sealVotes > 1
                  ? `${formatNumber(sealVotes)} seals`
                  : 'Sealed'}
              </span>
            ) : null}

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

            <span className="sm:hidden font-mono text-[10.5px]">
              {formatNumber(answers)} {answers === 1 ? 'answer' : 'answers'}
            </span>

            <span className="ml-auto inline-flex items-center gap-1 text-[12px] font-semibold text-brand transition-all group-hover/card:gap-2">
              {sealed ? (
                <>
                  <Sparkles className="size-3.5" />
                  Read seals
                </>
              ) : isAnswered ? (
                'Read answers'
              ) : (
                'Answer this'
              )}
              <ArrowRight className="size-3.5" />
            </span>
          </div>

          {/* Hidden raw username so deep-link routing keeps working when
              author profile is opened from elsewhere — never visible. */}
          <span hidden data-raw-username={getRawUsername(author)} />
        </div>
      </div>
    </Link>
  )
}

function Stat({ value, label, tone = 'default', icon: Icon }) {
  const toneClasses = {
    default: 'text-ink',
    brand:   'text-brand',
    gold:    'text-gold-2',
    muted:   'text-ink-3',
  }
  // The value pulses gently when SSE patches it — the inner span is
  // re-keyed by `value`, so motion runs its enter spring on change.
  const display = formatNumber(value ?? 0)
  return (
    <div>
      <div
        className={cn(
          'inline-flex items-center gap-1 font-display text-[19px] font-semibold leading-none tracking-[-0.01em] tabular-nums',
          toneClasses[tone],
        )}
      >
        {Icon ? <Icon className="size-3.5" /> : null}
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={display}
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 460, damping: 30 }}
            className="inline-block"
          >
            {display}
          </motion.span>
        </AnimatePresence>
      </div>
      <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">
        {label}
      </div>
    </div>
  )
}
