import { cn } from '@/lib/utils'

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/30 px-6 py-12 text-center',
        className,
      )}
    >
      {Icon ? (
        <div className="grid size-11 place-items-center rounded-full bg-background text-muted-foreground ring-1 ring-border">
          <Icon className="size-5" />
        </div>
      ) : null}
      <div className="space-y-1">
        {title ? <p className="text-sm font-medium text-foreground">{title}</p> : null}
        {description ? (
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  )
}
