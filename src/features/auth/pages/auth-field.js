import { cn } from '@/lib/utils'

export function inputClass(hasError) {
  return cn(
    'h-11 w-full rounded-lg border bg-secondary px-3.5 text-[14px] text-ink',
    'placeholder:text-ink-4 transition-colors outline-none',
    'focus:border-brand/50 focus:bg-paper focus:ring-[3px] focus:ring-brand/15',
    hasError
      ? 'border-destructive/55 focus:border-destructive focus:ring-destructive/15'
      : 'border-border',
  )
}
