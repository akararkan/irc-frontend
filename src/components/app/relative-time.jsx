import { useEffect, useReducer } from 'react'

import { formatRelativeTime } from '@/lib/format'
import { subscribeNowTicks } from '@/lib/relative-time-store'

function pickTimestamp(value, entity) {
  if (value != null) return value
  if (!entity || typeof entity !== 'object') return null
  return (
    entity.createdAt ??
    entity.publishedAt ??
    entity.updatedAt ??
    entity.acceptedAt ??
    null
  )
}

function defaultTitle(time) {
  if (time == null) return ''
  const date = new Date(time)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString()
}

/**
 * Live-ticking relative time label.
 *
 * Renders something like "just now" / "2 minutes ago" / "3 hours ago"
 * and re-renders every ~15s so a freshly created post stops saying
 * "just now" without the user reloading.
 *
 * Usage:
 *   <RelativeTime entity={post} />          // pulls createdAt / publishedAt / updatedAt
 *   <RelativeTime value={notification.createdAt} />
 *
 * If the entity has neither a parseable timestamp nor a backend
 * `timeAgo` string, the component renders nothing (or `fallback`).
 */
export function RelativeTime({
  value,
  entity,
  fallback = null,
  className,
  title,
  prefix,
}) {
  // Single-bit re-render trigger. The shared tick store calls this
  // every 15s while any RelativeTime is mounted; cleanup automatic.
  const [, force] = useReducer((x) => x + 1, 0)

  const timestamp = pickTimestamp(value, entity)

  useEffect(() => {
    if (timestamp == null) return undefined
    return subscribeNowTicks(force)
  }, [timestamp])

  if (timestamp == null) {
    // Backend pre-rendered string ("5 minutes ago") is a frozen
    // snapshot — only used when we have nothing better.
    if (entity?.timeAgo) {
      return (
        <span className={className} title={title ?? ''}>
          {prefix ? `${prefix} ` : ''}
          {entity.timeAgo}
        </span>
      )
    }
    return fallback
  }

  const label = formatRelativeTime(timestamp)
  return (
    <span className={className} title={title ?? defaultTitle(timestamp)}>
      {prefix ? `${prefix} ` : ''}
      {label}
    </span>
  )
}
