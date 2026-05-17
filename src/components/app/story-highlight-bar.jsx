import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Plus } from 'lucide-react'

import { StoryViewer } from '@/components/app/story-viewer'
import {
  getHighlightsByUser,
  getHighlightStories,
} from '@/features/stories/stories.api'
import { cn } from '@/lib/utils'
import { resolveMediaUrl } from '@/lib/format'

// ── Skeleton tile ─────────────────────────────────────────────────────
function HighlightSkeleton({ index }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.05 }}
      className="flex shrink-0 flex-col items-center gap-2"
    >
      <div className="size-[60px] rounded-full shimmer" />
      <div className="h-2 w-10 rounded-full shimmer" />
    </motion.div>
  )
}

// ── Single highlight circle ───────────────────────────────────────────
function HighlightCircle({ highlight, index, onClick }) {
  const cover = resolveMediaUrl(highlight.coverUrl)
  // Pick a gradient based on the highlight title's first character
  const GRADIENTS = [
    'linear-gradient(135deg,#0F6E56,#1B7A7F)',
    'linear-gradient(135deg,#6B3B07,#C9A227)',
    'linear-gradient(135deg,#3D2A72,#7B68EE)',
    'linear-gradient(135deg,#7F1D1D,#DB2777)',
    'linear-gradient(135deg,#052E16,#16A34A)',
    'linear-gradient(135deg,#0F172A,#334155)',
  ]
  const fallbackGradient = GRADIENTS[highlight.title?.charCodeAt(0) % GRADIENTS.length] ?? GRADIENTS[0]

  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 10, scale: 0.88 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay: Math.min(index, 6) * 0.055,
        type: 'spring',
        stiffness: 300,
        damping: 26,
      }}
      whileHover={{ y: -4, scale: 1.06 }}
      whileTap={{ scale: 0.93 }}
      className="flex shrink-0 flex-col items-center gap-2 outline-none"
    >
      {/* Circle */}
      <div
        className="size-[60px] overflow-hidden rounded-full"
        style={{
          boxShadow: '0 2px 8px rgba(0,0,0,0.12), 0 0 0 1.5px rgba(0,0,0,0.08)',
        }}
      >
        {cover ? (
          <img
            src={cover}
            alt={highlight.title}
            className="h-full w-full object-cover transition-transform duration-300 hover:scale-110"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ background: fallbackGradient }}
          >
            <span className="text-[22px] font-semibold text-white/90 leading-none">
              {highlight.title?.[0]?.toUpperCase() ?? '★'}
            </span>
          </div>
        )}
      </div>

      <span className="w-[62px] truncate text-center text-[11px] leading-tight text-ink-3">
        {highlight.title}
      </span>
    </motion.button>
  )
}

// ── "New highlight" tile — own profile only ───────────────────────────
function NewHighlightTile() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex shrink-0 flex-col items-center gap-2"
    >
      <motion.button
        type="button"
        whileHover={{ y: -4, scale: 1.06 }}
        whileTap={{ scale: 0.93 }}
        className="flex size-[60px] items-center justify-center rounded-full border-2 border-dashed border-border text-ink-3 transition-colors hover:border-brand/60 hover:text-brand outline-none"
      >
        <Plus className="size-5" strokeWidth={1.7} />
      </motion.button>
      <span className="text-[11px] text-ink-3">New</span>
    </motion.div>
  )
}

// ── Main highlight bar ────────────────────────────────────────────────
export function StoryHighlightBar({ userId, isMe = false }) {
  const [highlights,   setHighlights]   = useState([])
  const [loading,      setLoading]      = useState(true)
  const [viewerGroups, setViewerGroups] = useState(null)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    getHighlightsByUser(userId)
      .then((data) => { if (!cancelled) setHighlights(Array.isArray(data) ? data : []) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [userId])

  async function openHighlight(highlight) {
    try {
      const page = await getHighlightStories(highlight.id, { size: 50 })
      const stories = page?.content ?? page ?? []
      if (!stories.length) return
      setViewerGroups([{ author: { id: userId }, stories, hasUnseen: false }])
    } catch { /* ignore */ }
  }

  if (!loading && highlights.length === 0 && !isMe) return null

  return (
    <>
      <div className="scrollbar-none flex items-end gap-4 overflow-x-auto pb-1">
        {isMe ? <NewHighlightTile /> : null}

        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <HighlightSkeleton key={i} index={i} />)
        ) : (
          highlights.map((h, i) => (
            <HighlightCircle
              key={h.id}
              highlight={h}
              index={i}
              onClick={() => openHighlight(h)}
            />
          ))
        )}
      </div>

      <AnimatePresence>
        {viewerGroups ? (
          <StoryViewer
            groups={viewerGroups}
            initialGroupIndex={0}
            onClose={() => setViewerGroups(null)}
          />
        ) : null}
      </AnimatePresence>
    </>
  )
}
