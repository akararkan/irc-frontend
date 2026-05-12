import { cn } from '@/lib/utils'

/**
 * PageHeader — IRC Scholar spec § "section" eyebrow + serif title.
 * - Mono eyebrow with a 32px circled number (or accent dot)
 * - Newsreader serif h1 with italic accent emphasis
 * - Optional `action` slot (right-aligned controls)
 * - Optional `stats` row (3 cells) separated by a hairline rule
 *   shape: [{ value, label, tone? }] — tone: 'default' | 'gold' | 'brand'
 */
export function PageHeader({
  eyebrow,
  number,
  title,
  description,
  action,
  stats,
  className,
}) {
  return (
    <section
      className={cn(
        'mb-8 border-b border-[var(--sidebar-border)] pb-7 sm:pb-8',
        className,
      )}
    >
      {eyebrow ? (
        <div className="mb-4 flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.16em] text-brand">
          {number ? (
            <span className="grid size-8 place-items-center rounded-full border border-brand/50 font-mono text-[11px] tabular-nums">
              {number}
            </span>
          ) : (
            <span
              aria-hidden
              className="size-1.5 rounded-full"
              style={{ background: 'var(--brand)' }}
            />
          )}
          <span>{eyebrow}</span>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1
            className={cn(
              'font-display font-medium leading-[1.05] tracking-[-0.022em] text-ink text-balance',
              'text-[32px] sm:text-[44px]',
            )}
          >
            {title}
          </h1>

          {description ? (
            <p className="mt-4 max-w-[60ch] text-[15px] leading-[1.65] text-ink-2">
              {description}
            </p>
          ) : null}
        </div>

        {action ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>
        ) : null}
      </div>

      {stats && stats.length ? (
        <div className="mt-6 flex flex-wrap gap-x-10 gap-y-3 border-t border-[var(--sidebar-border)] pt-5">
          {stats.map((s, i) => (
            <div key={i}>
              <div
                className={cn(
                  'font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-ink-4',
                )}
              >
                {s.label}
              </div>
              <div
                className={cn(
                  'mt-1 text-[14px] tabular-nums',
                  s.tone === 'gold'
                    ? 'text-gold-2'
                    : s.tone === 'brand'
                      ? 'text-brand'
                      : 'text-ink-2',
                )}
              >
                {s.value}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}
