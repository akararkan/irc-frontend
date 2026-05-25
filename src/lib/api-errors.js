// ══════════════════════════════════════════════════════════════
//  api-errors — typed error classes + parser for every shape the
//                backend can return.
//
//  This module is the canonical reference for handling errors
//  from the Spring backend. It understands ALL FOUR error shapes:
//
//    1. Unified `ApiErrorResponse`
//       (status + error + message + path + errorCode + ...)
//    2. Multipart-only `{ error: "upload_failed", message }`     (502)
//    3. Multipart-only `{ error: "post_create_failed", message,
//                         rolledBackFiles }`                     (500)
//    4. Bare-body 401 / 403 / 404 (no JSON, status only)
//
//  Plus the `SecurityException` quirk (POST_ERRORS.md §8) where
//  certain author-only mutations surface as 500 INTERNAL_ERROR
//  instead of the semantic 403 — those are reclassified here.
//
//  Every parsed error is an instance of `ApiError`. Specific
//  subclasses let call sites do `instanceof RateLimited` etc.
//  without string-matching on error codes.
//
//  The axios interceptor in `src/api/client.js` calls `parseApiError`
//  on every rejection and stashes the result on `error.parsedError`.
//  Use `getApiError(rawError)` from any catch block — it returns
//  the typed error whether it came pre-parsed or not.
// ══════════════════════════════════════════════════════════════

// ── Base class ────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(message, {
    status = null,
    errorCode = null,
    traceId = null,
    path = null,
    details = null,
    fieldErrors = null,
    raw = null,
  } = {}) {
    super(message ?? 'Something went wrong.')
    this.name = this.constructor.name
    this.status = status
    this.errorCode = errorCode
    this.traceId = traceId
    this.path = path
    this.details = details ?? null
    this.fieldErrors = fieldErrors ?? null
    this.raw = raw
  }
}

// ── Subclasses (mirrors the discriminated union in POST_ERRORS.md §15.1)

/** Token expired / invalid / missing user. Client should try /auth/refresh. */
export class SessionExpired extends ApiError {}

/** Account disabled / locked / expired / credentials expired. Login won't help. */
export class AccountUnavailable extends ApiError {}

/** Bad credentials / insufficient auth — login flow only. */
export class AuthFailed extends ApiError {}

/** 403 — caller can't perform this action. */
export class Forbidden extends ApiError {}

/** 404 — resource missing. */
export class NotFound extends ApiError {}

/** 429 — rate limited. `.retryAfterSeconds` exposes the wait. */
export class RateLimited extends ApiError {
  get retryAfterSeconds() {
    return Number(this.details?.retryAfterSeconds) || null
  }
  get action() {
    return this.details?.action ?? null
  }
}

/** 413 — uploaded file exceeded `max-file-size`. `.maxSize` is in bytes. */
export class FileTooLarge extends ApiError {
  get maxSize() {
    return Number(this.details?.maxSize) || null
  }
}

/** 503 — R2 / S3 unreachable (DNS, TLS, credentials, network). */
export class StorageUnavailable extends ApiError {}

/** 400 + `VALIDATION_FAILED` — `.fieldErrors[]` carries per-field reasons. */
export class ValidationFailed extends ApiError {}

/** 400 — malformed body / type mismatch / illegal argument. */
export class BadRequest extends ApiError {}

/** 409 — conflict / duplicate / integrity violation. */
export class Conflict extends ApiError {}

/** 502 multipart-only — R2 upload failed; previously-uploaded keys were rolled back. */
export class R2UploadFailed extends ApiError {}

/**
 * 500 multipart-only — R2 succeeded but the Cassandra insert failed;
 * `.rolledBackFiles` is the count of R2 keys deleted in cleanup.
 */
export class PostCreateFailed extends ApiError {
  constructor(message, opts = {}) {
    super(message, opts)
    this.rolledBackFiles = Number(opts.rolledBackFiles) || 0
  }
}

/** 5xx — generic server failure. Always carries a `.traceId`. */
export class InternalError extends ApiError {}

/** 405 / 415 — programmer error, the client sent the wrong shape. */
export class ProgrammerError extends ApiError {}

/** No HTTP response at all (CORS, DNS, offline, axios cancellation). */
export class NetworkError extends ApiError {}

/**
 * The frontend asked for an ID that hadn't hydrated yet (the literal
 * string "undefined", "null", or an empty value made it into a path
 * segment). The backend has a special detection for this and tags
 * the error with `details.hint === "frontend_path_param_unhydrated"`,
 * but we also short-circuit at the request side via `requireId()`
 * and the axios interceptor in `client.js` so the broken request
 * never leaves the browser.
 *
 * These should never appear as user-facing toasts — they're
 * programmer errors. The default handler in `formatApiError`
 * downgrades them to the generic "something went wrong" message.
 */
export class UnhydratedIdError extends ApiError {}

const UNHYDRATED_VALUES = new Set(['', 'undefined', 'null', 'NaN'])

/**
 * Guard helper for API call sites that interpolate an ID into the
 * URL path. Throws synchronously (NOT via a network round-trip) when
 * the value is falsy or one of the literal strings that JavaScript's
 * template-string coercion produces from `undefined` / `null` /
 * `NaN`. Use at the top of every API function that takes an ID:
 *
 *   export async function getPost(postId) {
 *     requireId(postId, 'postId')
 *     ...
 *   }
 *
 * The thrown error is an `UnhydratedIdError`, which `formatApiError`
 * recognizes and downgrades — the user never sees a toast for it
 * but the dev console gets a loud warning.
 */
export function requireId(value, name = 'id') {
  const s = value == null ? '' : String(value)
  if (UNHYDRATED_VALUES.has(s)) {
    if (typeof console !== 'undefined' && import.meta.env?.DEV) {
      // Loud, link-traceable dev warning. Production code stays quiet.
      console.warn(
        `[api] ${name} is "${s}" — call site is firing before its ID hydrated. Guard with \`if (!${name}) return\` before the fetch.`,
      )
    }
    throw new UnhydratedIdError(`Missing ${name}.`, {
      errorCode: 'CLIENT_ID_UNHYDRATED',
      details: { parameter: name, receivedValue: s },
    })
  }
}

// ── Helpers ───────────────────────────────────────────────────

const TOKEN_CODES = new Set([
  'AUTH_TOKEN_INVALID',
  'AUTH_REQUIRED',
  'AUTH_UNAUTHORIZED',
  'AUTH_USER_NOT_FOUND',
  'AUTH_WRONG_TOKEN_TYPE',
])

const ACCOUNT_CODES = new Set([
  'AUTH_ACCOUNT_DISABLED',
  'AUTH_ACCOUNT_LOCKED',
  'AUTH_ACCOUNT_EXPIRED',
  'AUTH_CREDENTIALS_EXPIRED',
])

const AUTH_FAIL_CODES = new Set([
  'AUTH_BAD_CREDENTIALS',
  'AUTH_FAILED',
  'AUTH_INSUFFICIENT',
])

const NOT_FOUND_CODES = new Set([
  'POST_NOT_FOUND',
  'RESOURCE_NOT_FOUND',
  'ENDPOINT_NOT_FOUND',
])

const CONFLICT_CODES = new Set([
  'RESOURCE_CONFLICT',
  'RESOURCE_DUPLICATE',
  'DATA_INTEGRITY_VIOLATION',
])

const BAD_REQUEST_CODES = new Set([
  'MISSING_PARAMETER',
  'TYPE_MISMATCH',
  'MALFORMED_JSON',
  'ILLEGAL_ARGUMENT',
  'BAD_REQUEST',
])

const FORBIDDEN_CODES = new Set([
  'ACCESS_DENIED',
  'ACCESS_FORBIDDEN',
])

const PROGRAMMER_CODES = new Set([
  'METHOD_NOT_ALLOWED',
  'UNSUPPORTED_MEDIA_TYPE',
])

/**
 * The SecurityException quirk (POST_ERRORS.md §8) — these endpoints
 * surface "not the author" as a generic 500 INTERNAL_ERROR instead of
 * a 403. Detect by status + path so we present a 403-flavoured message
 * to the user.
 */
const SECURITY_QUIRK_MATCHERS = [
  // PATCH or DELETE /api/v1/posts/comments/{commentId}
  (path, method) =>
    /^\/api\/v1\/posts\/comments\/[^/]+$/.test(path) &&
    (method === 'PATCH' || method === 'DELETE'),
  // DELETE /api/v1/stories/{storyId}
  (path, method) =>
    /^\/api\/v1\/stories\/[^/]+$/.test(path) && method === 'DELETE',
  // POST /api/v1/stories/{storyId}/poll
  (path, method) =>
    /^\/api\/v1\/stories\/[^/]+\/poll$/.test(path) && method === 'POST',
  // POST /api/v1/highlights/{highlightId}/stories/{storyId}
  (path, method) =>
    /^\/api\/v1\/highlights\/[^/]+\/stories\/[^/]+$/.test(path) &&
    method === 'POST',
]

function looksLikeSecurityQuirk(path, method, status) {
  if (status !== 500 || !path || !method) return false
  const m = method.toUpperCase()
  return SECURITY_QUIRK_MATCHERS.some((fn) => fn(path, m))
}

function pathFromAxiosError(rawError) {
  // Axios stores the URL on config; strip any query string so it
  // matches the `path` from the server (which excludes the query).
  const url = rawError?.config?.url
  if (!url) return null
  const qIdx = url.indexOf('?')
  return qIdx >= 0 ? url.slice(0, qIdx) : url
}

function methodFromAxiosError(rawError) {
  const m = rawError?.config?.method
  return m ? String(m).toUpperCase() : null
}

// ── The parser ────────────────────────────────────────────────

/**
 * Convert any axios rejection into a typed `ApiError`. Idempotent —
 * if `rawError` is already an ApiError, returns it unchanged.
 */
export function parseApiError(rawError) {
  if (rawError instanceof ApiError) return rawError

  // Network / DNS / CORS — no response object.
  if (rawError && !rawError.response) {
    if (rawError.code === 'ERR_CANCELED' || rawError.name === 'CanceledError') {
      return new NetworkError('Request cancelled.', { raw: rawError })
    }
    return new NetworkError(
      rawError.message ?? 'Network unavailable.',
      { raw: rawError, errorCode: rawError.code ?? null },
    )
  }

  const response = rawError.response
  const status = response?.status ?? null
  const body = response?.data ?? null
  const path = pathFromAxiosError(rawError)
  const method = methodFromAxiosError(rawError)

  // ── 1. Bare-body 401 / 403 / 404 ──────────────────────────
  // Heuristic: body is empty / undefined / a non-object (Spring sends
  // an empty body for these). Detect by checking for absence of the
  // unified fields.
  const hasUnifiedShape =
    body && typeof body === 'object' && 'errorCode' in body && 'status' in body
  const hasMultipartShape =
    body && typeof body === 'object' && typeof body.error === 'string' && !body.errorCode

  if (!hasUnifiedShape && !hasMultipartShape) {
    switch (status) {
      case 401:
        return new SessionExpired('Please sign in to continue.', {
          status, path, raw: rawError,
        })
      case 403:
        return new Forbidden("You don't have permission to do that.", {
          status, path, raw: rawError,
        })
      case 404:
        return new NotFound('The thing you asked for no longer exists.', {
          status, path, raw: rawError,
        })
      default:
        return new ApiError(
          rawError.message ?? `Request failed (${status ?? 'unknown'}).`,
          { status, path, raw: rawError },
        )
    }
  }

  // ── 2. Multipart custom-bodies ────────────────────────────
  if (hasMultipartShape) {
    if (body.error === 'upload_failed') {
      return new R2UploadFailed(
        body.message ?? 'Could not upload the file.',
        { status: status ?? 502, path, raw: rawError, errorCode: 'UPLOAD_FAILED' },
      )
    }
    if (body.error === 'post_create_failed') {
      return new PostCreateFailed(
        body.message ?? 'Post upload succeeded but the save failed.',
        {
          status: status ?? 500,
          path,
          raw: rawError,
          errorCode: 'POST_CREATE_FAILED',
          rolledBackFiles: body.rolledBackFiles,
        },
      )
    }
    // Unknown custom shape — fall through to ApiError.
    return new ApiError(body.message ?? body.error, {
      status, path, raw: rawError,
    })
  }

  // ── 3. Unified ApiErrorResponse ───────────────────────────
  const opts = {
    status: body.status ?? status,
    errorCode: body.errorCode ?? null,
    traceId: body.traceId ?? null,
    path: body.path ?? path,
    details: body.details ?? null,
    fieldErrors: Array.isArray(body.fieldErrors) ? body.fieldErrors : null,
    raw: rawError,
  }
  const code = body.errorCode

  // Backend's developer-facing hint for path-param hydration bugs —
  // tagged via `details.hint = "frontend_path_param_unhydrated"` on
  // `TYPE_MISMATCH` responses where the rejected value was literally
  // "undefined" or "null". Downgrade to a non-user-facing error so
  // it never reaches a toast, and log a loud dev warning.
  if (
    code === 'TYPE_MISMATCH' &&
    body?.details?.hint === 'frontend_path_param_unhydrated'
  ) {
    if (typeof console !== 'undefined' && import.meta.env?.DEV) {
      console.warn(
        `[api] server received an unhydrated path param at ${opts.path} (value="${body.details?.receivedValue}"). Guard the call site before fetching.`,
      )
    }
    return new UnhydratedIdError(body.message, opts)
  }

  // SecurityException quirk: a 500 INTERNAL_ERROR on certain endpoints
  // is actually a permission failure. Reclassify before the switch so
  // the user sees a 403 message, not a generic 500.
  if (
    code === 'INTERNAL_ERROR' &&
    looksLikeSecurityQuirk(opts.path, method, opts.status)
  ) {
    return new Forbidden('Only the author can do this.', opts)
  }

  if (TOKEN_CODES.has(code)) {
    return new SessionExpired(body.message, opts)
  }
  if (ACCOUNT_CODES.has(code)) {
    return new AccountUnavailable(body.message, opts)
  }
  if (AUTH_FAIL_CODES.has(code)) {
    return new AuthFailed(body.message, opts)
  }
  if (FORBIDDEN_CODES.has(code)) {
    return new Forbidden(body.message, opts)
  }
  if (NOT_FOUND_CODES.has(code)) {
    return new NotFound(body.message, opts)
  }
  if (code === 'VALIDATION_FAILED') {
    return new ValidationFailed(body.message, opts)
  }
  if (code === 'RATE_LIMITED') {
    return new RateLimited(body.message, opts)
  }
  if (code === 'FILE_TOO_LARGE') {
    return new FileTooLarge(body.message, opts)
  }
  if (code === 'STORAGE_UNAVAILABLE') {
    return new StorageUnavailable(body.message, opts)
  }
  if (CONFLICT_CODES.has(code)) {
    return new Conflict(body.message, opts)
  }
  if (BAD_REQUEST_CODES.has(code)) {
    return new BadRequest(body.message, opts)
  }
  if (PROGRAMMER_CODES.has(code)) {
    return new ProgrammerError(body.message, opts)
  }
  if (code === 'INTERNAL_ERROR' || code === 'ILLEGAL_STATE') {
    return new InternalError(body.message, opts)
  }
  return new ApiError(body.message, opts)
}

/**
 * Return the typed error for any value caught in a try/catch. Reads
 * `parsedError` if the axios interceptor already attached one;
 * otherwise parses on demand. Safe on non-axios values (returns a
 * generic ApiError).
 */
export function getApiError(rawError) {
  if (rawError instanceof ApiError) return rawError
  if (rawError?.parsedError instanceof ApiError) return rawError.parsedError
  return parseApiError(rawError)
}

// ── User-facing copy ──────────────────────────────────────────
//
// Each error type maps to one calm sentence. Components that just
// need to render a toast call `formatApiError(error)` and get back
// something acceptable to show users — no leaking trace IDs, stack
// traces, or low-level wire messages.

const FRIENDLY_MAP = {
  // Known business-rule codes — the message string overrides the
  // server's text. Keep this list short; prefer letting the server
  // own its copy.
  DUPLICATE_REPOST: 'You already reposted this.',
  BLOCKED_INTERACTION: 'This action is unavailable.',
  USER_BLOCKED: 'This action is unavailable.',
  USER_BLOCKED_VIEWER: 'This action is unavailable.',
  USER_RESTRICTED: 'This action is unavailable.',
}

export function formatApiError(error, fallback = 'Something went wrong.') {
  const e = getApiError(error)

  if (FRIENDLY_MAP[e.errorCode]) return FRIENDLY_MAP[e.errorCode]

  if (e instanceof RateLimited) {
    const s = e.retryAfterSeconds
    return s && s > 0
      ? `You're going a little fast — try again in ${s}s.`
      : "You're going a little fast — try again in a moment."
  }
  if (e instanceof FileTooLarge) {
    const max = e.maxSize
    if (max) {
      const mb = Math.max(1, Math.round(max / (1024 * 1024)))
      return `That file is too large. Max ${mb} MB.`
    }
    return 'That file is too large.'
  }
  if (e instanceof StorageUnavailable) {
    return 'File storage is briefly unavailable — please try again.'
  }
  if (e instanceof R2UploadFailed) {
    return 'Upload failed. Please try again.'
  }
  if (e instanceof PostCreateFailed) {
    return 'Your post couldn’t be saved — please try again.'
  }
  if (e instanceof SessionExpired) {
    return 'Please sign in again to continue.'
  }
  if (e instanceof AccountUnavailable) {
    return e.message || 'Your account is currently unavailable.'
  }
  if (e instanceof Forbidden) {
    return e.message || 'You don’t have permission to do that.'
  }
  if (e instanceof NotFound) {
    return e.message || 'That thing no longer exists.'
  }
  if (e instanceof ValidationFailed) {
    // Show the first field error if there is one — it's almost
    // always the most useful sentence to the user.
    const first = e.fieldErrors?.[0]
    if (first?.message) return first.message
    return e.message || 'Some fields need fixing.'
  }
  if (e instanceof BadRequest) {
    return e.message || 'That request wasn’t valid.'
  }
  if (e instanceof Conflict) {
    return e.message || 'That conflicts with the current state.'
  }
  if (e instanceof NetworkError) {
    return 'No connection — check your internet and try again.'
  }
  if (e instanceof InternalError) {
    // Surface trace id so support can grep the log.
    return e.traceId
      ? `Something went wrong. Reference: ${e.traceId}`
      : 'Something went wrong. Please try again.'
  }
  if (e instanceof ProgrammerError) {
    // Don't expose this to users — it's a frontend bug. Show generic.
    return 'Something went wrong. Please try again.'
  }
  if (e instanceof UnhydratedIdError) {
    // Programmer error — call site fired before its id hydrated.
    // The dev console already got a loud warning; surface a calm
    // generic message in case anything ever calls formatApiError on
    // this (toast handlers, banners, etc.).
    return 'Loading…'
  }
  return e.message || fallback
}

/**
 * Return a `{ field: message }` map from a ValidationFailed error.
 * Empty object if the error doesn't carry field-level info.
 */
export function fieldErrorMap(error) {
  const e = getApiError(error)
  const out = {}
  if (!e.fieldErrors) return out
  for (const fe of e.fieldErrors) {
    if (fe?.field) out[fe.field] = fe.message ?? 'Invalid value.'
  }
  return out
}

// ── Predicates (for `if (isRateLimited(err))` style checks) ────

export function isRateLimited(error) {
  return getApiError(error) instanceof RateLimited
}
export function isSessionExpired(error) {
  return getApiError(error) instanceof SessionExpired
}
export function isForbidden(error) {
  return getApiError(error) instanceof Forbidden
}
export function isNotFound(error) {
  return getApiError(error) instanceof NotFound
}
export function isNetworkError(error) {
  return getApiError(error) instanceof NetworkError
}
export function isValidationFailed(error) {
  return getApiError(error) instanceof ValidationFailed
}
