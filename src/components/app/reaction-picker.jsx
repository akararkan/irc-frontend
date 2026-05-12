import { cn } from '@/lib/utils'
import { getPostReaction } from '@/lib/reactions'

// Single-LIKE heart toggle (Instagram-style). The backend now only
// accepts LIKE on every /react endpoint, so the old Facebook-style
// palette is gone — one tap toggles, no hover tray.
//
// The component keeps its previous prop surface (`current`, `onSelect`,
// `onClear`, `trigger`, `reactionSet`, `align`, `className`) so the
// many existing call sites keep working unchanged:
//   - `current` is treated as a boolean ("is the viewer reacting?").
//     Any truthy value (`'LIKE'`, `true`, an info object) means yes.
//   - `onSelect` is called with `'LIKE'` on a fresh tap.
//   - `onClear` is called when the viewer unlikes.
//   - `trigger(props)` still gets `{ toggleDefault, current }` so the
//     call site can render its own bespoke heart button.
//   - `reactionSet` / `align` are accepted but no longer affect
//     rendering — the heart is the same everywhere.
export function ReactionPicker({
  current,
  onSelect,
  onClear,
  disabled,
  trigger,
  className,
  // Accepted but unused now — kept so existing call sites compile.
  // eslint-disable-next-line no-unused-vars
  reactionSet,
  // eslint-disable-next-line no-unused-vars
  align,
}) {
  const isReacting = Boolean(current)
  const currentInfo = isReacting ? getPostReaction() : null

  function handleDefault() {
    if (disabled) return
    if (isReacting) onClear?.()
    else onSelect?.('LIKE')
  }

  if (trigger) {
    return (
      <div className={cn('relative inline-flex', className)}>
        {trigger({
          open: handleDefault,
          toggleDefault: handleDefault,
          current: currentInfo,
        })}
      </div>
    )
  }

  return (
    <div className={cn('relative inline-flex', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={handleDefault}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-all duration-200 active:scale-95',
          isReacting
            ? cn(currentInfo.color, currentInfo.bg, 'ring-1', currentInfo.ring)
            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
        )}
        aria-pressed={isReacting}
        aria-label={isReacting ? 'Unlike' : 'Like'}
      >
        <span className="text-[16px] leading-none">{currentInfo?.emoji ?? '♡'}</span>
        <span>{isReacting ? 'Liked' : 'Like'}</span>
      </button>
    </div>
  )
}
