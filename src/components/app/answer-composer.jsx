import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  CornerDownLeft,
  FileText,
  Library,
  Link2,
  Loader2,
  Paperclip,
  Plus,
  Trash2,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { MentionTextarea } from '@/components/app/mention-textarea'
import { RoleBadge } from '@/components/app/role-badge'
import { UserAvatar } from '@/components/app/user-avatar'
import { useAuth } from '@/features/auth/auth-context'
import {
  createAnswer,
  uploadAnswerAttachment,
} from '@/features/qna/qna.api'
import { useToast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import { extractApiMessage } from '@/lib/api-error'
import { useCooldown } from '@/lib/rate-limit-cooldown'
import {
  SOURCE_TYPE_OPTIONS,
  formatFileSize,
  getMediaTypeMeta,
  inferMediaTypeFromMime,
} from '@/lib/qna-media'

const ANSWER_MAX = 10000

const emptySource = () => ({
  sourceType: 'URL',
  title: '',
  citationText: '',
  url: '',
  doi: '',
  isbn: '',
})

export function AnswerComposer({ questionId, disabled, onCreated }) {
  const { user, isAuthenticated } = useAuth()
  const toast = useToast()
  const fileInputRef = useRef(null)
  // Backend caps 10 comments / 30 s per user across post/research/qna
  // comment endpoints. Park the post button while the window is open
  // so the user doesn't keep tapping into 429s.
  const commentCooldown = useCooldown('comment')

  const [body, setBody] = useState('')
  const [showLinks, setShowLinks] = useState(false)
  const [showSources, setShowSources] = useState(false)
  const [showAttachments, setShowAttachments] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploadStatus, setUploadStatus] = useState(null)

  const [links, setLinks] = useState('')

  const [sources, setSources] = useState([])
  const [attachments, setAttachments] = useState([])

  if (!isAuthenticated) return null

  const charactersLeft = ANSWER_MAX - body.length
  const trimmedBody = body.trim()

  function reset() {
    setBody('')
    setShowLinks(false)
    setShowSources(false)
    setShowAttachments(false)
    setLinks('')
    setSources([])
    setAttachments([])
    setUploadStatus(null)
  }

  function addSource() {
    setSources((current) => [...current, emptySource()])
  }

  function removeSource(index) {
    setSources((current) => current.filter((_, i) => i !== index))
  }

  function updateSource(index, field, value) {
    setSources((current) =>
      current.map((src, i) => (i === index ? { ...src, [field]: value } : src)),
    )
  }

  function pickAttachments(event) {
    const picked = Array.from(event.target.files ?? [])
    if (picked.length) {
      setAttachments((current) => [
        ...current,
        ...picked.map((file) => ({ file, caption: '' })),
      ])
    }
    event.target.value = ''
  }

  function removeAttachment(index) {
    setAttachments((current) => current.filter((_, i) => i !== index))
  }

  function updateAttachmentCaption(index, value) {
    setAttachments((current) =>
      current.map((item, i) => (i === index ? { ...item, caption: value } : item)),
    )
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting || disabled || !trimmedBody) return

    const cleanSources = sources
      .map((src) => ({ ...src, title: src.title.trim() }))
      .filter((src) => src.title)
      .map((src) => {
        const out = { sourceType: src.sourceType, title: src.title }
        if (src.citationText.trim()) out.citationText = src.citationText.trim()
        if (src.url.trim()) out.url = src.url.trim()
        if (src.doi.trim()) out.doi = src.doi.trim()
        if (src.isbn.trim()) out.isbn = src.isbn.trim()
        return out
      })

    const payload = { body: trimmedBody }

    if (showLinks && links.trim()) {
      payload.links = links
        .split(/[\n,;]+/)
        .map((url) => url.trim())
        .filter(Boolean)
        .join(',')
    }

    if (cleanSources.length > 0) {
      payload.sources = cleanSources
    }

    setSubmitting(true)
    try {
      setUploadStatus('Posting answer…')
      let created = await createAnswer(questionId, payload)

      // Sequentially upload each attachment so the server has a stable
      // displayOrder. Failures on a single file do not abort the rest.
      if (attachments.length > 0) {
        const uploadedAttachments = []
        for (let index = 0; index < attachments.length; index += 1) {
          const { file, caption } = attachments[index]
          setUploadStatus(`Uploading ${file.name}… (${index + 1}/${attachments.length})`)
          try {
            const uploaded = await uploadAnswerAttachment(
              questionId,
              created.id,
              file,
              { caption: caption?.trim() || null, displayOrder: index },
            )
            uploadedAttachments.push(uploaded)
          } catch (error) {
            toast.error(extractApiMessage(error, `Failed to upload ${file.name}.`))
          }
        }
        if (uploadedAttachments.length > 0) {
          created = {
            ...created,
            attachments: [
              ...(created.attachments ?? []),
              ...uploadedAttachments,
            ],
          }
        }
      }

      onCreated?.(created)
      reset()
      toast.success('Answer posted.')
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not post answer.'))
    } finally {
      setSubmitting(false)
      setUploadStatus(null)
    }
  }

  if (disabled) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        Answers are locked for this question.
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-foreground/15"
    >
      <div className="flex gap-3 px-4 py-4 sm:px-5">
        <UserAvatar user={user} className="hidden size-10 shrink-0 sm:block" />

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {/* Posting-as banner — the role badge sits front and centre
              so the user is reminded which standing their answer
              carries onto the thread (Scholar / Researcher). */}
          {user?.role ? (
            <div className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
              <span>Answering as</span>
              <RoleBadge role={user.role} size="sm" />
            </div>
          ) : null}
          <div className="relative">
            <MentionTextarea
              value={body}
              onChange={(next) => setBody(next.slice(0, ANSWER_MAX))}
              placeholder="Share what you know, grounded in evidence and respect…"
              rows={4}
              className="min-h-[112px] resize-none rounded-xl border-0 bg-muted/50 px-4 py-3 leading-relaxed shadow-none focus-visible:ring-1"
            />
            {body.length > ANSWER_MAX - 200 ? (
              <span
                className={cn(
                  'absolute bottom-2 right-3 font-mono text-[11px] tabular-nums',
                  charactersLeft < 0 ? 'text-destructive' : 'text-muted-foreground',
                )}
              >
                {charactersLeft}
              </span>
            ) : null}
          </div>

          <AnimatePresence initial={false}>
            {showAttachments ? (
              <motion.div
                key="attachments"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-3 rounded-xl border border-dashed border-border bg-muted/30 px-3 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      <Paperclip className="size-3" />
                      Attachments — file upload
                    </Label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAttachments(false)
                        setAttachments([])
                      }}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Close attachments"
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={pickAttachments}
                  />

                  {attachments.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background/40 px-3 py-6 text-center transition-colors hover:border-foreground/30 hover:bg-background"
                    >
                      <span className="grid size-9 place-items-center rounded-full bg-foreground text-background">
                        <Plus className="size-4" />
                      </span>
                      <span className="text-[13px] font-semibold">Choose files</span>
                      <span className="text-[11px] text-muted-foreground">
                        PDF · Word · ZIP · video · audio · images
                      </span>
                    </button>
                  ) : (
                    <ul className="space-y-2">
                      {attachments.map(({ file, caption }, index) => {
                        const inferred = inferMediaTypeFromMime(file.type)
                        const meta = getMediaTypeMeta(inferred)
                        const Icon = meta.icon
                        return (
                          <li
                            key={`${file.name}-${index}`}
                            className="space-y-1.5 rounded-lg border border-border bg-card p-2.5"
                          >
                            <div className="flex items-center gap-2.5">
                              <span
                                className={cn(
                                  'grid size-9 shrink-0 place-items-center rounded-lg',
                                  meta.bg,
                                  meta.tone,
                                )}
                              >
                                <Icon className="size-4" />
                              </span>
                              <div className="min-w-0 flex-1 leading-tight">
                                <p className="truncate text-[13px] font-medium">
                                  {file.name}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  {meta.label}
                                  {file.size ? ` · ${formatFileSize(file.size)}` : ''}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeAttachment(index)}
                                className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                aria-label={`Remove ${file.name}`}
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                            <Input
                              value={caption}
                              onChange={(event) =>
                                updateAttachmentCaption(index, event.target.value)
                              }
                              placeholder="Caption (optional)"
                              className="h-7 text-xs"
                            />
                          </li>
                        )
                      })}
                    </ul>
                  )}

                  {attachments.length > 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-full"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Plus className="size-3.5" />
                      Add more files
                    </Button>
                  ) : null}
                </div>
              </motion.div>
            ) : null}

            {showSources ? (
              <motion.div
                key="sources"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-3 rounded-xl border border-dashed border-border bg-muted/30 px-3 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      <Library className="size-3" />
                      Sources — paste citations
                    </Label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSources(false)
                        setSources([])
                      }}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Close sources"
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  {sources.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">
                      Cite the Quran, Hadith collections, books, articles — anything
                      that backs up your answer.
                    </p>
                  ) : null}

                  <div className="space-y-2">
                    {sources.map((src, index) => (
                      <div
                        key={index}
                        className="space-y-2 rounded-lg border border-border bg-card p-2.5"
                      >
                        <div className="flex flex-wrap items-center gap-1.5">
                          {SOURCE_TYPE_OPTIONS.map((option) => {
                            const active = src.sourceType === option.value
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() =>
                                  updateSource(index, 'sourceType', option.value)
                                }
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
                          <button
                            type="button"
                            onClick={() => removeSource(index)}
                            className="ml-auto inline-flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            aria-label="Remove source"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>

                        <Input
                          value={src.title}
                          onChange={(event) =>
                            updateSource(index, 'title', event.target.value)
                          }
                          placeholder='Title — e.g. "Sahih al-Bukhari, Hadith 1395"'
                          className="h-8"
                        />

                        {src.sourceType === 'URL' ? (
                          <Input
                            value={src.url}
                            onChange={(event) =>
                              updateSource(index, 'url', event.target.value)
                            }
                            placeholder="Paste link — https://…"
                            className="h-8"
                          />
                        ) : null}
                        {src.sourceType === 'DOI' ? (
                          <Input
                            value={src.doi}
                            onChange={(event) =>
                              updateSource(index, 'doi', event.target.value)
                            }
                            placeholder="10.1234/abcd"
                            className="h-8"
                          />
                        ) : null}
                        {src.sourceType === 'ISBN' ? (
                          <Input
                            value={src.isbn}
                            onChange={(event) =>
                              updateSource(index, 'isbn', event.target.value)
                            }
                            placeholder="978-3-16-148410-0"
                            className="h-8"
                          />
                        ) : null}

                        <Textarea
                          value={src.citationText}
                          onChange={(event) =>
                            updateSource(index, 'citationText', event.target.value)
                          }
                          placeholder="Optional: full quotation or formatted citation."
                          rows={2}
                          className="resize-none rounded-lg text-sm"
                        />
                      </div>
                    ))}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-full"
                    onClick={addSource}
                  >
                    <Plus className="size-3.5" />
                    Add source
                  </Button>
                </div>
              </motion.div>
            ) : null}

            {showLinks ? (
              <motion.div
                key="links"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-2 rounded-xl border border-dashed border-border bg-muted/30 px-3 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      <Link2 className="size-3" />
                      Links — paste URLs
                    </Label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowLinks(false)
                        setLinks('')
                      }}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Close links"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                  <Textarea
                    value={links}
                    onChange={(event) => setLinks(event.target.value)}
                    placeholder={'One URL per line, or comma-separated\nhttps://example.com\nhttps://another.org'}
                    rows={3}
                    className="resize-none rounded-lg"
                  />
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => setShowAttachments((v) => !v)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                  showAttachments && 'bg-muted text-foreground',
                )}
                title="Upload files"
              >
                <Paperclip className="size-4" />
                <span className="hidden sm:inline">
                  Attachments
                  {attachments.length > 0 ? ` (${attachments.length})` : ''}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setShowSources((v) => !v)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                  showSources && 'bg-muted text-foreground',
                )}
                title="Add citations"
              >
                <Library className="size-4" />
                <span className="hidden sm:inline">
                  Sources
                  {sources.length > 0 ? ` (${sources.length})` : ''}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setShowLinks((v) => !v)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                  showLinks && 'bg-muted text-foreground',
                )}
                title="Paste URLs"
              >
                <Link2 className="size-4" />
                <span className="hidden sm:inline">Links</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {uploadStatus ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                  <FileText className="size-3" />
                  {uploadStatus}
                </span>
              ) : null}
              <button
                type="submit"
                disabled={!trimmedBody || submitting || commentCooldown > 0}
                title={
                  commentCooldown > 0
                    ? `Rate limit — try again in ${commentCooldown}s`
                    : undefined
                }
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-foreground px-4 text-[12.5px] font-semibold text-background transition-colors hover:bg-foreground/85 disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CornerDownLeft className="size-3.5" />
                )}
                {commentCooldown > 0
                  ? `Wait ${commentCooldown}s`
                  : submitting
                    ? 'Posting…'
                    : 'Post answer'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  )
}
