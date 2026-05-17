import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

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
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 28 }}
      className={cn(
        'relative overflow-hidden rounded-2xl border-[0.5px] border-border bg-paper',
        className,
      )}
      style={{ boxShadow: 'var(--shadow-sm)' }}
    >
      {/* ── Brand stripe at top ── */}
      <div
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{
          background:
            'linear-gradient(90deg, var(--brand) 0%, var(--gold) 45%, var(--accent-violet) 80%, transparent 100%)',
        }}
      />

      {/* ── Ambient glows ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-28 -top-36 size-80 rounded-full opacity-60"
        style={{
          background:
            'radial-gradient(circle, color-mix(in oklch, var(--gold) 18%, transparent), transparent 65%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-20 bottom-0 size-56 rounded-full opacity-40"
        style={{
          background:
            'radial-gradient(circle, color-mix(in oklch, var(--brand) 16%, transparent), transparent 65%)',
        }}
      />

      <div className="relative px-6 pb-6 pt-7 sm:px-8 sm:pb-7 sm:pt-9">
        {/* ── Top meta row ── */}
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
              {longDate}
            </p>
            {hijri ? (
              <p className="font-display text-[11px] italic text-ink-4">{hijri}</p>
            ) : null}
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-4">
              Est. 2024
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-4">
              No. {issueNumber}
            </p>
          </div>
        </div>

        {/* ── Horizontal rule ── */}
        <div
          className="mb-5 h-px w-full"
          style={{
            background:
              'linear-gradient(90deg, transparent, color-mix(in oklch, var(--foreground) 18%, transparent), transparent)',
          }}
        />

        {/* ── Editorial title block ── */}
        <div className="text-center">
          {/* Diamond ornaments above */}
          <div className="mb-3 flex items-center justify-center gap-4">
            <div
              className="h-px flex-1"
              style={{
                background:
                  'linear-gradient(to right, transparent, color-mix(in oklch, var(--foreground) 14%, transparent))',
              }}
            />
            <div className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block size-[5px] rotate-45"
                style={{ background: 'var(--gold)' }}
              />
              <span
                aria-hidden
                className="inline-block size-2 rotate-45"
                style={{ background: 'var(--gold)' }}
              />
              <span
                aria-hidden
                className="inline-block size-[5px] rotate-45"
                style={{ background: 'var(--gold)' }}
              />
            </div>
            <div
              className="h-px flex-1"
              style={{
                background:
                  'linear-gradient(to left, transparent, color-mix(in oklch, var(--foreground) 14%, transparent))',
              }}
            />
          </div>

          {/* Main title */}
          <h1 className="font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.026em] text-ink sm:text-[36px] md:text-[42px]">
            Islamic Research Community
          </h1>

          {/* Tagline */}
          <p className="mt-2.5 font-display text-[12.5px] italic leading-relaxed tracking-[0.015em] text-ink-3 sm:text-[13.5px]">
            Scholarship &nbsp;·&nbsp; Discussion &nbsp;·&nbsp; Discovery
          </p>

          {/* Dot row below */}
          <div className="mt-4 flex items-center justify-center gap-4">
            <div
              className="h-px flex-1"
              style={{
                background:
                  'linear-gradient(to right, transparent, color-mix(in oklch, var(--foreground) 14%, transparent))',
              }}
            />
            <div className="flex items-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="size-1 rounded-full"
                  style={{ background: 'var(--ink-4)' }}
                />
              ))}
            </div>
            <div
              className="h-px flex-1"
              style={{
                background:
                  'linear-gradient(to left, transparent, color-mix(in oklch, var(--foreground) 14%, transparent))',
              }}
            />
          </div>
        </div>
      </div>
    </motion.section>
  )
}

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
    const day   = parts.find((p) => p.type === 'day')?.value
    const month = parts.find((p) => p.type === 'month')?.value
    const year  = parts.find((p) => p.type === 'year')?.value
    if (!year) return ''
    return `${day} ${month} ${year} AH`
  } catch {
    return ''
  }
}
