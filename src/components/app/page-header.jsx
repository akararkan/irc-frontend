import { cn } from '@/lib/utils'

/**
 * PageHeader — editorial hero card used at the top of major pages.
 * - Eyebrow with a small gilt dot
 * - Display-serif title with balanced wrap
 * - Optional `action` slot (right-aligned controls)
 * - Optional `stats` row (3 cells) separated by a dashed top rule
 *   shape: [{ value, label, tone? }] — tone: 'default' | 'gold' | 'brand'
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  stats,
  className,
}) {
  return (
    <section
      className={cn(
        'hairline-gradient relative mb-6 overflow-hidden rounded-2xl border border-border bg-paper px-5 py-5 sm:px-6',
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -top-32 size-80 rounded-full"
        style={{
          background:
            'radial-gradient(circle, color-mix(in oklch, var(--brand) 18%, transparent), transparent 60%)',
        }}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          {eyebrow ? (
            <div className="inline-flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.18em] text-brand">
              <span
                className="size-[5px] rounded-full"
                style={{
                  background: 'var(--gold)',
                  boxShadow:
                    '0 0 0 3px color-mix(in oklch, var(--gold) 25%, transparent)',
                }}
              />
              {eyebrow}
            </div>
          ) : null}

          <h1
            className={cn(
              'mt-2 font-display font-semibold leading-[1.1] tracking-[-0.022em] text-ink text-balance',
              'text-[26px] sm:text-[32px]',
            )}
          >
            {title}
          </h1>

          {description ? (
            <p className="mt-1.5 max-w-[58ch] text-[14px] leading-[1.55] text-ink-3">
              {description}
            </p>
          ) : null}
        </div>

        {action ? (
          <div className="flex shrink-0 items-center gap-2">{action}</div>
        ) : null}
      </div>

      {stats && stats.length ? (
        <div className="mt-4 flex flex-wrap gap-x-7 gap-y-3 border-t border-dashed border-border pt-4">
          {stats.map((s, i) => (
            <div key={i}>
              <div
                className={cn(
                  'font-display text-[22px] font-semibold tracking-[-0.02em] tabular-nums',
                  s.tone === 'gold'
                    ? 'text-gold-2'
                    : s.tone === 'brand'
                      ? 'text-brand'
                      : 'text-ink',
                )}
              >
                {s.value}
              </div>
              <div className="mt-0.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-3">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}
