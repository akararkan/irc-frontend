import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowLeft,
  Award,
  Bookmark,
  CheckCircle2,
  ChevronDown,
  CornerDownRight,
  Hash,
  Heart,
  HelpCircle,
  Link2,
  Loader2,
  Lock,
  MessageCircleQuestion,
  MoreHorizontal,
  Pencil,
  Share2,
  Star,
  Trash2,
  Unlock,
  X,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { AnswerAttachments } from '@/components/app/answer-attachments'
import { AnswerComposer } from '@/components/app/answer-composer'
import { AnswerSources } from '@/components/app/answer-sources'
import { AudioPlayer } from '@/components/app/audio-player'
import { MentionText } from '@/components/app/mention-text'
import { EditAnswerDialog } from '@/components/app/edit-answer-dialog'
import { ReanswerComposer } from '@/components/app/reanswer-composer'
import { EditQuestionDialog } from '@/components/app/edit-question-dialog'
import { EmptyState } from '@/components/app/empty-state'
import { RoleBadge } from '@/components/app/role-badge'
import { UserAvatar } from '@/components/app/user-avatar'
import {
  acceptAnswer,
  deleteAnswer,
  deleteQuestion,
  getAnswerReplies,
  getAnswers,
  getQuestion,
  lockAnswers,
  recordQuestionShare,
  saveQuestion,
  setAnswerLimit,
  reactToAnswer,
  removeAnswerReaction,
  unacceptAnswer,
  unlockAnswers,
  unsaveQuestion,
  unvoteBestAnswer,
  voteBestAnswer,
} from '@/features/qna/qna.api'
import { useQuestionStream } from '@/hooks/use-question-stream'
import { bumpCounter, setCounter, useCounter } from '@/lib/counter-store'
import { useCooldown } from '@/lib/rate-limit-cooldown'
import {
  seedFromResponse,
  setReacted,
  setSaved,
  useDidIReact,
  useDidISave,
} from '@/lib/my-reaction-store'
import { useAuth } from '@/features/auth/auth-context'
import { useToast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import { extractApiMessage, friendlyApiMessage } from '@/lib/api-error'
import { formatNumber, getFullName, getHandle, getRawUsername, resolveMediaUrl } from '@/lib/format'
import { RelativeTime } from '@/components/app/relative-time'
import {
  canAnswerQuestion,
  canManageAnswer,
  canManageQuestion,
  canVoteBestAnswer,
  isExpertAnswerer,
} from '@/lib/roles'

const STATUS_META = {
  OPEN: { label: 'Open' },
  ANSWERED: { label: 'Answered' },
  CLOSED: { label: 'Closed' },
  ARCHIVED: { label: 'Archived' },
}

/* ── Helpers ─────────────────────────────────────────────────── */
function authorOf(entity) {
  return {
    id: entity?.authorId,
    username: entity?.authorUsername,
    fullName: entity?.authorFullName,
    profileImage: entity?.authorProfileImage,
    role: entity?.authorRole,
  }
}

function parseLinks(value) {
  if (!value) return []
  return value
    .split(/[,;\s]+/)
    .map((url) => url.trim())
    .filter(Boolean)
}

function sortAnswers(list) {
  function bestScore(answer) {
    if (answer.accepted) return Math.max(1, answer.bestAnswerVoteCount ?? 0)
    return answer.bestAnswerVoteCount ?? 0
  }
  return [...list].sort((a, b) => {
    const aBest = bestScore(a)
    const bBest = bestScore(b)
    if (aBest !== bBest) return bBest - aBest
    const fb = (b.feedbackCount ?? 0) - (a.feedbackCount ?? 0)
    if (fb !== 0) return fb
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })
}

/* ── Question header ─────────────────────────────────────────── */
function QuestionHeader({ question, onToggleSave, onShare }) {
  const author = authorOf(question)
  const status = STATUS_META[question.status] ?? STATUS_META.OPEN
  const authorRoute = getRawUsername(author)
  const authorHandle = getHandle(author)
  const authorName = getFullName(author) || authorHandle || 'Unknown'
  const sealVotes =
    question.bestAnswerVoteCount ??
    question.scholarVoteCount ??
    (question.hasAcceptedAnswer ? 1 : 0)
  const sealed = sealVotes > 0 || Boolean(question.hasAcceptedAnswer)
  const storeSaysSaved = useDidISave('question', question.id, false)
  const isSaved = question.isSaved ?? storeSaysSaved

  return (
    <section className="relative space-y-6 pb-2">
      {/* Meta strip */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-[12px] font-medium leading-none text-fg-soft">
          {sealed ? (
            <CheckCircle2 className="size-3.5 text-emerald-600" strokeWidth={2} />
          ) : (
            <HelpCircle className="size-3.5" strokeWidth={1.7} />
          )}
          {status.label}
        </span>
        <span className="font-mono text-[11px] uppercase tracking-wider text-fg-muted">
          Asked <RelativeTime entity={question} />
          {question.viewCount != null ? (
            <>
              {' · '}
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={question.viewCount}
                  initial={{ y: 4, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -4, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 460, damping: 30 }}
                  className="tabular-nums"
                >
                  {formatNumber(question.viewCount)}
                </motion.span>
              </AnimatePresence>{' '}
              views
            </>
          ) : null}
          {question.maxAnswers != null ? <> · Answer limit {question.maxAnswers}</> : null}
          {question.answersLocked ? <> · Locked</> : null}
        </span>
      </div>

      {/* Title */}
      <h1
        dir="auto"
        className="text-balance font-semibold text-[32px] font-semibold leading-[1.1] tracking-[-0.022em] text-ink sm:text-[42px]"
      >
        {question.title}
      </h1>

      {/* Body */}
      {question.body ? (
        <p
          dir="auto"
          className="max-w-[68ch] whitespace-pre-wrap text-[15.5px] leading-[1.7] text-fg-soft"
        >
          <MentionText text={question.body} />
        </p>
      ) : null}

      {/* Author row + actions */}
      <div className="flex flex-wrap items-center gap-3.5 border-t border-line pt-5">
        <Link to={`/profile/${authorRoute}`} className="shrink-0">
          <UserAvatar user={author} className="size-10 rounded-full" />
        </Link>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <Link
              to={`/profile/${authorRoute}`}
              className="font-semibold text-[15px] font-semibold text-ink hover:underline"
            >
              {authorName}
            </Link>
            {author.role ? <RoleBadge role={author.role} size="xs" /> : null}
          </div>
          {authorHandle ? (
            <p className="mt-0.5 font-mono text-[11px] text-fg-muted">@{authorHandle}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onShare}
            title="Share this question"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-[12.5px] font-medium text-fg-soft transition-colors hover:border-fg/40 hover:bg-bg-soft hover:text-ink"
          >
            <Share2 className="size-[15px]" strokeWidth={1.8} />
            {(question.shareCount ?? 0) > 0 ? formatNumber(question.shareCount) : 'Share'}
          </button>
          <button
            type="button"
            onClick={onToggleSave}
            title={isSaved ? 'Remove from saved' : 'Save question'}
            aria-pressed={isSaved}
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[12.5px] font-medium transition-colors',
              isSaved
                ? 'border-[#93C5FD] bg-[#EFF6FF] text-accent-indigo'
                : 'border-line text-fg-soft hover:border-fg/40 hover:bg-bg-soft hover:text-ink',
            )}
          >
            <Bookmark
              className="size-[15px]"
              strokeWidth={1.8}
              fill={isSaved ? 'currentColor' : 'none'}
            />
            {isSaved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>
    </section>
  )
}

/* ── Answer media ────────────────────────────────────────────── */
function AnswerMedia({ url, type, thumbnailUrl }) {
  const resolved = resolveMediaUrl(url)
  if (!resolved) return null
  const upper = (type ?? '').toUpperCase()
  if (upper === 'VIDEO') {
    return (
      <video
        src={resolved}
        poster={resolveMediaUrl(thumbnailUrl)}
        controls
        playsInline
        preload="metadata"
        className="aspect-video w-full rounded-md border border-line bg-black object-contain"
      />
    )
  }
  return (
    <a
      href={resolved}
      target="_blank"
      rel="noreferrer"
      className="block overflow-hidden rounded-md border border-line bg-bg-soft"
    >
      <img
        src={resolved}
        alt=""
        loading="lazy"
        className="max-h-[520px] w-full object-cover transition-transform duration-700 hover:scale-[1.02]"
      />
    </a>
  )
}

/* ── Inline reaction row ─────────────────────────────────────── */
function AnswerReactionRow({ questionId, answer, isAuthenticated, onPatch, trailing = null }) {
  const toast = useToast()
  const [working, setWorking] = useState(false)
  useEffect(() => {
    seedFromResponse('answer', answer, { authoritative: true })
  }, [answer])
  const storeSaysLiked = useDidIReact('answer', answer.id, false)
  const liked = answer.myReaction != null || storeSaysLiked
  const reactionCount = useCounter('answer', answer.id, 'rx', answer.reactionCount ?? 0)
  const reactionCooldown = useCooldown('reaction')

  async function toggle() {
    if (!isAuthenticated) {
      toast.info('Sign in to react.')
      return
    }
    if (working) return
    const previous = { myReaction: answer.myReaction, reactionCount }
    onPatch?.({
      id: answer.id,
      parentAnswerId: answer.parentAnswerId,
      myReaction: liked ? null : 'LIKE',
      reactionCount: liked ? Math.max(0, reactionCount - 1) : reactionCount + 1,
    })
    setReacted('answer', answer.id, !liked, liked ? null : 'LIKE')
    bumpCounter('answer', answer.id, 'rx', reactionCount, liked ? -1 : +1)
    setWorking(true)
    try {
      const updated = liked
        ? await removeAnswerReaction(questionId, answer.id)
        : await reactToAnswer(questionId, answer.id, 'LIKE')
      if (updated?.id != null && updated.reactionCount != null) {
        onPatch?.({
          id: updated.id,
          parentAnswerId: answer.parentAnswerId,
          myReaction: updated.myReaction ?? null,
          reactionCount: updated.reactionCount,
        })
        setCounter('answer', answer.id, 'rx', updated.reactionCount)
        setReacted('answer', answer.id, updated.myReaction != null, updated.myReaction ?? null)
      }
    } catch (error) {
      onPatch?.({ id: answer.id, parentAnswerId: answer.parentAnswerId, ...previous })
      setReacted('answer', answer.id, Boolean(previous.myReaction), previous.myReaction ?? null)
      setCounter('answer', answer.id, 'rx', previous.reactionCount)
      toast.error(friendlyApiMessage(error, 'Could not react.'))
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="flex w-full flex-wrap items-center gap-1.5">
      <button
        type="button"
        disabled={working || reactionCooldown > 0}
        onClick={toggle}
        className={cn(
          'inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-medium transition-colors active:scale-95 disabled:opacity-50',
          liked
            ? 'border-rose-300 bg-rose-50 text-rose-600'
            : 'border-line text-fg-soft hover:border-fg/40 hover:text-ink',
        )}
        aria-pressed={liked}
        aria-label={reactionCooldown > 0 ? `Try again in ${reactionCooldown}s` : liked ? 'Unlike' : 'Like'}
      >
        <Heart
          className="size-[14px]"
          strokeWidth={1.8}
          fill={liked ? 'currentColor' : 'none'}
        />
        {reactionCooldown > 0 ? (
          <span className="tabular-nums">{reactionCooldown}s</span>
        ) : reactionCount > 0 ? (
          <span className="tabular-nums">{formatNumber(reactionCount)}</span>
        ) : (
          <span>Like</span>
        )}
      </button>
      {trailing ? <div className="ml-auto flex items-center">{trailing}</div> : null}
    </div>
  )
}

/* ── Answer card ─────────────────────────────────────────────── */
function AnswerCard({
  questionId,
  answer,
  isAnswerOwner,
  canManageQuestion: canManage,
  canManageThisAnswer,
  allowedToAnswer,
  replies,
  repliesLoaded,
  repliesLoading,
  onEdit,
  onDelete,
  onAccept,
  onUnaccept,
  onVoteBest,
  onUnvoteBest,
  onAttachmentsChange,
  onSourcesChange,
  onLoadReplies,
  onReanswerCreated,
  onReanswerDelete,
  onAnswerPatch,
  repliesByAnswer,
  user,
  question,
  canManageAnswer: canManageAnswerFn,
  isAuthenticated,
  allowedToVoteBest = false,
}) {
  const author = authorOf(answer)
  const expert = isExpertAnswerer(author.role)
  const links = useMemo(() => parseLinks(answer.links), [answer.links])
  const voiceUrl = resolveMediaUrl(answer.voiceUrl)

  const bestVoteCount = answer.bestAnswerVoteCount ?? 0
  const isAccepted = Boolean(answer.accepted)
  const isVoted = bestVoteCount > 0
  const [voteBusy, setVoteBusy] = useState(false)

  const [showReanswerComposer, setShowReanswerComposer] = useState(false)
  const [showReplies, setShowReplies] = useState(false)

  const replyCount = repliesLoaded ? (replies?.length ?? 0) : (answer.replyCount ?? 0)

  useEffect(() => {
    if (!showReplies && !showReanswerComposer) return
    if (repliesLoaded || repliesLoading) return
    onLoadReplies?.(answer.id)
  }, [showReplies, showReanswerComposer, repliesLoaded, repliesLoading, answer.id, onLoadReplies])

  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      className={cn(
        'group/answer relative isolate overflow-hidden rounded-lg bg-background transition-colors',
        isAccepted
          ? 'border-[1.5px] border-emerald-500 shadow-[0_0_0_4px_#ECFDF5]'
          : 'border border-line hover:border-fg/30',
      )}
    >
      {/* Top status row */}
      {isAccepted || isVoted ? (
        <div className="flex flex-wrap items-center gap-2 px-6 pt-5">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium leading-none',
              isAccepted ? 'bg-emerald-600 text-white' : 'bg-[#FEF3C7] text-[#B45309]',
            )}
          >
            {isAccepted ? (
              <>
                <CheckCircle2 className="size-3.5" strokeWidth={2} />
                Accepted
              </>
            ) : null}
            {isAccepted && isVoted ? <span aria-hidden className="opacity-50">·</span> : null}
            {isVoted ? (
              <>
                <Award className="size-3.5" strokeWidth={1.9} />
                Best
              </>
            ) : null}
          </span>
          <span className="ml-auto font-mono text-[11px] uppercase tracking-wider text-fg-muted">
            <RelativeTime entity={answer} />
            {answer.edited ? ' · edited' : ''}
          </span>
        </div>
      ) : expert ? (
        <div className="flex items-center gap-2 px-6 pt-5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-medium leading-none text-accent-indigo">
            <Star className="size-3" strokeWidth={1.8} />
            {author.role === 'SCHOLAR' ? "Scholar's answer" : 'Expert answer'}
          </span>
          <span className="ml-auto font-mono text-[11px] uppercase tracking-wider text-fg-muted">
            <RelativeTime entity={answer} />
            {answer.edited ? ' · edited' : ''}
          </span>
        </div>
      ) : null}

      {/* Manage dropdown */}
      {canManageThisAnswer || canManage ? (
        <div className="absolute right-4 top-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="rounded-lg text-fg-muted hover:text-ink"
                aria-label="More"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-md">
              {canManage && !answer.parentAnswerId ? (
                answer.accepted ? (
                  <DropdownMenuItem onSelect={() => onUnaccept(answer.id)}>
                    <Award className="mr-2 size-4" />
                    Remove author's accept
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onSelect={() => onAccept(answer.id)}>
                    <Award className="mr-2 size-4" />
                    Accept as author
                  </DropdownMenuItem>
                )
              ) : null}
              {isAnswerOwner ? (
                <>
                  {canManage ? <DropdownMenuSeparator /> : null}
                  <DropdownMenuItem onSelect={() => onEdit(answer)}>
                    <Pencil className="mr-2 size-4" />
                    Edit
                  </DropdownMenuItem>
                </>
              ) : null}
              {canManageThisAnswer ? (
                <>
                  {!isAnswerOwner && canManage ? <DropdownMenuSeparator /> : null}
                  <DropdownMenuItem
                    onSelect={() => onDelete(answer.id)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 size-4" />
                    Delete
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}

      {/* Body */}
      <div>
        <div className="space-y-4 px-6 pb-5 pt-4">
          {answer.body ? (
            <p dir="auto" className="whitespace-pre-wrap text-[15.5px] leading-[1.7] text-ink">
              <MentionText text={answer.body} />
            </p>
          ) : null}

          {answer.mediaUrl ? (
            <AnswerMedia
              url={answer.mediaUrl}
              type={answer.mediaType}
              thumbnailUrl={answer.mediaThumbnailUrl}
            />
          ) : null}

          {voiceUrl ? (
            <AudioPlayer
              src={voiceUrl}
              title="Voice answer"
              subtitle="Voice"
              variant="rich"
              trackKind="voice"
              showDownload
            />
          ) : null}

          {links.length > 0 ? (
            <div className="space-y-1.5 rounded-md border border-line bg-bg-soft p-3">
              <p className="flex items-center gap-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-fg-muted">
                <Link2 className="size-3" />
                Linked sources
              </p>
              <ul className="space-y-1">
                {links.map((url, index) => (
                  <li key={`${url}-${index}`} className="truncate">
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex max-w-full items-center gap-1.5 truncate text-[13px] font-medium text-ink hover:underline"
                    >
                      <Link2 className="size-3 shrink-0 text-fg-muted" />
                      <span className="truncate">{url}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <AnswerAttachments
            questionId={questionId}
            answerId={answer.id}
            attachments={answer.attachments ?? []}
            canManage={canManageThisAnswer}
            onChange={(next) => onAttachmentsChange?.(answer.id, next)}
          />

          <AnswerSources
            questionId={questionId}
            answerId={answer.id}
            sources={answer.sources ?? []}
            canManage={canManageThisAnswer}
            onChange={(next) => onSourcesChange?.(answer.id, next)}
          />

          {/* Author + reaction row */}
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <Link to={`/profile/${getRawUsername(author)}`} className="shrink-0">
              <UserAvatar user={author} className="size-9 rounded-full" />
            </Link>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <Link
                  to={`/profile/${getRawUsername(author)}`}
                  className="font-semibold text-[14px] font-semibold text-ink hover:underline"
                >
                  {getFullName(author) || getHandle(author) || 'Unknown'}
                </Link>
                {author.role ? (
                  <span className="font-semibold text-[13px] italic text-fg-muted">
                    · {author.role.toLowerCase()}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <AnswerReactionRow
                questionId={questionId}
                answer={answer}
                isAuthenticated={isAuthenticated}
                onPatch={onAnswerPatch}
              />
              <span className="font-mono text-[11px] uppercase tracking-wider text-fg-muted">
                <RelativeTime entity={answer} />
              </span>
            </div>
          </div>

          {/* Best-answer vote */}
          <div className="flex flex-wrap items-center gap-3">
            {allowedToVoteBest && !answer.parentAnswerId ? (
              <button
                type="button"
                onClick={async () => {
                  if (voteBusy) return
                  setVoteBusy(true)
                  try {
                    if (answer.votedByMe) {
                      await onUnvoteBest?.(answer.id)
                    } else {
                      await onVoteBest?.(answer.id)
                    }
                  } finally {
                    setVoteBusy(false)
                  }
                }}
                disabled={voteBusy}
                className={cn(
                  'ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-medium transition-colors active:scale-95',
                  answer.votedByMe
                    ? 'bg-[#FEF3C7] text-[#B45309]'
                    : 'text-fg-muted hover:bg-bg-soft hover:text-ink',
                )}
              >
                <Award
                  className={cn('size-3.5', answer.votedByMe && 'fill-current')}
                  strokeWidth={1.8}
                />
                <span>{answer.votedByMe ? 'Voted best' : 'Mark as best'}</span>
                {bestVoteCount > 0 ? (
                  <span className="tabular-nums opacity-80">· {formatNumber(bestVoteCount)}</span>
                ) : null}
              </button>
            ) : bestVoteCount > 0 && !answer.parentAnswerId ? (
              <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[#FEF3C7] px-3 py-1.5 text-[11.5px] font-medium text-[#B45309]">
                <Award className="size-3.5" strokeWidth={1.8} />
                {formatNumber(bestVoteCount)} {bestVoteCount === 1 ? 'best vote' : 'best votes'}
              </span>
            ) : null}
          </div>

          {/* Reanswers */}
          <div className="border-t border-line pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setShowReplies((v) => !v)}
                disabled={replyCount === 0 && !allowedToAnswer}
                aria-expanded={showReplies}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.1em] transition-colors',
                  showReplies ? 'bg-secondary text-ink' : 'text-fg-muted hover:bg-bg-soft hover:text-ink',
                  replyCount === 0 && !allowedToAnswer && 'cursor-default opacity-60 hover:bg-transparent',
                )}
              >
                <ChevronDown
                  className={cn('size-3 transition-transform duration-200', showReplies && 'rotate-180')}
                  strokeWidth={2}
                />
                <span>
                  {replyCount === 0
                    ? 'No replies yet'
                    : `${showReplies ? 'Hide' : 'Show'} ${formatNumber(replyCount)} ${replyCount === 1 ? 'reply' : 'replies'}`}
                </span>
                {repliesLoading ? <Loader2 className="size-3 animate-spin" /> : null}
              </button>
              {allowedToAnswer ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowReanswerComposer((v) => !v)
                    if (!showReplies) setShowReplies(true)
                  }}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors',
                    showReanswerComposer
                      ? 'bg-brand text-accent-indigo-foreground'
                      : 'text-fg-muted hover:bg-bg-soft hover:text-ink',
                  )}
                >
                  <CornerDownRight className="size-3.5" strokeWidth={1.7} />
                  {showReanswerComposer ? 'Cancel' : 'Reply'}
                </button>
              ) : null}
            </div>

            <AnimatePresence initial={false}>
              {showReplies ? (
                <motion.div
                  key="reply-tree"
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 rounded-md border border-line bg-bg-soft p-4">
                    {showReanswerComposer ? (
                      <div className="mb-4">
                        <ReanswerComposer
                          questionId={questionId}
                          parentAnswerId={answer.id}
                          parentAuthor={author}
                          onCreated={(reply) => {
                            onReanswerCreated?.(answer.id, reply)
                            setShowReanswerComposer(false)
                          }}
                          onCancel={() => setShowReanswerComposer(false)}
                        />
                      </div>
                    ) : null}

                    {repliesLoaded && replies && replies.length > 0 ? (
                      <div className="space-y-4">
                        <AnimatePresence initial={false}>
                          {replies.map((reply, index) => (
                            <ReanswerItem
                              key={reply.id}
                              questionId={questionId}
                              question={question}
                              reply={reply}
                              parentAnswerId={answer.id}
                              currentUser={user}
                              isAuthenticated={isAuthenticated}
                              allowedToAnswer={allowedToAnswer}
                              canManageAnswer={
                                canManageAnswerFn?.(user, question, reply) ?? false
                              }
                              onEdit={onEdit}
                              onDelete={(replyId) => onReanswerDelete?.(answer.id, replyId)}
                              onAnswerPatch={onAnswerPatch}
                              repliesByAnswer={repliesByAnswer}
                              onLoadReplies={onLoadReplies}
                              onReanswerCreated={onReanswerCreated}
                              onReanswerDelete={onReanswerDelete}
                              depth={0}
                              isLast={index === replies.length - 1}
                            />
                          ))}
                        </AnimatePresence>
                      </div>
                    ) : repliesLoaded && !repliesLoading ? (
                      <p className="font-semibold text-[13px] italic text-fg-muted">
                        {showReanswerComposer
                          ? 'Be the first to reply.'
                          : allowedToAnswer
                            ? 'No replies yet — open the conversation.'
                            : 'No replies yet.'}
                      </p>
                    ) : repliesLoading ? (
                      <p className="font-mono text-[11px] text-fg-muted">Loading replies…</p>
                    ) : null}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.article>
  )
}

/* ── Reanswer item ───────────────────────────────────────────── */
function ReanswerItem({
  questionId,
  question,
  reply,
  currentUser,
  isAuthenticated,
  allowedToAnswer,
  canManageAnswer: canDelete,
  onEdit,
  onDelete,
  onAnswerPatch,
  repliesByAnswer,
  onLoadReplies,
  onReanswerCreated,
  onReanswerDelete,
  depth = 0,
  isLast = false,
}) {
  const author = authorOf(reply)
  const expert = isExpertAnswerer(author.role)
  const isOwner = currentUser?.id === reply.authorId
  const isQuestionAuthor = reply.authorId != null && reply.authorId === question?.authorId
  const links = parseLinks(reply.links)

  const authorRoute = getRawUsername(author)
  const authorHandle = getHandle(author)
  const authorName = getFullName(author) || authorHandle || 'Unknown'

  const [showReplyBox, setShowReplyBox] = useState(false)

  const nestedBucket = repliesByAnswer?.[reply.id]
  const nested = nestedBucket?.items ?? []
  const nestedLoaded = Boolean(nestedBucket?.loaded)
  const loadingNested = Boolean(nestedBucket?.loading)
  const reportedReplyCount = reply.replyCount ?? 0
  const effectiveReplyCount = nestedLoaded ? nested.length : reportedReplyCount

  useEffect(() => {
    if (!reply?.id) return
    if (depth !== 0) return
    if (nestedLoaded || loadingNested) return
    onLoadReplies?.(reply.id)
  }, [reply?.id, depth, nestedLoaded, loadingNested, onLoadReplies])

  function handleNestedCreated(child) {
    onReanswerCreated?.(reply.id, child)
    setShowReplyBox(false)
  }

  function handleNestedDelete(childId) {
    onReanswerDelete?.(reply.id, childId)
  }

  const hasOpenChildren =
    showReplyBox ||
    nested.length > 0 ||
    (depth === 0 && effectiveReplyCount > 0 && !isLast)
  const showSpine = !isLast || hasOpenChildren

  if (depth === 1) {
    return (
      <NestedReplyItem
        questionId={questionId}
        question={question}
        reply={reply}
        currentUser={currentUser}
        isAuthenticated={isAuthenticated}
        canManageAnswer={canDelete}
        onEdit={onEdit}
        onDelete={onDelete}
        onAnswerPatch={onAnswerPatch}
        allowedToAnswer={allowedToAnswer}
        onReanswerCreated={onReanswerCreated}
      />
    )
  }

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 360, damping: 28 }}
      className="group/reanswer relative"
    >
      <div className="flex gap-3">
        {/* Avatar + thread spine */}
        <div className="relative flex shrink-0 flex-col items-center">
          <Link
            to={`/profile/${authorRoute}`}
            onClick={(event) => event.stopPropagation()}
            className="relative z-10 transition-transform hover:scale-105"
          >
            <UserAvatar
              user={author}
              className={cn(
                depth === 0 ? 'size-8' : 'size-7',
                'rounded-full ring-2 ring-paper',
                expert && 'ring-brand/30',
                isBest(reply) && 'ring-emerald-400/50',
              )}
            />
          </Link>
          {showSpine ? (
            <span aria-hidden className="mt-1 w-px flex-1 bg-border" />
          ) : null}
        </div>

        {/* Content column */}
        <div className="min-w-0 flex-1 pb-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <Link
              to={`/profile/${authorRoute}`}
              onClick={(event) => event.stopPropagation()}
              className="truncate font-semibold text-[13.5px] font-semibold tracking-[-0.005em] text-ink hover:underline"
            >
              {authorName}
            </Link>
            {authorHandle && authorHandle.toLowerCase() !== authorName.toLowerCase() ? (
              <span className="truncate font-mono text-[10.5px] text-fg-muted">@{authorHandle}</span>
            ) : null}
            {author.role ? <RoleBadge role={author.role} size="xs" showIcon={false} /> : null}
            {isQuestionAuthor ? (
              <span className="inline-flex items-center rounded-full bg-brand-soft px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.1em] text-accent-indigo">
                Author
              </span>
            ) : null}
            <span aria-hidden className="text-fg-faint">·</span>
            <span className="text-[11px] text-fg-muted">
              <RelativeTime entity={reply} />
              {reply.edited ? ' · edited' : ''}
            </span>
            {isOwner || canDelete ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="ml-auto rounded-full p-1 text-fg-muted transition-colors hover:bg-bg-soft hover:text-ink"
                    aria-label="More"
                  >
                    <MoreHorizontal className="size-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44 rounded-md">
                  {isOwner ? (
                    <DropdownMenuItem onSelect={() => onEdit?.(reply)}>
                      <Pencil className="mr-2 size-4" />
                      Edit
                    </DropdownMenuItem>
                  ) : null}
                  {canDelete ? (
                    <>
                      {isOwner ? <DropdownMenuSeparator /> : null}
                      <DropdownMenuItem
                        onSelect={() => onDelete?.(reply.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 size-4" />
                        Delete
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>

          {reply.body ? (
            <p
              dir="auto"
              className="mt-1 whitespace-pre-wrap break-words text-[14px] leading-[1.6] text-fg-soft"
            >
              <MentionText text={reply.body} />
            </p>
          ) : null}

          {reply.mediaUrl ? (
            <div className="mt-2 max-w-[460px] overflow-hidden rounded-md border border-line bg-bg-soft">
              <AnswerMedia url={reply.mediaUrl} type={reply.mediaType} thumbnailUrl={reply.mediaThumbnailUrl} />
            </div>
          ) : null}

          {reply.voiceUrl ? (
            <div className="mt-2 max-w-[460px]">
              <AudioPlayer
                src={resolveMediaUrl(reply.voiceUrl)}
                title="Voice reanswer"
                subtitle="Voice"
                trackKind="voice"
                variant="compact"
              />
            </div>
          ) : null}

          {links.length > 0 ? (
            <ul className="mt-1.5 space-y-0.5">
              {links.map((url, index) => (
                <li key={`${url}-${index}`} className="truncate">
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex max-w-full items-center gap-1 truncate text-[12px] font-medium text-ink hover:underline"
                  >
                    <Link2 className="size-3 shrink-0 text-fg-muted" />
                    <span className="truncate">{url}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : null}

          {/* Action row */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-fg-muted">
            <AnswerReactionRow
              questionId={questionId}
              answer={reply}
              isAuthenticated={isAuthenticated}
              onPatch={onAnswerPatch}
            />

            {depth === 0 && allowedToAnswer && isAuthenticated ? (
              <button
                type="button"
                onClick={() => setShowReplyBox((v) => !v)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium transition-colors',
                  showReplyBox
                    ? 'bg-brand text-accent-indigo-foreground'
                    : 'hover:bg-bg-soft hover:text-ink',
                )}
              >
                <CornerDownRight className="size-3" />
                {showReplyBox ? 'Cancel' : 'Reply'}
              </button>
            ) : null}
          </div>

          {depth === 0 && showReplyBox ? (
            <div className="mt-2.5">
              <ReanswerComposer
                questionId={questionId}
                parentAnswerId={reply.id}
                parentAuthor={author}
                onCreated={handleNestedCreated}
                onCancel={() => setShowReplyBox(false)}
              />
            </div>
          ) : null}

          {/* Nested level */}
          {depth === 0 && (nested.length > 0 || loadingNested) ? (
            <div className="relative mt-4 space-y-4 border-l-2 border-line pl-5">
              {loadingNested && nested.length === 0 ? (
                <div className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.08em] text-fg-muted">
                  <Loader2 className="size-3 animate-spin" />
                  Loading replies…
                </div>
              ) : null}
              <AnimatePresence initial={false}>
                {nested.map((child, index) => (
                  <ReanswerItem
                    key={child.id}
                    questionId={questionId}
                    question={question}
                    reply={child}
                    parentAnswerId={reply.id}
                    currentUser={currentUser}
                    isAuthenticated={isAuthenticated}
                    allowedToAnswer={allowedToAnswer}
                    canManageAnswer={canManageAnswer(currentUser, question, child)}
                    onEdit={onEdit}
                    onDelete={(childId) => handleNestedDelete(childId)}
                    onAnswerPatch={onAnswerPatch}
                    repliesByAnswer={repliesByAnswer}
                    onLoadReplies={onLoadReplies}
                    onReanswerCreated={onReanswerCreated}
                    onReanswerDelete={onReanswerDelete}
                    depth={1}
                    isLast={index === nested.length - 1}
                  />
                ))}
              </AnimatePresence>
            </div>
          ) : null}
        </div>
      </div>
    </motion.div>
  )
}

/* ── Nested reply item (depth 1) — bubble ────────────────────── */
function NestedReplyItem({
  questionId,
  question,
  reply,
  currentUser,
  isAuthenticated,
  canManageAnswer: canDelete,
  onEdit,
  onDelete,
  onAnswerPatch,
  allowedToAnswer = false,
  onReanswerCreated,
}) {
  const author = authorOf(reply)
  const expert = isExpertAnswerer(author.role)
  const isOwner = currentUser?.id === reply.authorId
  const isQuestionAuthor = reply.authorId != null && reply.authorId === question?.authorId

  const authorRoute = getRawUsername(author)
  const authorHandle = getHandle(author)
  const authorName = getFullName(author) || authorHandle || 'Unknown'

  const [showReplyBox, setShowReplyBox] = useState(false)
  const reReplyParentId = reply.parentAnswerId

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      className="group/nested flex items-start gap-2.5"
    >
      <Link
        to={`/profile/${authorRoute}`}
        onClick={(event) => event.stopPropagation()}
        className="shrink-0 transition-transform hover:scale-105"
      >
        <UserAvatar
          user={author}
          className={cn('size-7 rounded-full ring-2 ring-paper', expert && 'ring-brand/30')}
        />
      </Link>

      <div className="min-w-0 flex-1">
        {/* Bubble */}
        <div className="rounded-lg rounded-tl-md bg-bg-soft px-3.5 py-2">
          <div className="flex items-start justify-between gap-2">
            <Link
              to={`/profile/${authorRoute}`}
              onClick={(event) => event.stopPropagation()}
              className="group/author block min-w-0 flex-1"
            >
              <span className="flex items-center gap-1.5">
                <span className="block truncate text-[12.5px] font-semibold text-ink group-hover/author:underline">
                  {authorName}
                </span>
                {author.role ? <RoleBadge role={author.role} size="xs" showIcon={false} /> : null}
                {isQuestionAuthor ? (
                  <span className="inline-flex items-center rounded-full bg-brand-soft px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.1em] text-accent-indigo">
                    Author
                  </span>
                ) : null}
              </span>
              {authorHandle && authorHandle.toLowerCase() !== authorName.toLowerCase() ? (
                <span className="block truncate font-mono text-[10px] text-fg-muted">
                  @{authorHandle}
                </span>
              ) : null}
            </Link>

            {isOwner || canDelete ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="-mr-1 -mt-0.5 rounded-full p-1 text-fg-muted transition-colors hover:bg-paper hover:text-ink"
                    aria-label="More"
                  >
                    <MoreHorizontal className="size-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44 rounded-md">
                  {isOwner ? (
                    <DropdownMenuItem onSelect={() => onEdit?.(reply)}>
                      <Pencil className="mr-2 size-4" />
                      Edit
                    </DropdownMenuItem>
                  ) : null}
                  {canDelete ? (
                    <>
                      {isOwner ? <DropdownMenuSeparator /> : null}
                      <DropdownMenuItem
                        onSelect={() => onDelete?.(reply.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 size-4" />
                        Delete
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>

          {reply.body ? (
            <p
              dir="auto"
              className="mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-[1.55] text-fg-soft"
            >
              <MentionText text={reply.body} />
            </p>
          ) : null}

          {reply.mediaUrl ? (
            <div className="mt-2 max-w-[400px] overflow-hidden rounded-md border border-line bg-bg-soft">
              <AnswerMedia url={reply.mediaUrl} type={reply.mediaType} thumbnailUrl={reply.mediaThumbnailUrl} />
            </div>
          ) : null}

          {reply.voiceUrl ? (
            <div className="mt-2 max-w-[400px]">
              <AudioPlayer
                src={resolveMediaUrl(reply.voiceUrl)}
                title="Voice reply"
                subtitle="Voice"
                trackKind="voice"
                variant="compact"
              />
            </div>
          ) : null}
        </div>

        {/* Action row */}
        <div className="mt-1.5 flex flex-wrap items-center gap-3 pl-1.5 text-[11px] font-medium text-fg-muted">
          <AnswerReactionRow
            questionId={questionId}
            answer={reply}
            isAuthenticated={isAuthenticated}
            onPatch={onAnswerPatch}
          />
          {allowedToAnswer && isAuthenticated && reReplyParentId ? (
            <button
              type="button"
              onClick={() => setShowReplyBox((v) => !v)}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium transition-colors',
                showReplyBox
                  ? 'bg-brand text-accent-indigo-foreground'
                  : 'hover:bg-bg-soft hover:text-ink',
              )}
            >
              <CornerDownRight className="size-3" />
              {showReplyBox ? 'Cancel' : 'Reply'}
            </button>
          ) : null}
          <RelativeTime entity={reply} />
          {reply.edited ? <span className="italic">(edited)</span> : null}
        </div>

        {showReplyBox && reReplyParentId ? (
          <div className="mt-2.5 pl-1.5">
            <ReanswerComposer
              questionId={questionId}
              parentAnswerId={reReplyParentId}
              parentAuthor={author}
              onCreated={(created) => {
                onReanswerCreated?.(reReplyParentId, created)
                setShowReplyBox(false)
              }}
              onCancel={() => setShowReplyBox(false)}
            />
          </div>
        ) : null}
      </div>
    </motion.div>
  )
}

function isBest(answer) {
  return (
    Boolean(answer?.isBestAnswer) ||
    Boolean(answer?.accepted) ||
    (answer?.bestAnswerVoteCount ?? 0) > 0
  )
}

/* ── Owner toolbar ───────────────────────────────────────────── */
function OwnerControls({ question, working, onToggleLock, onSetLimit }) {
  const [editingLimit, setEditingLimit] = useState(false)
  const [draftLimit, setDraftLimit] = useState(
    question.maxAnswers != null ? String(question.maxAnswers) : '',
  )

  useEffect(() => {
    setDraftLimit(question.maxAnswers != null ? String(question.maxAnswers) : '')
  }, [question.maxAnswers])

  function commitLimit() {
    const trimmed = draftLimit.trim()
    if (!trimmed) {
      onSetLimit(null)
      setEditingLimit(false)
      return
    }
    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed) || parsed < 1) return
    onSetLimit(parsed)
    setEditingLimit(false)
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <button
        type="button"
        onClick={onToggleLock}
        disabled={working}
        className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-[11px] font-medium text-fg-muted transition-colors hover:border-fg/40 hover:text-ink disabled:opacity-50"
      >
        {question.answersLocked ? (
          <>
            <Unlock className="size-3" />
            Unlock
          </>
        ) : (
          <>
            <Lock className="size-3" />
            Lock
          </>
        )}
      </button>

      {editingLimit ? (
        <span className="inline-flex items-center gap-1 rounded-lg border border-line bg-background px-2.5 py-1">
          <Hash className="size-3 text-fg-muted" />
          <input
            value={draftLimit}
            onChange={(event) => setDraftLimit(event.target.value.replace(/[^\d]/g, ''))}
            inputMode="numeric"
            placeholder="∞"
            className="w-12 bg-transparent font-mono text-[11px] tabular-nums outline-none"
            autoFocus
          />
          <button
            type="button"
            className="rounded-full px-1.5 text-[10px] font-medium uppercase tracking-wider text-accent-indigo hover:underline"
            onClick={commitLimit}
            disabled={working}
          >
            Save
          </button>
          <button
            type="button"
            className="text-fg-muted hover:text-ink"
            onClick={() => setEditingLimit(false)}
            aria-label="Cancel"
          >
            <X className="size-3" />
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setEditingLimit(true)}
          disabled={working}
          className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-[11px] font-medium text-fg-muted transition-colors hover:border-fg/40 hover:text-ink disabled:opacity-50"
        >
          <Hash className="size-3" />
          {question.maxAnswers != null ? `Limit ${question.maxAnswers}` : 'Set limit'}
        </button>
      )}
    </div>
  )
}

/* ─── QuestionDetailPage ─────────────────────────────────────── */
export function QuestionDetailPage() {
  const { questionId } = useParams()
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()
  const toast = useToast()

  const [question, setQuestion] = useState(null)
  const [answers, setAnswers] = useState([])
  const [loading, setLoading] = useState(true)
  const [answersLoading, setAnswersLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [editQuestionOpen, setEditQuestionOpen] = useState(false)
  const [editAnswer, setEditAnswerState] = useState(null)
  const [repliesByAnswer, setRepliesByAnswer] = useState({})

  const loadAll = useCallback(async () => {
    setLoading(true)
    setAnswersLoading(true)
    try {
      const [q, a] = await Promise.all([
        getQuestion(questionId),
        getAnswers(questionId, { page: 0, size: 50 }),
      ])
      setQuestion(q)
      setAnswers(a?.content ?? [])
    } catch (error) {
      const status = error?.response?.status ?? error?.status
      if (status !== 404) {
        toast.error(extractApiMessage(error, 'Could not load question.'))
      }
      setQuestion(null)
    } finally {
      setLoading(false)
      setAnswersLoading(false)
    }
  }, [questionId, toast])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  function applyAnswerPatch(answerOrPatch) {
    if (!answerOrPatch?.id) return
    if (answerOrPatch.parentAnswerId) {
      setRepliesByAnswer((current) => {
        const bucket = current[answerOrPatch.parentAnswerId]
        if (!bucket) return current
        return {
          ...current,
          [answerOrPatch.parentAnswerId]: {
            ...bucket,
            items: bucket.items.map((item) =>
              item.id === answerOrPatch.id ? { ...item, ...answerOrPatch } : item,
            ),
          },
        }
      })
      return
    }
    setAnswers((current) =>
      current.map((item) =>
        item.id === answerOrPatch.id ? { ...item, ...answerOrPatch } : item,
      ),
    )
  }

  function patchAnswerReactionFromEvent(payload) {
    if (!payload) return
    const id = payload.answerId ?? payload.id
    if (!id) return
    const next = payload.answerReactionCount ?? payload.reactionCount
    if (next == null) return
    const isOwnActor = Boolean(user?.id && payload.actorId === user.id)
    if (!isOwnActor) setCounter('answer', id, 'rx', next)
    const patch = { id }
    if (!isOwnActor) patch.reactionCount = next
    if (payload.parentAnswerId) patch.parentAnswerId = payload.parentAnswerId
    if (isOwnActor) {
      const eventType = payload.eventType ?? payload.type
      if (eventType === 'ANSWER_REACTION_REMOVED') {
        patch.myReaction = null
      } else if (eventType === 'ANSWER_REACTION_ADDED') {
        patch.myReaction = payload.reactionType ?? 'LIKE'
      }
    }
    applyAnswerPatch(patch)
  }

  const handleLoadRepliesRef = useRef(null)
  const handleLoadReplies = useCallback(
    async (answerId, { recursive = true } = {}) => {
      setRepliesByAnswer((current) => ({
        ...current,
        [answerId]: {
          items: current[answerId]?.items ?? [],
          loaded: current[answerId]?.loaded ?? false,
          loading: true,
        },
      }))
      try {
        const items = await getAnswerReplies(questionId, answerId)
        const list = items ?? []
        setRepliesByAnswer((current) => ({
          ...current,
          [answerId]: { items: list, loaded: true, loading: false },
        }))
        if (recursive) {
          const loader = handleLoadRepliesRef.current
          for (const child of list) {
            if ((child?.replyCount ?? 0) <= 0) continue
            loader?.(child.id, { recursive: false })
          }
        }
      } catch (error) {
        toast.error(extractApiMessage(error, 'Could not load reanswers.'))
        setRepliesByAnswer((current) => ({
          ...current,
          [answerId]: {
            items: current[answerId]?.items ?? [],
            loaded: current[answerId]?.loaded ?? false,
            loading: false,
          },
        }))
      }
    },
    [questionId, toast],
  )
  useEffect(() => {
    handleLoadRepliesRef.current = handleLoadReplies
  }, [handleLoadReplies])

  const bumpAnswerReplyCount = useCallback((parentId, delta) => {
    if (!parentId || !delta) return
    setAnswers((current) =>
      current.map((item) =>
        item.id === parentId
          ? { ...item, replyCount: Math.max(0, (item.replyCount ?? 0) + delta) }
          : item,
      ),
    )
    setRepliesByAnswer((current) => {
      let changed = false
      const next = {}
      for (const [bucketKey, bucket] of Object.entries(current)) {
        if (!bucket?.items) {
          next[bucketKey] = bucket
          continue
        }
        const idx = bucket.items.findIndex((item) => item.id === parentId)
        if (idx === -1) {
          next[bucketKey] = bucket
          continue
        }
        const items = bucket.items.slice()
        items[idx] = {
          ...items[idx],
          replyCount: Math.max(0, (items[idx].replyCount ?? 0) + delta),
        }
        next[bucketKey] = { ...bucket, items }
        changed = true
      }
      return changed ? next : current
    })
  }, [])

  useQuestionStream(questionId, {
    QUESTION_UPDATED: (payload) => {
      if (!payload?.id) return
      setQuestion((current) => (current ? { ...current, ...payload } : current))
    },
    QUESTION_LOCKED: () => {
      setQuestion((current) => (current ? { ...current, answersLocked: true } : current))
    },
    QUESTION_UNLOCKED: () => {
      setQuestion((current) => (current ? { ...current, answersLocked: false } : current))
    },
    QUESTION_DELETED: () => {
      toast.info('This question was removed by its author.')
      navigate('/questions', { replace: true })
    },
    VIEW_COUNT_UPDATED: (payload) => {
      const next = payload?.questionViewCount ?? payload?.viewCount
      if (next == null) return
      setCounter('question', questionId, 'vw', next)
      setQuestion((current) => (current ? { ...current, viewCount: next } : current))
    },
    SAVE_COUNT_UPDATED: (payload) => {
      const next = payload?.questionSaveCount ?? payload?.saveCount
      if (next == null) return
      if (user?.id && payload?.actorId === user.id) return
      setCounter('question', questionId, 'sv', next)
      setQuestion((current) => (current ? { ...current, saveCount: next } : current))
    },
    SHARE_COUNT_UPDATED: (payload) => {
      const next = payload?.questionShareCount ?? payload?.shareCount
      if (next == null) return
      if (user?.id && payload?.actorId === user.id) return
      setCounter('question', questionId, 'sh', next)
      setQuestion((current) => (current ? { ...current, shareCount: next } : current))
    },
    ANSWER_CREATED: (payload) => {
      if (!payload?.id) return
      setAnswers((current) =>
        current.some((item) => item.id === payload.id)
          ? current.map((item) => (item.id === payload.id ? { ...item, ...payload } : item))
          : [...current, payload],
      )
      setQuestion((current) => {
        if (!current) return current
        const nextAnswerCount =
          payload.questionAnswerCount ?? payload.answerCount ?? (current.answerCount ?? 0) + 1
        setCounter('question', questionId, 'an', nextAnswerCount)
        return {
          ...current,
          answerCount: nextAnswerCount,
          status: current.status === 'OPEN' ? 'ANSWERED' : current.status,
        }
      })
    },
    REANSWER_CREATED: (payload) => {
      if (!payload?.id || !payload.parentAnswerId) return
      let countsAsNew = false
      let bucketMissing = false
      setRepliesByAnswer((current) => {
        const bucket = current[payload.parentAnswerId]
        if (!bucket) {
          countsAsNew = true
          bucketMissing = true
          return current
        }
        if (bucket.items.some((item) => item.id === payload.id)) {
          return current
        }
        countsAsNew = true
        if (!bucket.loaded) return current
        return {
          ...current,
          [payload.parentAnswerId]: {
            ...bucket,
            items: [...bucket.items, payload],
          },
        }
      })
      if (countsAsNew) bumpAnswerReplyCount(payload.parentAnswerId, +1)
      if (bucketMissing) handleLoadReplies(payload.parentAnswerId)
    },
    ANSWER_EDITED: (payload) => applyAnswerPatch(payload),
    ANSWER_DELETED: (payload) => {
      const id = payload?.id ?? payload?.answerId
      if (!id) return
      const parentId = payload?.parentAnswerId
      if (parentId) {
        let removed = false
        setRepliesByAnswer((current) => {
          const bucket = current[parentId]
          if (!bucket?.items) return current
          const next = bucket.items.filter((item) => item.id !== id)
          if (next.length === bucket.items.length) return current
          removed = true
          return { ...current, [parentId]: { ...bucket, items: next } }
        })
        if (removed) bumpAnswerReplyCount(parentId, -1)
        setRepliesByAnswer((current) => {
          if (!current[id]) return current
          const next = { ...current }
          delete next[id]
          return next
        })
        return
      }
      setAnswers((current) => current.filter((item) => item.id !== id))
      setQuestion((current) => {
        if (!current) return current
        const nextAnswerCount =
          payload?.questionAnswerCount ??
          payload?.answerCount ??
          Math.max(0, (current.answerCount ?? 0) - 1)
        setCounter('question', questionId, 'an', nextAnswerCount)
        return { ...current, answerCount: nextAnswerCount }
      })
    },
    ANSWER_ACCEPTED: (payload) => {
      if (!payload?.id) return
      applyAnswerPatch({ ...payload, accepted: true })
      setQuestion((current) => (current ? { ...current, status: 'ANSWERED' } : current))
    },
    ANSWER_UNACCEPTED: (payload) => {
      if (!payload?.id) return
      applyAnswerPatch({ ...payload, accepted: false })
    },
    ANSWER_REACTION_ADDED: (payload) =>
      patchAnswerReactionFromEvent({ ...payload, eventType: 'ANSWER_REACTION_ADDED' }),
    ANSWER_REACTION_REMOVED: (payload) =>
      patchAnswerReactionFromEvent({ ...payload, eventType: 'ANSWER_REACTION_REMOVED' }),
    ANSWER_FEEDBACK_ADDED: (payload) => {
      const id = payload?.answerId ?? payload?.id
      if (!id) return
      applyAnswerPatch({ id, feedbackCount: payload?.feedbackCount })
    },
    ANSWER_FEEDBACK_EDITED: (payload) => {
      const id = payload?.answerId ?? payload?.id
      if (!id) return
      applyAnswerPatch({ id })
    },
    ANSWER_FEEDBACK_DELETED: (payload) => {
      const id = payload?.answerId ?? payload?.id
      if (!id) return
      applyAnswerPatch({ id, feedbackCount: payload?.feedbackCount })
    },
    BEST_ANSWER_VOTED: (payload) => {
      const id = payload?.answerId ?? payload?.id
      if (!id) return
      const isMe = user?.id != null && payload?.voterId === user.id
      applyAnswerPatch({
        id,
        bestAnswerVoteCount: payload?.bestAnswerVoteCount,
        isBestAnswer: true,
        ...(isMe ? { votedByMe: true } : {}),
      })
    },
    BEST_ANSWER_UNVOTED: (payload) => {
      const id = payload?.answerId ?? payload?.id
      if (!id) return
      const isMe = user?.id != null && payload?.voterId === user.id
      const nextCount = payload?.bestAnswerVoteCount ?? 0
      applyAnswerPatch({
        id,
        bestAnswerVoteCount: nextCount,
        isBestAnswer: nextCount > 0 ? true : undefined,
        ...(isMe ? { votedByMe: false } : {}),
      })
    },
  })

  const canManage = canManageQuestion(user, question)
  const allowedToAnswer = canAnswerQuestion(user)
  const allowedToVoteBest = canVoteBestAnswer(user, question)

  const sortedAnswers = useMemo(() => sortAnswers(answers), [answers])
  const limitReached =
    question?.maxAnswers != null &&
    (question.answerCount ?? answers.length) >= question.maxAnswers
  const composerDisabled = Boolean(
    question?.answersLocked || (limitReached && !canManage),
  )

  function handleAnswerCreated(created) {
    setAnswers((current) => [...current, created])
    setQuestion((current) =>
      current
        ? {
            ...current,
            answerCount: (current.answerCount ?? 0) + 1,
            status: current.status === 'OPEN' ? 'ANSWERED' : current.status,
          }
        : current,
    )
  }

  function handleAnswerUpdated(updated) {
    if (updated.parentAnswerId) {
      setRepliesByAnswer((current) => {
        const next = { ...current }
        const bucket = next[updated.parentAnswerId]
        if (!bucket) return current
        next[updated.parentAnswerId] = {
          ...bucket,
          items: bucket.items.map((item) =>
            item.id === updated.id ? { ...item, ...updated } : item,
          ),
        }
        return next
      })
      return
    }
    setAnswers((current) =>
      current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
    )
  }

  function handleReanswerCreated(parentId, reply) {
    let inserted = false
    setRepliesByAnswer((current) => {
      const bucket = current[parentId]
      const previousItems = Array.isArray(bucket?.items) ? bucket.items : []
      if (previousItems.some((item) => item.id === reply.id)) return current
      inserted = true
      return {
        ...current,
        [parentId]: { items: [...previousItems, reply], loaded: true, loading: false },
      }
    })
    if (inserted) bumpAnswerReplyCount(parentId, +1)
  }

  async function handleReanswerDelete(parentId, replyId) {
    if (!confirm('Delete this reply?')) return
    try {
      await deleteAnswer(questionId, replyId)
      let removed = false
      setRepliesByAnswer((current) => {
        const bucket = current[parentId]
        if (!bucket?.items) return current
        const next = bucket.items.filter((item) => item.id !== replyId)
        if (next.length === bucket.items.length) return current
        removed = true
        return { ...current, [parentId]: { ...bucket, items: next } }
      })
      if (removed) bumpAnswerReplyCount(parentId, -1)
      toast.success('Reply deleted.')
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not delete reply.'))
    }
  }

  async function handleAcceptAnswer(answerId) {
    setWorking(true)
    try {
      const updated = await acceptAnswer(questionId, answerId)
      setAnswers((current) =>
        current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
      )
      setQuestion((current) => (current ? { ...current, status: 'ANSWERED' } : current))
      toast.success('Marked as a best answer.')
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not accept answer.'))
    } finally {
      setWorking(false)
    }
  }

  async function handleUnacceptAnswer(answerId) {
    setWorking(true)
    try {
      const updated = await unacceptAnswer(questionId, answerId)
      setAnswers((current) =>
        current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
      )
      toast.success('Removed from best answers.')
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not unaccept answer.'))
    } finally {
      setWorking(false)
    }
  }

  async function handleVoteBest(answerId) {
    const previous = answers
    setAnswers((current) =>
      current.map((item) =>
        item.id === answerId
          ? { ...item, votedByMe: true, bestAnswerVoteCount: (item.bestAnswerVoteCount ?? 0) + 1, isBestAnswer: true }
          : item,
      ),
    )
    try {
      const updated = await voteBestAnswer(questionId, answerId)
      if (updated?.id) applyAnswerPatch({ ...updated, votedByMe: true })
      toast.success('Marked as a best answer.')
    } catch (error) {
      setAnswers(previous)
      toast.error(extractApiMessage(error, 'Could not vote for this answer.'))
    }
  }

  async function handleUnvoteBest(answerId) {
    const previous = answers
    setAnswers((current) =>
      current.map((item) => {
        if (item.id !== answerId) return item
        const nextCount = Math.max(0, (item.bestAnswerVoteCount ?? 0) - 1)
        return { ...item, votedByMe: false, bestAnswerVoteCount: nextCount, isBestAnswer: Boolean(item.accepted) || nextCount > 0 }
      }),
    )
    try {
      const updated = await unvoteBestAnswer(questionId, answerId)
      if (updated?.id) applyAnswerPatch({ ...updated, votedByMe: false })
      toast.success('Vote withdrawn.')
    } catch (error) {
      setAnswers(previous)
      toast.error(extractApiMessage(error, 'Could not withdraw vote.'))
    }
  }

  async function handleDeleteAnswer(answerId) {
    if (!confirm('Delete this answer?')) return
    try {
      await deleteAnswer(questionId, answerId)
      setAnswers((current) => current.filter((item) => item.id !== answerId))
      setQuestion((current) =>
        current ? { ...current, answerCount: Math.max(0, (current.answerCount ?? 0) - 1) } : current,
      )
      toast.success('Answer deleted.')
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not delete answer.'))
    }
  }

  async function handleDeleteQuestion() {
    if (!confirm(`Delete "${question.title}"? This cannot be undone.`)) return
    try {
      await deleteQuestion(questionId)
      toast.success('Question deleted.')
      navigate('/questions', { replace: true })
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not delete question.'))
    }
  }

  async function handleToggleSave() {
    if (!question) return
    if (!isAuthenticated) {
      toast.info('Sign in to save this question.')
      return
    }
    const previous = question
    const wasSaved = Boolean(question.isSaved)
    const previousSaveCount = question.saveCount ?? 0
    setQuestion((current) =>
      current
        ? {
            ...current,
            isSaved: !wasSaved,
            saveCount: wasSaved
              ? Math.max(0, (current.saveCount ?? 0) - 1)
              : (current.saveCount ?? 0) + 1,
          }
        : current,
    )
    setSaved('question', question.id, !wasSaved)
    bumpCounter('question', question.id, 'sv', previousSaveCount, wasSaved ? -1 : +1)
    try {
      const updated = wasSaved
        ? await unsaveQuestion(question.id)
        : await saveQuestion(question.id)
      if (updated?.id) {
        setQuestion((current) => (current ? { ...current, ...updated } : updated))
        if (updated.saveCount != null) setCounter('question', question.id, 'sv', updated.saveCount)
        if (updated.isSaved != null) setSaved('question', question.id, Boolean(updated.isSaved))
      }
      if (!wasSaved) toast.success('Saved to your library.')
    } catch (error) {
      setQuestion(previous)
      setSaved('question', question.id, wasSaved)
      setCounter('question', question.id, 'sv', previousSaveCount)
      toast.error(extractApiMessage(error, 'Could not update save state.'))
    }
  }

  async function handleShare() {
    if (!question) return
    try {
      const result = await recordQuestionShare(question.id)
      const url =
        result?.shortUrl ??
        result?.canonicalUrl ??
        (typeof result === 'string' ? result : null) ??
        window.location.href
      if (navigator.share) {
        await navigator.share({ title: question.title, url })
      } else {
        await navigator.clipboard.writeText(url)
        toast.success('Link copied to clipboard.')
      }
      setQuestion((current) => ({
        ...current,
        shareCount: result?.shareCount ?? (current?.shareCount ?? 0) + 1,
      }))
    } catch {
      /* user cancelled or unsupported */
    }
  }

  async function handleToggleLock() {
    if (!question) return
    setWorking(true)
    try {
      const updated = question.answersLocked
        ? await unlockAnswers(questionId)
        : await lockAnswers(questionId)
      setQuestion((current) => ({ ...current, ...updated }))
      toast.success(updated.answersLocked ? 'Answers locked.' : 'Answers unlocked.')
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not change lock state.'))
    } finally {
      setWorking(false)
    }
  }

  async function handleSetLimit(value) {
    setWorking(true)
    try {
      const updated = await setAnswerLimit(questionId, value)
      setQuestion((current) => ({ ...current, ...updated }))
      toast.success(value == null ? 'Limit cleared.' : `Limit set to ${value}.`)
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not update limit.'))
    } finally {
      setWorking(false)
    }
  }

  function handleAttachmentsChange(answerId, next) {
    setAnswers((current) =>
      current.map((item) => (item.id === answerId ? { ...item, attachments: next } : item)),
    )
  }

  function handleSourcesChange(answerId, next) {
    setAnswers((current) =>
      current.map((item) => (item.id === answerId ? { ...item, sources: next } : item)),
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-72 w-full rounded-lg" />
        <Skeleton className="h-44 w-full rounded-lg" />
        <Skeleton className="h-44 w-full rounded-lg" />
      </div>
    )
  }

  if (!question) {
    return (
      <EmptyState
        icon={MessageCircleQuestion}
        title="This question isn't available"
        description="It may have been removed, archived, or the author has restricted who can see it."
        action={
          <Button asChild size="sm" variant="outline" className="rounded-full">
            <Link to="/questions">Back to questions</Link>
          </Button>
        }
      />
    )
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/questions"
          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-fg-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="size-3.5" />
          All questions
        </Link>

        {canManage ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setEditQuestionOpen(true)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-medium text-fg-muted transition-colors hover:bg-bg-soft hover:text-ink"
            >
              <Pencil className="size-3.5" />
              Edit
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex size-7 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-bg-soft hover:text-ink"
                  aria-label="More"
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-md">
                <DropdownMenuItem onSelect={handleToggleLock}>
                  {question.answersLocked ? (
                    <>
                      <Unlock className="mr-2 size-4" />
                      Unlock answers
                    </>
                  ) : (
                    <>
                      <Lock className="mr-2 size-4" />
                      Lock answers
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={handleDeleteQuestion}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 size-4" />
                  Delete question
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}
      </div>

      {/* Editorial header */}
      <QuestionHeader question={question} onToggleSave={handleToggleSave} onShare={handleShare} />

      {/* Owner controls */}
      {canManage ? (
        <OwnerControls
          question={question}
          working={working}
          onToggleLock={handleToggleLock}
          onSetLimit={handleSetLimit}
        />
      ) : null}

      <span aria-hidden className="block h-px w-full bg-border" />

      {/* Answers section */}
      <section className="space-y-5">
        <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
          <div className="flex items-baseline gap-2.5">
            <h2 className="font-semibold text-[20px] font-semibold tracking-[-0.015em] text-ink sm:text-[22px]">
              Answers
            </h2>
            <span className="font-mono text-[12px] tabular-nums text-fg-muted">
              {formatNumber(question.answerCount ?? sortedAnswers.length)}
              {question.maxAnswers != null ? ` / ${question.maxAnswers}` : null}
            </span>
          </div>
          {sortedAnswers.some((a) => a.accepted) ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.08em] text-[#065F46]">
              <CheckCircle2 className="size-3" />
              {formatNumber(sortedAnswers.filter((a) => a.accepted).length)} accepted
            </span>
          ) : null}
          <span className="ml-auto h-px flex-1 self-center bg-border" aria-hidden />
        </div>

        {/* Composer */}
        {!isAuthenticated ? (
          <Card className="rounded-lg border border-line">
            <CardContent className="p-5 text-[13px] text-fg-muted">
              <Link to="/login" className="font-medium text-accent-indigo hover:underline">
                Sign in
              </Link>{' '}
              to post an answer.
            </CardContent>
          </Card>
        ) : allowedToAnswer ? (
          <AnswerComposer
            questionId={question.id}
            disabled={composerDisabled}
            onCreated={handleAnswerCreated}
          />
        ) : (
          <Card className="rounded-lg border border-dashed border-line">
            <CardContent className="p-5 text-[13px] text-fg-muted">
              Posting answers in the Q&A area is reserved for{' '}
              <span className="font-medium text-ink">scholars</span> and{' '}
              <span className="font-medium text-ink">researchers</span>. You can still read every
              answer below.
            </CardContent>
          </Card>
        )}

        {/* List */}
        {answersLoading ? (
          <div className="flex justify-center py-6 text-fg-muted">
            <Loader2 className="size-4 animate-spin" />
          </div>
        ) : sortedAnswers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line bg-background px-8 py-10 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-bg-soft text-fg-soft">
              <MessageCircleQuestion className="size-5" strokeWidth={1.6} />
            </span>
            <h3 className="mt-4 font-semibold text-[18px] font-semibold tracking-[-0.012em] text-ink">
              No answers yet
            </h3>
            <p className="mx-auto mt-1.5 max-w-[42ch] text-[13.5px] leading-[1.6] text-fg-muted">
              Be the first to share a thoughtful answer — citations welcome.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence initial={false}>
              {sortedAnswers.map((answer) => {
                const bucket = repliesByAnswer[answer.id]
                return (
                  <AnswerCard
                    key={answer.id}
                    questionId={question.id}
                    answer={answer}
                    isAnswerOwner={user?.id === answer.authorId}
                    isQuestionAuthor={
                      answer.authorId != null && answer.authorId === question.authorId
                    }
                    canManageQuestion={canManage}
                    canManageThisAnswer={canManageAnswer(user, question, answer)}
                    allowedToAnswer={allowedToAnswer && !question.answersLocked}
                    allowedToVoteBest={allowedToVoteBest}
                    user={user}
                    question={question}
                    canManageAnswer={canManageAnswer}
                    replies={bucket?.items ?? []}
                    repliesLoaded={bucket?.loaded ?? false}
                    repliesLoading={bucket?.loading ?? false}
                    onEdit={(target) => setEditAnswerState(target)}
                    onDelete={handleDeleteAnswer}
                    onAccept={handleAcceptAnswer}
                    onUnaccept={handleUnacceptAnswer}
                    onVoteBest={handleVoteBest}
                    onUnvoteBest={handleUnvoteBest}
                    onAttachmentsChange={handleAttachmentsChange}
                    onSourcesChange={handleSourcesChange}
                    onLoadReplies={handleLoadReplies}
                    onReanswerCreated={handleReanswerCreated}
                    onReanswerDelete={handleReanswerDelete}
                    onAnswerPatch={applyAnswerPatch}
                    repliesByAnswer={repliesByAnswer}
                    isAuthenticated={isAuthenticated}
                  />
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </section>

      {/* Dialogs */}
      {canManage ? (
        <EditQuestionDialog
          question={question}
          open={editQuestionOpen}
          onOpenChange={setEditQuestionOpen}
          onUpdated={(updated) => setQuestion((current) => ({ ...current, ...updated }))}
        />
      ) : null}

      <EditAnswerDialog
        questionId={question.id}
        answer={editAnswer}
        open={Boolean(editAnswer)}
        onOpenChange={(next) => {
          if (!next) setEditAnswerState(null)
        }}
        onUpdated={handleAnswerUpdated}
      />
    </div>
  )
}
