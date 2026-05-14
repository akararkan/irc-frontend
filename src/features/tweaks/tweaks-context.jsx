import { createContext, useCallback, useContext, useEffect, useState } from 'react'

const STORAGE_KEY = 'irc.tweaks.v2'

const DEFAULTS = {
  theme:       'light',        // 'light' | 'dark'
  accent:      'emerald',      // 'emerald' | 'rust' | 'violet' | 'ink' | 'gold' | 'sky'
  displayFont: 'fraunces',     // 'fraunces' | 'cormorant' | 'system'
  fontScale:   'comfortable',  // 'compact' | 'comfortable' | 'cozy' | 'large'
  density:     'comfortable',  // 'comfortable' | 'compact'
  pageBg:      'default',      // 'default' | 'white' | 'slate' | 'sepia'
  radius:      'default',      // 'sharp' | 'default' | 'round'
  lineHeight:  'comfortable',  // 'tight' | 'comfortable' | 'relaxed'
  reducedMotion: false,
}

export const ACCENT_OPTIONS = [
  { value: 'emerald', label: 'Emerald',   hint: 'Default teal',           swatch: 'oklch(0.42 0.10 175)' },
  { value: 'rust',    label: 'Rust',      hint: 'Warm madder',            swatch: 'oklch(0.52 0.13 38)'  },
  { value: 'violet',  label: 'Violet',   hint: 'Manuscript indigo',       swatch: 'oklch(0.52 0.12 285)' },
  { value: 'gold',    label: 'Gold',     hint: 'Manuscript amber',        swatch: 'oklch(0.68 0.14 75)'  },
  { value: 'sky',     label: 'Sky',      hint: 'Cerulean blue',           swatch: 'oklch(0.52 0.12 240)' },
  { value: 'ink',     label: 'Pure ink', hint: 'Charcoal monochrome',     swatch: 'oklch(0.20 0.012 270)' },
]

export const FONT_OPTIONS = [
  { value: 'fraunces',  label: 'Fraunces',          hint: 'Editorial serif (default)' },
  { value: 'cormorant', label: 'Cormorant Garamond', hint: 'Slim, classical' },
  { value: 'system',    label: 'System sans',        hint: 'No serif' },
]

export const FONT_SCALE_OPTIONS = [
  { value: 'compact',     label: 'Compact',     hint: 'More content per screen', sample: 'A', factor: 0.92 },
  { value: 'comfortable', label: 'Comfortable', hint: 'Default reading size',    sample: 'A', factor: 1.0  },
  { value: 'cozy',        label: 'Cozy',        hint: 'A touch larger',          sample: 'A', factor: 1.08 },
  { value: 'large',       label: 'Large',       hint: 'Maximum legibility',      sample: 'A', factor: 1.16 },
]

export const DENSITY_OPTIONS = [
  { value: 'comfortable', label: 'Comfortable', hint: 'Generous spacing' },
  { value: 'compact',     label: 'Compact',     hint: 'Tight rows' },
]

export const PAGE_BG_OPTIONS = [
  { value: 'default', label: 'Parchment', hint: 'Warm off-white',    swatch: '#FBFBFA', swatchDark: '#14110C' },
  { value: 'white',   label: 'White',     hint: 'Pure white',        swatch: '#FFFFFF', swatchDark: '#0D0D0D' },
  { value: 'slate',   label: 'Slate',     hint: 'Cool grey',         swatch: '#F1F5F9', swatchDark: '#0F172A' },
  { value: 'sepia',   label: 'Sepia',     hint: 'Warm manuscript',   swatch: '#FDF6E3', swatchDark: '#1C1409' },
]

export const RADIUS_OPTIONS = [
  { value: 'sharp',   label: 'Sharp',   hint: '4 px — geometric',    preview: '4px'  },
  { value: 'default', label: 'Default', hint: '10 px — balanced',    preview: '10px' },
  { value: 'round',   label: 'Round',   hint: '16 px — soft',        preview: '16px' },
]

export const LINE_HEIGHT_OPTIONS = [
  { value: 'tight',       label: 'Tight',       hint: 'Dense',        factor: 1.5  },
  { value: 'comfortable', label: 'Normal',       hint: 'Default',      factor: 1.65 },
  { value: 'relaxed',     label: 'Relaxed',     hint: 'Airy',         factor: 1.85 },
]

function readInitial() {
  if (typeof window === 'undefined') return DEFAULTS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  const prefersDark   = window.matchMedia?.('(prefers-color-scheme: dark)').matches
  const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  return { ...DEFAULTS, theme: prefersDark ? 'dark' : 'light', reducedMotion: !!prefersReduced }
}

export function applyToDocument(tweaks) {
  if (typeof document === 'undefined') return
  const root = document.documentElement

  root.classList.toggle('dark', tweaks.theme === 'dark')
  root.dataset.accent     = tweaks.accent
  root.dataset.font       = tweaks.displayFont
  root.dataset.fontScale  = tweaks.fontScale
  root.dataset.density    = tweaks.density
  root.dataset.pageBg     = tweaks.pageBg ?? 'default'
  root.dataset.radius     = tweaks.radius ?? 'default'
  root.dataset.lineHeight = tweaks.lineHeight ?? 'comfortable'
  root.dataset.reducedMotion = tweaks.reducedMotion ? 'true' : 'false'

  const factor = FONT_SCALE_OPTIONS.find((o) => o.value === tweaks.fontScale)?.factor ?? 1
  root.style.setProperty('--font-scale', String(factor))

  const lhFactor = LINE_HEIGHT_OPTIONS.find((o) => o.value === tweaks.lineHeight)?.factor ?? 1.65
  root.style.setProperty('--content-lh', String(lhFactor))
}

const TweaksContext = createContext(null)

export function TweaksProvider({ children }) {
  const [tweaks, setTweaks] = useState(readInitial)

  useEffect(() => {
    applyToDocument(tweaks)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tweaks)) } catch { /* ignore */ }
  }, [tweaks])

  const setTheme        = useCallback((theme)        => setTweaks((t) => ({ ...t, theme })), [])
  const setAccent       = useCallback((accent)       => setTweaks((t) => ({ ...t, accent })), [])
  const setDisplayFont  = useCallback((displayFont)  => setTweaks((t) => ({ ...t, displayFont })), [])
  const setFontScale    = useCallback((fontScale)    => setTweaks((t) => ({ ...t, fontScale })), [])
  const setDensity      = useCallback((density)      => setTweaks((t) => ({ ...t, density })), [])
  const setPageBg       = useCallback((pageBg)       => setTweaks((t) => ({ ...t, pageBg })), [])
  const setRadius       = useCallback((radius)       => setTweaks((t) => ({ ...t, radius })), [])
  const setLineHeight   = useCallback((lineHeight)   => setTweaks((t) => ({ ...t, lineHeight })), [])
  const setReducedMotion = useCallback((reducedMotion) => setTweaks((t) => ({ ...t, reducedMotion })), [])
  const reset = useCallback(() => setTweaks(DEFAULTS), [])

  return (
    <TweaksContext.Provider value={{
      ...tweaks,
      setTheme, setAccent, setDisplayFont, setFontScale,
      setDensity, setPageBg, setRadius, setLineHeight, setReducedMotion,
      reset,
      isDark: tweaks.theme === 'dark',
    }}>
      {children}
    </TweaksContext.Provider>
  )
}

export function useTweaks() {
  const ctx = useContext(TweaksContext)
  if (!ctx) throw new Error('useTweaks must be used inside <TweaksProvider>.')
  return ctx
}
