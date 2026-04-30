import * as React from 'react'
import { createContext, useCallback, useContext, useState } from 'react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'

import { cn } from '@/lib/utils'

const ToastContext = createContext(null)

const TONE_ICON = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
}

const TONE_CLASS = {
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  error: 'border-destructive/40 bg-destructive/10 text-destructive',
  info: 'border-border bg-background text-foreground',
}

let idCounter = 0

export function ToastProvider({ children, duration = 4200 }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const toast = useCallback(
    (input) => {
      const id = ++idCounter
      const payload =
        typeof input === 'string'
          ? { message: input, tone: 'info' }
          : { tone: 'info', ...input }
      setToasts((current) => [...current, { id, ...payload }])

      if ((payload.duration ?? duration) > 0) {
        setTimeout(() => dismiss(id), payload.duration ?? duration)
      }
      return id
    },
    [dismiss, duration],
  )

  const value = React.useMemo(
    () => ({
      toast,
      dismiss,
      success: (message, options = {}) => toast({ ...options, message, tone: 'success' }),
      error: (message, options = {}) => toast({ ...options, message, tone: 'error' }),
      info: (message, options = {}) => toast({ ...options, message, tone: 'info' }),
    }),
    [toast, dismiss],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2"
      >
        {toasts.map((toast) => {
          const Icon = TONE_ICON[toast.tone] ?? Info
          return (
            <div
              key={toast.id}
              className={cn(
                'pointer-events-auto flex items-start gap-3 rounded-lg border p-3 shadow-lg backdrop-blur',
                TONE_CLASS[toast.tone] ?? TONE_CLASS.info,
              )}
            >
              <Icon className="mt-0.5 size-4 shrink-0" />
              <div className="min-w-0 flex-1 text-sm">
                {toast.title ? (
                  <p className="font-medium text-foreground">{toast.title}</p>
                ) : null}
                <p className={toast.title ? 'mt-0.5 text-muted-foreground' : ''}>
                  {toast.message}
                </p>
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="rounded-md text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-4" />
                <span className="sr-only">Dismiss</span>
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}
