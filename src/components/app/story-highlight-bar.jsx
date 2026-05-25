import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'

import { StoryViewer } from '@/components/app/story-viewer'
import {
  getHighlightsByUser,
  getHighlightStories,
} from '@/features/stories/stories.api'
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
    '#D4D4D4',
    '#A3A3A3',
    '#737373',
    '#525252',
    '#404040',
    '#262626',
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

// ── Main highlight bar ────────────────────────────────────────────────
// `isMe` is accepted but unused — the bar now renders the same way for
// the owner and for visitors, since the "+ New" creation affordance
// has been removed pending a real highlight-creation flow.
export function StoryHighlightBar({ userId /* , isMe */ }) {
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

  // Hide the bar entirely when there are no real highlights to show
  // (regardless of whose profile this is) — previously we kept it open
  // for the owner just to render a non-functional "+ New" tile.
  if (!loading && highlights.length === 0) return null

  return (
    <>
      <div className="scrollbar-none flex items-end gap-4 overflow-x-auto pb-1">
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
