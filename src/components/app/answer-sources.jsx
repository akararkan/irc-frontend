import { useState } from 'react'
import { ExternalLink, Library, Loader2, Plus, Trash2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  addAnswerSource,
  deleteAnswerSource,
} from '@/features/qna/qna.api'
import { useToast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import { extractApiMessage } from '@/lib/api-error'
import {
  SOURCE_TYPE_OPTIONS,
  getSourceLink,
  getSourceTypeMeta,
} from '@/lib/qna-media'

function SourceRow({ source, canManage, onDelete }) {
  const meta = getSourceTypeMeta(source.sourceType)
  const Icon = meta.icon
  const link = getSourceLink(source)

  return (
    <li className="flex items-start gap-2.5 rounded-xl border border-border bg-card p-2.5">
      <span
        className={cn(
          'mt-0.5 grid size-7 shrink-0 place-items-center rounded-full',
          meta.bg,
          meta.tone,
        )}
      >
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {link ? (
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 truncate text-[13px] font-semibold text-foreground hover:underline"
            >
              <span className="truncate">{source.title}</span>
              <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
            </a>
          ) : (
            <span className="truncate text-[13px] font-semibold">{source.title}</span>
          )}
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
              meta.bg,
              meta.tone,
            )}
          >
            {meta.label}
          </span>
        </div>
        {source.citationText ? (
          <p className="whitespace-pre-wrap text-[12px] leading-snug text-muted-foreground">
            {source.citationText}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          {source.doi ? <span>DOI: {source.doi}</span> : null}
          {source.isbn ? <span>ISBN: {source.isbn}</span> : null}
          {source.originalFileName ? <span>{source.originalFileName}</span> : null}
        </div>
      </div>
      {canManage ? (
        <button
          type="button"
          onClick={() => onDelete?.(source.id)}
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          aria-label="Remove source"
        >
          <Trash2 className="size-3.5" />
        </button>
      ) : null}
    </li>
  )
}

const emptyDraft = () => ({
  sourceType: 'URL',
  title: '',
  citationText: '',
  url: '',
  doi: '',
  isbn: '',
})

function AddSourceForm({ onCancel, onSubmit, submitting }) {
  const [draft, setDraft] = useState(emptyDraft())

  function update(field, value) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!draft.title.trim()) return
    const payload = { sourceType: draft.sourceType, title: draft.title.trim() }
    if (draft.citationText.trim()) payload.citationText = draft.citationText.trim()
    if (draft.url.trim()) payload.url = draft.url.trim()
    if (draft.doi.trim()) payload.doi = draft.doi.trim()
    if (draft.isbn.trim()) payload.isbn = draft.isbn.trim()
    const ok = await onSubmit(payload)
    if (ok) setDraft(emptyDraft())
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Add source
        </Label>
        <button
          type="button"
          onClick={onCancel}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SOURCE_TYPE_OPTIONS.map((option) => {
          const active = draft.sourceType === option.value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => update('sourceType', option.value)}
              className={cn(
                'rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors',
                active
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {option.label}
            </button>
          )
        })}
      </div>

      <Input
        value={draft.title}
        onChange={(event) => update('title', event.target.value)}
        placeholder='Title — e.g. "Sahih al-Bukhari, Hadith 1395"'
        className="h-8"
      />

      {draft.sourceType === 'URL' ? (
        <Input
          value={draft.url}
          onChange={(event) => update('url', event.target.value)}
          placeholder="https://…"
          className="h-8"
        />
      ) : null}
      {draft.sourceType === 'DOI' ? (
        <Input
          value={draft.doi}
          onChange={(event) => update('doi', event.target.value)}
          placeholder="10.1234/abcd"
          className="h-8"
        />
      ) : null}
      {draft.sourceType === 'ISBN' ? (
        <Input
          value={draft.isbn}
          onChange={(event) => update('isbn', event.target.value)}
          placeholder="978-3-16-148410-0"
          className="h-8"
        />
      ) : null}

      <Textarea
        value={draft.citationText}
        onChange={(event) => update('citationText', event.target.value)}
        placeholder="Optional: full quotation or formatted citation."
        rows={2}
        className="resize-none rounded-lg text-sm"
      />

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 rounded-full"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          className="h-8 rounded-full"
          disabled={!draft.title.trim() || submitting}
        >
          {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
          Add
        </Button>
      </div>
    </form>
  )
}

export function AnswerSources({
  questionId,
  answerId,
  sources = [],
  canManage = false,
  onChange,
}) {
  const toast = useToast()
  const [adding, setAdding] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const hasSources = sources.length > 0

  if (!hasSources && !canManage) return null

  async function handleAdd(payload) {
    setSubmitting(true)
    try {
      const created = await addAnswerSource(questionId, answerId, payload)
      onChange?.([...sources, created])
      setAdding(false)
      return true
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not add source.'))
      return false
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(sourceId) {
    if (!confirm('Remove this source?')) return
    try {
      await deleteAnswerSource(questionId, answerId, sourceId)
      onChange?.(sources.filter((item) => item.id !== sourceId))
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not delete source.'))
    }
  }

  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-2">
        <Library className="size-3 text-muted-foreground" />
        <h4 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Sources & references
        </h4>
        {hasSources ? (
          <span className="text-[11px] text-muted-foreground">· {sources.length}</span>
        ) : null}
        <span className="ml-auto h-px flex-1 bg-border" aria-hidden />
        {canManage && !adding ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 rounded-full text-xs"
            onClick={() => setAdding(true)}
          >
            <Plus className="size-3.5" />
            Add
          </Button>
        ) : null}
      </div>

      {adding ? (
        <AddSourceForm
          submitting={submitting}
          onCancel={() => setAdding(false)}
          onSubmit={handleAdd}
        />
      ) : null}

      {hasSources ? (
        <ul className="space-y-2">
          {sources.map((source) => (
            <SourceRow
              key={source.id}
              source={source}
              canManage={canManage}
              onDelete={handleDelete}
            />
          ))}
        </ul>
      ) : !adding ? (
        <p className="text-[12px] text-muted-foreground">No sources yet.</p>
      ) : null}
    </section>
  )
}
