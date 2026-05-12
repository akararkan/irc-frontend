import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowLeft,
  Award,
  Bookmark,
  CheckCircle2,
  ChevronDown,
  CornerDownRight,
  Eye,
  Hash,
  Heart,
  HelpCircle,
  Library,
  Link2,
  Loader2,
  Lock,
  MessageCircleQuestion,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Reply,
  Share2,
  Sparkles,
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
  setAnswerLimit,
  reactToAnswer,
  removeAnswerReaction,
  unacceptAnswer,
  unlockAnswers,
  unvoteBestAnswer,
  voteBestAnswer,
} from '@/features/qna/qna.api'
import { useQuestionStream } from '@/hooks/use-question-stream'
import { useAuth } from '@/features/auth/auth-context'
import { useToast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import { extractApiMessage, friendlyApiMessage } from '@/lib/api-error'
import {
  formatNumber,
  getFullName,
  getHandle,
  getRawUsername,
  resolveMediaUrl,
} from '@/lib/format'
import { RelativeTime } from '@/components/app/relative-time'
import {
  canAnswerQuestion,
  canManageAnswer,
  canManageQuestion,
  canVoteBestAnswer,
  isExpertAnswerer,
} from '@/lib/roles'

// Status palette per IRC Scholar spec — OPEN success, ANSWERED info,
// CLOSED / ARCHIVED muted. The same map is used on the feed card so the
// pill reads identically across surfaces.
const STATUS_META = {
  OPEN:     { label: 'Open',     className: 'pill-success' },
  ANSWERED: { label: 'Answered', className: 'pill-info' },
  CLOSED:   { label: 'Closed',   className: 'pill-mute' },
  ARCHIVED: { label: 'Archived', className: 'pill-mute' },
}

// ─── Helpers ────────────────────────────────────────────────────────
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
  // Best answers float to the top — earned via either the legacy
  // single-author accept OR the multi-scholar vote count. Within the
  // "best" bucket, more votes wins; within ties, more feedback;
  // within those, oldest first.
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

// ─── Question header — tight editorial design (no card) ───────────
function QuestionHeader({ question }) {
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

  return (
    <section className="rounded-xl border-[0.5px] border-border bg-paper p-6 sm:p-7">
      {/* Top status row — spec §07 question card */}
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium leading-none',
            status.className,
          )}
        >
          <HelpCircle className="size-3" strokeWidth={1.5} />
          {status.label}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full pill-mute px-2 py-0.5 text-[11px] font-medium">
          {formatNumber(question.answerCount ?? 0)}{' '}
          {(question.answerCount ?? 0) === 1 ? 'answer' : 'answers'}
        </span>
        {question.viewCount != null ? (
          <span className="inline-flex items-center gap-1 rounded-full pill-mute px-2 py-0.5 text-[11px] font-medium">
            <Eye className="size-3" strokeWidth={1.5} />
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={question.viewCount}
                initial={{ y: 5, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -5, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 460, damping: 30 }}
                className="inline-block tabular-nums"
              >
                {formatNumber(question.viewCount)}
              </motion.span>
            </AnimatePresence>
            {' '}views
          </span>
        ) : null}
        {sealed ? (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ background: 'var(--gold-soft)', color: 'var(--gold-2)' }}
            title={`${sealVotes} ${sealVotes === 1 ? 'scholar has' : 'scholars have'} sealed an answer`}
          >
            <Award className="size-3" strokeWidth={1.5} />
            {sealVotes > 1 ? `${formatNumber(sealVotes)} seals` : 'Sealed'}
          </span>
        ) : null}
        {question.answersLocked ? (
          <span className="inline-flex items-center gap-1 rounded-full pill-mute px-2 py-0.5 text-[11px] font-medium">
            <Lock className="size-3" strokeWidth={1.5} />
            Locked
          </span>
        ) : null}
        <span className="ml-auto font-mono text-[11px] text-ink-3">
          <RelativeTime entity={question} />
        </span>
      </div>

      {/* Title — Newsreader, generous */}
      <h1
        dir="auto"
        className="mt-4 font-display text-[28px] font-medium leading-[1.18] tracking-[-0.018em] text-ink text-balance sm:text-[34px]"
      >
        {question.title}
      </h1>

      {/* Body */}
      {question.body ? (
        <p
          dir="auto"
          className="mt-3 max-w-prose whitespace-pre-wrap text-[15px] leading-[1.65] text-ink-2"
        >
          <MentionText text={question.body} />
        </p>
      ) : null}

      {/* Asker row — hairline above, save/share on the right */}
      <div className="mt-5 flex flex-wrap items-center gap-3 border-t-[0.5px] border-border pt-4">
        <Link to={`/profile/${authorRoute}`} className="shrink-0">
          <UserAvatar user={author} className="size-[34px]" />
        </Link>
        <div className="min-w-0 flex-1 leading-tight">
          <Link
            to={`/profile/${authorRoute}`}
            className="block truncate text-[14px] font-medium text-ink hover:underline"
          >
            {authorName}
          </Link>
          <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] text-ink-3">
            {author.role ? <RoleBadge role={author.role} size="xs" /> : null}
            {authorHandle ? <span>@{authorHandle}</span> : null}
            <span aria-hidden>·</span>
            <span>
              Asked <RelativeTime entity={question} />
              {question.updatedAt && question.updatedAt !== question.createdAt
                ? ' · edited'
                : ''}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button className="rx-bare" type="button" title="Save">
            <Bookmark className="size-[14px]" strokeWidth={1.5} />
            Save
          </button>
          <button className="rx-bare" type="button" title="Share">
            <Share2 className="size-[14px]" strokeWidth={1.5} />
            Share
          </button>
        </div>
      </div>
    </section>
  )
}

// ─── Answer media block ─────────────────────────────────────────────
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
        className="aspect-video w-full rounded-2xl border border-border bg-black object-contain"
      />
    )
  }
  return (
    <a
      href={resolved}
      target="_blank"
      rel="noreferrer"
      className="block overflow-hidden rounded-2xl border border-border bg-muted"
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

// ─── Inline reaction row for answers / reanswers ───────────────────
// Single LIKE (Instagram heart). The backend collapsed the QnaReactionType
// enum to LIKE-only; tap toggles, repeat is idempotent. Optimistic
// updates flow back through `onPatch` so the SSE stream's
// ANSWER_REACTION_ADDED / ANSWER_REACTION_REMOVED echo reconciles.
function AnswerReactionRow({
  questionId,
  answer,
  isAuthenticated,
  onPatch,
  // `compact` kept for compatibility with the call sites — same heart
  // either way.
  // eslint-disable-next-line no-unused-vars
  compact = false,
  trailing = null,
}) {
  const toast = useToast()
  const [working, setWorking] = useState(false)
  const liked = Boolean(answer.myReaction)
  const reactionCount = answer.reactionCount ?? 0

  async function toggle() {
    if (!isAuthenticated) {
      toast.info('Sign in to react.')
      return
    }
    if (working) return
    const previous = {
      myReaction: answer.myReaction,
      reactionCount,
    }
    onPatch?.({
      id: answer.id,
      parentAnswerId: answer.parentAnswerId,
      myReaction: liked ? null : 'LIKE',
      reactionCount: liked
        ? Math.max(0, reactionCount - 1)
        : reactionCount + 1,
    })
    setWorking(true)
    try {
      // Fire the write — don't merge the response body. AnswerResponse
      // echoes a stale reactionCount through Hibernate's L1 cache, so
      // spreading it would clobber our optimistic +1. The
      // ANSWER_REACTION_ADDED / ANSWER_REACTION_REMOVED SSE event
      // arrives a tick later with the authoritative count.
      if (liked) {
        await removeAnswerReaction(questionId, answer.id)
      } else {
        await reactToAnswer(questionId, answer.id, 'LIKE')
      }
    } catch (error) {
      onPatch?.({
        id: answer.id,
        parentAnswerId: answer.parentAnswerId,
        ...previous,
      })
      toast.error(friendlyApiMessage(error, 'Could not react.'))
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="flex w-full flex-wrap items-center gap-1.5">
      <button
        type="button"
        disabled={working}
        onClick={toggle}
        className={cn('rx', liked && 'is-on', 'active:scale-95')}
        title={liked ? 'Unlike' : 'Like'}
        aria-pressed={liked}
        aria-label={liked ? 'Unlike' : 'Like'}
      >
        <Heart
          className="size-[14px]"
          strokeWidth={1.5}
          fill={liked ? 'currentColor' : 'none'}
        />
        {reactionCount > 0 ? (
          <span className="tabular-nums">{formatNumber(reactionCount)}</span>
        ) : (
          <span>Like</span>
        )}
      </button>
      {trailing ? <div className="ml-auto flex items-center">{trailing}</div> : null}
    </div>
  )
}

// ─── Single answer card (collapsible — accepted answers open by default) ─
function AnswerCard({
  questionId,
  answer,
  /** answer.author.id === currentUser.id */
  isAnswerOwner,
  /** answer.authorId === question.authorId — the asker answered their own question */
  isQuestionAuthor,
  /** mirrors backend canManageQuestion: question author OR admin/super-admin */
  canManageQuestion: canManage,
  /** mirrors backend canManageAnswer: answer author OR question author OR admin */
  canManageThisAnswer,
  /** allowedToAnswer — same gate the top-level composer uses */
  allowedToAnswer,
  /** Loaded reanswers + their fetch state, owned by the page */
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
  /** Patch a single answer (top-level OR reply). Used by inline reactions. */
  onAnswerPatch,
  /** Page-level map for nested reanswer children — passed straight
   *  through to ReanswerItem so each row reads from the same source. */
  repliesByAnswer,
  /** Question-level role helpers, needed when judging delete on a reply. */
  user,
  question,
  canManageAnswer: canManageAnswerFn,
  isAuthenticated,
  /** Scholar / admin can vote an answer as "best" (multi-vote model). */
  allowedToVoteBest = false,
}) {
  const author = authorOf(answer)
  const expert = isExpertAnswerer(author.role)
  const links = useMemo(() => parseLinks(answer.links), [answer.links])
  const voiceUrl = resolveMediaUrl(answer.voiceUrl)

  // Vote bookkeeping. Reanswers (replies) can never be "best" — the
  // backend rejects the vote endpoint on them anyway, so the button
  // stays hidden in the reanswer rail below.
  // Per the IRC Scholar spec, we distinguish two signals the backend
  // tracks separately:
  //   * `accepted` (boolean)        → asker accepted this answer
  //   * `bestAnswerVoteCount` (int) → scholar consensus votes
  // The card decorates accordingly: a success-green frame + "Accepted
  // by asker" pill for the former, an amber trophy pill for the latter.
  const bestVoteCount = answer.bestAnswerVoteCount ?? 0
  const isAccepted = Boolean(answer.accepted)
  const isVoted = bestVoteCount > 0
  const isBest = isAccepted || isVoted || Boolean(answer.isBestAnswer)
  const [voteBusy, setVoteBusy] = useState(false)

  // Spec §07 — answers are *always* expanded. The reader sees the full
  // body, sources, reactions, asker feedback, and the entire reply
  // thread at a glance. No accordion, no lazy collapse.
  const expanded = true
  const [showReanswerComposer, setShowReanswerComposer] = useState(false)

  const attachmentCount = answer.attachments?.length ?? 0
  const sourceCount = answer.sources?.length ?? 0
  const replyCount = repliesLoaded
    ? (replies?.length ?? 0)
    : (answer.replyCount ?? 0)

  // Always pull replies the first time we mount with any reply count.
  useEffect(() => {
    if (
      !repliesLoaded
      && !repliesLoading
      && (answer.replyCount ?? 0) > 0
    ) {
      onLoadReplies?.(answer.id)
    }
  }, [repliesLoaded, repliesLoading, answer.id, answer.replyCount, onLoadReplies])

  // First line of the body — used as the collapsed snippet
  const snippet = useMemo(() => {
    const text = (answer.body ?? '').trim()
    if (!text) return ''
    const firstLine = text.split(/\n+/)[0]
    return firstLine.length > 180 ? `${firstLine.slice(0, 180).trimEnd()}…` : firstLine
  }, [answer.body])

  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      className={cn(
        'group/answer relative isolate rounded-xl bg-paper transition-colors',
        // Spec §07: accepted answers get the only 1.5px-border + green
        // ring treatment. Everything else uses the 0.5px hairline.
        isAccepted
          ? 'border-[1.5px] border-ok-fg shadow-[0_0_0_4px_var(--ok-bg)]'
          : 'border-[0.5px] border-border card-hover',
      )}
    >
      {/* Floating green tick for accepted answers — spec ::before mark */}
      {isAccepted ? (
        <span
          aria-hidden
          className="absolute -top-3 left-[18px] grid size-6 place-items-center rounded-full text-white"
          style={{ background: 'var(--ok-fg)' }}
        >
          <CheckCircle2 className="size-3.5" strokeWidth={2} />
        </span>
      ) : null}

      {/* Top status row — accepted / votes / edited time */}
      {(isAccepted || isVoted) ? (
        <div className="flex flex-wrap items-center gap-2 px-6 pt-5">
          {isAccepted ? (
            <span className="inline-flex items-center gap-1 rounded-full pill-success px-2 py-0.5 text-[11px] font-medium leading-none">
              <CheckCircle2 className="size-3" strokeWidth={1.5} />
              Accepted by asker
            </span>
          ) : null}
          {isVoted ? (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium leading-none"
              style={{ background: 'var(--gold-soft)', color: 'var(--gold-2)' }}
              title={`${bestVoteCount} ${bestVoteCount === 1 ? 'scholar has' : 'scholars have'} voted this as best`}
            >
              <Award className="size-3" strokeWidth={1.5} />
              {formatNumber(bestVoteCount)}{' '}
              {bestVoteCount === 1 ? 'scholar vote' : 'scholar votes'}
            </span>
          ) : null}
          <span className="ml-auto font-mono text-[11px] text-ink-3">
            <RelativeTime entity={answer} />
            {answer.edited ? ' · edited' : ''}
          </span>
        </div>
      ) : expert ? (
        <div className="flex items-center gap-2 px-6 pt-5">
          <span className="inline-flex items-center gap-1 rounded-full pill-info px-2 py-0.5 text-[11px] font-medium leading-none">
            <Star className="size-3" strokeWidth={1.5} />
            {author.role === 'SCHOLAR' ? "Scholar's answer" : 'Expert answer'}
          </span>
          <span className="ml-auto font-mono text-[11px] text-ink-3">
            <RelativeTime entity={answer} />
            {answer.edited ? ' · edited' : ''}
          </span>
        </div>
      ) : null}

      {/* ── Header — always visible, click to toggle ─────────── */}
      {/* Author row — flat, always visible, no toggle (spec §07). */}
      <div className="flex w-full items-start gap-3 px-6 pt-4">
        <Link
          to={`/profile/${getRawUsername(author)}`}
          className="shrink-0"
        >
          <UserAvatar user={author} className="size-10" />
        </Link>

        <div className="min-w-0 flex-1 leading-tight">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <Link
              to={`/profile/${getRawUsername(author)}`}
              className="truncate text-[14px] font-medium text-ink hover:underline"
            >
              {getFullName(author) || getHandle(author) || 'Unknown'}
            </Link>
            {/* Account-type chip — Scholar / Researcher / Admin etc.
                rendered at full sm-size so the reader instantly knows
                the answerer's standing on a question they care about. */}
            {author.role ? <RoleBadge role={author.role} size="sm" /> : null}
            {isQuestionAuthor ? (
              <span
                className="inline-flex items-center rounded-full pill-info px-1.5 py-0.5 text-[10px] font-medium leading-none"
                title="The question's author posted this answer"
              >
                Author
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11.5px] text-ink-3">
            {expert ? (
              <span>
                Verified scholar
                {answer.expertSubtitle ? ` · ${answer.expertSubtitle}` : ''}
              </span>
            ) : null}
            {getHandle(author) ? (
              <>
                {expert ? <span aria-hidden>·</span> : null}
                <span className="font-mono text-[10.5px]">
                  @{getHandle(author)}
                </span>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {(canManageThisAnswer || canManage) ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-md text-ink-3 hover:text-ink"
                  aria-label="More"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
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
          ) : null}
        </div>
      </div>

      {/* ── Body — always shown per spec §07 ────────────────── */}
      <div>
        <div className="space-y-4 px-6 pb-5 pt-4">
              {answer.body ? (
                <p
                  dir="auto"
                  className="whitespace-pre-wrap text-[16px] leading-[1.7] text-ink"
                >
                  <MentionText text={answer.body} />
                </p>
              ) : null}

              {/* Legacy media (kept for back-compat) */}
              {answer.mediaUrl ? (
                <AnswerMedia
                  url={answer.mediaUrl}
                  type={answer.mediaType}
                  thumbnailUrl={answer.mediaThumbnailUrl}
                />
              ) : null}

              {/* Legacy voice */}
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

              {/* Links */}
              {links.length > 0 ? (
                <div className="space-y-1.5 rounded-xl border border-border bg-muted/30 p-3">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
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
                          className="inline-flex max-w-full items-center gap-1.5 truncate text-[13px] font-medium text-foreground hover:underline"
                        >
                          <Link2 className="size-3 shrink-0 text-muted-foreground" />
                          <span className="truncate">{url}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {/* Attachments — PDF, Word, ZIP, video, audio, images */}
              <AnswerAttachments
                questionId={questionId}
                answerId={answer.id}
                attachments={answer.attachments ?? []}
                canManage={canManageThisAnswer}
                onChange={(next) => onAttachmentsChange?.(answer.id, next)}
              />

              {/* Sources / references */}
              <AnswerSources
                questionId={questionId}
                answerId={answer.id}
                sources={answer.sources ?? []}
                canManage={canManageThisAnswer}
                onChange={(next) => onSourcesChange?.(answer.id, next)}
              />

              {/* Inline reaction (8-emoji palette) — sits above the
                   feedback panel because reactions are open to anyone
                   while feedback is question-author-only. */}
              <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
                <AnswerReactionRow
                  questionId={questionId}
                  answer={answer}
                  isAuthenticated={isAuthenticated}
                  onPatch={onAnswerPatch}
                />
                {(answer.reactionCount ?? 0) > 0 ? (
                  <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-muted-foreground">
                    <Heart className="size-3.5 fill-current text-rose-600" strokeWidth={1.6} />
                    <span className="tabular-nums">
                      {formatNumber(answer.reactionCount)}
                    </span>
                  </span>
                ) : null}

                {/* Multi-scholar best-answer vote — only for top-level
                    answers, only when the viewer is allowed to vote.
                    Vote count + own-vote affordance live together so a
                    scholar always sees both the consensus and their own
                    contribution at a glance. */}
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
                      'ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition-all duration-200 active:scale-95',
                      answer.votedByMe
                        ? 'bg-[color-mix(in_oklch,var(--gold)_18%,transparent)] text-gold-2 ring-1 ring-[color-mix(in_oklch,var(--gold)_30%,transparent)]'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                    title={
                      answer.votedByMe
                        ? 'Withdraw your "best answer" vote'
                        : 'Mark this answer as best'
                    }
                  >
                    <Award
                      className={cn(
                        'size-3.5',
                        answer.votedByMe ? 'fill-current' : '',
                      )}
                    />
                    <span>
                      {answer.votedByMe ? 'Voted best' : 'Mark as best'}
                    </span>
                    {bestVoteCount > 0 ? (
                      <span className="tabular-nums opacity-80">
                        · {formatNumber(bestVoteCount)}
                      </span>
                    ) : null}
                  </button>
                ) : bestVoteCount > 0 && !answer.parentAnswerId ? (
                  // Non-voters still see the consensus count.
                  <span
                    className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_oklch,var(--gold)_14%,transparent)] px-2.5 py-1 text-[11.5px] font-semibold text-gold-2 ring-1 ring-[color-mix(in_oklch,var(--gold)_25%,transparent)]"
                    title={`${bestVoteCount} ${
                      bestVoteCount === 1 ? 'scholar' : 'scholars'
                    } voted this as best`}
                  >
                    <Award className="size-3.5" />
                    {formatNumber(bestVoteCount)}{' '}
                    {bestVoteCount === 1 ? 'best vote' : 'best votes'}
                  </span>
                ) : null}
              </div>

              {/* Reanswers — always visible reply thread (spec §07). */}
              <div className="border-t-[0.5px] border-border pt-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
                    <span>{formatNumber(replyCount)} {replyCount === 1 ? 'reply' : 'replies'}</span>
                    {repliesLoading ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : null}
                  </div>
                  {allowedToAnswer ? (
                    <button
                      type="button"
                      onClick={() => setShowReanswerComposer((v) => !v)}
                      className={cn('rx-bare', showReanswerComposer && 'is-on')}
                    >
                      <CornerDownRight className="size-3.5" strokeWidth={1.5} />
                      {showReanswerComposer ? 'Cancel' : 'Reply'}
                    </button>
                  ) : null}
                </div>

                {showReanswerComposer ? (
                  <div className="mb-3">
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
                          onDelete={(replyId) =>
                            onReanswerDelete?.(answer.id, replyId)
                          }
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
                  <p className="font-display text-[13px] italic text-ink-3">
                    {showReanswerComposer
                      ? 'Be the first to reply.'
                      : allowedToAnswer
                        ? 'No replies yet — open the conversation.'
                        : 'No replies yet.'}
                  </p>
                ) : null}
              </div>
            </div>
      </div>
    </motion.article>
  )
}

// ─── Reanswer item — threaded discussion tree ──────────────────────────
//
// Each reanswer is laid out as a flat row, NOT a comment bubble:
//
//   ┌── avatar column ──┐  ┌── content column ───────────────────┐
//   │  ●                 │  │  Name @handle · role · 21 min ago   │
//   │  │ thread line     │  │  body text flowing here…            │
//   │  │ (continues       │  │  [media] [voice] [link list]       │
//   │  │  through child)  │  │  👍 React · ↳ Reply · ✦ 3 reactions │
//   └────────────────────┘  └─────────────────────────────────────┘
//
// The avatar column carries a vertical "thread line" that runs through
// the whole sub-tree, so the eye can trace replies up to their parent
// across nested levels — the way GitHub PR comments and Discourse
// threads do, not the way Facebook comment bubbles do.
//
// Nested replies (depth 1) sit inside an indented branch with their
// own thread line + an L-shaped connector at the top tying them to
// the parent's spine. Single-level nesting cap matches the post-
// comments convention.
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
  /** Page-level map of parentId → { items, loaded, loading }. Shared
   *  between top-level reanswers and nested reanswers so SSE patches
   *  flow into the same store regardless of nesting depth. */
  repliesByAnswer,
  /** Lazy loader the page exposes — same one AnswerCard uses. */
  onLoadReplies,
  /** Append a new reanswer (top-level OR nested) to the right bucket. */
  onReanswerCreated,
  /** Remove a nested reanswer from its bucket. */
  onReanswerDelete,
  depth = 0,
  isLast = false,
}) {
  const author = authorOf(reply)
  const expert = isExpertAnswerer(author.role)
  const isOwner = currentUser?.id === reply.authorId
  const isQuestionAuthor =
    reply.authorId != null && reply.authorId === question?.authorId
  const links = parseLinks(reply.links)

  const authorRoute = getRawUsername(author)
  const authorHandle = getHandle(author)
  const authorName = getFullName(author) || authorHandle || 'Unknown'

  const [showReplyBox, setShowReplyBox] = useState(false)
  // Nested replies are *always visible* — no view/hide toggle. Behaviour
  // matches the comment thread spec (1-level nest, flat layout) so a
  // reader sees the whole conversation at a glance, the way community
  // post comments work.

  // Nested children come from the page-level `repliesByAnswer` map.
  // Keeping the data on the page (instead of in component state) means
  // SSE events landing on the page (e.g. another scholar replying to
  // this reanswer) flow through to the rendered list automatically —
  // a viewer who already has the thread expanded sees the new reply
  // appear without having to refetch.
  const nestedBucket = repliesByAnswer?.[reply.id]
  const nested = nestedBucket?.items ?? []
  const nestedLoaded = Boolean(nestedBucket?.loaded)
  const loadingNested = Boolean(nestedBucket?.loading)
  const reportedReplyCount = reply.replyCount ?? 0
  // The backend sometimes omits `replyCount` on individual reanswer
  // payloads, so we can't rely on it to decide whether to fetch the
  // nested thread — doing so leaves the sub-tree invisible until a
  // reaction patch happens to fill the count in. Trust the loaded
  // list once we have it, fall back to the reported count otherwise.
  const effectiveReplyCount = nestedLoaded ? nested.length : reportedReplyCount

  // Auto-fetch the nested thread on mount for every depth-0 reanswer.
  // We don't gate on replyCount: an extra GET that returns an empty
  // list is cheaper than a sub-tree the user can't see until they
  // click a reaction. Once loaded, the effect won't re-fire (the
  // bucket guards both `nestedLoaded` and `loadingNested`).
  useEffect(() => {
    if (!reply?.id) return
    if (depth !== 0) return
    if (nestedLoaded || loadingNested) return
    onLoadReplies?.(reply.id)
  }, [reply?.id, depth, nestedLoaded, loadingNested, onLoadReplies])

  function handleNestedCreated(child) {
    // Delegate to the page so the bucket is the single source of truth
    // and any SSE echo from the same write deduplicates by id.
    onReanswerCreated?.(reply.id, child)
    setShowReplyBox(false)
  }

  function handleNestedDelete(childId) {
    onReanswerDelete?.(reply.id, childId)
  }

  // The vertical thread line in the avatar column extends past the
  // avatar whenever there's anything below this row that should remain
  // tied to the same spine — an inline reply composer, an open nested
  // sub-tree, or another sibling further down the parent's list.
  const hasOpenChildren =
    showReplyBox ||
    nested.length > 0 ||
    (depth === 0 && effectiveReplyCount > 0 && !isLast)
  const showSpine = !isLast || hasOpenChildren

  // Nested replies (depth 1) — render like a Facebook-style comment:
  // tiny avatar + speech bubble holding name + body, with a small React
  // control beneath. Much lighter than the depth-0 tree row; intended
  // for quick scholar-to-scholar back-and-forth rather than a formal
  // "reply note".
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
        {/* Avatar + thread spine. The spine is a 1px column descending
            past the avatar all the way to the bottom of the item, so a
            sub-tree (or a sibling underneath) reads as part of the same
            thread without a heavyweight border on the content card.
            At depth 1 (a nested reply) the spine picks up a brand tint
            so the eye registers the visual handoff from "reply to the
            answer" → "reply to the reply". */}
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
                'ring-2 ring-paper',
                expert && 'ring-[color-mix(in_oklch,var(--accent-sky)_35%,transparent)]',
                isBest(reply) && 'ring-[color-mix(in_oklch,var(--accent-sage)_45%,transparent)]',
              )}
            />
          </Link>
          {showSpine ? (
            <span
              aria-hidden
              className={cn(
                'mt-1 w-px flex-1',
                depth === 0
                  ? 'bg-gradient-to-b from-border via-border to-transparent'
                  : 'bg-gradient-to-b from-brand/30 via-brand/15 to-transparent',
              )}
            />
          ) : null}
        </div>

        {/* Content column */}
        <div className="min-w-0 flex-1 pb-1">
          {/* Header — name + handle + role + author chip + time + more */}
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <Link
              to={`/profile/${authorRoute}`}
              onClick={(event) => event.stopPropagation()}
              className="truncate font-display text-[13.5px] font-semibold tracking-[-0.005em] text-ink hover:underline"
            >
              {authorName}
            </Link>
            {authorHandle &&
            authorHandle.toLowerCase() !== authorName.toLowerCase() ? (
              <span className="truncate font-mono text-[10.5px] text-ink-3">
                @{authorHandle}
              </span>
            ) : null}
            {author.role ? (
              <RoleBadge role={author.role} size="xs" showIcon={false} />
            ) : null}
            {isQuestionAuthor ? (
              <span
                className="inline-flex items-center rounded-full bg-brand/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-brand ring-1 ring-brand/20"
                title="The question's author posted this reanswer"
              >
                Author
              </span>
            ) : null}
            <span aria-hidden className="text-ink-4">·</span>
            <span className="text-[11px] text-muted-foreground">
              <RelativeTime entity={reply} />
              {reply.edited ? ' · edited' : ''}
            </span>
            {(isOwner || canDelete) ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="ml-auto rounded-full p-1 text-ink-3 transition-colors hover:bg-muted hover:text-ink"
                    aria-label="More"
                  >
                    <MoreHorizontal className="size-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
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

          {/* Body — flows directly under the header, no bubble. */}
          {reply.body ? (
            <p
              dir="auto"
              className="mt-1 whitespace-pre-wrap break-words text-[14px] leading-[1.6] text-foreground/95"
            >
              <MentionText text={reply.body} />
            </p>
          ) : null}

          {reply.mediaUrl ? (
            <div className="mt-2 max-w-[460px] overflow-hidden rounded-xl border border-border bg-muted">
              <AnswerMedia
                url={reply.mediaUrl}
                type={reply.mediaType}
                thumbnailUrl={reply.mediaThumbnailUrl}
              />
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
                    className="inline-flex max-w-full items-center gap-1 truncate text-[12px] font-medium text-foreground hover:underline"
                  >
                    <Link2 className="size-3 shrink-0 text-muted-foreground" />
                    <span className="truncate">{url}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : null}

          {/* Action row — react / reply toggle / reaction-summary chip.
              Sits at the bottom of the row, no separator above so the
              cluster reads as part of the body, not a separate strip. */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-muted-foreground">
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
                    ? 'bg-ink text-paper'
                    : 'hover:bg-muted hover:text-foreground',
                )}
              >
                <CornerDownRight className="size-3" />
                {showReplyBox ? 'Cancel' : 'Reply'}
              </button>
            ) : null}

            {(reply.reactionCount ?? 0) > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-paper px-1.5 py-0.5 text-[10.5px]">
                <Heart
                  className="size-3 fill-current text-rose-600"
                  strokeWidth={1.6}
                />
                <span className="tabular-nums text-muted-foreground">
                  {formatNumber(reply.reactionCount)}
                </span>
              </span>
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

          {/* Nested level — always visible (no toggle), recurses with
              depth 1. Loading state surfaces inline while the bucket
              hydrates so the spine still reads as an active thread. */}
          {depth === 0 ? (
            <div className="relative mt-4 space-y-4">
              {loadingNested && nested.length === 0 ? (
                <div className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-3">
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
                    canManageAnswer={
                      canManageAnswer(currentUser, question, child)
                    }
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

// ─── Nested reply item (depth 1) — comment-style ───────────────────
//
// A reply-to-a-reanswer doesn't deserve the full editorial treatment
// of a top-level reanswer. We render it as a tight comment row:
//   ●  Name @handle · 22s ago                                     ⋮
//   │  ┌─ speech bubble ────────────────────────┐
//   │  │ body flowing inside a soft muted bg    │
//   │  └────────────────────────────────────────┘
//   │  👍 Like · 2
//
// Body sits in a rounded bubble (rounded-tl-[6px]) to read as a
// quick comment. Reactions still use the Q&A palette so the count is
// honest and SSE patches keep flowing through `onAnswerPatch`.
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
  /** Allow composing a re-reply — sibling depth-1 nested reply that
   *  posts to the same depth-0 reanswer parent, with an @mention of
   *  this reply's author so the conversation stays threaded. */
  allowedToAnswer = false,
  onReanswerCreated,
}) {
  const author = authorOf(reply)
  const expert = isExpertAnswerer(author.role)
  const isOwner = currentUser?.id === reply.authorId
  const isQuestionAuthor =
    reply.authorId != null && reply.authorId === question?.authorId

  const authorRoute = getRawUsername(author)
  const authorHandle = getHandle(author)
  const authorName = getFullName(author) || authorHandle || 'Unknown'

  const [showReplyBox, setShowReplyBox] = useState(false)
  // Re-reply parent — backend stores parent/child as a flat parentAnswerId
  // chain. We deliberately keep nested replies *flat at depth-1* by posting
  // siblings under the same depth-0 ancestor, mirroring how Twitter / FB
  // flatten beyond a single nest. The ancestor id lives on this reply's
  // own `parentAnswerId`.
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
          className={cn(
            'size-7 ring-2 ring-paper',
            expert && 'ring-[color-mix(in_oklch,var(--accent-sky)_35%,transparent)]',
          )}
        />
      </Link>

      <div className="min-w-0 flex-1">
        {/* Speech bubble */}
        <div className="relative inline-flex max-w-full flex-col">
          <div className="rounded-[18px] rounded-tl-[6px] bg-muted px-3.5 py-2 shadow-sm transition-colors group-hover/nested:bg-muted/80">
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
                  {author.role ? (
                    <RoleBadge role={author.role} size="xs" showIcon={false} />
                  ) : null}
                  {isQuestionAuthor ? (
                    <span
                      className="inline-flex items-center rounded-full bg-brand/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-brand ring-1 ring-brand/20"
                      title="The question's author posted this reply"
                    >
                      Author
                    </span>
                  ) : null}
                </span>
                {authorHandle &&
                authorHandle.toLowerCase() !== authorName.toLowerCase() ? (
                  <span className="block truncate font-mono text-[10px] text-ink-3">
                    @{authorHandle}
                  </span>
                ) : null}
              </Link>

              {(isOwner || canDelete) ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="-mr-1 -mt-1 rounded-full p-1 text-ink-3 transition-colors hover:bg-secondary hover:text-ink"
                      aria-label="More"
                    >
                      <MoreHorizontal className="size-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
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
                className="mt-0.5 whitespace-pre-wrap break-words text-[13.5px] leading-[1.55] text-foreground/95"
              >
                <MentionText text={reply.body} />
              </p>
            ) : null}

            {reply.mediaUrl ? (
              <div className="mt-2 max-w-[400px] overflow-hidden rounded-xl border border-border bg-muted">
                <AnswerMedia
                  url={reply.mediaUrl}
                  type={reply.mediaType}
                  thumbnailUrl={reply.mediaThumbnailUrl}
                />
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

          {/* Floating reaction-summary chip pinned to bottom-right of
              the bubble — the conventional comment treatment. */}
          <AnimatePresence>
            {(reply.reactionCount ?? 0) > 0 ? (
              <motion.span
                key={`nested-reaction-${reply.reactionCount}`}
                initial={{ opacity: 0, scale: 0.5, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ type: 'spring', stiffness: 460, damping: 22 }}
                className="absolute -bottom-2 right-2 inline-flex items-center gap-0.5 rounded-full border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium shadow-sm"
              >
                <Heart
                  className="size-3 fill-current text-rose-600"
                  strokeWidth={1.6}
                />
                <span className="tabular-nums text-muted-foreground">
                  {formatNumber(reply.reactionCount)}
                </span>
              </motion.span>
            ) : null}
          </AnimatePresence>
        </div>

        {/* Action row — React picker + Reply (flat re-reply). Time
            sits inline so the row stays compact. */}
        <div className="mt-2 flex flex-wrap items-center gap-3 pl-3 text-[11px] font-medium text-muted-foreground">
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
                  ? 'bg-ink text-paper'
                  : 'hover:bg-muted hover:text-foreground',
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
          <div className="mt-2.5 pl-3">
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

// "Best" if the answer is accepted or has at least one scholar vote.
// Mirrors the AnswerCard derivation so a sealed reanswer can pick up
// the same emerald avatar ring.
function isBest(answer) {
  return (
    Boolean(answer?.isBestAnswer) ||
    Boolean(answer?.accepted) ||
    (answer?.bestAnswerVoteCount ?? 0) > 0
  )
}

// ─── Owner toolbar (lock / limit) ───────────────────────────────────
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
        className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground disabled:opacity-50"
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
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5">
          <Hash className="size-3 text-muted-foreground" />
          <input
            value={draftLimit}
            onChange={(event) =>
              setDraftLimit(event.target.value.replace(/[^\d]/g, ''))
            }
            inputMode="numeric"
            placeholder="∞"
            className="w-12 bg-transparent text-[11px] font-mono tabular-nums outline-none"
            autoFocus
          />
          <button
            type="button"
            className="rounded-full px-1.5 text-[10px] font-semibold uppercase tracking-wider text-brand hover:underline"
            onClick={commitLimit}
            disabled={working}
          >
            Save
          </button>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
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
          className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground disabled:opacity-50"
        >
          <Hash className="size-3" />
          {question.maxAnswers != null
            ? `Limit ${question.maxAnswers}`
            : 'Set limit'}
        </button>
      )}
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────────────
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
  // Replies state, keyed by parent answer id. Each entry: { items, loaded, loading }.
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
      // 404 is the universal "not visible to you" signal — either the
      // question was deleted OR the viewer is in a block edge with the
      // author. Don't toast in that case; the EmptyState below already
      // explains it. Other errors still surface.
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

  // ── Realtime ─────────────────────────────────────────────────
  // Subscribe to /api/v1/questions/{id}/stream. Every QnA write the
  // backend broadcasts (answer create/edit/delete, accept toggle,
  // reaction add/change/remove, feedback add/edit/delete, question
  // edit/delete/lock) flows in here and is patched into local state
  // without a refetch. Helper closures use functional state updates
  // so handlers can stay closure-free over `answers`/`question`.
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
    const patch = { id, reactionCount: payload.reactionCount }
    if (payload.parentAnswerId) patch.parentAnswerId = payload.parentAnswerId
    applyAnswerPatch(patch)
  }

  // Declared above the SSE subscription so the closures inside
  // `useQuestionStream` (BEST_ANSWER_VOTED, REANSWER_CREATED, etc.)
  // can reference these helpers without tripping the TDZ rule. Both
  // are useCallbacks so the SSE handlers don't re-register on every
  // render.
  // Routed through a ref so the recursive pre-load can call back into
  // `handleLoadReplies` without taking a self-reference at declaration
  // time (the lint rule rightly flags that as a TDZ hazard).
  const handleLoadRepliesRef = useRef(null)
  const handleLoadReplies = useCallback(
    // `recursive` is internal — when we expand the top-level batch
    // for an answer, we kick off pre-loads for every reanswer that
    // already has `replyCount > 0` so the entire visible tree paints
    // on first render. The inner pre-load fires with `recursive=false`
    // to keep the cap at one level and avoid a fetch storm.
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
        // Pre-warm one level of nested children so the user sees the
        // whole sub-tree without having to react / scroll / click.
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

  // Walk both top-level answers AND every nested-reply bucket to bump
  // `replyCount` on a parent — works whether the parent is a top-level
  // answer or a deeply-nested reanswer.
  const bumpAnswerReplyCount = useCallback((parentId, delta) => {
    if (!parentId || !delta) return
    setAnswers((current) =>
      current.map((item) =>
        item.id === parentId
          ? {
              ...item,
              replyCount: Math.max(0, (item.replyCount ?? 0) + delta),
            }
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
      setQuestion((current) =>
        current ? { ...current, answersLocked: true } : current,
      )
    },
    QUESTION_UNLOCKED: () => {
      setQuestion((current) =>
        current ? { ...current, answersLocked: false } : current,
      )
    },
    QUESTION_DELETED: () => {
      toast.info('This question was removed by its author.')
      navigate('/questions', { replace: true })
    },
    // Live view counter — Backend dedupes per-viewer for 1 h via
    // Redis SET NX EX, then bumps `viewCount` and broadcasts the
    // fresh value here. Mirrors post / research view streams.
    VIEW_COUNT_UPDATED: (payload) => {
      const next = payload?.questionViewCount ?? payload?.viewCount
      if (next == null) return
      setQuestion((current) =>
        current ? { ...current, viewCount: next } : current,
      )
    },
    ANSWER_CREATED: (payload) => {
      if (!payload?.id) return
      setAnswers((current) =>
        current.some((item) => item.id === payload.id)
          ? current.map((item) =>
              item.id === payload.id ? { ...item, ...payload } : item,
            )
          : [...current, payload],
      )
      setQuestion((current) =>
        current
          ? {
              ...current,
              answerCount: (current.answerCount ?? 0) + 1,
              status: current.status === 'OPEN' ? 'ANSWERED' : current.status,
            }
          : current,
      )
    },
    REANSWER_CREATED: (payload) => {
      if (!payload?.id || !payload.parentAnswerId) return
      // Track whether this reply is genuinely new from our perspective.
      // The local optimistic path (`handleReanswerCreated`) may have
      // already appended it; in that case the SSE echo is a no-op.
      let countsAsNew = false
      let bucketMissing = false
      setRepliesByAnswer((current) => {
        const bucket = current[payload.parentAnswerId]
        if (!bucket) {
          // Bucket not seeded yet — viewer hasn't expanded the parent.
          // Still treat the reply as new so the "Show N replies" CTA
          // bumps; we'll trigger a fetch right after so the row shows
          // up without the user having to click anything.
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
      // Bump the parent's replyCount whether the parent is a top-level
      // answer OR a nested reanswer — the helper walks both stores.
      if (countsAsNew) bumpAnswerReplyCount(payload.parentAnswerId, +1)
      // Proactively fetch the freshly-grown sub-thread when the parent
      // is one we already render but whose children we hadn't fetched
      // yet. This is what makes a deeply-nested reply (e.g. project
      // replying to akar's reply on akar's tab) appear instantly: we
      // don't rely on a re-render to trigger the auto-load effect — we
      // call the loader directly the moment the SSE event lands.
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
          return {
            ...current,
            [parentId]: { ...bucket, items: next },
          }
        })
        // Walk both top-level + nested stores (a reanswer can have
        // sub-replies whose parent isn't in `answers`).
        if (removed) bumpAnswerReplyCount(parentId, -1)
        // Also drop any sub-tree the deleted reanswer owned.
        setRepliesByAnswer((current) => {
          if (!current[id]) return current
          const next = { ...current }
          delete next[id]
          return next
        })
        return
      }
      setAnswers((current) => current.filter((item) => item.id !== id))
      setQuestion((current) =>
        current
          ? {
              ...current,
              answerCount: Math.max(0, (current.answerCount ?? 0) - 1),
            }
          : current,
      )
    },
    ANSWER_ACCEPTED: (payload) => {
      if (!payload?.id) return
      applyAnswerPatch({ ...payload, accepted: true })
      setQuestion((current) =>
        current ? { ...current, status: 'ANSWERED' } : current,
      )
    },
    ANSWER_UNACCEPTED: (payload) => {
      if (!payload?.id) return
      applyAnswerPatch({ ...payload, accepted: false })
    },
    ANSWER_REACTION_ADDED: patchAnswerReactionFromEvent,
    ANSWER_REACTION_REMOVED: patchAnswerReactionFromEvent,
    ANSWER_FEEDBACK_ADDED: (payload) => {
      const id = payload?.answerId ?? payload?.id
      if (!id) return
      applyAnswerPatch({
        id,
        feedbackCount: payload?.feedbackCount,
      })
    },
    ANSWER_FEEDBACK_EDITED: (payload) => {
      // Count is unchanged on edit — surface for any panel that's open
      // via a no-op patch so the UI can re-render the feedback list lazily.
      const id = payload?.answerId ?? payload?.id
      if (!id) return
      applyAnswerPatch({ id })
    },
    ANSWER_FEEDBACK_DELETED: (payload) => {
      const id = payload?.answerId ?? payload?.id
      if (!id) return
      applyAnswerPatch({
        id,
        feedbackCount: payload?.feedbackCount,
      })
    },
    // Multi-scholar best-answer voting. Payload includes the canonical
    // `bestAnswerVoteCount` so we always reconcile with server truth.
    // `voterId` lets us flip `votedByMe` precisely when the voter is us
    // (covers cross-tab and cross-device cases).
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
        // Banner stays only if the answer is still considered "best" —
        // either via legacy accept (handled by the patch already on the
        // entity) or because at least one scholar still has a vote on it.
        isBestAnswer: nextCount > 0 ? true : undefined,
        ...(isMe ? { votedByMe: false } : {}),
      })
    },
  })

  // Question-level rights — mirrors QuestionServiceImpl#canManageQuestion:
  // question author OR admin/super-admin. Admins inherit every owner
  // affordance (lock, limit, accept, give feedback, edit, delete).
  const canManage = canManageQuestion(user, question)
  // Scholars and Researchers can answer and reanswer. Marking an
  // answer as "best" is the question author's editorial decision —
  // nobody else (even admins) gets to override it.
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
    // Edit can land on either a top-level answer or a reanswer. Patch the
    // matching one in whichever list owns it.
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
      current.map((item) =>
        item.id === updated.id ? { ...item, ...updated } : item,
      ),
    )
  }

  function handleReanswerCreated(parentId, reply) {
    let inserted = false
    setRepliesByAnswer((current) => {
      const bucket = current[parentId]
      const previousItems = Array.isArray(bucket?.items) ? bucket.items : []
      // Dedupe: an SSE echo of the same write — or a stale optimistic
      // path — must not double the row.
      if (previousItems.some((item) => item.id === reply.id)) return current
      inserted = true
      return {
        ...current,
        [parentId]: {
          items: [...previousItems, reply],
          loaded: true,
          loading: false,
        },
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
        return {
          ...current,
          [parentId]: { ...bucket, items: next },
        }
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
      // The backend allows multiple "best" answers — accepting one
      // does NOT auto-unaccept others, so we only patch the one row.
      const updated = await acceptAnswer(questionId, answerId)
      setAnswers((current) =>
        current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
      )
      setQuestion((current) =>
        current ? { ...current, status: 'ANSWERED' } : current,
      )
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
        current.map((item) =>
          item.id === updated.id ? { ...item, ...updated } : item,
        ),
      )
      toast.success('Removed from best answers.')
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not unaccept answer.'))
    } finally {
      setWorking(false)
    }
  }

  // ── Multi-scholar best-answer voting ───────────────────────────
  // Optimistic flip: bump/decrement the local count + flip `votedByMe`
  // immediately. The SSE stream's BEST_ANSWER_VOTED / BEST_ANSWER_UNVOTED
  // event will land seconds later with the canonical count and reconcile
  // any races with other scholars voting at the same time.
  async function handleVoteBest(answerId) {
    const previous = answers
    setAnswers((current) =>
      current.map((item) =>
        item.id === answerId
          ? {
              ...item,
              votedByMe: true,
              bestAnswerVoteCount: (item.bestAnswerVoteCount ?? 0) + 1,
              isBestAnswer: true,
            }
          : item,
      ),
    )
    try {
      const updated = await voteBestAnswer(questionId, answerId)
      if (updated?.id) {
        applyAnswerPatch({ ...updated, votedByMe: true })
      }
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
        return {
          ...item,
          votedByMe: false,
          bestAnswerVoteCount: nextCount,
          // The "best answer" flag is set by either an old-style accept
          // OR a non-zero vote count, so honour the accepted flag here.
          isBestAnswer: Boolean(item.accepted) || nextCount > 0,
        }
      }),
    )
    try {
      const updated = await unvoteBestAnswer(questionId, answerId)
      if (updated?.id) {
        applyAnswerPatch({ ...updated, votedByMe: false })
      }
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
        current
          ? {
              ...current,
              answerCount: Math.max(0, (current.answerCount ?? 0) - 1),
            }
          : current,
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

  async function handleToggleLock() {
    if (!question) return
    setWorking(true)
    try {
      const updated = question.answersLocked
        ? await unlockAnswers(questionId)
        : await lockAnswers(questionId)
      setQuestion((current) => ({ ...current, ...updated }))
      toast.success(
        updated.answersLocked ? 'Answers locked.' : 'Answers unlocked.',
      )
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
      current.map((item) =>
        item.id === answerId ? { ...item, attachments: next } : item,
      ),
    )
  }

  function handleSourcesChange(answerId, next) {
    setAnswers((current) =>
      current.map((item) =>
        item.id === answerId ? { ...item, sources: next } : item,
      ),
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-72 w-full rounded-3xl" />
        <Skeleton className="h-44 w-full rounded-3xl" />
        <Skeleton className="h-44 w-full rounded-3xl" />
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
      {/* Slim top bar — back link + manage actions */}
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/questions"
          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          All questions
        </Link>

        {canManage ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setEditQuestionOpen(true)}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Pencil className="size-3.5" />
              Edit
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="More"
                  aria-label="More"
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
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

      {/* Editorial header — no card, tight rhythm */}
      <QuestionHeader question={question} />

      {/* Inline owner controls (lock / limit) — only for author/admin */}
      {canManage ? (
        <OwnerControls
          question={question}
          working={working}
          onToggleLock={handleToggleLock}
          onSetLimit={handleSetLimit}
        />
      ) : null}

      {/* Subtle divider — separates header from answers */}
      <span aria-hidden className="block h-px w-full bg-border" />

      {/* Answers section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-muted-foreground" />
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Answers
          </h2>
          <span className="text-[11px] text-muted-foreground">
            · {formatNumber(question.answerCount ?? sortedAnswers.length)}
          </span>
          {question.maxAnswers != null ? (
            <span className="text-[11px] text-muted-foreground">
              / {question.maxAnswers}
            </span>
          ) : null}
          {sortedAnswers.some((a) => a.accepted) ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_oklch,var(--accent-sage)_14%,transparent)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-sage">
              <CheckCircle2 className="size-3" />
              {formatNumber(sortedAnswers.filter((a) => a.accepted).length)} accepted
            </span>
          ) : null}
          <span className="ml-2 h-px flex-1 bg-border" aria-hidden />
        </div>

        {/* Composer */}
        {!isAuthenticated ? (
          <Card className="border">
            <CardContent className="p-5 text-sm text-muted-foreground">
              <Link
                to="/login"
                className="font-medium text-primary hover:underline"
              >
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
          <Card className="border border-dashed">
            <CardContent className="p-5 text-sm text-muted-foreground">
              Posting answers in the Q&A area is reserved for{' '}
              <span className="font-medium text-foreground">scholars</span> and{' '}
              <span className="font-medium text-foreground">researchers</span>.
              You can still read every answer below.
            </CardContent>
          </Card>
        )}

        {/* List */}
        {answersLoading ? (
          <div className="flex justify-center py-6 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
          </div>
        ) : sortedAnswers.length === 0 ? (
          <EmptyState
            icon={MessageCircleQuestion}
            title="No answers yet"
            description="Be the first to share a thoughtful answer."
          />
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
                      answer.authorId != null &&
                      answer.authorId === question.authorId
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
          onUpdated={(updated) =>
            setQuestion((current) => ({ ...current, ...updated }))
          }
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

