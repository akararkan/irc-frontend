import { useMemo } from 'react'
import { AnimatePresence, motion } from 'motion/react'

import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/format'
import { getPostReaction, getResearchReaction } from '@/lib/reactions'

// Stacked top-3 reaction emojis + total count, ordered most → least.
// If only one type exists, only that single emoji shows.
export function ReactionSummary({
  totalCount = 0,
  topTypes = [],
  reactionSet = 'post',
  size = 'md',
  className,
}) {
  if (!totalCount) return null

  const resolver = reactionSet === 'research' ? getResearchReaction : getPostReaction

  const types = useMemo(() => {
    const raw = topTypes?.length ? topTypes : ['LIKE']
    // Dedupe (preserve most→least order) and cap at the actual reaction
    // count so a post with 2 reactions never shows 3 emoji bubbles.
    const seen = new Set()
    const unique = []
    for (const type of raw) {
      if (seen.has(type)) continue
      seen.add(type)
      unique.push(type)
    }
    return unique.slice(0, Math.min(3, totalCount))
  }, [topTypes, totalCount])

  const dim =
    size === 'sm'
      ? { circle: 'size-[18px]', emoji: 'text-[12px]', text: 'text-[11px]' }
      : { circle: 'size-[22px]', emoji: 'text-[13px]', text: 'text-[12px]' }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 text-muted-foreground',
        className,
      )}
    >
      <div className="flex -space-x-1.5">
        <AnimatePresence initial={false}>
          {types.map((type, index) => {
            const info = resolver(type)
            return (
              <motion.span
                key={`${type}-${index}`}
                initial={{ opacity: 0, scale: 0.4, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.4 }}
                transition={{ type: 'spring', stiffness: 380, damping: 24 }}
                style={{ zIndex: 10 - index }}
                title={info.label}
                className={cn(
                  'inline-flex items-center justify-center rounded-full border-2 border-background bg-card shadow-sm',
                  dim.circle,
                )}
              >
                <span className={cn('-mt-px leading-none', dim.emoji)}>
                  {info.emoji}
                </span>
              </motion.span>
            )
          })}
        </AnimatePresence>
      </div>
      <motion.span
        key={totalCount}
        initial={{ scale: 0.85, opacity: 0.6 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 28 }}
        className={cn('font-semibold tabular-nums text-foreground/80', dim.text)}
      >
        {formatNumber(totalCount)}
      </motion.span>
    </div>
  )
}
