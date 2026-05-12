import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Clapperboard, Eye, Play, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Skeleton } from '@/components/ui/skeleton'
import { getReels } from '@/features/posts/posts.api'
import { useAuth } from '@/features/auth/auth-context'
import { cn } from '@/lib/utils'
import {
  formatNumber,
  getFullName,
  getHandle,
  resolveMediaUrl,
} from '@/lib/format'

function normalizeAuthor(post) {
  if (post.author) {
    return {
      id: post.author.id,
      username: post.author.username,
      fullName: post.author.fullName,
      profileImage: post.author.avatarUrl,
    }
  }
  return {
    username: post.authorUsername,
    profileImage: post.authorProfileImage,
  }
}

function ReelThumb({ post, index }) {
  const media = post.mediaList?.[0]
  const author = normalizeAuthor(post)
  const thumbUrl = resolveMediaUrl(media?.thumbnailUrl ?? media?.mediaThumbnailUrl)
  const videoUrl = media?.mediaType === 'VIDEO' ? resolveMediaUrl(media?.url) : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        type: 'spring',
        stiffness: 260,
        damping: 26,
        delay: Math.min(index, 6) * 0.04,
      }}
      whileHover={{ y: -6, scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      className="shrink-0"
    >
      <Link
        to={`/reels?id=${post.id}`}
        className={cn(
          'group relative flex h-52 w-36 overflow-hidden rounded-2xl border border-border bg-paper',
          'transition-all hover:border-brand/30',
        )}
      >
        {videoUrl ? (
          // Browsers paint a blank canvas for `<video>` until a frame
          // is decoded — `preload="metadata"` alone often shows black.
          // Seeking to ~0.1 s once metadata lands forces the decoder
          // to render that frame, which then sits in the element as
          // the de-facto poster image. Cheaper than generating a
          // thumbnail server-side and works without any backend
          // changes. `poster` overrides the seeked frame if the
          // backend ever ships a real thumbnail URL.
          <video
            src={videoUrl}
            poster={thumbUrl || undefined}
            muted
            playsInline
            preload="metadata"
            disablePictureInPicture
            controlsList="nodownload nofullscreen noremoteplayback"
            onLoadedMetadata={(event) => {
              const el = event.currentTarget
              try {
                if (el.duration > 0.2) el.currentTime = 0.1
              } catch {
                /* some browsers throw if seek is too early; non-fatal */
              }
            }}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : thumbUrl ? (
          <img
            src={thumbUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background: `repeating-linear-gradient(${
                ((index ?? 0) * 37) % 180
              }deg, var(--brand-soft) 0 14px, color-mix(in oklch, var(--brand-soft) 50%, var(--paper)) 14px 28px)`,
            }}
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/10" />

        <motion.div
          initial={{ opacity: 0, scale: 0.6 }}
          whileHover={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 380, damping: 22 }}
          className="absolute inset-0 grid place-items-center"
        >
          <span className="grid size-12 place-items-center rounded-full bg-paper/95 text-ink shadow-soft-lg backdrop-blur">
            <Play className="size-5 translate-x-[1px] fill-current" />
          </span>
        </motion.div>

        <div className="relative z-10 flex w-full flex-col justify-between p-2.5 text-white">
          <div className="flex items-center">
            <span className="inline-flex items-center gap-1 rounded-md bg-black/45 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] backdrop-blur">
              <Clapperboard className="size-2.5" />
              Reel
            </span>
          </div>
          <div className="space-y-1">
            <p className="font-display text-[13px] font-semibold leading-[1.25] tracking-[-0.005em] drop-shadow-sm">
              {getFullName(author) || getHandle(author) || 'Unknown'}
            </p>
            <p className="inline-flex items-center gap-1 font-mono text-[10px] tabular-nums text-white/85">
              <Eye className="size-2.5" />
              {formatNumber(post.viewCount ?? 0)}
            </p>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

export function ReelStrip({ onCreateReel }) {
  const { isAuthenticated } = useAuth()
  const [reels, setReels] = useState([])
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
    return () => {
      cancelled = true
    }
  }, [])

  if (!loading && reels.length === 0 && !isAuthenticated) return null

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display inline-flex items-center gap-2 text-[15px] font-semibold tracking-[-0.005em]">
          <span
            aria-hidden
            className="inline-block h-[1.5px] w-4 rounded-full"
            style={{ background: 'var(--gold)' }}
          />
          Featured reels
        </h2>
        <Link
          to="/reels"
          className="text-[11.5px] font-semibold text-brand transition-colors hover:underline"
        >
          See all →
        </Link>
      </div>

      <div className={cn('flex gap-3 overflow-x-auto pb-2 pt-1 scrollbar-none')}>
        {isAuthenticated ? (
          <motion.div
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 340, damping: 26 }}
            className="shrink-0"
          >
            <button
              type="button"
              onClick={() => onCreateReel?.()}
              className={cn(
                'group flex h-52 w-36 flex-col items-center justify-center gap-2.5 rounded-2xl border border-dashed border-border bg-paper p-3 text-center',
                'transition-colors hover:border-brand/40 hover:bg-brand-soft/40',
              )}
            >
              <span className="grid size-11 place-items-center rounded-full bg-gradient-to-br from-brand to-brand/85 text-brand-foreground shadow-soft transition-transform group-hover:scale-110">
                <Plus className="size-5" strokeWidth={2.5} />
              </span>
              <span className="font-display text-[13px] font-semibold tracking-[-0.005em]">Create reel</span>
              <span className="text-[11px] text-ink-3">Short video</span>
            </button>
          </motion.div>
        ) : null}

        {loading
          ? [0, 1, 2, 3].map((key) => (
              <Skeleton key={key} className="h-52 w-36 shrink-0 rounded-2xl" />
            ))
          : reels.map((post, index) => <ReelThumb key={post.id} post={post} index={index} />)}
      </div>
    </section>
  )
}
