import { createContext, useCallback, useContext, useEffect, useState } from 'react'

const STORAGE_KEY = 'irc.tweaks.v1'

const DEFAULTS = {
  theme: 'light',         // 'light' | 'dark'
  accent: 'emerald',      // 'emerald' | 'rust' | 'violet' | 'ink'
  displayFont: 'fraunces', // 'fraunces' | 'cormorant' | 'system'
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

function readInitial() {
  if (typeof window === 'undefined') return DEFAULTS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  // Honor system preference for first-run dark mode
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
  return { ...DEFAULTS, theme: prefersDark ? 'dark' : 'light' }
}

function applyToDocument({ theme, accent, displayFont }) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.dataset.accent = accent
  root.dataset.font = displayFont
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

  const setTheme       = useCallback((theme)       => setTweaks((t) => ({ ...t, theme })), [])
  const setAccent      = useCallback((accent)      => setTweaks((t) => ({ ...t, accent })), [])
  const setDisplayFont = useCallback((displayFont) => setTweaks((t) => ({ ...t, displayFont })), [])
  const reset          = useCallback(() => setTweaks(DEFAULTS), [])

  const value = {
    ...tweaks,
    setTheme,
    setAccent,
    setDisplayFont,
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
