import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'

import { cn } from '@/lib/utils'
import {
  getPostReaction,
  getPostReactionList,
  getQnaReaction,
  getQnaReactionList,
  getResearchReaction,
  getResearchReactionList,
} from '@/lib/reactions'

// Map of `reactionSet` → (resolver, list-builder). Picker / summary
// surfaces choose the palette by passing `reactionSet="qna"` etc.;
// defaulting to "post" preserves the existing call sites.
const REACTION_SETS = {
  post:     { resolve: getPostReaction,     list: getPostReactionList },
  research: { resolve: getResearchReaction, list: getResearchReactionList },
  qna:      { resolve: getQnaReaction,      list: getQnaReactionList },
}

// Facebook-style hover-to-open reaction picker.
//   - Single click on the trigger toggles the default reaction (Like).
//   - Hover (or focus) opens a floating palette of all reactions.
//   - Clicking a palette item picks that reaction (or switches if already reacted).
//   - Long-press also opens the palette (touch-friendly).
//
// `align` controls which edge of the trigger the palette anchors to:
//   - 'left'  (default): palette opens to the right of the trigger's left edge
//   - 'right': palette opens to the left of the trigger's right edge — use
//              when the trigger sits near the right edge of an `overflow-hidden`
//              container (e.g. the reels rail).
export function ReactionPicker({
  current,
  onSelect,
  onClear,
  disabled,
  reactionSet = 'post',
  trigger,
  className,
  align = 'left',
}) {
  const set = REACTION_SETS[reactionSet] ?? REACTION_SETS.post
  const reactionList = set.list()
  const resolve = set.resolve

  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(null)
  const containerRef = useRef(null)
  const closeTimerRef = useRef(null)
  const openTimerRef = useRef(null)
  const longPressTimerRef = useRef(null)

  useEffect(() => {
    function handleOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  useEffect(
    () => () => {
      clearTimeout(closeTimerRef.current)
      clearTimeout(openTimerRef.current)
      clearTimeout(longPressTimerRef.current)
    },
    [],
  )

  const currentInfo = current ? resolve(current) : null

  function scheduleOpen() {
    if (disabled) return
    clearTimeout(closeTimerRef.current)
    clearTimeout(openTimerRef.current)
    openTimerRef.current = setTimeout(() => setOpen(true), 200)
  }
  function scheduleClose() {
    clearTimeout(openTimerRef.current)
    clearTimeout(closeTimerRef.current)
    closeTimerRef.current = setTimeout(() => setOpen(false), 220)
  }
  function keepOpen() {
    clearTimeout(openTimerRef.current)
    clearTimeout(closeTimerRef.current)
    setOpen(true)
  }
  function closeNow() {
    clearTimeout(openTimerRef.current)
    clearTimeout(closeTimerRef.current)
    setOpen(false)
  }

  function handleDefault() {
    if (disabled) return
    if (current) onClear?.()
    else onSelect?.(reactionList[0].type)
  }

  function handlePick(type) {
    if (disabled) return
    onSelect?.(type)
    closeNow()
  }

  function startLongPress() {
    if (disabled) return
    clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = setTimeout(() => setOpen(true), 380)
  }
  function cancelLongPress() {
    clearTimeout(longPressTimerRef.current)
  }

  const isRight = align === 'right'

  return (
    <div
      ref={containerRef}
      className={cn('relative inline-flex', className)}
      onMouseEnter={scheduleOpen}
      onMouseLeave={() => {
        setHovered(null)
        scheduleClose()
      }}
      onFocus={keepOpen}
      onBlur={scheduleClose}
      onTouchStart={startLongPress}
      onTouchEnd={cancelLongPress}
      onTouchMove={cancelLongPress}
      onTouchCancel={cancelLongPress}
    >
      <AnimatePresence>
        {open ? (
          <motion.div
            key="picker"
            role="menu"
            initial={{ opacity: 0, y: 14, scale: 0.82 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.86 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className={cn(
              'absolute -top-[60px] z-30',
              isRight ? 'right-0 origin-bottom-right' : 'left-0 origin-bottom-left',
            )}
            onMouseEnter={keepOpen}
            onMouseLeave={() => {
              setHovered(null)
              scheduleClose()
            }}
          >
            <AnimatePresence>
              {hovered ? (
                <motion.span
                  key={hovered}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.15 }}
                  className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold text-background shadow-md"
                >
                  {hovered}
                </motion.span>
              ) : null}
            </AnimatePresence>
            <div className="flex items-center gap-1 rounded-full border border-border/60 bg-popover/95 px-2 py-1.5 shadow-[0_18px_44px_-12px_rgba(0,0,0,0.30)] backdrop-blur-md">
              {reactionList.map((item, index) => {
                const active = current === item.type
                return (
                  <motion.button
                    key={item.type}
                    type="button"
                    title={item.label}
                    disabled={disabled}
                    onClick={() => handlePick(item.type)}
                    onMouseEnter={() => setHovered(item.label)}
                    onMouseLeave={() => setHovered(null)}
                    initial={{ opacity: 0, y: 12, scale: 0.4 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{
                      type: 'spring',
                      stiffness: 460,
                      damping: 22,
                      delay: index * 0.03,
                    }}
                    whileHover={{ y: -8, scale: 1.42 }}
                    whileTap={{ scale: 0.92 }}
                    className={cn(
                      'grid size-10 place-items-center rounded-full transition-shadow',
                      active && cn('ring-2 ring-offset-2 ring-offset-popover', item.ring),
                    )}
                  >
                    <span className="select-none text-[26px] leading-none drop-shadow-sm">
                      {item.emoji}
                    </span>
                    <span className="sr-only">{item.label}</span>
                  </motion.button>
                )
              })}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {trigger ? (
        trigger({
          open: () => setOpen(true),
          toggleDefault: handleDefault,
          current: currentInfo,
        })
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={handleDefault}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-all duration-200 active:scale-95',
            currentInfo
              ? cn(currentInfo.color, currentInfo.bg, 'ring-1', currentInfo.ring)
              : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
          )}
        >
          <span className="text-[16px] leading-none">
            {currentInfo?.emoji ?? '👍'}
          </span>
          <span>{currentInfo?.label ?? 'Like'}</span>
        </button>
      )}
    </div>
  )
}
