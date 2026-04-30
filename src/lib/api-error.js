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