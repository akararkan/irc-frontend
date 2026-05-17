import { useMemo } from 'react'
import { Link, Outlet } from 'react-router-dom'

import { APP_FULL_NAME } from '@/config/env'

const QUOTES = [
  {
    text: 'The ink of the scholar is more sacred than the blood of the martyr.',
    attr: 'Prophetic tradition',
  },
  {
    text: 'Seeking knowledge is an obligation upon every Muslim.',
    attr: 'Prophetic tradition',
  },
  {
    text: 'Whoever travels a path in search of knowledge, God makes easy for them a path to Paradise.',
    attr: 'Prophetic tradition',
  },
]

const STATS = [
  { value: '12.4k', label: 'Researchers' },
  { value: '48k', label: 'Papers' },
  { value: '96k', label: 'Questions' },
]

export function AuthLayout() {
  const quote = useMemo(
    () => QUOTES[Math.floor(Math.random() * QUOTES.length)],
    [],
  )

  return (
    <div className="flex min-h-[100dvh] bg-background text-foreground">
      {/* ── Brand panel ───────────────────────────────────── */}
      <aside
        className="relative hidden w-[44%] max-w-[520px] shrink-0 flex-col overflow-hidden p-10 lg:flex"
        style={{ background: 'var(--brand-dark, #15243B)' }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -right-16 -bottom-16 size-72 rounded-full"
          style={{ background: 'var(--brand-deep, #1E3A5F)' }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute right-10 -top-14 size-40 rounded-full border"
          style={{
            borderColor:
              'color-mix(in oklch, var(--brand) 28%, transparent)',
          }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            background:
              'repeating-linear-gradient(115deg, transparent 0 22px, #FFFFFF 22px 23px)',
          }}
        />

        <Link to="/" className="relative z-10 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-brand font-display text-[14px] font-semibold tracking-[0.03em] text-brand-foreground">
            IRC
          </span>
          <span className="leading-tight">
            <span className="block font-display text-[16px] font-semibold text-white">
              Scholar
            </span>
            <span className="block text-[11px] tracking-[0.04em] text-white/55">
              {APP_FULL_NAME}
            </span>
          </span>
        </Link>

        <div className="relative z-10 my-auto">
          <h2 className="font-display text-[26px] font-medium leading-[1.3] text-white">
            Knowledge, research &amp; community.
          </h2>
          <blockquote className="mt-5 border-l-2 border-brand pl-4 font-display text-[14px] italic leading-[1.65] text-white/70">
            “{quote.text}”
            <footer className="mt-2 text-[12px] not-italic text-white/45">
              — {quote.attr}
            </footer>
          </blockquote>
        </div>

        <div className="relative z-10 flex gap-8">
          {STATS.map((s) => (
            <div key={s.label}>
              <div className="font-display text-[18px] font-semibold text-white">
                {s.value}
              </div>
              <div className="text-[10.5px] uppercase tracking-[0.08em] text-white/45">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* ── Form panel ────────────────────────────────────── */}
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2.5 border-b border-border px-5 py-4 lg:hidden">
          <span className="grid size-9 place-items-center rounded-lg bg-brand font-display text-[12px] font-semibold text-brand-foreground">
            IRC
          </span>
          <span className="font-display text-[15px] font-semibold tracking-[-0.01em]">
            Scholar
          </span>
        </div>

        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-10">
          <div className="w-full max-w-[400px]">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  )
}
