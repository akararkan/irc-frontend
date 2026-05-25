// Thin facade over Sonner.  Keeps the existing `useToast()` and
// `ToastProvider` API so the 99 call sites compile unchanged while
// rendering goes through the modern Sonner toaster.
//
// Direct Sonner usage is preferred in new code:
//   import { toast } from 'sonner'
//   toast.success('...')
//   toast.error('...')

import { useMemo } from 'react'
import { toast as sonnerToast } from 'sonner'

import { Toaster as SonnerToaster } from '@/components/ui/sonner'

function dispatch(input, tone) {
  const payload = typeof input === 'string' ? { message: input } : input ?? {}
  const message = payload.title ?? payload.message ?? ''
  const description = payload.title && payload.message ? payload.message : undefined
  const action = payload.action?.label
    ? {
        label: payload.action.label,
        onClick: payload.action.onClick ?? (() => {}),
      }
    : undefined
  const options = {
    description,
    duration: payload.duration,
    action,
  }
  switch (tone) {
    case 'success':
      return sonnerToast.success(message, options)
    case 'error':
      return sonnerToast.error(message, options)
    case 'info':
    default:
      return sonnerToast(message, options)
  }
}

export function ToastProvider({ children }) {
  // Sonner renders its own toaster element; we just mount the
  // visual component once per provider so the visible toasts stay
  // anchored to the providers' scope (the app root in practice).
  return (
    <>
      {children}
      <SonnerToaster />
    </>
  )
}

export function useToast() {
  return useMemo(
    () => ({
      toast: (input) => dispatch(input, input?.tone ?? 'info'),
      dismiss: (id) => sonnerToast.dismiss(id),
      success: (message, options = {}) =>
        dispatch({ ...options, message }, 'success'),
      error: (message, options = {}) =>
        dispatch({ ...options, message }, 'error'),
      info: (message, options = {}) =>
        dispatch({ ...options, message }, 'info'),
    }),
    [],
  )
}
