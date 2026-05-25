import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { Loader2, Pencil, Plus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { UserAvatar } from '@/components/app/user-avatar'
import { RoleBadge } from '@/components/app/role-badge'
import { useToast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import { extractApiMessage } from '@/lib/api-error'
import { getFullName, getHandle, getRawUsername } from '@/lib/format'
import { searchUsers } from '@/features/users/users.api'
import {
  CONTRIBUTOR_ROLES,
  addResearchContributor,
  getResearchContributors,
  removeResearchContributor,
  updateResearchContributor,
} from '@/features/research/research.api'

// Order the role groups appear in. `CONTRIBUTOR_ROLES` is the enum order
// from the backend; this matches the natural reading order — co-authors
// first, support roles after.
const ROLE_LABELS = {
  CO_AUTHOR: 'Co-authors',
  ADVISOR: 'Advisors',
  REVIEWER: 'Reviewers',
  TRANSLATOR: 'Translators',
  EDITOR: 'Editors',
  CONTRIBUTOR: 'Contributors',
}
const ROLE_LABELS_SINGULAR = {
  CO_AUTHOR: 'Co-author',
  ADVISOR: 'Advisor',
  REVIEWER: 'Reviewer',
  TRANSLATOR: 'Translator',
  EDITOR: 'Editor',
  CONTRIBUTOR: 'Contributor',
}

// Eligible target accounts for a contributor row. The backend enforces
// the same set and returns 400 if violated; checking here lets us hide
// non-eligible search results before the user clicks.
const ELIGIBLE_ACCOUNT_TYPES = new Set([
  'VERIFIED_RESEARCHER',
  'VERIFIED_SCHOLAR',
  'RESEARCHER',
  'SCHOLAR',
  'ADMIN',
  'SUPER_ADMIN',
])

function isEligibleTarget(user) {
  if (!user) return false
  if (ELIGIBLE_ACCOUNT_TYPES.has(user.accountType)) return true
  // Some endpoints ship `role` instead of `accountType`. Treat the same
  // family of values as eligible.
  return ELIGIBLE_ACCOUNT_TYPES.has(user.role)
}

function groupByRole(contributors) {
  const groups = new Map()
  for (const role of CONTRIBUTOR_ROLES) groups.set(role, [])
  for (const c of contributors) {
    const bucket = groups.get(c.role) ?? groups.get('CONTRIBUTOR')
    bucket.push(c)
  }
  // Drop empty buckets so render order is predictable + no empty headers.
  return Array.from(groups.entries()).filter(([, list]) => list.length > 0)
}

export function ResearchContributors({
  researchId,
  isOwner,
  ownerId,
  initialContributors,
}) {
  const toast = useToast()
  const [contributors, setContributors] = useState(
    Array.isArray(initialContributors) ? initialContributors : [],
  )
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)

  // Re-sync when the research changes (e.g. user navigates between
  // research detail pages without unmounting this component tree).
  useEffect(() => {
    setContributors(Array.isArray(initialContributors) ? initialContributors : [])
  }, [initialContributors, researchId])

  // If the detail payload didn't carry contributors (older endpoint),
  // fall back to a one-shot fetch so the section still renders.
  useEffect(() => {
    if (!researchId) return
    if (Array.isArray(initialContributors)) return
    let cancelled = false
    setLoading(true)
    getResearchContributors(researchId)
      .then((data) => {
        if (!cancelled) setContributors(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        if (!cancelled) setContributors([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [researchId, initialContributors])

  const grouped = useMemo(() => groupByRole(contributors), [contributors])
  const hasAny = contributors.length > 0

  // Nothing to show and the viewer can't add anything either — render
  // nothing rather than an empty section header.
  if (!hasAny && !isOwner && !loading) return null

  async function handleAdd(payload) {
    try {
      const created = await addResearchContributor(researchId, payload)
      setContributors((current) => [...current, created])
      toast.success('Contributor added.')
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not add contributor.'))
      throw error
    }
  }

  async function handleUpdate(contributorId, patch) {
    try {
      const updated = await updateResearchContributor(researchId, contributorId, patch)
      setContributors((current) =>
        current.map((c) => (c.id === contributorId ? { ...c, ...updated } : c)),
      )
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not update contributor.'))
    }
  }

  async function handleRemove(contributorId) {
    const previous = contributors
    setContributors((current) => current.filter((c) => c.id !== contributorId))
    try {
      await removeResearchContributor(researchId, contributorId)
    } catch (error) {
      setContributors(previous)
      toast.error(extractApiMessage(error, 'Could not remove contributor.'))
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-fg-muted">
          Contributors
          {loading ? (
            <Loader2
              className="ml-2 inline size-3 animate-spin text-fg-faint"
              strokeWidth={2}
            />
          ) : null}
        </h2>
        {isOwner ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 rounded-full px-2.5 text-[12px] text-fg-soft hover:bg-bg-soft"
            onClick={() => setEditing((v) => !v)}
          >
            <Pencil className="mr-1 size-3.5" strokeWidth={1.6} />
            {editing ? 'Done' : hasAny ? 'Edit' : 'Add'}
          </Button>
        ) : null}
      </div>

      {hasAny ? (
        <div className="space-y-3">
          {grouped.map(([role, list]) => (
            <RoleGroup
              key={role}
              role={role}
              list={list}
              editing={editing}
              onRemove={handleRemove}
              onUpdate={handleUpdate}
            />
          ))}
        </div>
      ) : !loading ? (
        <p className="font-semibold text-[13px] italic text-fg-muted">
          {isOwner
            ? "Add co-authors, advisors, or translators who helped with this research."
            : 'No contributors listed.'}
        </p>
      ) : null}

      {editing ? (
        <AddContributorForm
          researchId={researchId}
          ownerId={ownerId}
          existingUserIds={new Set(contributors.map((c) => c.userId))}
          onAdd={handleAdd}
        />
      ) : null}
    </section>
  )
}

function RoleGroup({ role, list, editing, onRemove, onUpdate }) {
  return (
    <div className="space-y-1.5">
      <p className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-fg-faint">
        {ROLE_LABELS[role] ?? role}
      </p>
      <ul className="flex flex-wrap gap-2">
        {list.map((c) => (
          <ContributorChip
            key={c.id}
            contributor={c}
            editing={editing}
            onRemove={() => onRemove(c.id)}
            onChangeRole={(nextRole) => onUpdate(c.id, { role: nextRole })}
          />
        ))}
      </ul>
    </div>
  )
}

function ContributorChip({ contributor, editing, onRemove, onChangeRole }) {
  const route = getRawUsername(contributor)
  const name = getFullName(contributor) || getHandle(contributor)
  const handle = getHandle(contributor)

  return (
    <li className="group inline-flex items-center gap-2 rounded-full border-[0.5px] border-line bg-background py-1 pl-1 pr-2.5 text-[13px] transition-colors hover:border-ink-4">
      <Link
        to={route ? `/profile/${route}` : '#'}
        className="flex items-center gap-2"
        title={contributor.note || name}
      >
        <UserAvatar user={contributor} className="size-6 rounded-full" />
        <span className="font-medium text-ink">{name}</span>
        {handle && handle !== name ? (
          <span className="font-mono text-[10.5px] text-fg-muted">@{handle}</span>
        ) : null}
        {contributor.role ? <RoleBadge role={contributor.accountRole ?? contributor.role} size="xs" /> : null}
      </Link>

      {editing ? (
        <>
          <Select value={contributor.role} onValueChange={onChangeRole}>
            <SelectTrigger
              size="sm"
              className="ml-1 h-6 rounded-md px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em]"
              aria-label="Contributor role"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONTRIBUTOR_ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABELS_SINGULAR[r] ?? r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            type="button"
            onClick={onRemove}
            className="ml-0.5 grid size-5 place-items-center rounded-full text-fg-muted transition-colors hover:bg-destructive/10 hover:text-destructive"
            aria-label={`Remove ${name}`}
            title="Remove"
          >
            <X className="size-3" strokeWidth={2} />
          </button>
        </>
      ) : null}
    </li>
  )
}

function AddContributorForm({ researchId, ownerId, existingUserIds, onAdd }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState(null)
  const [role, setRole] = useState('CO_AUTHOR')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const debounceRef = useRef(null)

  // Debounced search — 220ms is enough to feel responsive without
  // hammering the endpoint on every keystroke.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    debounceRef.current = setTimeout(() => {
      searchUsers({ q: trimmed, page: 0, size: 10 })
        .then((data) => {
          const items = Array.isArray(data) ? data : (data?.content ?? [])
          setResults(items)
        })
        .catch(() => setResults([]))
        .finally(() => setSearching(false))
    }, 220)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, researchId])

  async function submit() {
    if (!selected || submitting) return
    setSubmitting(true)
    try {
      await onAdd({
        userId: selected.id,
        role,
        note: note.trim() || null,
      })
      setSelected(null)
      setQuery('')
      setRole('CO_AUTHOR')
      setNote('')
      setResults([])
    } finally {
      setSubmitting(false)
    }
  }

  const filteredResults = results.filter((u) => {
    if (!u?.id) return false
    if (u.id === ownerId) return false
    if (existingUserIds.has(u.id)) return false
    return isEligibleTarget(u)
  })

  return (
    <div className="rounded-md border-[0.5px] border-line bg-bg-soft p-3">
      <p className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.1em] text-fg-muted">
        Add contributor
      </p>

      {selected ? (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 rounded-lg border-[0.5px] border-line bg-background px-2.5 py-2">
            <UserAvatar user={selected} className="size-7 rounded-full" />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-[13px] font-medium text-ink">
                {getFullName(selected) || getHandle(selected)}
              </p>
              <p className="truncate font-mono text-[10.5px] text-fg-muted">
                @{getHandle(selected)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="grid size-6 place-items-center rounded-full text-fg-muted transition-colors hover:bg-bg-soft hover:text-ink"
              aria-label="Pick a different user"
            >
              <X className="size-3.5" strokeWidth={1.8} />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger
                size="sm"
                className="font-mono text-[11px] uppercase tracking-[0.08em]"
                aria-label="Role"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTRIBUTOR_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS_SINGULAR[r] ?? r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note (e.g. 'second author')"
              className="h-8 flex-1 rounded-lg text-[12.5px]"
              maxLength={200}
            />
            <Button
              type="button"
              size="sm"
              onClick={submit}
              disabled={submitting}
              className="h-8 rounded-full"
            >
              {submitting ? (
                <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
              ) : (
                <>
                  <Plus className="mr-1 size-3.5" strokeWidth={2} />
                  Add
                </>
              )}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, username, or email…"
            className="h-9 rounded-lg text-[13px]"
            autoFocus
          />
          {query.trim().length >= 2 ? (
            <div className="max-h-56 overflow-y-auto rounded-lg border-[0.5px] border-line bg-background">
              {searching ? (
                <p className="px-3 py-4 text-center text-[12.5px] text-fg-muted">
                  <Loader2
                    className="mr-1.5 inline size-3.5 animate-spin"
                    strokeWidth={2}
                  />
                  Searching…
                </p>
              ) : filteredResults.length === 0 ? (
                <p className="px-3 py-4 text-center text-[12.5px] italic text-fg-muted">
                  No eligible researchers or scholars found.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  <AnimatePresence initial={false}>
                    {filteredResults.map((u) => (
                      <motion.li
                        key={u.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <button
                          type="button"
                          onClick={() => setSelected(u)}
                          className={cn(
                            'flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors',
                            'hover:bg-bg-soft',
                          )}
                        >
                          <UserAvatar user={u} className="size-7 rounded-full" />
                          <div className="min-w-0 flex-1 leading-tight">
                            <div className="flex items-center gap-1.5">
                              <p className="truncate text-[13px] font-medium text-ink">
                                {getFullName(u) || getHandle(u)}
                              </p>
                              {u.role ? <RoleBadge role={u.role} size="xs" /> : null}
                            </div>
                            <p className="truncate font-mono text-[10.5px] text-fg-muted">
                              @{getHandle(u)}
                            </p>
                          </div>
                        </button>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </div>
          ) : (
            <p className="font-semibold text-[12px] italic text-fg-muted">
              Type at least 2 characters to search. Only researchers and
              scholars can be added.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
