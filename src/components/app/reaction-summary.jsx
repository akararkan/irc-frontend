import { motion } from 'motion/react'
import { Heart } from 'lucide-react'

import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/format'

// Single-LIKE summary chip — small filled heart + total count.
// Props `topTypes`, `reactionSet` are accepted but ignored so existing
// call sites compile unchanged.
export function ReactionSummary({
  totalCount = 0,
  size = 'md',
  className,
  // eslint-disable-next-line no-unused-vars
  topTypes,
  // eslint-disable-next-line no-unused-vars
  reactionSet,
}) {
  if (!totalCount) return null

  const dim =
    size === 'sm'
      ? { heart: 'size-[12px]', text: 'text-[11px]' }
      : { heart: 'size-[14px]', text: 'text-[12px]' }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 text-muted-foreground',
        className,
      )}
    >
      <Heart
        className={cn(dim.heart, 'fill-current text-rose-600')}
        strokeWidth={1.6}
      />
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
