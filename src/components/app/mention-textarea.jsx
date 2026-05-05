import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Megaphone } from 'lucide-react'

import { Textarea } from '@/components/ui/textarea'
import { UserAvatar } from '@/components/app/user-avatar'
import { suggestMentions } from '@/features/mentions/mentions.api'
import { findActiveMention } from '@/lib/mentions'
import { seedUserCache } from '@/lib/user-cache'
import { cn } from '@/lib/utils'
import { getFullName } from '@/lib/format'

const FOLLOWERS_OPTION = {
  id: '__followers__',
  username: 'followers',
  isFollowers: true,
}

/**
 * Textarea with @username / @followers autocomplete.
 *
 * Forwards the underlying <Textarea> ref; accepts the same props plus:
 *   - value, onChange (controlled)
 *   - allowFollowersToken: surface "@followers" as a top-of-list option
 *     (only enable on top-level composers — the backend ignores it on
 *     comments/answers anyway, but hiding it keeps the UI honest)
 *
 * Behavior:
 *   - Typing `@` opens the dropdown; further typing filters via searchUsers
 *   - ↑/↓ navigates, Enter or Tab picks, Esc closes
 *   - Selecting replaces the in-progress `@partial` with `@username `
 *
 * Caret-anchored dropdown is rendered relative to a mirror div that mimics
 * the textarea's wrapping; this is the standard "mirror element" trick to
 * place a popover at the caret without measuring the canvas glyphs.
 */
export const MentionTextarea = forwardRef(function MentionTextarea(
  {
    value = '',
    onChange,
    onKeyDown,
    onSelect,
    allowFollowersToken = false,
    className,
    wrapperClassName,
    minSearchLength = 1,
    maxResults = 6,
    ...textareaProps
  },
  ref,
) {
  const innerRef = useRef(null)
  useImperativeHandle(ref, () => innerRef.current)

  const [active, setActive] = useState(null) // { start, query }
  const [results, setResults] = useState([])
  const [highlighted, setHighlighted] = useState(0)
  const [loading, setLoading] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0, height: 0 })
  const mirrorRef = useRef(null)

  // ── Detect active @mention near caret ────────────────────────────
  function handleSelectionChange() {
    const el = innerRef.current
    if (!el) return
    const next = findActiveMention(value, el.selectionStart)
    setActive((prev) => {
      if (next == null && prev == null) return prev
      if (
        next != null &&
        prev != null &&
        next.start === prev.start &&
        next.query === prev.query
      ) {
        return prev
      }
      return next
    })
  }

  useEffect(handleSelectionChange, [value])

  // ── Fetch suggestions when active ────────────────────────────────
  useEffect(() => {
    if (!active) {
      setResults([])
      setHighlighted(0)
      return undefined
    }
    const query = active.query.trim()
    let cancelled = false

    // Always include @followers (when allowed) at the top before any server
    // results — keep its position stable so keyboard nav is predictable.
    function withFollowers(list) {
      if (!allowFollowersToken) return list
      const matchesFilter =
        query.length === 0 || 'followers'.startsWith(query.toLowerCase())
      return matchesFilter ? [FOLLOWERS_OPTION, ...list] : list
    }

    if (query.length < minSearchLength) {
      setResults(withFollowers([]))
      setHighlighted(0)
      return undefined
    }

    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        // Purpose-built picker endpoint — username-prefix ranked,
        // self / blocked / locked / deleted filtered server-side,
        // 30s Redis cached. Sub-5ms warm even on millions of rows.
        const suggestions = await suggestMentions({ q: query, limit: maxResults })
        if (cancelled) return
        const items = suggestions.filter((u) => u.username)
        // Seed the user-cache as we go so any `<MentionText>` chip in
        // the same view that references one of these users renders
        // their display name immediately, without a second round-trip.
        for (const user of items) seedUserCache(user)
        setResults(withFollowers(items))
        setHighlighted(0)
      } catch {
        if (!cancelled) setResults(withFollowers([]))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 180)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [active, allowFollowersToken, minSearchLength, maxResults])

  // ── Position the dropdown at the caret using a mirror element ───
  useEffect(() => {
    if (!active) return
    const el = innerRef.current
    const mirror = mirrorRef.current
    if (!el || !mirror) return
    const style = window.getComputedStyle(el)
    const props = [
      'boxSizing',
      'width',
      'fontFamily',
      'fontSize',
      'fontWeight',
      'lineHeight',
      'letterSpacing',
      'padding',
      'border',
      'whiteSpace',
      'wordWrap',
      'wordBreak',
    ]
    props.forEach((p) => {
      mirror.style[p] = style[p]
    })
    mirror.style.position = 'absolute'
    mirror.style.visibility = 'hidden'
    mirror.style.overflow = 'hidden'
    mirror.style.height = 'auto'

    const upTo = value.slice(0, active.start)
    mirror.textContent = upTo
    const span = document.createElement('span')
    span.textContent = '@'
    mirror.appendChild(span)

    const top = span.offsetTop - el.scrollTop
    const left = span.offsetLeft - el.scrollLeft
    const lineHeight = parseFloat(style.lineHeight) || 16
    setCoords({ top: top + lineHeight + 4, left, height: lineHeight })
    mirror.textContent = ''
  }, [active, value])

  // ── Picking an option ────────────────────────────────────────────
  function pick(option) {
    if (!active || !option) return
    const el = innerRef.current
    const before = value.slice(0, active.start)
    const after = value.slice(active.start + 1 + active.query.length) // +1 for `@`
    const insert = `@${option.username} `
    const next = `${before}${insert}${after}`
    onChange?.(next)
    // Cache the picked user so the rendered mention chip shows their
    // display name (Facebook-style) the instant the post is published.
    if (!option.isFollowers) seedUserCache(option)
    setActive(null)
    setResults([])
    // Restore caret right after the inserted token
    requestAnimationFrame(() => {
      if (el) {
        const caret = before.length + insert.length
        el.focus()
        el.setSelectionRange(caret, caret)
      }
    })
  }

  // ── Key handling: nav within the dropdown, then delegate ─────────
  function handleKeyDown(event) {
    if (active && results.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setHighlighted((i) => (i + 1) % results.length)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setHighlighted((i) => (i - 1 + results.length) % results.length)
        return
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault()
        pick(results[highlighted])
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        setActive(null)
        return
      }
    }
    onKeyDown?.(event)
  }

  const showDropdown = active != null && (results.length > 0 || loading)

  const dropdown = useMemo(() => {
    if (!showDropdown) return null
    return (
      <motion.div
        key="mention-popover"
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.12 }}
        role="listbox"
        className={cn(
          'absolute z-30 max-h-64 w-72 overflow-y-auto rounded-xl border border-border bg-popover/95 p-1 shadow-soft-lg backdrop-blur',
        )}
        style={{ top: coords.top, left: coords.left }}
      >
        {loading && results.length === 0 ? (
          <p className="px-3 py-2 text-[12px] text-ink-3">Searching…</p>
        ) : null}
        {results.map((option, i) => {
          const highlight = i === highlighted
          if (option.isFollowers) {
            return (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={highlight}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(option)}
                onMouseEnter={() => setHighlighted(i)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors',
                  highlight ? 'bg-gold-soft/60 text-gold-2' : 'text-ink hover:bg-muted',
                )}
              >
                <span className="grid size-7 place-items-center rounded-full bg-gold-soft text-gold-2">
                  <Megaphone className="size-3.5" strokeWidth={1.9} />
                </span>
                <span className="flex-1">
                  <span className="font-semibold">@followers</span>
                  <span className="ml-1.5 text-[11px] text-ink-3">
                    Notify everyone who follows you
                  </span>
                </span>
              </button>
            )
          }
          return (
            <button
              key={option.id}
              type="button"
              role="option"
              aria-selected={highlight}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(option)}
              onMouseEnter={() => setHighlighted(i)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors',
                highlight ? 'bg-brand/10 text-brand' : 'text-ink hover:bg-muted',
              )}
            >
              <UserAvatar user={option} className="size-7 ring-1 ring-border" />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate font-semibold">
                  {getFullName(option) || option.username}
                </span>
                <span className="block truncate text-[11px] text-ink-3">
                  {option.username}
                </span>
              </span>
            </button>
          )
        })}
      </motion.div>
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDropdown, results, highlighted, loading, coords.top, coords.left])

  return (
    <div className={cn('relative', wrapperClassName)}>
      <Textarea
        ref={innerRef}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        onKeyDown={handleKeyDown}
        onSelect={(event) => {
          handleSelectionChange()
          onSelect?.(event)
        }}
        onClick={handleSelectionChange}
        onBlur={() => {
          // Close shortly after blur so click-on-option still registers
          setTimeout(() => setActive(null), 120)
        }}
        className={className}
        {...textareaProps}
      />
      {/* Hidden mirror used for caret positioning */}
      <div
        ref={mirrorRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 -z-10"
      />
      <AnimatePresence>{dropdown}</AnimatePresence>
    </div>
  )
})
