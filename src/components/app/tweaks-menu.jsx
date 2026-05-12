import { Popover as PopoverPrimitive } from 'radix-ui'
import {
  ALargeSmall,
  Check,
  ChevronDown,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ACCENT_OPTIONS,
  DENSITY_OPTIONS,
  FONT_OPTIONS,
  FONT_SCALE_OPTIONS,
  useTweaks,
} from '@/features/tweaks/tweaks-context'
import { cn } from '@/lib/utils'

const Popover = PopoverPrimitive.Root
const PopoverAnchor = PopoverPrimitive.Anchor
const PopoverPortal = PopoverPrimitive.Portal

function PopoverTrigger({ asChild, children, ...props }) {
  return (
    <PopoverPrimitive.Trigger asChild={asChild} {...props}>
      {children}
    </PopoverPrimitive.Trigger>
  )
}

function PopoverContent({ className, align = 'end', sideOffset = 8, children, ...props }) {
  return (
    <PopoverPortal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 max-h-[calc(100dvh-5rem)] w-[320px] origin-[var(--radix-popover-content-transform-origin)] overflow-y-auto rounded-2xl border border-border bg-paper p-4 shadow-soft-lg outline-none',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          className,
        )}
        {...props}
      >
        {children}
      </PopoverPrimitive.Content>
    </PopoverPortal>
  )
}

function SectionLabel({ children, icon: Icon }) {
  return (
    <p className="mb-1.5 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-3">
      {Icon ? <Icon className="size-3" /> : null}
      {children}
    </p>
  )
}

function ThemeToggle({ value, onChange }) {
  const options = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark',  label: 'Dark',  icon: Moon },
  ]
  return (
    <div className="relative grid grid-cols-2 gap-1 rounded-xl border border-border bg-muted/50 p-1">
      {options.map(({ value: v, label, icon: Icon }) => {
        const active = v === value
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={cn(
              'relative inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors',
              active
                ? 'border border-brand/25 bg-paper text-brand shadow-soft'
                : 'text-ink-3 hover:text-ink',
            )}
          >
            <Icon className="size-[15px]" strokeWidth={active ? 2.1 : 1.7} />
            {label}
          </button>
        )
      })}
    </div>
  )
}

function AccentSelect({ value, onChange }) {
  const current = ACCENT_OPTIONS.find((o) => o.value === value) ?? ACCENT_OPTIONS[0]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex w-full items-center gap-2.5 rounded-lg border border-border bg-paper px-3 py-2 text-left',
            'text-[13px] text-ink transition-colors hover:border-brand/40',
          )}
        >
          <span
            aria-hidden
            className="size-[14px] shrink-0 rounded-full border border-border"
            style={{ background: current.swatch }}
          />
          <span className="min-w-0 flex-1 truncate font-semibold">{current.label}</span>
          <ChevronDown className="size-3.5 shrink-0 text-ink-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="w-[268px] rounded-xl border-border bg-paper p-1 shadow-soft-lg"
      >
        {ACCENT_OPTIONS.map((opt) => {
          const active = opt.value === value
          return (
            <DropdownMenuItem
              key={opt.value}
              onSelect={() => onChange(opt.value)}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-2.5 py-2',
                active && 'bg-brand-soft/60 text-brand',
              )}
            >
              <span
                aria-hidden
                className="size-[14px] shrink-0 rounded-full border border-border"
                style={{ background: opt.swatch }}
              />
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-[13px] font-semibold">{opt.label}</p>
                <p className="truncate text-[11px] text-ink-3">{opt.hint}</p>
              </div>
              {active ? <Check className="size-3.5 text-brand" /> : null}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function FontSelect({ value, onChange }) {
  const current = FONT_OPTIONS.find((o) => o.value === value) ?? FONT_OPTIONS[0]
  const previewFont = (v) =>
    v === 'cormorant'
      ? '"Cormorant Garamond", Georgia, serif'
      : v === 'system'
        ? '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif'
        : '"Fraunces", Georgia, serif'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex w-full items-center gap-2.5 rounded-lg border border-border bg-paper px-3 py-2 text-left',
            'text-[13px] text-ink transition-colors hover:border-brand/40',
          )}
        >
          <span
            aria-hidden
            className="grid size-[22px] shrink-0 place-items-center rounded-md border border-border bg-muted text-[14px] font-semibold leading-none text-ink"
            style={{ fontFamily: previewFont(current.value) }}
          >
            Aa
          </span>
          <span className="min-w-0 flex-1 truncate font-semibold">{current.label}</span>
          <ChevronDown className="size-3.5 shrink-0 text-ink-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="w-[268px] rounded-xl border-border bg-paper p-1 shadow-soft-lg"
      >
        {FONT_OPTIONS.map((opt) => {
          const active = opt.value === value
          return (
            <DropdownMenuItem
              key={opt.value}
              onSelect={() => onChange(opt.value)}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-2.5 py-2',
                active && 'bg-brand-soft/60 text-brand',
              )}
            >
              <span
                aria-hidden
                className="grid size-[26px] shrink-0 place-items-center rounded-md border border-border bg-muted text-[15px] font-semibold leading-none"
                style={{ fontFamily: previewFont(opt.value) }}
              >
                Aa
              </span>
              <div className="min-w-0 flex-1 leading-tight">
                <p
                  className="truncate text-[13px] font-semibold"
                  style={{ fontFamily: previewFont(opt.value) }}
                >
                  {opt.label}
                </p>
                <p className="truncate text-[11px] text-ink-3">{opt.hint}</p>
              </div>
              {active ? <Check className="size-3.5 text-brand" /> : null}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Four-step font-size selector. Each step renders its own preview
// "Aa" at the actual scale factor so the user reads the choice
// before applying it. Layout mirrors the theme toggle so the menu
// reads as one consistent control system.
function FontScaleSelect({ value, onChange }) {
  return (
    <div className="grid grid-cols-4 gap-1 rounded-xl border border-border bg-muted/50 p-1">
      {FONT_SCALE_OPTIONS.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            title={`${opt.label} — ${opt.hint}`}
            className={cn(
              'group/scale relative inline-flex flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-2 text-[11.5px] font-semibold transition-colors',
              active
                ? 'border border-brand/25 bg-paper text-brand shadow-soft'
                : 'text-ink-3 hover:text-ink',
            )}
            aria-pressed={active}
            aria-label={opt.label}
          >
            <span
              aria-hidden
              className="font-display font-semibold leading-none text-ink"
              style={{ fontSize: `${opt.factor * 18}px` }}
            >
              {opt.sample}
            </span>
            <span className="text-[10.5px]">{opt.label.split(' ')[0]}</span>
          </button>
        )
      })}
    </div>
  )
}

function DensityToggle({ value, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-muted/50 p-1">
      {DENSITY_OPTIONS.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors',
              active
                ? 'border border-brand/25 bg-paper text-brand shadow-soft'
                : 'text-ink-3 hover:text-ink',
            )}
            title={opt.hint}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// iOS-style switch row. Used for boolean tweaks (reduced motion).
function SwitchRow({ label, hint, checked, onChange, icon: Icon }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border border-border bg-paper px-3 py-2.5 text-left',
        'transition-colors hover:border-brand/40',
      )}
      aria-pressed={checked}
    >
      {Icon ? (
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-muted text-ink-2">
          <Icon className="size-[15px]" strokeWidth={1.7} />
        </span>
      ) : null}
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-[13px] font-semibold text-ink">{label}</p>
        {hint ? (
          <p className="truncate text-[11.5px] text-ink-3">{hint}</p>
        ) : null}
      </div>
      <span
        aria-hidden
        className={cn(
          'relative inline-flex h-[22px] w-[36px] shrink-0 items-center rounded-full border transition-colors',
          checked
            ? 'border-brand/40 bg-brand'
            : 'border-border bg-muted',
        )}
      >
        <span
          className={cn(
            'pointer-events-none absolute left-[2px] top-[2px] grid size-[16px] place-items-center rounded-full bg-paper shadow-soft transition-transform',
            checked && 'translate-x-[14px]',
          )}
        />
      </span>
    </button>
  )
}

export function TweaksMenu({ trigger }) {
  const {
    theme,
    accent,
    displayFont,
    fontScale,
    density,
    reducedMotion,
    setTheme,
    setAccent,
    setDisplayFont,
    setFontScale,
    setDensity,
    setReducedMotion,
    reset,
  } = useTweaks()

  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="font-display text-[15px] font-semibold leading-none tracking-[-0.012em] text-ink">
              Tweaks
            </p>
            <p className="mt-1 text-[11.5px] text-ink-3">
              Personalize the look. Saved on this device.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-ink-3 hover:text-ink"
            onClick={reset}
            title="Reset to defaults"
          >
            <RotateCcw className="size-3.5" />
          </Button>
        </div>

        <div className="space-y-3.5">
          <div>
            <SectionLabel icon={Sun}>Theme</SectionLabel>
            <ThemeToggle value={theme} onChange={setTheme} />
          </div>

          <div>
            <SectionLabel icon={ALargeSmall}>Font size</SectionLabel>
            <FontScaleSelect value={fontScale} onChange={setFontScale} />
          </div>

          <div>
            <SectionLabel icon={Type}>Display font</SectionLabel>
            <FontSelect value={displayFont} onChange={setDisplayFont} />
          </div>

          <div>
            <SectionLabel icon={Palette}>Accent</SectionLabel>
            <AccentSelect value={accent} onChange={setAccent} />
          </div>

          <div>
            <SectionLabel icon={Rows3}>Density</SectionLabel>
            <DensityToggle value={density} onChange={setDensity} />
          </div>

          <div>
            <SectionLabel icon={Wind}>Motion</SectionLabel>
            <SwitchRow
              icon={Wind}
              label="Reduce motion"
              hint="Calm down transitions and animations"
              checked={reducedMotion}
              onChange={setReducedMotion}
            />
          </div>

          {/* Live sample */}
          <div className="mt-1 rounded-xl border border-dashed border-border bg-muted/40 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand">
              Preview
            </p>
            <p className="mt-1 font-display text-[18px] font-semibold leading-[1.15] tracking-[-0.018em] text-ink">
              What scholars are reading today.
            </p>
            <p className="mt-1 text-[11.5px] text-ink-3">
              Body text stays in the system sans for clarity.
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export { PopoverAnchor }
