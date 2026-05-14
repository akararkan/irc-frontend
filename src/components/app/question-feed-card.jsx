import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  Award,
  CheckCircle2,
  Eye,
  Hash,
  Lock,
  MessageCircleQuestion,
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

// Status palette per IRC Scholar spec §07: OPEN → success green,
// ANSWERED → info blue, CLOSED / ARCHIVED → muted. Drawn from the
// semantic pill utilities exposed in index.css.
const STATUS_META = {
  OPEN:     { label: 'Open',     className: 'pill-success' },
  ANSWERED: { label: 'Answered', className: 'pill-info' },
  CLOSED:   { label: 'Closed',   className: 'pill-mute' },
  ARCHIVED: { label: 'Archived', className: 'pill-mute' },
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
  // eslint-disable-next-line no-unused-vars
  const limitReached = question.maxAnswers != null && answers >= question.maxAnswers
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
      className="group/card card-hover block overflow-hidden rounded-xl border-[0.5px] border-border bg-paper p-5 sm:p-6"
    >
      {/* Author + meta — single row matching reference */}
      <div className="mb-4 flex items-center gap-2.5">
        <UserAvatar user={author} className="size-9 shrink-0" />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span className="font-display text-[15px] font-semibold text-ink">
            {getFullName(author) || getHandle(author) || 'Unknown'}
          </span>
          <span className="font-display text-[14px] italic text-ink-3">asked</span>
          <span className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
            <RelativeTime entity={question} />
          </span>
          {question.answersLocked ? (
            <span className="inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-wider text-ink-3">
              <Lock className="size-3" strokeWidth={1.5} />
              Locked
            </span>
          ) : null}
        </div>
        {/* Status pill — top right, outlined */}
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border-[0.5px] border-border px-2.5 py-1 text-[11px] font-medium leading-none text-ink">
          {isAnswered || sealed ? (
            <CheckCircle2 className="size-3" strokeWidth={1.8} />
          ) : null}
          {sealed ? 'Answered' : status.label}
        </span>
      </div>

      {/* Title */}
      <h3
        dir="auto"
        className="font-display text-[21px] font-semibold leading-[1.2] tracking-[-0.016em] text-ink text-balance transition-colors group-hover/card:text-brand sm:text-[23px]"
      >
        {question.title}
      </h3>

      {/* Excerpt */}
      {question.body ? (
        <p
          dir="auto"
          className="mt-2.5 line-clamp-2 text-[14.5px] leading-[1.65] text-ink-2"
        >
          {question.body}
        </p>
      ) : null}

      {/* Stat footer — mono uppercase icons + counts, no bordered pills */}
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-wider text-ink-3">
        <span className="inline-flex items-center gap-1.5">
          <MessageCircleQuestion className="size-3.5" strokeWidth={1.5} />
          {formatNumber(answers)} {answers === 1 ? 'answer' : 'answers'}
        </span>
        {(question.reactionCount ?? 0) > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="text-[13px] leading-none">♡</span>
            {formatNumber(question.reactionCount)} likes
          </span>
        ) : null}
        {(question.viewCount ?? 0) > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <Eye className="size-3.5" strokeWidth={1.5} />
            {formatNumber(question.viewCount)} views
          </span>
        ) : null}
        {sealed ? (
          <span className="inline-flex items-center gap-1.5" title={`${sealVotes} scholar ${sealVotes === 1 ? 'vote' : 'votes'}`}>
            <Award className="size-3.5" strokeWidth={1.5} />
            {sealVotes > 1 ? `${formatNumber(sealVotes)} seals` : 'Sealed'}
          </span>
        ) : null}
      </div>

      <span hidden data-raw-username={getRawUsername(author)} />
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
            className="live-flash inline-block"
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
