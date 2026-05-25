import { useCallback, useEffect, useRef, useState } from 'react'
import { API_URL } from '@/config/env'
import { AnimatePresence, motion } from 'motion/react'
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Eye,
  GraduationCap,
  Link2,
  Loader2,
  MessageCircle,
  Mic,
  Pause,
  Play,
  Send,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'

import { Link } from 'react-router-dom'

import { UserAvatar } from '@/components/app/user-avatar'
import { useAuth } from '@/features/auth/auth-context'
import {
  reactToStory,
  recordStoryView,
  replyToStory,
  voteOnStoryPoll,
} from '@/features/stories/stories.api'
import { cn } from '@/lib/utils'
import {
  displayTime,
  formatNumber,
  getFullName,
  getHandle,
  resolveMediaUrl,
} from '@/lib/format'

const TEXT_DURATION  = 7000
const IMAGE_DURATION = 7000
const TICK_MS        = 50

const REACTIONS = [
  { emoji: '❤️',  label: 'Love' },
  { emoji: '🤲',  label: 'Du\'a' },
  { emoji: '😍',  label: 'Amazing' },
  { emoji: '😮',  label: 'Wow' },
  { emoji: '😂',  label: 'Funny' },
  { emoji: '🙏',  label: 'Grateful' },
]

const LINKED_META = {
  LINKED_POST:     { label: 'Post',     icon: MessageCircle, color: 'from-brand/80 to-brand/40' },
  LINKED_REEL:     { label: 'Reel',     icon: Play,          color: 'from-[#BD9344]/85 to-[#D8B463]/40' },
  LINKED_QNA:      { label: 'Q&A',      icon: GraduationCap, color: 'from-amber-600/80 to-amber-400/40' },
  LINKED_RESEARCH: { label: 'Research', icon: BookOpen,       color: 'from-[#0E6B54]/85 to-[#1FB98E]/40' },
}

// ── Progress bars ─────────────────────────────────────────────────────
function ProgressBars({ count, currentIndex, progress }) {
  return (
    <div className="flex gap-[3px] px-3 pt-3 pb-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="relative h-[3px] flex-1 overflow-hidden rounded-full"
          style={{ background: 'rgba(255,255,255,0.28)' }}
        >
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full bg-white"
            style={{
              width: i < currentIndex ? '100%'
                   : i === currentIndex ? `${progress * 100}%`
                   : '0%',
              boxShadow: i === currentIndex ? '0 0 6px 1px rgba(255,255,255,0.6)' : 'none',
            }}
            transition={{ duration: 0 }}
          />
        </div>
      ))}
    </div>
  )
}

// ── Linked content card ───────────────────────────────────────────────
function LinkedCard({ story }) {
  const snap = (() => {
    try { return story.linkedContentSnapshot ? JSON.parse(story.linkedContentSnapshot) : {} }
    catch { return {} }
  })()
  const meta = LINKED_META[story.storyType] ?? { label: 'Content', icon: Link2, color: 'from-white/20 to-white/5' }
  const Icon = meta.icon
  const href = {
    LINKED_POST:     `/posts/${story.linkedContentId}`,
    LINKED_REEL:     `/reels?id=${story.linkedContentId}`,
    LINKED_QNA:      `/qna/${story.linkedContentId}`,
    LINKED_RESEARCH: `/research/${story.linkedContentId}`,
  }[story.storyType] ?? '#'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 280, damping: 24, delay: 0.1 }}
      className="pointer-events-auto mx-auto w-full max-w-[300px] overflow-hidden rounded-lg"
      style={{
        background: 'rgba(255,255,255,0.08)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.16)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.32)',
      }}
    >
      {/* Media / gradient header */}
      <div className={cn('relative h-40 bg-gradient-to-br', meta.color)}>
        {snap.thumbnailUrl ? (
          <img src={snap.thumbnailUrl} alt="" className="h-full w-full object-cover opacity-80" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Icon className="size-12 text-white/40" strokeWidth={1.2} />
          </div>
        )}
        {/* Type chip */}
        <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 backdrop-blur">
          <Icon className="size-3 text-white" strokeWidth={2} />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-white">
            {meta.label}
          </span>
        </div>
      </div>
      {/* Body */}
      <div className="p-4">
        {snap.title ? (
          <p className="mb-1 line-clamp-2 text-[15px] font-semibold leading-snug text-white">
            {snap.title}
          </p>
        ) : null}
        {snap.authorName ? (
          <p className="mb-3 text-[12px] text-white/55">{snap.authorName}</p>
        ) : null}
        <Link
          to={href}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-white/25"
        >
          Open {meta.label}
          <ChevronRight className="size-3" strokeWidth={2.5} />
        </Link>
      </div>
    </motion.div>
  )
}

// ── Poll overlay ──────────────────────────────────────────────────────
function PollOverlay({ story, onVote }) {
  const [voted, setVoted] = useState(null)
  const [localA, setLocalA] = useState(story.poll?.voteACount ?? 0)
  const [localB, setLocalB] = useState(story.poll?.voteBCount ?? 0)

  const poll = story.poll
  if (!poll) return null

  const total = localA + localB
  const pctA = total ? Math.round((localA / total) * 100) : 50
  const pctB = 100 - pctA

  async function handleVote(choice) {
    if (voted) return
    setVoted(choice)
    if (choice === 'A') setLocalA((n) => n + 1)
    else setLocalB((n) => n + 1)
    try { await onVote(story.id, choice) } catch { setVoted(null) }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, type: 'spring', stiffness: 280, damping: 24 }}
      className="pointer-events-auto mx-auto w-full max-w-[300px] space-y-3"
    >
      <p
        className="text-center text-[17px] font-semibold text-white"
        style={{ textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}
      >
        {poll.question}
      </p>
      <div className="space-y-2.5">
        {[{ choice: 'A', label: poll.optionA, pct: pctA }, { choice: 'B', label: poll.optionB, pct: pctB }].map(({ choice, label, pct }) => {
          const isMine = voted === choice
          return (
            <button
              key={choice}
              type="button"
              onClick={() => handleVote(choice)}
              disabled={!!voted}
              className={cn(
                'relative w-full overflow-hidden rounded-lg px-5 py-3.5 text-left transition-all duration-200',
                'border text-sm font-semibold text-white',
                isMine
                  ? 'border-white/60 bg-white/25 scale-[1.02]'
                  : voted
                    ? 'border-white/15 bg-white/8'
                    : 'border-white/25 bg-white/12 hover:bg-white/20 hover:border-white/40 active:scale-[0.98]',
              )}
            >
              {voted ? (
                <motion.span
                  className="absolute inset-y-0 left-0 rounded-lg bg-white/20"
                  initial={{ width: '0%' }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.7, ease: [0.22, 0.61, 0.36, 1] }}
                />
              ) : null}
              <span className="relative flex items-center justify-between gap-3">
                <span className="truncate">{label}</span>
                {voted ? (
                  <span className={cn('shrink-0 text-[13px]', isMine ? 'font-bold text-white' : 'text-white/55')}>
                    {pct}%
                  </span>
                ) : null}
              </span>
            </button>
          )
        })}
      </div>
      {voted ? (
        <p className="text-center text-[11px] text-white/50">
          {formatNumber(total + 1)} {total + 1 === 1 ? 'vote' : 'votes'}
        </p>
      ) : null}
    </motion.div>
  )
}

// ── Owner stats panel ─────────────────────────────────────────────────
function OwnerStats({ story, liveViewCount }) {
  const bd = story.viewBreakdown
  const count = liveViewCount ?? story.viewCount ?? 0
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="flex items-center gap-4"
      style={{
        background: 'rgba(0,0,0,0.35)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderRadius: '999px',
        padding: '6px 16px',
      }}
    >
      <div className="flex items-center gap-1.5 text-white/80">
        <Eye className="size-3.5" strokeWidth={1.6} />
        <motion.span
          key={count}
          initial={{ scale: 1.3, color: '#5BBA9C' }}
          animate={{ scale: 1, color: 'rgba(255,255,255,0.8)' }}
          transition={{ duration: 0.4 }}
          className="text-[12px] font-semibold"
        >
          {formatNumber(count)}
        </motion.span>
        <span className="text-[11px] text-white/50">views</span>
      </div>
      {bd ? (
        <>
          {bd.byCloseFriends > 0 ? (
            <div className="flex items-center gap-1 text-white/60">
              <Users className="size-3" strokeWidth={1.8} />
              <span className="text-[11px]">{bd.byCloseFriends} close</span>
            </div>
          ) : null}
          {bd.byFollowers > 0 ? (
            <div className="flex items-center gap-1 text-white/60">
              <span className="text-[11px]">{bd.byFollowers} followers</span>
            </div>
          ) : null}
        </>
      ) : null}
      {story.reactionCount > 0 ? (
        <div className="flex items-center gap-1 text-white/60">
          <span className="text-[13px]">❤️</span>
          <span className="text-[11px]">{formatNumber(story.reactionCount)}</span>
        </div>
      ) : null}
    </motion.div>
  )
}

// ── Story type chip ───────────────────────────────────────────────────
function StoryTypeChip({ storyType }) {
  if (storyType === 'TEXT' || storyType === 'IMAGE' || storyType === 'VIDEO') return null
  const meta = LINKED_META[storyType]
  if (!meta) return null
  const Icon = meta.icon
  return (
    <div className="flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 backdrop-blur">
      <Icon className="size-3 text-white/80" strokeWidth={1.8} />
      <span className="text-[10px] font-semibold uppercase tracking-widest text-white/80">
        {meta.label}
      </span>
    </div>
  )
}

// ── Main viewer ───────────────────────────────────────────────────────
export function StoryViewer({ groups, initialGroupIndex = 0, onClose }) {
  const { user: viewer, session } = useAuth()
  const [groupIndex,   setGroupIndex]   = useState(initialGroupIndex)
  const [storyIndex,   setStoryIndex]   = useState(0)
  const [progress,     setProgress]     = useState(0)
  const [paused,       setPaused]       = useState(false)
  const [muted,        setMuted]        = useState(false)
  const [replyText,    setReplyText]    = useState('')
  const [replySending, setReplySending] = useState(false)
  const [reacted,      setReacted]      = useState(null)
  const [replyFocused,    setReplyFocused]    = useState(false)
  const [direction,       setDirection]       = useState(1)
  const [liveViewCount,   setLiveViewCount]   = useState(null)
  const [livePoll,        setLivePoll]        = useState(null)
  const [floatingEmoji,   setFloatingEmoji]   = useState(null)
  const [deletedStoryId,  setDeletedStoryId]  = useState(null)

  const videoRef    = useRef(null)
  const intervalRef = useRef(null)
  const viewedRef   = useRef(new Set())
  const inputRef    = useRef(null)
  const storyEsRef  = useRef(null)

  // Mutable story counters updated live via SSE (no re-render spam)
  const liveCountsRef = useRef({}) // { [storyId]: { viewCount, reactionCount, pollVoteACount, pollVoteBCount } }

  const group = groups[groupIndex]
  const story = group?.stories[storyIndex]
  const isMe  = viewer?.id && group?.author?.id === viewer.id

  const durationMs = story?.storyType === 'VIDEO'
    ? Math.min((story.durationSeconds ?? 30), 30) * 1000
    : IMAGE_DURATION

  // Record view
  useEffect(() => {
    if (!story?.id || viewedRef.current.has(story.id)) return
    viewedRef.current.add(story.id)
    recordStoryView(story.id, viewer?.id).catch(() => {})
  }, [story?.id])

  // Story stream SSE — connect/disconnect as story changes
  useEffect(() => {
    if (!story?.id) return

    // Close previous connection if switching stories
    if (storyEsRef.current) {
      storyEsRef.current.close()
      storyEsRef.current = null
    }

    const url = new URL(`/api/v1/stories/${story.id}/stream`, API_URL)
    if (session?.accessToken) url.searchParams.set('token', session.accessToken)

    const es = new EventSource(url.toString())
    storyEsRef.current = es

    es.addEventListener('view_count_updated', (e) => {
      try {
        const { viewCount } = JSON.parse(e.data)
        // Update live ref (owner sees it via live counter)
        liveCountsRef.current[story.id] = {
          ...(liveCountsRef.current[story.id] ?? {}),
          viewCount,
        }
        // Trigger a re-render only for owner (view count badge)
        setLiveViewCount(viewCount)
      } catch { /* ignore */ }
    })

    es.addEventListener('story_reacted', (e) => {
      try {
        const ev = JSON.parse(e.data)
        setFloatingEmoji({ emoji: ev.reactionEmoji, key: Date.now() })
      } catch { /* ignore */ }
    })

    es.addEventListener('story_poll_voted', (e) => {
      try {
        const ev = JSON.parse(e.data)
        setLivePoll({ voteACount: ev.pollVoteACount, voteBCount: ev.pollVoteBCount })
      } catch { /* ignore */ }
    })

    es.addEventListener('story_deleted', () => {
      setDeletedStoryId(story.id)
    })

    return () => { es.close(); storyEsRef.current = null }
  }, [story?.id])

  // Progress timer — pause when reply is focused
  const tick = useCallback(() => {
    setProgress((p) => Math.min(p + TICK_MS / durationMs, 1))
  }, [durationMs])

  useEffect(() => {
    setProgress(0)
    clearInterval(intervalRef.current)
    if (!paused && !replyFocused) {
      intervalRef.current = setInterval(tick, TICK_MS)
    }
    return () => clearInterval(intervalRef.current)
  }, [storyIndex, groupIndex, paused, replyFocused, tick])

  // Auto-advance
  useEffect(() => {
    if (progress < 1) return
    advance()
  }, [progress])

  function advance() {
    setDirection(1)
    const stories = group?.stories ?? []
    if (storyIndex < stories.length - 1) {
      setStoryIndex((i) => i + 1)
      setProgress(0)
    } else if (groupIndex < groups.length - 1) {
      setGroupIndex((g) => g + 1)
      setStoryIndex(0)
      setProgress(0)
    } else {
      onClose()
    }
  }

  function back() {
    setDirection(-1)
    if (storyIndex > 0) {
      setStoryIndex((i) => i - 1)
      setProgress(0)
    } else if (groupIndex > 0) {
      setGroupIndex((g) => g - 1)
      setStoryIndex(groups[groupIndex - 1].stories.length - 1)
      setProgress(0)
    }
  }

  // Keyboard
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape')      onClose()
      if (e.key === 'ArrowRight')  advance()
      if (e.key === 'ArrowLeft')   back()
      if (e.key === ' ' && e.target === document.body) {
        e.preventDefault()
        setPaused((p) => !p)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [groupIndex, storyIndex, groups])

  // Video sync
  useEffect(() => {
    if (!videoRef.current) return
    paused || replyFocused ? videoRef.current.pause() : videoRef.current.play().catch(() => {})
    videoRef.current.muted = muted
  }, [paused, replyFocused, muted])

  // When story_deleted fires, skip to next or close
  useEffect(() => {
    if (!deletedStoryId || deletedStoryId !== story?.id) return
    setDeletedStoryId(null)
    advance()
  }, [deletedStoryId])

  // Reset live state when story changes
  useEffect(() => {
    setLiveViewCount(null)
    setLivePoll(null)
    setFloatingEmoji(null)
  }, [story?.id])

  async function handleReact(emoji) {
    if (!story || reacted === emoji) return
    setReacted(emoji)
    try { await reactToStory(story.id, emoji) } catch { setReacted(null) }
  }

  async function handleReply(e) {
    e.preventDefault()
    if (!replyText.trim() || !story) return
    setReplySending(true)
    try {
      await replyToStory(story.id, replyText.trim())
      setReplyText('')
      inputRef.current?.blur()
    } catch { /* ignore */ }
    finally { setReplySending(false) }
  }

  if (!group || !story) return null

  const author = group.author
  const bgStyle = story.storyType === 'TEXT'
    ? {
        background: story.backgroundType === 'gradient'
          ? story.backgroundValue ?? 'linear-gradient(135deg,#0F3D3E,#C9A227)'
          : story.backgroundValue ?? '#131316',
      }
    : { background: '#000' }

  const variants = {
    enter: (dir) => ({ opacity: 0, x: dir > 0 ? 48 : -48, scale: 0.97 }),
    center: { opacity: 1, x: 0, scale: 1 },
    exit: (dir) => ({ opacity: 0, x: dir > 0 ? -48 : 48, scale: 0.97 }),
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.92)' }}
    >
      {/* ── Story card ── */}
      <div className="relative flex h-full w-full max-w-sm items-stretch sm:h-[calc(100dvh-32px)] sm:max-h-[780px]">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={`${groupIndex}-${storyIndex}`}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.26, ease: [0.22, 0.61, 0.36, 1] }}
            className="flex h-full w-full flex-col overflow-hidden sm:rounded-3xl"
            style={bgStyle}
          >
            {/* Background media */}
            {story.storyType === 'IMAGE' && story.mediaUrl ? (
              <motion.img
                key={story.id + '-img'}
                initial={{ scale: 1.04 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                src={resolveMediaUrl(story.mediaUrl)}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : null}

            {story.storyType === 'VIDEO' && story.mediaUrl ? (
              <video
                ref={videoRef}
                src={resolveMediaUrl(story.mediaUrl)}
                className="absolute inset-0 h-full w-full object-cover"
                autoPlay
                playsInline
                muted={muted}
                onEnded={advance}
                onLoadedMetadata={() => setProgress(0)}
              />
            ) : null}

            {/* Layered gradient scrim — strong at top/bottom, clear in middle */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 28%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.65) 80%, rgba(0,0,0,0.80) 100%)',
              }}
            />

            {/* ── Top chrome ── */}
            <div className="relative z-10 flex-shrink-0">
              <ProgressBars count={group.stories.length} currentIndex={storyIndex} progress={progress} />

              <div className="flex items-center gap-2.5 px-3 pb-3">
                <Link
                  to={`/profile/${author?.username}`}
                  className="shrink-0 outline-none"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    className="rounded-full p-[2px]"
                    style={{ background: 'linear-gradient(135deg,rgba(15,110,86,0.9),rgba(181,116,23,0.9))' }}
                  >
                    <UserAvatar
                      user={author}
                      className="size-9 ring-[1.5px] ring-black/30"
                    />
                  </div>
                </Link>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p
                      className="truncate text-[13px] font-semibold text-white"
                      style={{ textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}
                    >
                      {getFullName(author) || getHandle(author)}
                    </p>
                    <StoryTypeChip storyType={story.storyType} />
                  </div>
                  <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    {displayTime(story)}
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  {story.sound ? (
                    <div className="flex items-center gap-1 rounded-full bg-black/30 px-2 py-1 backdrop-blur">
                      <Mic className="size-2.5 text-white/70" strokeWidth={2} />
                      <span className="text-[10px] text-white/70">Sound</span>
                    </div>
                  ) : null}
                  {story.storyType === 'VIDEO' ? (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setMuted((m) => !m) }}
                      className="grid size-8 place-items-center rounded-full text-white transition-colors hover:bg-white/15 active:scale-90"
                    >
                      {muted
                        ? <VolumeX className="size-[15px]" strokeWidth={1.7} />
                        : <Volume2 className="size-[15px]" strokeWidth={1.7} />
                      }
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setPaused((p) => !p) }}
                    className="grid size-8 place-items-center rounded-full text-white transition-colors hover:bg-white/15 active:scale-90"
                  >
                    {paused
                      ? <Play className="size-[15px]" strokeWidth={1.7} />
                      : <Pause className="size-[15px]" strokeWidth={1.7} />
                    }
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onClose() }}
                    className="grid size-8 place-items-center rounded-full text-white transition-colors hover:bg-white/15 active:scale-90"
                  >
                    <X className="size-4" strokeWidth={2} />
                  </button>
                </div>
              </div>
            </div>

            {/* ── Invisible tap zones ── */}
            <button
              type="button"
              aria-label="Previous story"
              onClick={(e) => { e.stopPropagation(); back() }}
              className="absolute inset-y-0 left-0 z-20 w-[35%] cursor-default"
            />
            <button
              type="button"
              aria-label="Next story"
              onClick={(e) => { e.stopPropagation(); advance() }}
              className="absolute inset-y-0 right-0 z-20 w-[35%] cursor-default"
            />

            {/* ── Story body ── */}
            <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-5 px-5 py-4">
              {/* TEXT story */}
              {story.storyType === 'TEXT' && story.textContent ? (
                <motion.p
                  key={story.id + '-text'}
                  initial={{ opacity: 0, y: 14, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 0.12, type: 'spring', stiffness: 280, damping: 24 }}
                  className="max-w-[88%] text-center font-semibold text-[26px] font-semibold leading-[1.25] tracking-[-0.01em] text-white"
                  style={{ textShadow: '0 2px 20px rgba(0,0,0,0.5), 0 1px 4px rgba(0,0,0,0.4)' }}
                >
                  {story.textContent}
                </motion.p>
              ) : null}

              {/* LINKED card */}
              {story.storyType?.startsWith('LINKED_') ? (
                <LinkedCard story={story} />
              ) : null}

              {/* Caption on media/linked stories */}
              {story.textContent && story.storyType !== 'TEXT' ? (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.18 }}
                  className="max-w-[88%] rounded-lg px-4 py-3 text-center text-[15px] leading-snug text-white"
                  style={{
                    background: 'rgba(0,0,0,0.42)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                  }}
                >
                  {story.textContent}
                </motion.div>
              ) : null}

              {/* Poll — merge live vote counts from SSE */}
              {story.poll ? (
                <PollOverlay
                  story={livePoll
                    ? { ...story, poll: { ...story.poll, voteACount: livePoll.voteACount, voteBCount: livePoll.voteBCount } }
                    : story
                  }
                  onVote={voteOnStoryPoll}
                />
              ) : null}
            </div>

            {/* ── Bottom chrome ── */}
            <div className="relative z-10 flex-shrink-0 space-y-3 px-4 pb-6 pt-2">
              {/* Owner stats */}
              {isMe ? <OwnerStats story={story} liveViewCount={liveViewCount} /> : null}

              {/* Emoji reactions row */}
              {!isMe ? (
                <div className="flex items-center justify-center gap-2">
                  {REACTIONS.map(({ emoji, label }) => (
                    <motion.button
                      key={emoji}
                      type="button"
                      title={label}
                      onClick={(e) => { e.stopPropagation(); handleReact(emoji) }}
                      whileHover={{ scale: 1.25 }}
                      whileTap={{ scale: 0.85 }}
                      animate={reacted === emoji ? { scale: [1, 1.4, 1.1, 1] } : {}}
                      transition={{ duration: 0.35 }}
                      className={cn(
                        'flex size-11 items-center justify-center rounded-full text-[22px] transition-colors',
                        reacted === emoji
                          ? 'ring-2 ring-white/60'
                          : 'hover:bg-white/10',
                      )}
                      style={reacted === emoji
                        ? { background: 'rgba(255,255,255,0.22)' }
                        : {}
                      }
                    >
                      {emoji}
                    </motion.button>
                  ))}
                </div>
              ) : null}

              {/* Reply input */}
              {!isMe ? (
                <form
                  onSubmit={handleReply}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-2"
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onFocus={() => setReplyFocused(true)}
                    onBlur={() => setReplyFocused(false)}
                    placeholder={`Reply to ${getHandle(author)}…`}
                    className="flex-1 rounded-full py-3 pl-4 pr-3 text-[13px] text-white placeholder:text-white/45 outline-none"
                    style={{
                      background: 'rgba(255,255,255,0.12)',
                      border: replyFocused ? '1px solid rgba(255,255,255,0.55)' : '1px solid rgba(255,255,255,0.22)',
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      transition: 'border-color 180ms',
                    }}
                  />
                  <motion.button
                    type="submit"
                    disabled={!replyText.trim() || replySending}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.92 }}
                    className="grid size-11 shrink-0 place-items-center rounded-full text-white transition-opacity disabled:opacity-35"
                    style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
                  >
                    {replySending
                      ? <Loader2 className="size-4 animate-spin" strokeWidth={1.8} />
                      : <Send className="size-4" strokeWidth={1.8} />
                    }
                  </motion.button>
                </form>
              ) : null}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Desktop arrows — outside the card ── */}
      {groups.length > 1 || (group?.stories?.length ?? 0) > 1 ? (
        <>
          <motion.button
            type="button"
            aria-label="Previous"
            onClick={back}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            className="absolute left-4 top-1/2 z-50 hidden -translate-y-1/2 sm:grid place-items-center size-11 rounded-full text-white"
            style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.16)' }}
          >
            <ChevronLeft className="size-5" strokeWidth={2} />
          </motion.button>
          <motion.button
            type="button"
            aria-label="Next"
            onClick={advance}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            className="absolute right-4 top-1/2 z-50 hidden -translate-y-1/2 sm:grid place-items-center size-11 rounded-full text-white"
            style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.16)' }}
          >
            <ChevronRight className="size-5" strokeWidth={2} />
          </motion.button>
        </>
      ) : null}

      {/* Floating emoji — fires on story_reacted SSE */}
      <AnimatePresence>
        {floatingEmoji ? (
          <motion.div
            key={floatingEmoji.key}
            initial={{ opacity: 1, y: 0, scale: 0.6 }}
            animate={{ opacity: 0, y: -120, scale: 1.4 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.4, ease: 'easeOut' }}
            onAnimationComplete={() => setFloatingEmoji(null)}
            className="pointer-events-none absolute bottom-28 left-1/2 z-50 -translate-x-1/2 text-5xl"
          >
            {floatingEmoji.emoji}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Paused badge */}
      <AnimatePresence>
        {paused ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            className="pointer-events-none absolute left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 grid size-16 place-items-center rounded-full"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
          >
            <Pause className="size-7 text-white" strokeWidth={1.8} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  )
}
