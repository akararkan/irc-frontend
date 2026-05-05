import { Fragment } from 'react'
import { Link } from 'react-router-dom'

import { tokenizeMentions } from '@/lib/mentions'
import { useResolvedUser } from '@/lib/user-cache'
import { cn } from '@/lib/utils'
import { getFullName } from '@/lib/format'

/**
 * Single mention chip — Facebook-style.
 *
 *   - Renders the user's display name in brand color, no `@` prefix.
 *   - Falls back to the literal username while the cache is hydrating
 *     so the chip never blinks empty.
 *   - Click opens the profile.
 *
 * The cache fetch fires once per username per session via
 * `useResolvedUser`; concurrent feeds with many `@bob` mentions still
 * make exactly one network call.
 */
function MentionLink({ username, className }) {
  const resolved = useResolvedUser(username)
  const display = resolved ? getFullName(resolved) || resolved.username : null
  const label = display || username
  return (
    <Link
      to={`/profile/${username}`}
      className={cn(
        'font-semibold text-brand transition-colors hover:underline',
        className,
      )}
      title={resolved?.username ?? username}
    >
      {label}
    </Link>
  )
}

/**
 * Render a string with `@username` and `@followers` tokens styled as
 * editorial mention chips.
 *
 *   - `@username` → link to the profile, displayed as the user's
 *     display name (no `@`), Facebook-style.
 *   - `@followers` → small "all followers" pill (kept as-is because
 *     it's a directive, not a person).
 *
 * Whitespace and newlines in the source text are preserved by the
 * parent's CSS (`whitespace-pre-wrap`). This component itself does not
 * change the surrounding typography.
 */
export function MentionText({ text, className }) {
  if (!text) return null
  const tokens = tokenizeMentions(text)
  if (tokens.length === 0) return text

  return (
    <span className={className}>
      {tokens.map((token, i) => {
        if (token.kind === 'text') {
          return <Fragment key={i}>{token.value}</Fragment>
        }
        if (token.isFollowers) {
          return (
            <span
              key={i}
              className={cn(
                'mx-0.5 inline-flex items-center gap-1 rounded-full px-1.5 py-[1px]',
                'border border-gold/40 bg-gold-soft/60 text-[0.86em] font-semibold tracking-tight text-gold-2',
              )}
              title="Notifies all followers"
            >
              followers
            </span>
          )
        }
        return <MentionLink key={i} username={token.username} />
      })}
    </span>
  )
}
