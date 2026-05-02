import { Popover as PopoverPrimitive } from 'radix-ui'
import { Check, ChevronDown, Moon, Palette, RotateCcw, Sun, Type } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ACCENT_OPTIONS,
  FONT_OPTIONS,
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
          'z-50 w-[300px] origin-[var(--radix-popover-content-transform-origin)] rounded-2xl border border-border bg-paper p-4 shadow-soft-lg outline-none',
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

export function TweaksMenu({ trigger }) {
  const { theme, accent, displayFont, setTheme, setAccent, setDisplayFont, reset } =
    useTweaks()

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
            <SectionLabel icon={Palette}>Accent</SectionLabel>
            <AccentSelect value={accent} onChange={setAccent} />
          </div>

          <div>
            <SectionLabel icon={Type}>Display font</SectionLabel>
            <FontSelect value={displayFont} onChange={setDisplayFont} />
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
