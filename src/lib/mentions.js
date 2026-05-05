/**
 * Mention parsing — mirrors the backend's MentionExtractor:
 *   - Username charset: [a-zA-Z0-9_.], length 2–50, case-insensitive
 *   - Special `@followers` token (always lowercase, recognized only at top-level
 *     surfaces server-side; we still tokenize it everywhere for visual styling)
 *   - `@` preceded by an alphanumeric character is ignored (so `foo@bar.com`
 *     never triggers a mention)
 */

const FOLLOWERS_TOKEN = 'followers'

// Negative lookbehind for an alphanumeric or `_` `.` so emails / URLs don't match.
// Using `(?<![A-Za-z0-9._])` keeps parity with the backend's word-boundary rule.
const MENTION_REGEX = /(?<![A-Za-z0-9._])@([a-zA-Z0-9_.]{2,50})/g

/**
 * Tokenize text into an array of segments:
 *   { kind: 'text', value: '...' }
 *   { kind: 'mention', value: '@bob', username: 'bob', isFollowers: false }
 *   { kind: 'mention', value: '@followers', username: 'followers', isFollowers: true }
 */
export function tokenizeMentions(text) {
  if (!text) return []
  const tokens = []
  let lastIndex = 0
  let match
  MENTION_REGEX.lastIndex = 0
  while ((match = MENTION_REGEX.exec(text)) != null) {
    const matchStart = match.index
    const matchEnd = matchStart + match[0].length
    if (matchStart > lastIndex) {
      tokens.push({ kind: 'text', value: text.slice(lastIndex, matchStart) })
    }
    const username = match[1]
    tokens.push({
      kind: 'mention',
      value: match[0],
      username,
      isFollowers: username.toLowerCase() === FOLLOWERS_TOKEN,
    })
    lastIndex = matchEnd
  }
  if (lastIndex < text.length) {
    tokens.push({ kind: 'text', value: text.slice(lastIndex) })
  }
  return tokens
}

/**
 * Detect an in-progress `@partial` token immediately before the caret. Used by
 * the composer autocomplete: if the user has typed `@bob` (caret right after
 * `bob`), this returns `{ start: <index of @>, query: 'bob' }`. Returns null
 * if the caret is not in an active mention.
 */
export function findActiveMention(text, caretIndex) {
  if (caretIndex == null || caretIndex < 0) return null
  const slice = text.slice(0, caretIndex)
  const at = slice.lastIndexOf('@')
  if (at === -1) return null

  // Ensure no whitespace between `@` and caret
  const partial = slice.slice(at + 1)
  if (/\s/.test(partial)) return null
  // Length cap of 50 chars (matches backend)
  if (partial.length > 50) return null
  // Must be valid charset (allow empty: user just typed `@`)
  if (partial.length > 0 && !/^[a-zA-Z0-9_.]+$/.test(partial)) return null

  // Reject if `@` is preceded by an alphanumeric/underscore/dot (so emails like
  // foo@bar.com don't trigger autocomplete).
  if (at > 0 && /[A-Za-z0-9._]/.test(text[at - 1])) return null

  return { start: at, query: partial }
}
