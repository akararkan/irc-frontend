export function extractApiError(error, fallbackMessage = 'Something went wrong.') {
  const responseData = error?.response?.data ?? {}

  return {
    message:
      responseData.message ?? error?.message ?? fallbackMessage,
    errorCode: responseData.errorCode ?? null,
    fieldErrors: Array.isArray(responseData.fieldErrors)
      ? responseData.fieldErrors
      : [],
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
  const { errorCode, message } = extractApiError(error, fallbackMessage)
  return FRIENDLY_ERROR_CODES[errorCode] ?? message ?? fallbackMessage
}