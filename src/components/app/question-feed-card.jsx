import { useEffect, useState } from 'react'
import { Award, CheckCircle2, Eye, HelpCircle, Lock, MessageCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

import { UserAvatar } from '@/components/app/user-avatar'
import { useInView } from '@/hooks/use-in-view'
import { useQuestionStream } from '@/hooks/use-question-stream'
import { cn } from '@/lib/utils'
import { formatNumber, getFullName, getHandle, getRawUsername } from '@/lib/format'
import { RelativeTime } from '@/components/app/relative-time'

const STATUS_META = {
  OPEN: { label: 'Open' },
  ANSWERED: { label: 'Answered' },
  CLOSED: { label: 'Closed' },
  ARCHIVED: { label: 'Archived' },
}

export function QuestionFeedCard({ question: incoming }) {
  const [question, setQuestion] = useState(incoming)
  useEffect(() => {
    setQuestion((current) =>
      current?.id === incoming?.id ? { ...current, ...incoming } : incoming,
    )
  }, [incoming])

  const [setLiveRef, inView] = useInView({ rootMargin: '300px 0px 300px 0px' })

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
          answerCount: payload?.answerCount ?? (current.answerCount ?? 0) + 1,
          status: current.status === 'OPEN' ? 'ANSWERED' : current.status,
        }))
      },
      ANSWER_DELETED: (payload) => {
        setQuestion((current) => ({
          ...current,
          answerCount:
            payload?.answerCount ?? Math.max(0, (current.answerCount ?? 0) - 1),
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
            payload?.questionVoteCount ?? (current.bestAnswerVoteCount ?? 0) + 1,
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
  const sealVotes =
    question.bestAnswerVoteCount ??
    question.scholarVoteCount ??
    (question.hasAcceptedAnswer ? 1 : 0)
  const sealed = sealVotes > 0 || question.hasAcceptedAnswer
  const answeredLook = isAnswered || sealed

  return (
    <Link
      ref={setLiveRef}
      to={`/questions/${question.id}`}
      className="group block overflow-hidden rounded-2xl border border-border bg-paper p-5 transition-colors hover:border-brand/40 sm:p-6"
      style={{ boxShadow: 'var(--shadow-xs)' }}
    >
      {/* Author + meta */}
      <div className="mb-4 flex items-center gap-2.5">
        <UserAvatar user={author} className="size-9 shrink-0 rounded-full" />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span className="text-[14px] font-medium text-ink">
            {getFullName(author) || getHandle(author) || 'Unknown'}
          </span>
          <span className="font-display text-[13px] italic text-ink-3">asked</span>
          <span className="font-mono text-[10.5px] uppercase tracking-wider text-ink-3">
            <RelativeTime entity={question} />
          </span>
          {question.answersLocked ? (
            <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-ink-3">
              <Lock className="size-3" strokeWidth={1.6} />
              Locked
            </span>
          ) : null}
        </div>
        <span
          className={cn(
            'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium leading-none',
            answeredLook ? 'bg-[#ECFDF5] text-[#065F46]' : 'bg-brand-soft text-brand',
          )}
        >
          {answeredLook ? (
            <CheckCircle2 className="size-3" strokeWidth={2} />
          ) : (
            <HelpCircle className="size-3" strokeWidth={1.8} />
          )}
          {sealed ? 'Answered' : status.label}
        </span>
      </div>

      {/* Title */}
      <h3
        dir="auto"
        className="text-balance font-display text-[19px] font-semibold leading-[1.25] tracking-[-0.014em] text-ink transition-colors group-hover:text-brand sm:text-[21px]"
      >
        {question.title}
      </h3>

      {/* Excerpt */}
      {question.body ? (
        <p dir="auto" className="mt-2.5 line-clamp-2 text-[13.5px] leading-[1.6] text-ink-2">
          {question.body}
        </p>
      ) : null}

      {/* Stat footer */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3 font-mono text-[11px] uppercase tracking-wider text-ink-3">
        <span className="inline-flex items-center gap-1.5">
          <MessageCircle className="size-3.5" strokeWidth={1.6} />
          {formatNumber(answers)} {answers === 1 ? 'answer' : 'answers'}
        </span>
        {(question.viewCount ?? 0) > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <Eye className="size-3.5" strokeWidth={1.6} />
            {formatNumber(question.viewCount)} views
          </span>
        ) : null}
        {sealed ? (
          <span
            className="inline-flex items-center gap-1.5 text-[#B45309]"
            title={`${sealVotes} scholar ${sealVotes === 1 ? 'vote' : 'votes'}`}
          >
            <Award className="size-3.5" strokeWidth={1.6} />
            {sealVotes > 1 ? `${formatNumber(sealVotes)} seals` : 'Sealed'}
          </span>
        ) : null}
      </div>

      <span hidden data-raw-username={getRawUsername(author)} />
    </Link>
  )
}
