import { cn } from '@/lib/utils'

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-line bg-background px-6 py-10 text-center',
        className,
      )}
    >
      {Icon ? (
        <div className="grid size-12 place-items-center rounded-full bg-brand-soft text-accent-indigo">
          <Icon className="size-5" strokeWidth={1.7} />
        </div>
      ) : null}
      <div className="space-y-1.5">
        {title ? (
          <p className="font-semibold text-[17px] font-semibold tracking-[-0.01em] text-ink">
            {title}
          </p>
        ) : null}
        {description ? (
          <p className="mx-auto max-w-[42ch] text-[13px] leading-[1.6] text-fg-muted">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  )
}
