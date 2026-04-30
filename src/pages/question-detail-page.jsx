import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  ChevronDown,
  CornerDownRight,
  Hash,
  Library,
  Link2,
  Loader2,
  Lock,
  MessageCircleQuestion,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Reply,
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
import { AnswerFeedbackPanel } from '@/components/app/answer-feedback-panel'
import { AnswerSources } from '@/components/app/answer-sources'
import { AudioPlayer } from '@/components/app/audio-player'
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
  unacceptAnswer,
  unlockAnswers,
} from '@/features/qna/qna.api'
import { useAuth } from '@/features/auth/auth-context'
import { useToast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import { extractApiMessage } from '@/lib/api-error'
import {
  displayTime,
  formatNumber,
  getFullName,
  resolveMediaUrl,
} from '@/lib/format'
import {
  canManageAnswer,
  canManageQuestion,
  canUseQna,
  isExpertAnswerer,
} from '@/lib/roles'

const STATUS_META = {
  OPEN: {
    label: 'Open',
    className:
      'bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-300',
  },
  ANSWERED: {
    label: 'Answered',
    className:
      'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300',
  },
  CLOSED: {
    label: 'Closed',
    className:
      'bg-zinc-500/10 text-zinc-700 ring-zinc-500/20 dark:text-zinc-300',
  },
  ARCHIVED: {
    label: 'Archived',
    className:
      'bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-300',
  },
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
  return [...list].sort((a, b) => {
    if (a.accepted && !b.accepted) return -1
    if (!a.accepted && b.accepted) return 1
    const fb = (b.feedbackCount ?? 0) - (a.feedbackCount ?? 0)
    if (fb !== 0) return fb
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })
}

// ─── Question header — tight editorial design (no card) ───────────
function QuestionHeader({ question }) {
  const author = authorOf(question)
  const status = STATUS_META[question.status] ?? STATUS_META.OPEN
  const expert = isExpertAnswerer(author.role)

  return (
    <section className="space-y-4">
      {/* Eyebrow row — status + meta inline, no chips spread */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-muted-foreground">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ring-1',
            status.className,
          )}
        >
          {question.status === 'ANSWERED' ? (
            <CheckCircle2 className="size-3" />
          ) : (
            <span className="size-1.5 rounded-full bg-current" />
          )}
          {status.label}
        </span>
        {question.answersLocked ? (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Lock className="size-3" />
            Locked
          </span>
        ) : null}
        {question.maxAnswers != null ? (
          <span className="inline-flex items-center gap-1 font-mono tabular-nums">
            <Hash className="size-3" />
            {formatNumber(question.answerCount ?? 0)}/{question.maxAnswers}
          </span>
        ) : null}
      </div>

      {/* Title — Fraunces, large but tight */}
      <h1 className="font-display text-[32px] leading-[1.05] tracking-[-0.018em] text-foreground sm:text-[40px]">
        {question.title}
      </h1>

      {/* Author + body in one compact section */}
      <div className="flex items-center gap-2.5 text-[13px]">
        <Link to={`/profile/${author.username ?? ''}`} className="shrink-0">
          <UserAvatar
            user={author}
            className={cn(
              'size-7 ring-2 ring-background',
              expert && 'ring-amber-400/40',
            )}
          />
        </Link>
        <Link
          to={`/profile/${author.username ?? ''}`}
          className="font-medium hover:underline"
        >
          {getFullName(author) || author.username}
        </Link>
        {author.role ? <RoleBadge role={author.role} size="xs" /> : null}
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">
          {displayTime(question)}
          {question.updatedAt && question.updatedAt !== question.createdAt
            ? ` · edited`
            : ''}
        </span>
      </div>

      {question.body ? (
        <p className="max-w-prose whitespace-pre-wrap text-[15.5px] leading-[1.7] text-foreground/90">
          {question.body}
        </p>
      ) : null}
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
  onFeedbackCountChange,
  onAttachmentsChange,
  onSourcesChange,
  onLoadReplies,
  onReanswerCreated,
  onReanswerDelete,
  /** Question-level role helpers, needed when judging delete on a reply. */
  user,
  question,
  canManageAnswer: canManageAnswerFn,
}) {
  const author = authorOf(answer)
  const expert = isExpertAnswerer(author.role)
  const links = useMemo(() => parseLinks(answer.links), [answer.links])
  const voiceUrl = resolveMediaUrl(answer.voiceUrl)

  // Accepted ("best") answers — and the lone answer expert highlight — open
  // by default. Everything else collapses to a one-line summary the reader
  // can expand with a click.
  const [expanded, setExpanded] = useState(Boolean(answer.accepted))
  const [showReanswerComposer, setShowReanswerComposer] = useState(false)

  const attachmentCount = answer.attachments?.length ?? 0
  const sourceCount = answer.sources?.length ?? 0
  const feedbackCount = answer.feedbackCount ?? 0
  const replyCount = repliesLoaded
    ? (replies?.length ?? 0)
    : (answer.replyCount ?? 0)

  // Lazy-load reanswers on first expand if there are any to fetch.
  useEffect(() => {
    if (
      expanded
      && !repliesLoaded
      && !repliesLoading
      && (answer.replyCount ?? 0) > 0
    ) {
      onLoadReplies?.(answer.id)
    }
  }, [expanded, repliesLoaded, repliesLoading, answer.id, answer.replyCount, onLoadReplies])

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
        'group/answer relative isolate overflow-hidden rounded-2xl border bg-card transition-all',
        answer.accepted
          ? 'border-emerald-500/30 shadow-soft'
          : 'border-border hover:border-foreground/15 hover:shadow-soft',
      )}
    >
      {answer.accepted ? (
        <div className="flex items-center gap-2 border-b border-emerald-500/20 bg-emerald-500/5 px-5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
          <Award className="size-3.5" />
          Best answer
        </div>
      ) : expert ? (
        <div className="flex items-center gap-2 border-b border-amber-500/20 bg-amber-500/5 px-5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
          <Star className="size-3.5" />
          {author.role === 'SCHOLAR' ? "Scholar's answer" : 'Expert answer'}
        </div>
      ) : null}

      {/* ── Header — always visible, click to toggle ─────────── */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls={`answer-body-${answer.id}`}
        className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/40 sm:px-5"
      >
        <Link
          to={`/profile/${author.username ?? ''}`}
          onClick={(event) => event.stopPropagation()}
          className="shrink-0"
        >
          <UserAvatar
            user={author}
            className={cn(
              'size-10 ring-2 ring-background',
              expert && 'ring-amber-400/40',
            )}
          />
        </Link>

        <div className="min-w-0 flex-1 leading-tight">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <Link
              to={`/profile/${author.username ?? ''}`}
              onClick={(event) => event.stopPropagation()}
              className="truncate text-[14px] font-semibold hover:underline"
            >
              {getFullName(author) || author.username}
            </Link>
            {author.role ? <RoleBadge role={author.role} size="xs" /> : null}
            {isQuestionAuthor ? (
              <span
                className="inline-flex items-center rounded-full bg-brand/10 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-brand ring-1 ring-brand/20"
                title="The question's author posted this answer"
              >
                Author
              </span>
            ) : null}
            <span className="text-xs text-muted-foreground">
              · {displayTime(answer)}
              {answer.edited ? ' · edited' : ''}
            </span>
          </div>

          {/* Collapsed snippet + chips. Hidden when expanded. */}
          {!expanded && snippet ? (
            <p className="mt-1 line-clamp-1 text-[13.5px] text-muted-foreground">
              {snippet}
            </p>
          ) : null}

          {!expanded ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
              {attachmentCount > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <Paperclip className="size-3" />
                  {formatNumber(attachmentCount)} {attachmentCount === 1 ? 'file' : 'files'}
                </span>
              ) : null}
              {sourceCount > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <Library className="size-3" />
                  {formatNumber(sourceCount)} {sourceCount === 1 ? 'source' : 'sources'}
                </span>
              ) : null}
              {feedbackCount > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <MessageSquare className="size-3" />
                  {formatNumber(feedbackCount)} {feedbackCount === 1 ? 'feedback' : 'feedbacks'}
                </span>
              ) : null}
              {replyCount > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <Reply className="size-3" />
                  {formatNumber(replyCount)}{' '}
                  {replyCount === 1 ? 'reanswer' : 'reanswers'}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div
          className="flex shrink-0 items-center gap-1"
          onClick={(event) => event.stopPropagation()}
        >
          {(canManageThisAnswer || canManage) ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-full text-muted-foreground opacity-60 transition-opacity hover:opacity-100 group-hover/answer:opacity-100"
                  aria-label="More"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {canManage ? (
                  answer.accepted ? (
                    <DropdownMenuItem onSelect={() => onUnaccept(answer.id)}>
                      <Award className="mr-2 size-4" />
                      Remove from best
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onSelect={() => onAccept(answer.id)}>
                      <Award className="mr-2 size-4" />
                      Mark as best
                    </DropdownMenuItem>
                  )
                ) : null}
                {/* Edit body: backend allows answer author OR question
                    owner OR admin (canManageAnswer). The dropdown only
                    surfaces Edit for the answer's author since the body
                    is the author's voice — admins/owners get Delete only. */}
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

          {/* Chevron — rotates when expanded */}
          <span
            aria-hidden
            className={cn(
              'inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-transform duration-200',
              expanded && 'rotate-180',
            )}
          >
            <ChevronDown className="size-4" />
          </span>
        </div>
      </button>

      {/* ── Expandable body ──────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            id={`answer-body-${answer.id}`}
            key="body"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 30 }}
            className="overflow-hidden"
          >
            <div className="space-y-4 border-t border-border px-4 py-5 sm:px-5">
              {answer.body ? (
                <p className="whitespace-pre-wrap text-[15px] leading-[1.7] text-foreground/95">
                  {answer.body}
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

              {/* Feedback */}
              <div className="border-t border-border pt-3">
                <AnswerFeedbackPanel
                  questionId={questionId}
                  answerId={answer.id}
                  initialCount={answer.feedbackCount ?? 0}
                  canGiveFeedback={canManage}
                  onCountChange={(next) => onFeedbackCountChange?.(answer.id, next)}
                />
              </div>

              {/* Reanswers — scholar-to-scholar threaded discussion */}
              <div className="border-t border-border pt-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Reply className="size-3.5 text-muted-foreground" />
                    <h4 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Reanswers
                    </h4>
                    {replyCount > 0 ? (
                      <span className="text-[11px] text-muted-foreground">
                        · {formatNumber(replyCount)}
                      </span>
                    ) : null}
                    {repliesLoading ? (
                      <Loader2 className="size-3 animate-spin text-muted-foreground" />
                    ) : null}
                  </div>
                  {allowedToAnswer ? (
                    <button
                      type="button"
                      onClick={() => setShowReanswerComposer((v) => !v)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                        showReanswerComposer && 'bg-muted text-foreground',
                      )}
                    >
                      <CornerDownRight className="size-3.5" />
                      {showReanswerComposer ? 'Cancel' : 'Reanswer'}
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
                  <ul className="space-y-2 border-l-2 border-border pl-3">
                    {replies.map((reply) => (
                      <ReplyItem
                        key={reply.id}
                        question={question}
                        reply={reply}
                        currentUser={user}
                        canManageAnswer={canManageAnswerFn?.(user, question, reply) ?? false}
                        onEdit={onEdit}
                        onDelete={(replyId) => onReanswerDelete?.(answer.id, replyId)}
                      />
                    ))}
                  </ul>
                ) : repliesLoaded && !repliesLoading ? (
                  <p className="text-[12px] text-muted-foreground">
                    {showReanswerComposer
                      ? 'Be the first to reanswer.'
                      : allowedToAnswer
                        ? 'No reanswers yet — start the conversation.'
                        : 'No reanswers yet.'}
                  </p>
                ) : !repliesLoaded && (answer.replyCount ?? 0) > 0 ? (
                  <button
                    type="button"
                    onClick={() => onLoadReplies?.(answer.id)}
                    className="text-[12px] font-medium text-muted-foreground hover:text-foreground hover:underline"
                  >
                    Show {formatNumber(answer.replyCount)}{' '}
                    {(answer.replyCount ?? 0) === 1 ? 'reanswer' : 'reanswers'}
                  </button>
                ) : null}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.article>
  )
}

// ─── Reanswer row — compact, indented, scholar-to-scholar discussion ───
function ReplyItem({
  question,
  reply,
  currentUser,
  canManageAnswer: canDelete,
  onEdit,
  onDelete,
}) {
  const author = authorOf(reply)
  const expert = isExpertAnswerer(author.role)
  const isOwner = currentUser?.id === reply.authorId
  const isQuestionAuthor =
    reply.authorId != null && reply.authorId === question?.authorId
  const links = parseLinks(reply.links)

  return (
    <li className="rounded-lg bg-muted/20 px-3 py-2.5">
      <div className="flex items-start gap-2.5">
        <Link
          to={`/profile/${author.username ?? ''}`}
          className="shrink-0"
          onClick={(event) => event.stopPropagation()}
        >
          <UserAvatar
            user={author}
            className={cn(
              'size-7 ring-2 ring-background',
              expert && 'ring-amber-400/40',
            )}
          />
        </Link>

        <div className="min-w-0 flex-1 leading-tight">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <Link
              to={`/profile/${author.username ?? ''}`}
              onClick={(event) => event.stopPropagation()}
              className="truncate text-[13px] font-semibold hover:underline"
            >
              {getFullName(author) || author.username}
            </Link>
            {author.role ? <RoleBadge role={author.role} size="xs" /> : null}
            {isQuestionAuthor ? (
              <span
                className="inline-flex items-center rounded-full bg-brand/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-brand ring-1 ring-brand/20"
                title="The question's author posted this reanswer"
              >
                Author
              </span>
            ) : null}
            <span className="text-[11px] text-muted-foreground">
              · {displayTime(reply)}
              {reply.edited ? ' · edited' : ''}
            </span>
          </div>

          <p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-[1.65] text-foreground/95">
            {reply.body}
          </p>

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
        </div>

        {(isOwner || canDelete) ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="rounded-full text-muted-foreground opacity-60 transition-opacity hover:opacity-100"
                aria-label="More"
              >
                <MoreHorizontal className="size-4" />
              </Button>
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
    </li>
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
      toast.error(extractApiMessage(error, 'Could not load question.'))
      setQuestion(null)
    } finally {
      setLoading(false)
      setAnswersLoading(false)
    }
  }, [questionId, toast])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  // Question-level rights — mirrors QuestionServiceImpl#canManageQuestion:
  // question author OR admin/super-admin. Admins inherit every owner
  // affordance (lock, limit, accept, give feedback, edit, delete).
  const canManage = canManageQuestion(user, question)
  const allowedToAnswer = canUseQna(user)

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

  const handleLoadReplies = useCallback(
    async (answerId) => {
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
        setRepliesByAnswer((current) => ({
          ...current,
          [answerId]: { items: items ?? [], loaded: true, loading: false },
        }))
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

  function handleReanswerCreated(parentId, reply) {
    setRepliesByAnswer((current) => {
      const bucket = current[parentId]
      const items = bucket?.loaded
        ? [...bucket.items, reply]
        : bucket?.items
          ? [...bucket.items, reply]
          : [reply]
      return {
        ...current,
        [parentId]: { items, loaded: true, loading: false },
      }
    })
    setAnswers((current) =>
      current.map((item) =>
        item.id === parentId
          ? { ...item, replyCount: (item.replyCount ?? 0) + 1 }
          : item,
      ),
    )
  }

  async function handleReanswerDelete(parentId, replyId) {
    if (!confirm('Delete this reanswer?')) return
    try {
      await deleteAnswer(questionId, replyId)
      setRepliesByAnswer((current) => {
        const bucket = current[parentId]
        if (!bucket) return current
        return {
          ...current,
          [parentId]: {
            ...bucket,
            items: bucket.items.filter((item) => item.id !== replyId),
          },
        }
      })
      setAnswers((current) =>
        current.map((item) =>
          item.id === parentId
            ? { ...item, replyCount: Math.max(0, (item.replyCount ?? 0) - 1) }
            : item,
        ),
      )
      toast.success('Reanswer deleted.')
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not delete reanswer.'))
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

  function handleFeedbackCountChange(answerId, next) {
    setAnswers((current) =>
      current.map((item) =>
        item.id === answerId ? { ...item, feedbackCount: next } : item,
      ),
    )
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
        title="Question not found"
        description="It may have been removed by the author or a moderator."
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
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              <Award className="size-3" />
              {formatNumber(sortedAnswers.filter((a) => a.accepted).length)} best
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
              Posting answers and giving feedback in the Q&A area is reserved
              for <span className="font-medium text-foreground">scholars</span>.
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
                    onFeedbackCountChange={handleFeedbackCountChange}
                    onAttachmentsChange={handleAttachmentsChange}
                    onSourcesChange={handleSourcesChange}
                    onLoadReplies={handleLoadReplies}
                    onReanswerCreated={handleReanswerCreated}
                    onReanswerDelete={handleReanswerDelete}
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

