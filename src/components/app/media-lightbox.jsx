import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, ChevronRight, Loader2, Plus, X } from 'lucide-react'
import { Link } from 'react-router-dom'

import { UserAvatar } from '@/components/app/user-avatar'
import { RoleBadge } from '@/components/app/role-badge'
import { useAuth } from '@/features/auth/auth-context'
import { followUser, getSocialStatus, unfollowUser } from '@/features/social/social.api'
import { useToast } from '@/components/ui/toaster'
import { getFullName, getHandle, getRawUsername, resolveMediaUrl } from '@/lib/format'
import { extractApiMessage } from '@/lib/api-error'
import { cn } from '@/lib/utils'

// ─── Inline follow button — shown in the lightbox author bar ────────
function LightboxFollowButton({ author }) {
  const { user, isAuthenticated } = useAuth()
  const toast = useToast()
  const [following, setFollowing] = useState(null)
  const [busy, setBusy] = useState(false)

  const isMe = isAuthenticated && user?.id && author?.id && user.id === author.id

  useEffect(() => {
    if (!author?.id || !isAuthenticated || isMe) {
      setFollowing(null)
      return
    }
    let cancelled = false
    getSocialStatus(author.id)
      .then((s) => { if (!cancelled) setFollowing(Boolean(s?.isFollowing ?? s?.following)) })
      .catch(() => { if (!cancelled) setFollowing(false) })
    return () => { cancelled = true }
  }, [author?.id, isAuthenticated, isMe])

  if (!author?.id || !isAuthenticated || isMe || following == null) return null

  async function toggle(e) {
    e.preventDefault()
    e.stopPropagation()
    if (busy) return
    const prev = following
    setBusy(true)
    setFollowing(!prev)
    try {
      if (prev) await unfollowUser(author.id)
      else await followUser(author.id)
    } catch (error) {
      setFollowing(prev)
      toast.error(extractApiMessage(error, 'Could not update follow.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-all',
        following
          ? 'border-white/20 bg-white/10 text-white hover:bg-white/15'
          : 'border-white/30 bg-white text-ink hover:bg-white/95',
        busy && 'opacity-60',
      )}
    >
      {following ? 'Following' : (
        <>
          <Plus className="size-3.5" strokeWidth={2.4} />
          Follow
        </>
      )}
    </button>
  )
}

// ─── Single media slide ────────────────────────────────────────────
function MediaSlide({ item }) {
  const url = resolveMediaUrl(item?.url ?? item?.mediaUrl)
  const type = (item?.mediaType ?? item?.type ?? 'IMAGE').toUpperCase()
  const [loading, setLoading] = useState(true)

  if (!url) return null

  if (type === 'VIDEO') {
    return (
      <div className="relative grid h-full w-full place-items-center">
        <video
          src={url}
          controls
          autoPlay
          playsInline
          preload="auto"
          onLoadedData={() => setLoading(false)}
          className="max-h-full max-w-full bg-black object-contain"
          // Tapping the video shouldn't close the lightbox — stop propagation.
          onClick={(e) => e.stopPropagation()}
        />
        {loading ? (
          <span className="pointer-events-none absolute grid size-12 place-items-center rounded-full bg-black/50 text-white backdrop-blur-md">
            <Loader2 className="size-5 animate-spin" />
          </span>
        ) : null}
      </div>
    )
  }

  return (
    <div className="relative grid h-full w-full place-items-center">
      <img
        src={url}
        alt={item.altText ?? ''}
        onLoad={() => setLoading(false)}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'max-h-full max-w-full select-none object-contain transition-opacity duration-300',
          loading ? 'opacity-0' : 'opacity-100',
        )}
        draggable={false}
      />
      {loading ? (
        <span className="pointer-events-none absolute grid size-12 place-items-center rounded-full bg-black/50 text-white backdrop-blur-md">
          <Loader2 className="size-5 animate-spin" />
        </span>
      ) : null}
    </div>
  )
}

// ─── Lightbox ───────────────────────────────────────────────────────
export function MediaLightbox({ open, onOpenChange, media = [], startIndex = 0, author = null, postCaption = null }) {
  const [index, setIndex] = useState(startIndex)
  const touchStartX = useRef(null)

  useEffect(() => { if (open) setIndex(startIndex) }, [open, startIndex])

  const total = media.length
  const goPrev = useCallback(() => setIndex((i) => (i > 0 ? i - 1 : i)), [])
  const goNext = useCallback(() => setIndex((i) => (i < total - 1 ? i + 1 : i)), [total])

  useEffect(() => {
    if (!open) return undefined
    function onKey(e) {
      if (e.key === 'Escape') onOpenChange(false)
      else if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === 'ArrowRight') goNext()
    }
    // Lock body scroll while open
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [open, goPrev, goNext, onOpenChange])

  function handleTouchStart(e) {
    touchStartX.current = e.touches[0]?.clientX ?? null
  }
  function handleTouchEnd(e) {
    if (touchStartX.current == null) return
    const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current
    if (Math.abs(dx) < 50) return
    if (dx > 0) goPrev()
    else goNext()
    touchStartX.current = null
  }

  if (!open || typeof document === 'undefined') return null

  const current = media[index]
  const authorRoute = author ? getRawUsername(author) : null
  const authorName = author ? getFullName(author) || getHandle(author) || 'Unknown' : null
  const authorHandle = author ? getHandle(author) : null

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="lightbox"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 z-[100] flex flex-col bg-black/95 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        dir="ltr" // Lightbox always uses LTR layout — image is the focus
      >
        {/* ── Top bar: author + close ─────────────────────────── */}
        <div
          className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {author ? (
            <Link
              to={authorRoute ? `/profile/${authorRoute}` : '#'}
              onClick={() => onOpenChange(false)}
              className="flex min-w-0 items-center gap-3 text-white transition-opacity hover:opacity-90"
            >
              <UserAvatar user={author} className="size-10 shrink-0 ring-2 ring-white/20" />
              <div className="min-w-0 leading-tight">
                <div className="flex items-center gap-1.5">
                  <span
                    className="truncate font-display text-[15px] font-bold tracking-[-0.005em]"
                    style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}
                  >
                    {authorName}
                  </span>
                  {author.role ? <RoleBadge role={author.role} size="xs" /> : null}
                </div>
                {authorHandle ? (
                  <span className="block truncate font-mono text-[11.5px] text-white/65">
                    @{authorHandle}
                  </span>
                ) : null}
              </div>
            </Link>
          ) : <span />}

          <div className="flex items-center gap-2">
            {author ? <LightboxFollowButton author={author} /> : null}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="grid size-9 shrink-0 place-items-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20"
              aria-label="Close"
            >
              <X className="size-5" strokeWidth={1.8} />
            </button>
          </div>
        </div>

        {/* ── Media canvas ────────────────────────────────────── */}
        <div className="relative flex flex-1 items-center justify-center overflow-hidden px-2 sm:px-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="flex h-full w-full items-center justify-center"
            >
              <MediaSlide item={current} />
            </motion.div>
          </AnimatePresence>

          {/* Prev / next arrows — hidden on phones (swipe instead) */}
          {total > 1 && index > 0 ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); goPrev() }}
              className="absolute left-2 top-1/2 hidden -translate-y-1/2 sm:grid size-12 place-items-center rounded-full bg-white/10 text-white backdrop-blur-md transition-all hover:bg-white/20 hover:scale-105"
              aria-label="Previous"
            >
              <ChevronLeft className="size-6" strokeWidth={1.8} />
            </button>
          ) : null}
          {total > 1 && index < total - 1 ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); goNext() }}
              className="absolute right-2 top-1/2 hidden -translate-y-1/2 sm:grid size-12 place-items-center rounded-full bg-white/10 text-white backdrop-blur-md transition-all hover:bg-white/20 hover:scale-105"
              aria-label="Next"
            >
              <ChevronRight className="size-6" strokeWidth={1.8} />
            </button>
          ) : null}
        </div>

        {/* ── Bottom: caption + index dots ────────────────────── */}
        <div
          className="flex flex-col items-center gap-2 px-4 py-3 sm:px-6 sm:py-4"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {postCaption ? (
            <p
              dir="auto"
              className="line-clamp-2 max-w-[640px] text-center text-[14px] leading-[1.5] text-white/85"
              style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}
            >
              {postCaption}
            </p>
          ) : null}

          {total > 1 ? (
            <div className="flex items-center gap-1.5">
              {media.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setIndex(i) }}
                  className={cn(
                    'h-1.5 rounded-full transition-all',
                    i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/60',
                  )}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
              <span className="ml-2 font-mono text-[11px] tabular-nums text-white/50">
                {index + 1} / {total}
              </span>
            </div>
          ) : null}
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}
