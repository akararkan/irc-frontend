export function extractApiError(error, fallbackMessage = 'Something went wrong.') {
  const responseData = error?.response?.data ?? {}

  return {
    message:
      responseData.message ?? error?.message ?? fallbackMessage,
    errorCode: responseData.errorCode ?? null,
    fieldErrors: Array.isArray(responseData.fieldErrors)
      ? responseData.fieldErrors
      : [],
    // Wave 2A rate-limit metadata: the backend's
    // RateLimitExceededException returns `RATE_LIMITED` plus a
    // `retryAfterSeconds` hint in the details object. The Retry-After
    // header is also set; either one is enough to know how long to
    // wait before another click is worth trying.
    retryAfterSeconds:
      Number(
        responseData.details?.retryAfterSeconds ??
          error?.response?.headers?.['retry-after'] ??
          NaN,
      ) || null,
    status: error?.response?.status ?? null,
  }
}

export function extractApiMessage(error, fallbackMessage = 'Something went wrong.') {
  return extractApiError(error, fallbackMessage).message
}

export function extractFieldErrors(error) {
  const { fieldErrors } = extractApiError(error)

  return fieldErrors.reduce((accumulator, fieldError) => {
    if (fieldError?.field) {
      accumulator[fieldError.field] =
        fieldError.message ?? 'Invalid value.'
    }

    return accumulator
  }, {})
}

/**
 * Map well-known backend errorCodes to friendly user-facing copy. Falls back
 * to the server's `message` field, then to `fallbackMessage`. Use this when
 * a callsite knows the operation can fail with a known business-rule code
 * (e.g. DUPLICATE_REPOST, OPTIMISTIC_LOCK).
 */
const FRIENDLY_ERROR_CODES = {
  DUPLICATE_REPOST: 'You already reposted this.',
  // Backend `SocialGuard` rejects interactions across a block edge —
  // intentionally returns 403/404 to avoid leaking the block. Whichever
  // shape it lands in, surface a calm, neutral message.
  BLOCKED_INTERACTION: 'This action is unavailable.',
  USER_BLOCKED: 'This action is unavailable.',
  USER_BLOCKED_VIEWER: 'This action is unavailable.',
  USER_RESTRICTED: 'This action is unavailable.',
}

export function friendlyApiMessage(error, fallbackMessage = 'Something went wrong.') {
  const { errorCode, message, retryAfterSeconds, status } = extractApiError(
    error,
    fallbackMessage,
  )
  // Rate-limit branch: the backend's RateLimiter caps click bursts
  // (e.g. 30 reactions / 10 s) and returns 429 + `RATE_LIMITED`. Show
  // a calm, specific message with the wait — generic "Something went
  // wrong" would make the user spam-retry.
  if (errorCode === 'RATE_LIMITED' || status === 429) {
    if (retryAfterSeconds && retryAfterSeconds > 0) {
      return `You're going a little fast — try again in ${retryAfterSeconds}s.`
    }
    return "You're going a little fast — try again in a moment."
  }
  return FRIENDLY_ERROR_CODES[errorCode] ?? message ?? fallbackMessage
}

/** True when the error is the backend's 429/RATE_LIMITED response. */
export function isRateLimited(error) {
  const { errorCode, status } = extractApiError(error)
  return status === 429 || errorCode === 'RATE_LIMITED'
}