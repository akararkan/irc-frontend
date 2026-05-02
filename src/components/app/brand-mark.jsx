import { cn } from '@/lib/utils'

/**
 * BrandMark — calligraphic tile used in the sidebar / auth screens.
 * Emerald-teal gradient with a soft gilt highlight in the bottom-right
 * corner; reads as a manuscript initial rather than a generic logo.
 */
export function BrandMark({ className, size = 'md' }) {
  const sizes = {
    sm: 'size-8 rounded-lg text-[12px]',
    md: 'size-9 rounded-xl text-[13.5px]',
    lg: 'size-11 rounded-xl text-[15px]',
    xl: 'size-14 rounded-2xl text-[19px]',
  }
  return (
    <span
      aria-hidden
      className={cn(
        'relative grid shrink-0 place-items-center overflow-hidden',
        'bg-gradient-to-br from-brand to-brand/85 text-brand-foreground',
        'shadow-soft font-display font-semibold leading-none tracking-[-0.04em]',
        sizes[size] ?? sizes.md,
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(120% 120% at 0% 0%, oklch(1 0 0 / 0.22), transparent 55%)',
        }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-1 -right-1 size-3 rounded-full"
        style={{ background: 'var(--gold)', filter: 'blur(6px)', opacity: 0.85 }}
      />
      <span className="relative">IRC</span>
    </span>
  )
}

/**
 * BrandWordmark — Fraunces serif "IRC" with a gilt tracking dot.
 */
export function BrandWordmark({ className, size = 'md' }) {
  const sizes = {
    sm: 'text-[14.5px]',
    md: 'text-[16px]',
    lg: 'text-[20px]',
    xl: 'text-[28px]',
  }
  return (
    <span
      className={cn(
        'font-display inline-flex items-baseline font-semibold tracking-[-0.025em]',
        sizes[size] ?? sizes.md,
        className,
      )}
    >
      <span>IRC</span>
      <span
        className="ml-[0.12em] inline-block h-[0.18em] w-[0.18em] translate-y-[-0.05em] rounded-full"
        style={{ background: 'var(--gold)' }}
      />
    </span>
  )
}
