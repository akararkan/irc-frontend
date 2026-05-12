import { createContext, useCallback, useContext, useEffect, useState } from 'react'

const STORAGE_KEY = 'irc.tweaks.v1'

// All persisted tweak settings. Keep keys short so localStorage stays
// readable; the migration story is "missing key → default".
const DEFAULTS = {
  theme: 'light',          // 'light' | 'dark'
  accent: 'emerald',       // 'emerald' | 'rust' | 'violet' | 'ink'
  displayFont: 'fraunces', // 'fraunces' | 'cormorant' | 'system'
  fontScale: 'comfortable', // 'compact' | 'comfortable' | 'cozy' | 'large'
  density: 'comfortable',   // 'comfortable' | 'compact'
  reducedMotion: false,     // honour prefers-reduced-motion when toggled on
}

export const ACCENT_OPTIONS = [
  { value: 'emerald', label: 'Emerald-teal',     hint: 'Calligraphic ink (default)', swatch: 'oklch(0.42 0.10 175)' },
  { value: 'rust',    label: 'Rust',             hint: 'Warm madder',                swatch: 'oklch(0.62 0.13 38)' },
  { value: 'violet',  label: 'Violet',           hint: 'Manuscript indigo',          swatch: 'oklch(0.52 0.12 285)' },
  { value: 'ink',     label: 'Pure ink',         hint: 'Charcoal monochrome',        swatch: 'oklch(0.20 0.012 270)' },
]

export const FONT_OPTIONS = [
  { value: 'fraunces',  label: 'Fraunces',          hint: 'Editorial serif (default)' },
  { value: 'cormorant', label: 'Cormorant Garamond', hint: 'Slim, classical' },
  { value: 'system',    label: 'System sans',        hint: 'No serif' },
]

// Maps each `fontScale` setting to a multiplier applied on the
// document root. Headings, body, and chrome all scale proportionally.
// The keys also drive a swatch row in TweaksMenu — order matters.
export const FONT_SCALE_OPTIONS = [
  { value: 'compact',      label: 'Compact',      hint: 'More content per screen', sample: 'A',  factor: 0.92 },
  { value: 'comfortable',  label: 'Comfortable',  hint: 'Default reading size',    sample: 'A',  factor: 1.0  },
  { value: 'cozy',         label: 'Cozy',         hint: 'A touch larger',          sample: 'A',  factor: 1.08 },
  { value: 'large',        label: 'Large',        hint: 'Maximum legibility',      sample: 'A',  factor: 1.16 },
]

export const DENSITY_OPTIONS = [
  { value: 'comfortable', label: 'Comfortable', hint: 'Generous spacing' },
  { value: 'compact',     label: 'Compact',     hint: 'Tight rows for power users' },
]

function readInitial() {
  if (typeof window === 'undefined') return DEFAULTS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  // First-run defaults follow the OS — dark mode + reduced motion are
  // common preferences the user shouldn't have to set twice.
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
  const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  return {
    ...DEFAULTS,
    theme: prefersDark ? 'dark' : 'light',
    reducedMotion: !!prefersReduced,
  }
}

function applyToDocument(tweaks) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.toggle('dark', tweaks.theme === 'dark')
  root.dataset.accent = tweaks.accent
  root.dataset.font = tweaks.displayFont
  root.dataset.fontScale = tweaks.fontScale
  root.dataset.density = tweaks.density
  root.dataset.reducedMotion = tweaks.reducedMotion ? 'true' : 'false'

  // `--font-scale` is consumed by the global zoom rule on `<main>` so
  // every text-bearing element in the content column scales together
  // — Tailwind's hardcoded px sizes included.
  const factor =
    FONT_SCALE_OPTIONS.find((o) => o.value === tweaks.fontScale)?.factor ?? 1
  root.style.setProperty('--font-scale', String(factor))
}

const TweaksContext = createContext(null)

export function TweaksProvider({ children }) {
  const [tweaks, setTweaks] = useState(readInitial)

  useEffect(() => {
    applyToDocument(tweaks)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tweaks))
    } catch {
      /* storage may be disabled */
    }
  }, [tweaks])

  const setTheme         = useCallback((theme)         => setTweaks((t) => ({ ...t, theme })), [])
  const setAccent        = useCallback((accent)        => setTweaks((t) => ({ ...t, accent })), [])
  const setDisplayFont   = useCallback((displayFont)   => setTweaks((t) => ({ ...t, displayFont })), [])
  const setFontScale     = useCallback((fontScale)     => setTweaks((t) => ({ ...t, fontScale })), [])
  const setDensity       = useCallback((density)       => setTweaks((t) => ({ ...t, density })), [])
  const setReducedMotion = useCallback((reducedMotion) => setTweaks((t) => ({ ...t, reducedMotion })), [])
  const reset            = useCallback(() => setTweaks(DEFAULTS), [])

  const value = {
    ...tweaks,
    setTheme,
    setAccent,
    setDisplayFont,
    setFontScale,
    setDensity,
    setReducedMotion,
    reset,
    isDark: tweaks.theme === 'dark',
  }

  return <TweaksContext.Provider value={value}>{children}</TweaksContext.Provider>
}

export function useTweaks() {
  const ctx = useContext(TweaksContext)
  if (!ctx) throw new Error('useTweaks must be used inside <TweaksProvider>.')
  return ctx
}
