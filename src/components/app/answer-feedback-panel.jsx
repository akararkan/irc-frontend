import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  ChevronDown,
  Loader2,
  Pencil,
  Send,
  ThumbsUp,
  Trash2,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { UserAvatar } from '@/components/app/user-avatar'
import {
  addAnswerFeedback,
  deleteAnswerFeedback,
  editAnswerFeedback,
  getAnswerFeedback,
} from '@/features/qna/qna.api'
import { useAuth } from '@/features/auth/auth-context'
import { useToast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import { extractApiMessage } from '@/lib/api-error'
import {
  formatNumber,
  formatRelativeTime,
  getFullName,
} from '@/lib/format'

// ─── Reaction taxonomy ──────────────────────────────────────────────
// Maps the backend feedback enum to a Facebook-style reaction.
// HELPFUL = the default "Like" — what a single click adds.
const REACTION_TYPES = [
  {
    value: 'HELPFUL',
    label: 'Like',
    emoji: '👍',
    chipBg: 'bg-sky-500/10',
    chipText: 'text-sky-600 dark:text-sky-400',
    ringTone: 'ring-sky-500/30',
  },
  {
    value: 'EXCELLENT',
    label: 'Brilliant',
    emoji: '💖',
    chipBg: 'bg-rose-500/10',
    chipText: 'text-rose-600 dark:text-rose-400',
    ringTone: 'ring-rose-500/30',
  },
  {
    value: 'NEEDS_IMPROVEMENT',
    label: 'Improve',
    emoji: '🤔',
    chipBg: 'bg-amber-500/10',
    chipText: 'text-amber-600 dark:text-amber-400',
    ringTone: 'ring-amber-500/30',
  },
  {
    value: 'INCORRECT',
    label: 'Incorrect',
    emoji: '❌',
    chipBg: 'bg-red-500/10',
    chipText: 'text-red-600 dark:text-red-400',
    ringTone: 'ring-red-500/30',
  },
  {
    value: 'OFF_TOPIC',
    label: 'Off-topic',
    emoji: '🌀',
    chipBg: 'bg-zinc-500/10',
    chipText: 'text-zinc-600 dark:text-zinc-400',
    ringTone: 'ring-zinc-500/30',
  },
]

const REACTION_LOOKUP = Object.fromEntries(
  REACTION_TYPES.map((item) => [item.value, item]),
)
const DEFAULT_REACTION = 'HELPFUL'

function getReactionMeta(type) {
  return REACTION_LOOKUP[type] ?? REACTION_TYPES[0]
}

// ─── Hover-to-open reaction picker (Facebook-style) ─────────────────
function ReactionTrigger({
  myReaction,
  disabled,
  onPick,
  onUnreact,
}) {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const closeTimer = useRef(null)
  const openTimer = useRef(null)

  useEffect(() => () => {
    clearTimeout(closeTimer.current)
    clearTimeout(openTimer.current)
  }, [])

  function scheduleOpen() {
    if (disabled) return
    clearTimeout(closeTimer.current)
    clearTimeout(openTimer.current)
    openTimer.current = setTimeout(() => setPaletteOpen(true), 180)
  }
  function scheduleClose() {
    clearTimeout(openTimer.current)
    clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setPaletteOpen(false), 160)
  }
  function closeNow() {
    clearTimeout(openTimer.current)
    clearTimeout(closeTimer.current)
    setPaletteOpen(false)
  }

  function handleClick() {
    if (disabled) return
    if (myReaction) onUnreact()
    else onPick(DEFAULT_REACTION)
  }

  function handlePick(type) {
    closeNow()
    onPick(type)
  }

  const meta = myReaction ? getReactionMeta(myReaction) : null

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={scheduleOpen}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        aria-pressed={Boolean(myReaction)}
        className={cn(
          'group inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold transition-all duration-200',
          'active:scale-95',
          meta
            ? cn(
                'border-transparent ring-1',
                meta.chipBg,
                meta.chipText,
                meta.ringTone,
              )
            : 'border-border bg-background text-muted-foreground hover:border-foreground/30 hover:bg-muted/60 hover:text-foreground',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        {meta ? (
          <span className="text-[15px] leading-none">{meta.emoji}</span>
        ) : (
          <ThumbsUp className="size-3.5" />
        )}
        <span>{meta?.label ?? 'Like'}</span>
      </button>

      <AnimatePresence>
        {paletteOpen ? (
          <motion.div
            key="palette"
            role="menu"
            aria-label="Pick a reaction"
            initial={{ opacity: 0, y: 10, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            className="absolute bottom-full left-0 z-30 mb-2 origin-bottom-left"
          >
            <div className="flex items-center gap-1 rounded-full border border-border/70 bg-popover/95 p-1.5 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.25)] backdrop-blur-md">
              {REACTION_TYPES.map((reaction, index) => {
                const active = myReaction === reaction.value
                return (
                  <motion.button
                    key={reaction.value}
                    type="button"
                    onClick={() => handlePick(reaction.value)}
                    initial={{ opacity: 0, y: 8, scale: 0.5 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{
                      delay: index * 0.035,
                      type: 'spring',
                      stiffness: 480,
                      damping: 22,
                    }}
                    whileHover={{ scale: 1.4, y: -6 }}
                    whileTap={{ scale: 0.92 }}
                    className={cn(
                      'group/r relative flex size-9 items-center justify-center rounded-full transition-colors',
                      active && cn('ring-2', reaction.ringTone),
                    )}
                    aria-label={reaction.label}
                    title={reaction.label}
                  >
                    <span className="select-none text-[24px] leading-none drop-shadow-sm">
                      {reaction.emoji}
                    </span>
                    <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold text-background opacity-0 shadow-md transition-opacity duration-150 group-hover/r:opacity-100">
                      {reaction.label}
                    </span>
                  </motion.button>
                )
              })}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

// ─── Stacked summary — top 3 reactions overlaid + total count ───────
function ReactionSummary({ feedback, count, onClick, open }) {
  const top = useMemo(() => {
    if (!feedback?.length) return []
    const counts = new Map()
    for (const item of feedback) {
      const key = item.feedbackType
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return [...counts.entries()]
      .map(([type, n]) => ({ type, n, meta: getReactionMeta(type) }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 3)
  }, [feedback])

  if (!count) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 text-[11.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        Be the first to react
        <ChevronDown
          className={cn(
            'size-3 transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="group inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
    >
      <span className="flex items-center -space-x-1.5">
        {top.map((item, idx) => (
          <span
            key={item.type}
            style={{ zIndex: 10 - idx }}
            className="inline-flex size-[22px] items-center justify-center rounded-full border-2 border-background bg-card text-[13px] leading-none shadow-sm transition-transform duration-200 group-hover:scale-105"
            title={`${item.meta.label} · ${item.n}`}
          >
            <span className="-mt-px">{item.meta.emoji}</span>
          </span>
        ))}
      </span>
      <span className="text-[12px] font-semibold tabular-nums text-foreground/80">
        {formatNumber(count)}
      </span>
      <ChevronDown
        className={cn(
          'size-3 text-muted-foreground transition-transform duration-200',
          open && 'rotate-180',
        )}
      />
    </button>
  )
}

// ─── Single feedback item — body + edit/delete for owner ────────────
function FeedbackItem({ feedback, isMine, onDelete, onSave }) {
  const meta = getReactionMeta(feedback.feedbackType)
  const author = {
    username: feedback.authorUsername,
    fullName: feedback.authorFullName,
    profileImage: feedback.authorProfileImage,
  }

  const [editing, setEditing] = useState(false)
  const [draftType, setDraftType] = useState(feedback.feedbackType)
  const [draftBody, setDraftBody] = useState(feedback.body ?? '')
  const [saving, setSaving] = useState(false)

  function startEdit() {
    setDraftType(feedback.feedbackType)
    setDraftBody(feedback.body ?? '')
    setEditing(true)
  }

  async function commitEdit(event) {
    event.preventDefault()
    if (!draftType) return
    const trimmed = draftBody.trim()
    const sameType = draftType === feedback.feedbackType
    const sameBody = trimmed === (feedback.body ?? '').trim()
    if (sameType && sameBody) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      await onSave({ feedbackType: draftType, body: trimmed || null })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <form
        onSubmit={commitEdit}
        className="space-y-2.5 rounded-2xl border border-border bg-card p-3"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Edit reaction
          </p>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Cancel edit"
          >
            <X className="size-3.5" />
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {REACTION_TYPES.map((option) => {
            const active = option.value === draftType
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setDraftType(option.value)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                  active
                    ? cn(
                        'border-transparent ring-1',
                        option.chipBg,
                        option.chipText,
                        option.ringTone,
                      )
                    : 'border-border bg-background text-muted-foreground hover:text-foreground',
                )}
              >
                <span className="text-[13px] leading-none">{option.emoji}</span>
                {option.label}
              </button>
            )
          })}
        </div>
        <Textarea
          value={draftBody}
          onChange={(event) => setDraftBody(event.target.value.slice(0, 5000))}
          placeholder="Add a note (optional)…"
          rows={2}
          className="resize-none rounded-xl text-sm"
        />
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 rounded-full"
            onClick={() => setEditing(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            className="h-8 rounded-full"
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Send className="size-3.5" />
            )}
            Save
          </Button>
        </div>
      </form>
    )
  }

  return (
    <div className="flex items-start gap-2.5">
      <div className="relative shrink-0">
        <UserAvatar user={author} className="size-7" />
        <span
          className={cn(
            'absolute -bottom-1 -right-1 inline-flex size-[18px] items-center justify-center rounded-full border-2 border-background text-[11px] leading-none shadow-sm',
            meta.chipBg,
          )}
          title={meta.label}
        >
          <span className="-mt-px">{meta.emoji}</span>
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          <span className="font-semibold">
            {getFullName(author) || author.username}
          </span>
          <span className={cn('text-[11px] font-medium', meta.chipText)}>
            · {meta.label}
          </span>
          <span className="text-muted-foreground">
            · {formatRelativeTime(feedback.createdAt)}
            {feedback.updatedAt && feedback.updatedAt !== feedback.createdAt
              ? ' · edited'
              : ''}
          </span>
          {isMine ? (
            <span className="ml-auto inline-flex items-center gap-1">
              <button
                type="button"
                onClick={startEdit}
                className="text-muted-foreground transition-colors hover:text-foreground"
                title="Edit"
                aria-label="Edit feedback"
              >
                <Pencil className="size-3" />
              </button>
              <button
                type="button"
                onClick={() => onDelete?.(feedback.id)}
                className="text-muted-foreground transition-colors hover:text-destructive"
                title="Delete"
                aria-label="Delete feedback"
              >
                <Trash2 className="size-3" />
              </button>
            </span>
          ) : null}
        </div>
        {feedback.body ? (
          <p className="mt-1 whitespace-pre-wrap text-[13px] leading-snug text-foreground/90">
            {feedback.body}
          </p>
        ) : null}
      </div>
    </div>
  )
}

/**
 * `canGiveFeedback` mirrors the backend `canManageQuestion` rule:
 * only the question author (or admin/super-admin) may add or remove
 * reactions. Everyone else still sees the stacked summary.
 */
export function AnswerFeedbackPanel({
  questionId,
  answerId,
  initialCount = 0,
  onCountChange,
  canGiveFeedback = false,
}) {
  const { user, isAuthenticated } = useAuth()
  const toast = useToast()

  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState([])
  const [count, setCount] = useState(initialCount)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    setCount(initialCount)
  }, [initialCount])

  // Eager-load on mount so the stacked summary reflects the actual
  // top-3 reaction types rather than guessing from `count` alone.
  // `initialCount === 0` → skip the fetch entirely.
  useEffect(() => {
    if (initialCount > 0 && !loaded && !loading) {
      ensureLoaded()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionId, answerId])

  async function ensureLoaded() {
    if (loaded || loading) return
    setLoading(true)
    try {
      const data = await getAnswerFeedback(questionId, answerId)
      setFeedback(data ?? [])
      setLoaded(true)
    } catch (error) {
      // Don't surface — the panel is collapsed by default and the
      // user can retry by toggling it open.
    } finally {
      setLoading(false)
    }
  }

  async function toggleOpen() {
    const next = !open
    setOpen(next)
    if (next) await ensureLoaded()
  }

  const myFeedback = useMemo(
    () => feedback.find((item) => item.authorId === user?.id) ?? null,
    [feedback, user?.id],
  )

  async function handlePick(type) {
    if (!isAuthenticated) {
      toast.info('Sign in to react.')
      return
    }
    if (!canGiveFeedback) {
      toast.info('Only the question author can react to answers.')
      return
    }
    if (working) return
    // Some panels mount with `initialCount === 0` and never fetch —
    // make sure we have the latest list so myFeedback is accurate.
    if (!loaded) await ensureLoaded()
    setWorking(true)
    try {
      const mine = feedback.find((item) => item.authorId === user?.id)
      if (mine) {
        if (mine.feedbackType === type) {
          await deleteAnswerFeedback(questionId, answerId, mine.id)
          setFeedback((current) => current.filter((f) => f.id !== mine.id))
          const next = Math.max(0, count - 1)
          setCount(next)
          onCountChange?.(next)
        } else {
          const updated = await editAnswerFeedback(
            questionId,
            answerId,
            mine.id,
            { feedbackType: type },
          )
          setFeedback((current) =>
            current.map((f) =>
              f.id === mine.id ? { ...f, ...updated } : f,
            ),
          )
        }
      } else {
        const created = await addAnswerFeedback(questionId, answerId, {
          feedbackType: type,
        })
        setFeedback((current) => [created, ...current])
        const next = count + 1
        setCount(next)
        onCountChange?.(next)
      }
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not save reaction.'))
    } finally {
      setWorking(false)
    }
  }

  async function handleUnreact() {
    if (!myFeedback || working) return
    setWorking(true)
    try {
      await deleteAnswerFeedback(questionId, answerId, myFeedback.id)
      setFeedback((current) =>
        current.filter((item) => item.id !== myFeedback.id),
      )
      const next = Math.max(0, count - 1)
      setCount(next)
      onCountChange?.(next)
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not remove reaction.'))
    } finally {
      setWorking(false)
    }
  }

  async function handleDelete(feedbackId) {
    try {
      await deleteAnswerFeedback(questionId, answerId, feedbackId)
      setFeedback((current) => current.filter((item) => item.id !== feedbackId))
      const next = Math.max(0, count - 1)
      setCount(next)
      onCountChange?.(next)
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not delete feedback.'))
    }
  }

  async function handleEdit(feedbackId, payload) {
    try {
      const updated = await editAnswerFeedback(
        questionId,
        answerId,
        feedbackId,
        payload,
      )
      setFeedback((current) =>
        current.map((item) =>
          item.id === feedbackId ? { ...item, ...updated } : item,
        ),
      )
      toast.success('Reaction updated.')
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not update reaction.'))
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        {canGiveFeedback ? (
          <ReactionTrigger
            myReaction={myFeedback?.feedbackType ?? null}
            disabled={working}
            onPick={handlePick}
            onUnreact={handleUnreact}
          />
        ) : null}

        <ReactionSummary
          feedback={feedback}
          count={count}
          open={open}
          onClick={toggleOpen}
        />
      </div>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="panel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 rounded-2xl border border-border bg-muted/20 p-3">
              {loading ? (
                <div className="flex justify-center py-2 text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                </div>
              ) : feedback.length === 0 ? (
                <p className="px-1 text-xs text-muted-foreground">
                  No reactions yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {feedback.map((item) => (
                    <FeedbackItem
                      key={item.id}
                      feedback={item}
                      isMine={user?.id === item.authorId}
                      onDelete={handleDelete}
                      onSave={(payload) => handleEdit(item.id, payload)}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
