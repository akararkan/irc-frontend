// Thin facade over `src/lib/api-errors.js` (plural). Kept so existing
// call sites (`extractApiMessage`, `extractFieldErrors`, etc.) keep
// working unchanged while new code is migrated to the typed
// `getApiError(err) instanceof RateLimited` style.

import {
  fieldErrorMap,
  formatApiError,
  getApiError,
  isRateLimited as isRateLimitedTyped,
  RateLimited,
} from '@/lib/api-errors'

/**
 * Legacy: `{message, errorCode, fieldErrors, retryAfterSeconds, status}`.
 * Sourced from the typed parser so all four wire shapes are recognised.
 */
export function extractApiError(error, fallbackMessage = 'Something went wrong.') {
  const e = getApiError(error)
  return {
    message: e.message || fallbackMessage,
    errorCode: e.errorCode,
    fieldErrors: Array.isArray(e.fieldErrors) ? e.fieldErrors : [],
    retryAfterSeconds: e instanceof RateLimited ? e.retryAfterSeconds : null,
    status: e.status,
  }
}

export function extractApiMessage(error, fallbackMessage = 'Something went wrong.') {
  // Use the friendly mapper so call sites get the same UX-friendly
  // copy whether they call extractApiMessage or formatApiError.
  return formatApiError(error, fallbackMessage)
}

export function extractFieldErrors(error) {
  return fieldErrorMap(error)
}

export function friendlyApiMessage(error, fallbackMessage = 'Something went wrong.') {
  return formatApiError(error, fallbackMessage)
}

export const isRateLimited = isRateLimitedTyped
