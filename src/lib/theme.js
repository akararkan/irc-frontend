import { useCallback, useEffect, useState } from 'react'
import i18n, { applyLangToDocument, RTL_LANGS } from '@/i18n'

const THEME_STORAGE_KEY = 'irc.theme'

function readStoredTheme() {
  if (typeof window === 'undefined') return 'light'
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'dark' || stored === 'light') return stored
  } catch { /* ignore */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

export function applyTheme(theme) {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

export function useTheme() {
  const [theme, setThemeState] = useState(readStoredTheme)

  useEffect(() => {
    applyTheme(theme)
    try { localStorage.setItem(THEME_STORAGE_KEY, theme) } catch { /* ignore */ }
  }, [theme])

  const setTheme = useCallback((value) => {
    setThemeState(value === 'dark' ? 'dark' : 'light')
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((t) => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, setTheme, toggleTheme, isDark: theme === 'dark' }
}

export function useLanguage() {
  const [lang, setLangState] = useState(() => i18n.language ?? 'en')

  useEffect(() => {
    function onChange(next) { setLangState(next) }
    i18n.on('languageChanged', onChange)
    return () => i18n.off('languageChanged', onChange)
  }, [])

  const setLang = useCallback((next) => {
    i18n.changeLanguage(next)
    applyLangToDocument(next)
    try { localStorage.setItem('irc.lang', next) } catch { /* ignore */ }
  }, [])

  return { lang, setLang, isRtl: RTL_LANGS.has(lang) }
}
