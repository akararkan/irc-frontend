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

function StarMark({ className }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id="authMark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1FB98E" />
          <stop offset="1" stopColor="#0A4A3C" />
        </linearGradient>
      </defs>
      <path
        fill="url(#authMark)"
        d="M24 2l5.2 5.2 7.4 0 0 7.4L41.8 24l-5.2 5.2 0 7.4-7.4 0L24 41.8 18.8 36.6l-7.4 0 0-7.4L6.2 24l5.2-5.2 0-7.4 7.4 0z"
      />
      <path
        fill="#BD9344"
        opacity="0.92"
        d="M24 11.5l3.4 3.4 4.8 0 0 4.8L35.6 24l-3.4 3.4 0 4.8-4.8 0L24 35.6l-3.4-3.4-4.8 0 0-4.8L12.4 24l3.4-3.4 0-4.8 4.8 0z"
      />
      <circle cx="24" cy="24" r="4.4" fill="#FFFDF7" />
    </svg>
  )
}

export function AuthLayout() {
  const quote = useMemo(
    () => QUOTES[Math.floor(Math.random() * QUOTES.length)],
    [],
  )

  return (
    <div className="flex min-h-[100dvh] bg-background text-foreground">
      {/* ── Brand hero panel ──────────────────────────────── */}
      <aside
        className="relative hidden w-[46%] max-w-[560px] shrink-0 flex-col overflow-hidden p-11 lg:flex"
        style={{
          background:
            'linear-gradient(155deg, var(--brand-dark) 0%, var(--brand-deep) 55%, #0E6B54 130%)',
        }}
      >
        {/* geometric latticework */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(60deg, transparent 0 26px, #FFFFFF 26px 27px), repeating-linear-gradient(-60deg, transparent 0 26px, #FFFFFF 26px 27px)',
          }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -right-24 -bottom-24 size-80 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(31,185,142,0.35), transparent 70%)' }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -right-10 top-16 size-48 rounded-full border"
          style={{ borderColor: 'rgba(216,180,99,0.28)' }}
        />

        <Link to="/" className="relative z-10 flex items-center gap-3">
          <StarMark className="size-11 drop-shadow-[0_4px_10px_rgba(10,74,60,0.5)]" />
          <span className="leading-tight">
            <span className="block font-display text-[19px] font-semibold tracking-[-0.01em] text-white">
              IRC<span className="text-[#D8B463]">.</span>
            </span>
            <span className="block text-[11px] tracking-[0.05em] text-white/55">
              {APP_FULL_NAME}
            </span>
          </span>
        </Link>

        <div className="relative z-10 my-auto">
          <h2 className="max-w-[20ch] font-display text-[34px] font-semibold leading-[1.12] tracking-[-0.02em] text-white">
            Knowledge, research <span className="text-[#D8B463]">&amp;</span> community.
          </h2>
          <p className="mt-4 max-w-[34ch] text-[14.5px] leading-[1.6] text-white/70">
            A scholarly home for posts, reels, questions and peer-reviewed
            research — grounded in tradition.
          </p>
          <blockquote
            className="mt-8 max-w-[40ch] border-l-2 pl-4 font-serif text-[16px] italic leading-[1.6] text-white/85"
            style={{ borderColor: '#D8B463' }}
          >
            “{quote.text}”
            <footer className="mt-2 text-[12px] not-italic text-white/45">
              — {quote.attr}
            </footer>
          </blockquote>
        </div>

        <div className="relative z-10 flex gap-9">
          {STATS.map((s) => (
            <div key={s.label}>
              <div className="font-display text-[22px] font-semibold text-white">
                {s.value}
              </div>
              <div className="text-[10.5px] uppercase tracking-[0.1em] text-white/45">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* ── Form panel ────────────────────────────────────── */}
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2.5 border-b border-line px-5 py-4 lg:hidden">
          <StarMark className="size-9" />
          <span className="font-display text-[16px] font-semibold tracking-[-0.01em]">
            IRC<span className="text-warn">.</span>
          </span>
        </div>

        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-10">
          <div className="w-full max-w-[412px] animate-fade-in">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  )
}
