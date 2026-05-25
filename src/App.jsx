import './i18n'
import { useEffect } from 'react'
import { applyTheme } from '@/lib/theme'
import { AppRouter } from '@/routes/app-router'

function readInitialTheme() {
  if (typeof window === 'undefined') return 'light'
  try {
    const stored = localStorage.getItem('irc.theme')
    if (stored === 'dark' || stored === 'light') return stored
  } catch { /* ignore */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function App() {
  useEffect(() => {
    applyTheme(readInitialTheme())
  }, [])

  return <AppRouter />
}

export default App
