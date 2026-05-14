import { Popover as PopoverPrimitive } from 'radix-ui'
import {
  ALargeSmall,
  AlignJustify,
  Check,
  Languages,
  Layers,
  Moon,
  Palette,
  RotateCcw,
  Rows3,
  Sun,
  Type,
  Wind,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  ACCENT_OPTIONS,
  DENSITY_OPTIONS,
  FONT_OPTIONS,
  FONT_SCALE_OPTIONS,
  LINE_HEIGHT_OPTIONS,
  PAGE_BG_OPTIONS,
  RADIUS_OPTIONS,
  useTweaks,
} from '@/features/tweaks/tweaks-context'
import { LANGUAGES } from '@/i18n'
import { cn } from '@/lib/utils'

const Popover = PopoverPrimitive.Root

function PopoverTrigger({ asChild, children, ...props }) {
  return (
    <PopoverPrimitive.Trigger asChild={asChild} {...props}>
      {children}
    </PopoverPrimitive.Trigger>
  )
}

function PopoverContent({ className, align = 'end', sideOffset = 8, children, ...props }) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'scrollbar-none z-50 max-h-[calc(100dvh-4rem)] w-[min(calc(100vw-1rem),340px)] origin-[var(--radix-popover-content-transform-origin)] overflow-y-auto rounded-2xl border border-border bg-paper p-0 shadow-soft-lg outline-none',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          className,
        )}
        {...props}
      >
        {children}
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  )
}

// ─── Section label ──────────────────────────────────────────────────
function SectionLabel({ children, icon: Icon }) {
  return (
    <p className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-3">
      {Icon ? <Icon className="size-3" strokeWidth={1.5} /> : null}
      {children}
    </p>
  )
}

// ─── Theme (light / dark) ───────────────────────────────────────────
function ThemeToggle({ value, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-1.5 rounded-xl border-[0.5px] border-border bg-secondary/50 p-1.5">
      {[
        { value: 'light', label: 'Light', icon: Sun  },
        { value: 'dark',  label: 'Dark',  icon: Moon },
      ].map(({ value: v, label, icon: Icon }) => {
        const active = v === value
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={cn(
              'relative flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[13px] font-semibold transition-all',
              active
                ? v === 'dark'
                  ? 'bg-ink text-paper shadow-sm'
                  : 'bg-paper text-ink shadow-[0_0_0_0.5px_var(--border)]'
                : 'text-ink-3 hover:text-ink',
            )}
          >
            <Icon className="size-4" strokeWidth={active ? 2 : 1.6} />
            {label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Accent color grid ──────────────────────────────────────────────
function AccentGrid({ value, onChange }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {ACCENT_OPTIONS.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'group relative flex flex-col items-center gap-1.5 rounded-xl border-[0.5px] px-2 py-3 text-center transition-all',
              active
                ? 'border-ink/30 bg-paper shadow-[0_0_0_2px_var(--brand)]'
                : 'border-border bg-secondary/40 hover:bg-secondary',
            )}
            title={opt.hint}
          >
            <span
              className="size-6 rounded-full shadow-sm ring-2 ring-paper"
              style={{ background: opt.swatch }}
            />
            <span className={cn('text-[11px] font-medium leading-none', active ? 'text-ink' : 'text-ink-3')}>
              {opt.label}
            </span>
            {active ? (
              <span className="absolute right-1.5 top-1.5 grid size-4 place-items-center rounded-full bg-brand text-paper">
                <Check className="size-2.5" strokeWidth={2.5} />
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

// ─── Background color swatches ──────────────────────────────────────
function PageBgGrid({ value, onChange, isDark }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {PAGE_BG_OPTIONS.map((opt) => {
        const active = opt.value === value
        const swatch = isDark ? opt.swatchDark : opt.swatch
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex flex-col items-center gap-1.5 rounded-xl border-[0.5px] px-2 py-2.5 transition-all',
              active
                ? 'border-brand/50 shadow-[0_0_0_1.5px_var(--brand)]'
                : 'border-border hover:border-ink/30',
            )}
            title={opt.hint}
          >
            <span
              className="size-8 rounded-lg border border-border/60 shadow-sm"
              style={{ background: swatch }}
            />
            <span className={cn('text-[10.5px] font-medium leading-none', active ? 'text-brand' : 'text-ink-3')}>
              {opt.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Corner radius ──────────────────────────────────────────────────
function RadiusPicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {RADIUS_OPTIONS.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex flex-col items-center gap-2 rounded-xl border-[0.5px] px-3 py-3 transition-all',
              active
                ? 'border-brand/40 bg-paper shadow-[0_0_0_1.5px_var(--brand)]'
                : 'border-border bg-secondary/40 hover:bg-secondary',
            )}
            title={opt.hint}
          >
            {/* Visual preview of the radius */}
            <span
              className="size-8 border-2 border-ink/30 bg-transparent"
              style={{ borderRadius: opt.preview }}
            />
            <span className={cn('text-[11px] font-semibold leading-none', active ? 'text-brand' : 'text-ink-3')}>
              {opt.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Font size ──────────────────────────────────────────────────────
function FontScaleRow({ value, onChange }) {
  return (
    <div className="grid grid-cols-4 gap-1 rounded-xl border-[0.5px] border-border bg-secondary/50 p-1">
      {FONT_SCALE_OPTIONS.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            title={opt.hint}
            className={cn(
              'flex flex-col items-center gap-1 rounded-lg px-2 py-2.5 transition-all',
              active
                ? 'bg-paper text-brand shadow-[0_0_0_0.5px_var(--border)]'
                : 'text-ink-3 hover:text-ink',
            )}
          >
            <span
              className="font-display font-semibold leading-none"
              style={{ fontSize: `${opt.factor * 18}px` }}
            >
              A
            </span>
            <span className="text-[9.5px] uppercase tracking-wider">{opt.label.charAt(0)}</span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Display font ───────────────────────────────────────────────────
function FontRow({ value, onChange }) {
  const previewFont = (v) =>
    v === 'cormorant'
      ? '"Cormorant Garamond", Georgia, serif'
      : v === 'system'
        ? '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
        : '"Fraunces", Georgia, serif'

  return (
    <div className="space-y-1">
      {FONT_OPTIONS.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl border-[0.5px] px-3 py-2.5 transition-all',
              active
                ? 'border-brand/40 bg-paper shadow-[0_0_0_0.5px_var(--border)]'
                : 'border-transparent hover:border-border hover:bg-secondary/50',
            )}
          >
            <span
              className="shrink-0 text-[22px] font-semibold leading-none text-ink"
              style={{ fontFamily: previewFont(opt.value) }}
            >
              Aa
            </span>
            <div className="min-w-0 flex-1 text-left leading-tight">
              <p className="text-[13px] font-semibold text-ink" style={{ fontFamily: previewFont(opt.value) }}>
                {opt.label}
              </p>
              <p className="text-[11px] text-ink-3">{opt.hint}</p>
            </div>
            {active ? <Check className="size-3.5 shrink-0 text-brand" /> : null}
          </button>
        )
      })}
    </div>
  )
}

// ─── Line height ────────────────────────────────────────────────────
function LineHeightRow({ value, onChange }) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-xl border-[0.5px] border-border bg-secondary/50 p-1">
      {LINE_HEIGHT_OPTIONS.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            title={opt.hint}
            className={cn(
              'flex flex-col items-center gap-1.5 rounded-lg px-2 py-2.5 transition-all',
              active
                ? 'bg-paper text-brand shadow-[0_0_0_0.5px_var(--border)]'
                : 'text-ink-3 hover:text-ink',
            )}
          >
            {/* Visual preview — 3 lines with varying spacing */}
            <span className="flex flex-col gap-0 w-6" style={{ rowGap: `${(opt.factor - 1) * 10}px` }}>
              {[6, 5, 4].map((w, i) => (
                <span
                  key={i}
                  className={cn('h-[2px] rounded-full', active ? 'bg-brand' : 'bg-ink-3')}
                  style={{ width: `${w * 4}px` }}
                />
              ))}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider leading-none">
              {opt.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Density ────────────────────────────────────────────────────────
function DensityRow({ value, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl border-[0.5px] border-border bg-secondary/50 p-1">
      {DENSITY_OPTIONS.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            title={opt.hint}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition-all',
              active
                ? 'bg-paper text-ink shadow-[0_0_0_0.5px_var(--border)]'
                : 'text-ink-3 hover:text-ink',
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── iOS-style switch ───────────────────────────────────────────────
function SwitchRow({ label, hint, checked, onChange, icon: Icon }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 rounded-xl border-[0.5px] border-border bg-secondary/30 px-3 py-2.5 text-left transition-colors hover:bg-secondary/60"
      aria-pressed={checked}
    >
      {Icon ? (
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-muted text-ink-2">
          <Icon className="size-[15px]" strokeWidth={1.6} />
        </span>
      ) : null}
      <div className="min-w-0 flex-1 leading-tight">
        <p className="text-[13px] font-semibold text-ink">{label}</p>
        {hint ? <p className="mt-0.5 text-[11px] text-ink-3">{hint}</p> : null}
      </div>
      <span
        className={cn(
          'relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full border transition-colors',
          checked ? 'border-brand bg-brand' : 'border-border bg-muted',
        )}
      >
        <span
          className={cn(
            'pointer-events-none absolute left-[2px] size-[16px] rounded-full bg-paper shadow-sm transition-transform',
            checked && 'translate-x-[16px]',
          )}
        />
      </span>
    </button>
  )
}

// ─── Language picker ────────────────────────────────────────────────
function LanguagePicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {LANGUAGES.map((lang) => {
        const active = value === lang.code
        return (
          <button
            key={lang.code}
            type="button"
            onClick={() => onChange(lang.code)}
            className={cn(
              'flex flex-col items-center gap-1.5 rounded-xl border-[0.5px] px-2 py-3 transition-all',
              active
                ? 'border-brand/40 bg-paper shadow-[0_0_0_1.5px_var(--brand)]'
                : 'border-border bg-secondary/40 hover:bg-secondary',
            )}
            title={lang.label}
            dir={lang.dir}
          >
            <span className={cn('text-[18px] font-semibold leading-none', active ? 'text-brand' : 'text-ink')}>
              {lang.code === 'en' ? 'A' : lang.code === 'ar' ? 'ع' : 'ک'}
            </span>
            <span className={cn('text-[11px] font-medium leading-none', active ? 'text-brand' : 'text-ink-3')}>
              {lang.nativeLabel}
            </span>
            {active ? (
              <span className="absolute right-1.5 top-1.5 grid size-3.5 place-items-center rounded-full bg-brand text-paper">
                <Check className="size-2.5" strokeWidth={2.5} />
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

// ─── Main menu ──────────────────────────────────────────────────────
export function TweaksMenu({ trigger }) {
  const {
    theme, accent, displayFont, fontScale, density,
    pageBg, radius, lineHeight, reducedMotion, isDark, lang,
    setTheme, setAccent, setDisplayFont, setFontScale, setDensity,
    setPageBg, setRadius, setLineHeight, setReducedMotion, setLang, reset,
  } = useTweaks()

  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent>
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b-[0.5px] border-border px-5 py-4">
          <div>
            <p className="font-display text-[16px] font-semibold leading-none tracking-[-0.012em] text-ink">
              Appearance
            </p>
            <p className="mt-0.5 text-[11.5px] text-ink-3">
              Saved on this device
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="rounded-lg text-ink-3 hover:text-ink"
            onClick={reset}
            title="Reset to defaults"
          >
            <RotateCcw className="size-3.5" />
          </Button>
        </div>

        {/* ── Controls ───────────────────────────────────────── */}
        <div className="space-y-5 p-4">

          {/* Theme */}
          <div>
            <SectionLabel icon={Sun}>Theme</SectionLabel>
            <ThemeToggle value={theme} onChange={setTheme} />
          </div>

          {/* Accent */}
          <div>
            <SectionLabel icon={Palette}>Accent colour</SectionLabel>
            <AccentGrid value={accent} onChange={setAccent} />
          </div>

          {/* Background */}
          <div>
            <SectionLabel icon={Layers}>Background</SectionLabel>
            <PageBgGrid value={pageBg} onChange={setPageBg} isDark={isDark} />
          </div>

          {/* Corner radius */}
          <div>
            <SectionLabel icon={Palette}>Corner style</SectionLabel>
            <RadiusPicker value={radius} onChange={setRadius} />
          </div>

          {/* Font size */}
          <div>
            <SectionLabel icon={ALargeSmall}>Text size</SectionLabel>
            <FontScaleRow value={fontScale} onChange={setFontScale} />
          </div>

          {/* Display font */}
          <div>
            <SectionLabel icon={Type}>Display font</SectionLabel>
            <FontRow value={displayFont} onChange={setDisplayFont} />
          </div>

          {/* Line height */}
          <div>
            <SectionLabel icon={AlignJustify}>Line spacing</SectionLabel>
            <LineHeightRow value={lineHeight} onChange={setLineHeight} />
          </div>

          {/* Density */}
          <div>
            <SectionLabel icon={Rows3}>Density</SectionLabel>
            <DensityRow value={density} onChange={setDensity} />
          </div>

          {/* Motion */}
          <div>
            <SectionLabel icon={Wind}>Accessibility</SectionLabel>
            <SwitchRow
              icon={Wind}
              label="Reduce motion"
              hint="Calms transitions and animations"
              checked={reducedMotion}
              onChange={setReducedMotion}
            />
          </div>

          {/* Language */}
          <div className="relative">
            <SectionLabel icon={Languages}>Language · زمان · زمان</SectionLabel>
            <LanguagePicker value={lang ?? 'en'} onChange={setLang} />
          </div>

          {/* Live preview */}
          <div className="rounded-xl border-[0.5px] border-dashed border-border bg-secondary/30 p-4">
            <p className="mb-2 font-mono text-[9.5px] uppercase tracking-[0.18em] text-brand">
              Preview
            </p>
            <p className="font-display text-[19px] font-semibold leading-[1.15] tracking-[-0.018em] text-ink">
              What scholars are reading today.
            </p>
            <p className="mt-1 text-[12px] text-ink-3">
              Body text uses the system sans for clarity and legibility across languages.
            </p>
            <div className="mt-3 flex gap-2">
              <span className="rx pointer-events-none text-[12px]">♡ Like</span>
              <span className="rx pointer-events-none text-[12px]">💬 Comment</span>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
