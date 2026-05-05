import { cn } from '@/lib/utils'

/**
 * Editorial masthead for the home page — purely a styled banner.
 *
 * Renders today's Gregorian and Hijri dates, a serif title with manuscript
 * ornaments, and an issue line derived from the day-of-year. No backend
 * data, no stats — just a typographic frame for the feed beneath it.
 */
export function CommunityMasthead({ className }) {
  const today = new Date()

  const longDate = today.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const hijri = formatHijri(today)
  const issueNumber = dayOfYear(today)

  return (
    <section
      className={cn(
        'hairline-gradient relative overflow-hidden rounded-2xl border border-border bg-paper',
        'px-5 pb-5 pt-5 sm:px-7 sm:pb-6 sm:pt-7',
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -top-40 size-96 rounded-full"
        style={{
          background:
            'radial-gradient(circle, color-mix(in oklch, var(--gold) 14%, transparent), transparent 60%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 -bottom-24 size-64 rounded-full"
        style={{
          background:
            'radial-gradient(circle, color-mix(in oklch, var(--brand) 12%, transparent), transparent 60%)',
        }}
      />

      <div className="relative grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
        <div className="leading-tight">
          <p className="text-[12.5px] font-semibold tracking-tight text-ink">
            {longDate}
          </p>
          {hijri ? (
            <p className="font-display mt-0.5 text-[12.5px] italic text-ink-3">
              {hijri}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-center gap-3 sm:gap-4">
          <span
            aria-hidden
            className="hidden size-2 rotate-45 sm:block"
            style={{ background: 'var(--gold)' }}
          />
          <h1 className="font-display text-[26px] font-semibold tracking-[-0.022em] text-ink sm:text-[32px] md:text-[36px]">
            The Community Daily
          </h1>
          <span
            aria-hidden
            className="hidden size-2 rotate-45 sm:block"
            style={{ background: 'var(--gold)' }}
          />
        </div>

        <div className="text-right text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-3">
          No. {issueNumber} · {today.getFullYear()}
        </div>
      </div>
    </section>
  )
}

// ── Helpers ────────────────────────────────────────────────────────

function dayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0)
  return Math.floor((date - start) / 86_400_000)
}

function formatHijri(date) {
  try {
    const formatter = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    const parts = formatter.formatToParts(date)
    const day = parts.find((p) => p.type === 'day')?.value
    const month = parts.find((p) => p.type === 'month')?.value
    const year = parts.find((p) => p.type === 'year')?.value
    if (!year) return ''
    return `${year} AH · ${day} ${month}`
  } catch {
    return ''
  }
}
