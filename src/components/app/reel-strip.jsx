import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Clapperboard, Eye, Play, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Skeleton } from '@/components/ui/skeleton'
import { getReels } from '@/features/posts/posts.api'
import { useAuth } from '@/features/auth/auth-context'
import { cn } from '@/lib/utils'
import { formatNumber, getFullName, resolveMediaUrl } from '@/lib/format'

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
        className="group relative flex h-52 w-36 overflow-hidden rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-950 ring-1 ring-border transition-all hover:ring-foreground/30"
      >
        {videoUrl ? (
          <video
            src={videoUrl}
            muted
            loop
            playsInline
            preload="metadata"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
        ) : thumbUrl ? (
          <img
            src={thumbUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-700 to-zinc-900" />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-black/10" />

        <motion.div
          initial={{ opacity: 0, scale: 0.6 }}
          whileHover={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 380, damping: 22 }}
          className="absolute inset-0 grid place-items-center"
        >
          <span className="grid size-12 place-items-center rounded-full bg-white/95 text-black shadow-2xl backdrop-blur">
            <Play className="size-5 translate-x-[1px] fill-black" />
          </span>
        </motion.div>

        <div className="relative z-10 flex w-full flex-col justify-between p-2.5 text-white">
          <div className="flex items-center">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium backdrop-blur">
              <Clapperboard className="size-2.5" />
              Reel
            </span>
          </div>
          <div className="space-y-1">
            <p className="truncate text-xs font-semibold drop-shadow-sm">
              {getFullName(author) || author.username || 'Unknown'}
            </p>
            <p className="inline-flex items-center gap-1 text-[10px] text-white/80">
              <Eye className="size-2.5" />
              {formatNumber(post.viewCount ?? 0)}
            </p>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

export function ReelStrip() {
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
      <div className="flex items-end justify-between gap-2">
        <h2 className="text-[15px] font-semibold tracking-tight">Reels</h2>
        <Link
          to="/reels"
          className="text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
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
            <Link
              to="/reels"
              className="group flex h-52 w-36 flex-col items-center justify-center gap-2.5 rounded-xl border border-dashed border-border bg-muted/30 p-3 text-center transition-colors hover:border-foreground/40 hover:bg-muted/60"
            >
              <span className="grid size-11 place-items-center rounded-full bg-foreground text-background transition-transform group-hover:scale-110">
                <Plus className="size-5" strokeWidth={2.5} />
              </span>
              <span className="text-[13px] font-semibold">Create reel</span>
              <span className="text-[11px] text-muted-foreground">Short video</span>
            </Link>
          </motion.div>
        ) : null}

        {loading
          ? [0, 1, 2, 3].map((key) => (
              <Skeleton key={key} className="h-52 w-36 shrink-0 rounded-xl" />
            ))
          : reels.map((post, index) => <ReelThumb key={post.id} post={post} index={index} />)}
      </div>
    </section>
  )
}
