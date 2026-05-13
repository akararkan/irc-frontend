import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Loader2, Megaphone, Search, UserRound } from 'lucide-react'

import { Textarea } from '@/components/ui/textarea'
import { RoleBadge } from '@/components/app/role-badge'
import { UserAvatar } from '@/components/app/user-avatar'
import {
  recordMentionClick,
  suggestMentions,
} from '@/features/mentions/mentions.api'
import { findActiveMention } from '@/lib/mentions'
import { seedUserCache } from '@/lib/user-cache'
import { cn } from '@/lib/utils'
import { getFullName, getHandle } from '@/lib/format'

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
 *   - Typing `@` opens the dropdown; further typing filters via suggestMentions
 *   - ↑/↓ navigates, Enter or Tab picks, Esc closes
 *   - Selecting replaces the in-progress `@partial` with `@username `
 *   - Picking a user fires a fire-and-forget POST /api/v1/mentions/click
 *     so the backend records a MENTION_LOOKUP activity row
 *
 * Display rule: every row shows the user's **full name** as the primary
 * label and `@username` as the secondary handle. Email is never shown.
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
    minSearchLength = 0,
    maxResults = 8,
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
    }, 160)

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
    setCoords({ top: top + lineHeight + 6, left, height: lineHeight })
    mirror.textContent = ''
  }, [active, value])

  // ── Picking an option ────────────────────────────────────────────
  function pick(option) {
    if (!active || !option) return
    const el = innerRef.current
    const before = value.slice(0, active.start)
    const after = value.slice(active.start + 1 + active.query.length) // +1 for `@`
    // Insert the sanitized handle, never the raw email-shaped username.
    // If we inserted `@user@gmail.com`, both the FE and backend mention
    // tokenizers (which match `@[a-zA-Z0-9_.]{2,50}`) would consume only
    // `@user`, leaving `@gmail.com` as orphan plain text — visually
    // broken. The handle keeps the chip well-formed; the user-cache
    // seeding below preserves the link to the canonical user record.
    const handle =
      option.isFollowers ? option.username : (getHandle(option) || option.username)
    const insert = `@${handle} `
    const next = `${before}${insert}${after}`
    onChange?.(next)
    if (!option.isFollowers) {
      // Cache the picked user so the rendered mention chip shows their
      // display name (Facebook-style) the instant the post is published.
      // We seed under both shapes (handle + raw username) so a chip that
      // resolves via either lookup hits the same record.
      seedUserCache(option)
      if (handle && handle !== option.username) {
        seedUserCache({ ...option, username: handle })
      }
      // Best-effort: tell the backend the picker locked in this user.
      // Records a MENTION_LOOKUP activity that streams to the per-user
      // realtime channel so cross-device "recent mentions" stay fresh.
      recordMentionClick({
        q: active.query.trim(),
        targetUserId: option.id,
        targetUsername: option.username,
      })
    }
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

  const showDropdown =
    active != null && (results.length > 0 || loading || (active.query?.length ?? 0) > 0)

  const dropdown = useMemo(() => {
    if (!showDropdown) return null
    const query = active?.query?.trim() ?? ''
    const peopleResults = results.filter((r) => !r.isFollowers)
    const showEmpty =
      !loading && peopleResults.length === 0 && query.length > 0
    return (
      <motion.div
        key="mention-popover"
        initial={{ opacity: 0, y: -6, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -6, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 480, damping: 32 }}
        role="listbox"
        className={cn(
          'absolute z-30 w-[320px] overflow-hidden rounded-2xl border border-border/80 bg-popover/98 p-1 shadow-soft-lg backdrop-blur-md',
        )}
        style={{ top: coords.top, left: coords.left }}
      >
        <div className="flex items-center gap-1.5 border-b border-border/60 px-2.5 pb-1.5 pt-1">
          <Search className="size-3 text-ink-4" />
          <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">
            Mention {query ? `· @${query}` : 'someone'}
          </span>
          {loading ? (
            <Loader2 className="ml-auto size-3 animate-spin text-ink-3" />
          ) : (
            <span className="ml-auto rounded-md bg-muted px-1.5 py-0.5 font-mono text-[9.5px] font-semibold tabular-nums text-ink-3">
              {peopleResults.length || 0}
            </span>
          )}
        </div>

        <div className="max-h-72 overflow-y-auto py-1">
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
                    'flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors',
                    highlight
                      ? 'bg-gold-soft/60 text-gold-2'
                      : 'text-ink hover:bg-muted',
                  )}
                >
                  <span className="grid size-9 place-items-center rounded-full bg-gold-soft text-gold-2">
                    <Megaphone className="size-4" strokeWidth={1.9} />
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block font-display text-[13.5px] font-semibold tracking-[-0.005em]">
                      Notify all followers
                    </span>
                    <span className="block font-mono text-[10.5px] text-ink-3">
                      @followers
                    </span>
                  </span>
                </button>
              )
            }
            const handle = getHandle(option)
            const display = getFullName(option) || handle || 'Unknown'
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
                  'group/mention flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors',
                  highlight ? 'bg-brand/10 text-brand' : 'text-ink hover:bg-muted/70',
                )}
              >
                <UserAvatar user={option} className="size-9 ring-1 ring-border" />
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="flex items-center gap-1.5">
                    <span className="block truncate font-display text-[13.5px] font-semibold tracking-[-0.005em] text-ink">
                      {display}
                    </span>
                    {option.role ? (
                      <RoleBadge role={option.role} size="xs" showIcon={false} />
                    ) : null}
                  </span>
                  {handle ? (
                    <span className="block truncate font-mono text-[11px] text-ink-3">
                      @{handle}
                    </span>
                  ) : null}
                </span>
                {highlight ? (
                  <kbd
                    aria-hidden
                    className="hidden shrink-0 rounded border border-border bg-paper px-1 py-[1px] font-mono text-[9.5px] font-semibold text-ink-3 group-hover/mention:inline-block"
                  >
                    ↵
                  </kbd>
                ) : null}
              </button>
            )
          })}

          {showEmpty ? (
            <div className="flex flex-col items-center gap-1 px-3 py-4 text-center">
              <UserRound className="size-5 text-ink-4" />
              <p className="font-display text-[12.5px] font-semibold tracking-[-0.005em] text-ink-2">
                No people match “@{query}”
              </p>
              <p className="text-[11px] text-ink-3">
                Try a shorter prefix, or check the spelling.
              </p>
            </div>
          ) : null}
        </div>

        {peopleResults.length > 0 ? (
          <div className="flex items-center justify-between border-t border-border/60 px-2.5 pb-1 pt-1.5 font-mono text-[10px] text-ink-3">
            <span className="inline-flex items-center gap-1.5">
              <kbd className="rounded border border-border bg-paper px-1 py-[1px] text-[9.5px] font-semibold">↑↓</kbd>
              navigate
            </span>
            <span className="inline-flex items-center gap-1.5">
              <kbd className="rounded border border-border bg-paper px-1 py-[1px] text-[9.5px] font-semibold">↵</kbd>
              pick
              <span className="text-ink-4">·</span>
              <kbd className="rounded border border-border bg-paper px-1 py-[1px] text-[9.5px] font-semibold">esc</kbd>
              close
            </span>
          </div>
        ) : null}
      </motion.div>
    )

  }, [showDropdown, results, highlighted, loading, coords.top, coords.left])

  return (
    <div className={cn('relative', wrapperClassName)}>
      <Textarea
        ref={innerRef}
        // `dir="auto"` lets the textarea flip alignment as the user
        // types — typing English aligns left, switching to Arabic /
        // Kurdish flips to right alignment. Mixed-language drafts
        // work naturally line by line.
        dir="auto"
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
