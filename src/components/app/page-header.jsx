import { cn } from '@/lib/utils'

export function PageHeader({ title, description, action, eyebrow, className }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0 space-y-2">
        {eyebrow ? (
          <p className="inline-flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            <span
              aria-hidden
              className="inline-block h-px w-6 bg-brand/60"
            />
            <span className="text-brand">{eyebrow}</span>
          </p>
        ) : null}
        <h1 className="font-display text-[34px] leading-[1.05] tracking-[-0.012em] text-foreground sm:text-[42px]">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? (
        <div className="flex shrink-0 items-center gap-2">{action}</div>
      ) : null}
    </div>
  )
}
