import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="space-y-4 text-center">
        <p className="font-display text-[72px] font-semibold leading-none tracking-[-0.02em] text-brand">
          404
        </p>
        <p className="font-display text-[18px] font-semibold tracking-[-0.01em] text-ink">
          This page doesn’t exist
        </p>
        <p className="mx-auto max-w-[42ch] text-[13.5px] leading-[1.6] text-ink-3">
          The page you’re looking for may have been moved, removed, or never existed.
        </p>
        <Link
          to="/"
          className="mt-2 inline-flex h-10 items-center rounded-lg bg-brand px-5 text-[13.5px] font-semibold text-brand-foreground transition-colors hover:bg-brand/90"
        >
          Back home
        </Link>
      </div>
    </div>
  )
}
