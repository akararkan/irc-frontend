import { useEffect, useState } from 'react'
import { Toaster as SonnerPrimitive } from 'sonner'

/**
 * Sonner toaster — the modern shadcn default. Drop one of these at
 * the root of the app and call `toast(...)` / `toast.success(...)` /
 * `toast.error(...)` from anywhere via `import { toast } from 'sonner'`.
 *
 * Theme detection: reads the `.dark` class on `<html>` directly so
 * it doesn't depend on any provider mount order.
 */
function Toaster({ ...props }) {
  const [theme, setTheme] = useState(() =>
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark')
      ? 'dark'
      : 'light',
  )

  // Watch for live theme changes — the theme toggle flips the
  // `.dark` class on <html>, so a MutationObserver keeps Sonner's
  // theme in sync without any direct coupling.
  useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    const next = () =>
      setTheme(root.classList.contains('dark') ? 'dark' : 'light')
    next()
    const observer = new MutationObserver(next)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return (
    <SonnerPrimitive
      theme={theme}
      className="toaster group"
      richColors
      closeButton
      position="top-right"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton:
            'group-[.toast]:bg-brand group-[.toast]:text-brand-foreground',
          cancelButton:
            'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
        },
      }}
      style={{
        '--normal-bg': 'var(--popover)',
        '--normal-text': 'var(--popover-foreground)',
        '--normal-border': 'var(--border)',
      }}
      {...props}
    />
  )
}

export { Toaster }
