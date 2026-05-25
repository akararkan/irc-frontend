import { cn } from '@/lib/utils'

/**
 * IRC geometric star mark — emerald 8-point star with an inset brass
 * star and a parchment core. Used across the topbar, sidebar, mobile
 * tabs and auth hero so the brand reads consistently everywhere.
 *
 * `id` must be unique per render location because the gradient is
 * referenced by id; we derive a stable one from the size.
 */
export function IrcMark({ className, gradientId = 'ircMarkGrad' }) {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1FB98E" />
          <stop offset="1" stopColor="#0A4A3C" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${gradientId})`}
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

/** Full lockup: mark + serif "IRC." wordmark. */
export function IrcWordmark({ className, markClassName, showText = true }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <IrcMark className={cn('size-[26px]', markClassName)} />
      {showText ? (
        <span className="font-display text-[20px] font-semibold leading-none tracking-[-0.02em] text-emerald-deep">
          <span style={{ color: 'var(--primary)' }}>IRC</span>
          <span style={{ color: 'var(--warn)' }}>.</span>
        </span>
      ) : null}
    </span>
  )
}
