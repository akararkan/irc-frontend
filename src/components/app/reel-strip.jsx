import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Clapperboard, Eye, Play, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Skeleton } from '@/components/ui/skeleton'
import { getReels } from '@/features/posts/posts.api'
import { useAuth } from '@/features/auth/auth-context'
import {
  formatNumber,
  getFullName,
  getHandle,
  resolveMediaUrl,
} from '@/lib/format'

// Gradient fallbacks when no thumbnail is available
const FALLBACK_GRADIENTS = [
  'linear-gradient(160deg,#0F3D3E,#1B7A7F)',
  'linear-gradient(160deg,#4A2106,#C9A227)',
  'linear-gradient(160deg,#2D2558,#7B68EE)',
  'linear-gradient(160deg,#14532D,#16A34A)',
  'linear-gradient(160deg,#5A0A0A,#DB2777)',
  'linear-gradient(160deg,#0F172A,#334155)',
]

function normalizeAuthor(post) {
  if (post.author) {
    return {
      id:           post.author.id,
      username:     post.author.username,
      fullName:     post.author.fullName,
      profileImage: post.author.avatarUrl,
    }
  }
  return { username: post.authorUsername, profileImage: post.authorProfileImage }
}

function ReelThumb({ post, index }) {
  const media   = post.mediaList?.[0]
  const author  = normalizeAuthor(post)
  const thumbUrl = resolveMediaUrl(media?.thumbnailUrl ?? media?.mediaThumbnailUrl)
  const videoUrl = media?.mediaType === 'VIDEO' ? resolveMediaUrl(media?.url) : null
  const fallback = FALLBACK_GRADIENTS[index % FALLBACK_GRADIENTS.length]

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 280, damping: 26, delay: Math.min(index, 6) * 0.045 }}
      whileHover={{ y: -8, scale: 1.03 }}
      whileTap={{ scale: 0.96 }}
      className="shrink-0"
    >
      <Link
        to={`/reels?id=${post.id}`}
        className="group relative flex h-56 w-[148px] overflow-hidden rounded-lg bg-bg-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.18), 0 1px 4px rgba(0,0,0,0.12)' }}
      >
        {/* Media */}
        {videoUrl ? (
          <video
            src={videoUrl}
            poster={thumbUrl || undefined}
            muted
            playsInline
            preload="metadata"
            disablePictureInPicture
            onLoadedMetadata={(e) => {
              try { if (e.currentTarget.duration > 0.2) e.currentTarget.currentTime = 0.1 } catch { /* ok */ }
            }}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
        ) : thumbUrl ? (
          <img
            src={thumbUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <div className="absolute inset-0" style={{ background: fallback }} />
        )}

        {/* Scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/20" />

        {/* Play button — appears on hover */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          whileHover={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 22 }}
          className="absolute inset-0 grid place-items-center"
        >
          <div
            className="grid size-12 place-items-center rounded-full text-white"
            style={{
              background: 'rgba(255,255,255,0.2)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: '1.5px solid rgba(255,255,255,0.4)',
            }}
          >
            <Play className="size-5 translate-x-[1.5px] fill-white text-white" />
          </div>
        </motion.div>

        {/* Top badge */}
        <div className="relative z-10 flex w-full flex-col justify-between p-3 text-white">
          <div className="flex items-center">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-white"
              style={{ background: 'rgba(0,0,0,0.40)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
            >
              <Clapperboard className="size-2.5" />
              Reel
            </span>
          </div>

          {/* Bottom meta */}
          <div className="space-y-0.5">
            <p
              className="truncate font-semibold text-[12.5px] font-semibold leading-tight tracking-[-0.01em] drop-shadow"
            >
              {getFullName(author) || getHandle(author) || 'Unknown'}
            </p>
            <p className="flex items-center gap-1 font-mono text-[10px] tabular-nums text-white/75">
              <Eye className="size-2.5" strokeWidth={1.8} />
              {formatNumber(post.viewCount ?? 0)}
            </p>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

function ReelSkeletonThumb() {
  return (
    <div className="h-56 w-[148px] shrink-0 overflow-hidden rounded-lg">
      <div className="h-full w-full shimmer" />
    </div>
  )
}

export function ReelStrip({ onCreateReel }) {
  const { isAuthenticated } = useAuth()
  const [reels,   setReels]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const data = await getReels({ page: 0, size: 10 })
        if (!cancelled) setReels(data?.content ?? [])
      } catch {
        if (!cancelled) setReels([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (!loading && reels.length === 0 && !isAuthenticated) return null

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 28, delay: 0.08 }}
      className="space-y-3.5"
    >
      {/* Section header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div
            className="h-[1.5px] w-5 rounded-full"
            style={{ background: 'var(--gold)' }}
          />
          <h2 className="font-semibold text-[14.5px] font-semibold tracking-[-0.008em] text-ink">
            Featured reels
          </h2>
        </div>
        <Link
          to="/reels"
          className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-accent-indigo transition-colors hover:text-accent-indigo/80"
        >
          See all →
        </Link>
      </div>

      {/* Scroll row */}
      <div className="scrollbar-none flex gap-3 overflow-x-auto pb-2 pt-1">
        {/* Create reel tile */}
        {isAuthenticated ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26 }}
            whileHover={{ y: -8, scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            className="shrink-0"
          >
            <button
              type="button"
              onClick={() => onCreateReel?.()}
              className="group flex h-56 w-[148px] flex-col items-center justify-center gap-3 overflow-hidden rounded-lg border-2 border-dashed border-line bg-background/60 transition-colors hover:border-fg/40 hover:bg-brand-soft/20 focus:outline-none"
              style={{ boxShadow: 'var(--shadow-xs)' }}
            >
              <motion.span
                whileHover={{ scale: 1.12, rotate: 8 }}
                transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                className="grid size-12 place-items-center rounded-full text-accent-indigo-foreground"
                style={{ background: 'linear-gradient(135deg, var(--brand), color-mix(in oklch, var(--brand) 75%, var(--gold)))' }}
              >
                <Plus className="size-6" strokeWidth={2.5} />
              </motion.span>
              <div className="space-y-0.5 text-center">
                <p className="font-semibold text-[13px] font-semibold tracking-[-0.01em] text-ink">
                  Create reel
                </p>
                <p className="text-[11px] text-fg-muted">Short video</p>
              </div>
            </button>
          </motion.div>
        ) : null}

        {/* Reel thumbnails */}
        <AnimatePresence initial={false}>
          {loading
            ? [0, 1, 2, 3].map((k) => <ReelSkeletonThumb key={k} />)
            : reels.map((post, index) => (
                <ReelThumb key={post.id} post={post} index={index} />
              ))
          }
        </AnimatePresence>
      </div>
    </motion.section>
  )
}
