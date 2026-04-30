import { cn } from '@/lib/utils'

export function BrandMark({ className }) {
  return (
    <span
      className={cn(
        'grid h-full w-full place-items-center text-[1.1em] font-bold leading-none tracking-[-0.04em]',
        className,
      )}
      aria-hidden
    >
      IRC
    </span>
  )
}

export function BrandWordmark({ className, size = 'md' }) {
  const sizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-3xl',
    xl: 'text-5xl',
  }
  return (
    <span
      className={cn(
        'inline-flex items-baseline font-bold leading-none tracking-[-0.06em]',
        sizes[size] ?? sizes.md,
        className,
      )}
    >
      <span>IRC</span>
      <span className="ml-[0.1em] inline-block h-[0.22em] w-[0.22em] translate-y-[-0.05em] rounded-full bg-current" />
    </span>
  )
}
