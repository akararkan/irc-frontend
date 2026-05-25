import { cn } from '@/lib/utils'

export function inputClass(hasError) {
  return cn(
    'h-12 w-full rounded-xl border bg-card px-4 text-[14.5px] text-ink',
    'placeholder:text-fg-faint transition-all outline-none',
    'focus:border-ring focus:bg-card focus:ring-[4px] focus:ring-ring/15',
    hasError
      ? 'border-destructive/55 focus:border-destructive focus:ring-destructive/15'
      : 'border-line',
  )
}
