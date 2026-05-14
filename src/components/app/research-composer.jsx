import { useEffect, useRef, useState } from 'react'
import {
  BookOpen,
  Clock,
  FlaskConical,
  ImageIcon,
  ImagePlus,
  LibraryBig,
  Plus,
  Send,
  Tag,
  Trash2,
  Video,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { MentionTextarea } from '@/components/app/mention-textarea'
import {
  createResearch,
  uploadResearchCover,
  uploadResearchVideoPromo,
} from '@/features/research/research.api'
import { useAuth } from '@/features/auth/auth-context'
import { useToast } from '@/components/ui/toaster'
import { RoleBadge } from '@/components/app/role-badge'
import { canPublishResearch } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { extractApiMessage } from '@/lib/api-error'
import { formatDuration } from '@/lib/video'

const VISIBILITY_OPTIONS = [
  { value: 'PUBLIC', label: 'Public', description: 'Visible in the global feed.' },
  { value: 'FOLLOWERS_ONLY', label: 'Followers', description: 'Only your followers can read.' },
  { value: 'PRIVATE', label: 'Private', description: 'Only you.' },
]

const SOURCE_TYPES = [
  { value: 'URL', label: 'Web link' },
  { value: 'DOI', label: 'DOI' },
  { value: 'ISBN', label: 'ISBN / Book' },
  { value: 'MEDIA_FILE', label: 'Media file' },
  { value: 'MANUAL', label: 'Manual citation' },
]

const emptySource = () => ({
  sourceType: 'URL',
  title: '',
  citationText: '',
  url: '',
  doi: '',
  isbn: '',
})

function parseTags(value) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

export function ResearchComposerButton({ onCreated, variant = 'default', className }) {
  const { user } = useAuth()
  const toast = useToast()
  const fileRef = useRef(null)
  const [open, setOpen] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [abstractText, setAbstractText] = useState('')
  const [keywords, setKeywords] = useState('')
  const [citation, setCitation] = useState('')
  const [doi, setDoi] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [visibility, setVisibility] = useState('PUBLIC')
  const [commentsEnabled, setCommentsEnabled] = useState(true)
  const [downloadsEnabled, setDownloadsEnabled] = useState(true)
  const [scheduledPublishAt, setScheduledPublishAt] = useState('')

  const [files, setFiles] = useState([])
  const [captions, setCaptions] = useState([])
  const [altTexts, setAltTexts] = useState([])

  const [sources, setSources] = useState([])

  const [coverImage, setCoverImage] = useState(null)
  const [coverPreview, setCoverPreview] = useState(null)
  const [videoPromo, setVideoPromo] = useState(null)
  const [videoPromoPreview, setVideoPromoPreview] = useState(null)
  const [videoPromoDuration, setVideoPromoDuration] = useState(null)

  const coverRef = useRef(null)
  const videoPromoRef = useRef(null)

  const [submitting, setSubmitting] = useState(false)
  const [uploadStatus, setUploadStatus] = useState(null)

  useEffect(() => {
    if (!coverImage) {
      setCoverPreview(null)
      return undefined
    }
    const url = URL.createObjectURL(coverImage)
    setCoverPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [coverImage])

  useEffect(() => {
    if (!videoPromo) {
      setVideoPromoPreview(null)
      setVideoPromoDuration(null)
      return undefined
    }
    const url = URL.createObjectURL(videoPromo)
    setVideoPromoPreview(url)
    setVideoPromoDuration(null) // duration returned by server after upload
    return () => URL.revokeObjectURL(url)
  }, [videoPromo])

  if (!canPublishResearch(user)) return null

  function resetForm() {
    setTitle('')
    setDescription('')
    setAbstractText('')
    setKeywords('')
    setCitation('')
    setDoi('')
    setTagsInput('')
    setVisibility('PUBLIC')
    setCommentsEnabled(true)
    setDownloadsEnabled(true)
    setScheduledPublishAt('')
    setFiles([])
    setCaptions([])
    setAltTexts([])
    setSources([])
    setCoverImage(null)
    setVideoPromo(null)
    setVideoPromoDuration(null)
    setUploadStatus(null)
  }

  function handleCoverPick(event) {
    const picked = event.target.files?.[0]
    event.target.value = ''
    if (!picked) return
    if (!picked.type.startsWith('image/')) {
      toast.error('Cover must be an image file.')
      return
    }
    setCoverImage(picked)
  }

  function handleVideoPromoPick(event) {
    const picked = event.target.files?.[0]
    event.target.value = ''
    if (!picked) return
    if (!picked.type.startsWith('video/')) {
      toast.error('Video promo must be a video file.')
      return
    }
    setVideoPromo(picked)
  }

  function removeFile(index) {
    setFiles((current) => current.filter((_, i) => i !== index))
    setCaptions((current) => current.filter((_, i) => i !== index))
    setAltTexts((current) => current.filter((_, i) => i !== index))
  }

  function handleFileChange(event) {
    const picked = Array.from(event.target.files ?? [])
    if (picked.length) {
      setFiles((current) => [...current, ...picked])
      setCaptions((current) => [...current, ...picked.map(() => '')])
      setAltTexts((current) => [...current, ...picked.map(() => '')])
    }
    event.target.value = ''
  }

  function updateCaption(index, value) {
    setCaptions((current) => current.map((v, i) => (i === index ? value : v)))
  }

  function updateAltText(index, value) {
    setAltTexts((current) => current.map((v, i) => (i === index ? value : v)))
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

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting) return
    if (!title.trim() || !description.trim() || !abstractText.trim()) return
    const tags = parseTags(tagsInput)
    if (tags.length === 0) {
      toast.info('Please add at least one tag.')
      return
    }

    setSubmitting(true)
    try {
      const cleanSources = sources
        .filter((src) => src.title.trim())
        .map((src, index) => ({
          sourceType: src.sourceType,
          title: src.title.trim(),
          citationText: src.citationText.trim() || null,
          url: src.url.trim() || null,
          doi: src.doi.trim() || null,
          isbn: src.isbn.trim() || null,
          displayOrder: index,
        }))

      const mediaFiles = files.map((_, index) => ({
        caption: captions[index]?.trim() || null,
        altText: altTexts[index]?.trim() || null,
        displayOrder: index,
      }))

      const data = {
        title: title.trim(),
        description: description.trim(),
        abstractText: abstractText.trim(),
        keywords: keywords.trim() || null,
        citation: citation.trim() || null,
        doi: doi.trim() || null,
        visibility,
        scheduledPublishAt: scheduledPublishAt ? new Date(scheduledPublishAt).toISOString() : null,
        commentsEnabled,
        downloadsEnabled,
        tags,
        sources: cleanSources,
        mediaFiles,
      }
      setUploadStatus('Creating research…')
      let finalResearch = await createResearch({ data, files })

      // Sequentially upload the cover image and video promo so the server
      // always has a valid UUID before each call. Both are optional, so we
      // let one fail without blocking the other.
      if (coverImage && finalResearch?.id) {
        setUploadStatus('Uploading cover image…')
        try {
          finalResearch = await uploadResearchCover(finalResearch.id, coverImage)
        } catch (error) {
          toast.error(extractApiMessage(error, 'Cover image upload failed.'))
        }
      }

      if (videoPromo && finalResearch?.id) {
        setUploadStatus('Uploading video promo…')
        try {
          finalResearch = await uploadResearchVideoPromo(finalResearch.id, videoPromo)
        } catch (error) {
          toast.error(extractApiMessage(error, 'Video promo upload failed.'))
        }
      }

      toast.success('Research draft created.')
      onCreated?.(finalResearch)
      resetForm()
      setOpen(false)
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not create research.'))
    } finally {
      setSubmitting(false)
      setUploadStatus(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size="sm" className={cn('rounded-full', className)}>
          <FlaskConical className="size-4" />
          Publish research
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              <span>Publish research</span>
              {user?.role ? (
                <RoleBadge role={user.role} size="sm" />
              ) : null}
            </DialogTitle>
            <DialogDescription>
              Create a draft you can publish from your research workspace later. Fields marked with
              an asterisk are required.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-4 sm:grid-cols-2">
            {/* ── Core ─────────────────────────────────────── */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="research-title">Title *</Label>
              <Input
                id="research-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="A concise, descriptive title"
                maxLength={500}
                required
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="research-description">Short description *</Label>
              <MentionTextarea
                id="research-description"
                value={description}
                onChange={setDescription}
                rows={2}
                placeholder="One paragraph overview shown in feed cards."
                allowFollowersToken
                required
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="research-abstract">Abstract *</Label>
              <MentionTextarea
                id="research-abstract"
                value={abstractText}
                onChange={setAbstractText}
                rows={5}
                maxLength={5000}
                placeholder="Full abstract of your work (max 5000 chars)."
                allowFollowersToken
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="research-keywords">Keywords</Label>
              <Input
                id="research-keywords"
                value={keywords}
                onChange={(event) => setKeywords(event.target.value)}
                placeholder="machine learning, medicine, NLP"
              />
              <p className="text-xs text-muted-foreground">Comma-separated keywords for search.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="research-doi">DOI</Label>
              <Input
                id="research-doi"
                value={doi}
                onChange={(event) => setDoi(event.target.value)}
                placeholder="10.1234/abcd"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="research-citation">Citation</Label>
              <Textarea
                id="research-citation"
                value={citation}
                onChange={(event) => setCitation(event.target.value)}
                rows={2}
                placeholder="How others should cite this work (APA/MLA/custom)."
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label className="flex items-center gap-1.5">
                <Tag className="size-3.5" />
                Tags *
              </Label>
              <Input
                value={tagsInput}
                onChange={(event) => setTagsInput(event.target.value)}
                placeholder="quran, hadith, philosophy"
                required
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated, 1–30 tags, each ≤ 100 characters.
              </p>
            </div>

            {/* ── Publication settings ─────────────────────── */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Visibility</Label>
              <div className="flex flex-wrap gap-2">
                {VISIBILITY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setVisibility(option.value)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      visibility === option.value
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-muted-foreground hover:text-foreground',
                    )}
                    title={option.description}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="research-schedule">Scheduled publish at</Label>
              <Input
                id="research-schedule"
                type="datetime-local"
                value={scheduledPublishAt}
                onChange={(event) => setScheduledPublishAt(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">Leave empty for manual publishing.</p>
            </div>

            <div className="space-y-2">
              <Label>Toggles</Label>
              <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={commentsEnabled}
                    onChange={(event) => setCommentsEnabled(event.target.checked)}
                    className="size-4 rounded border-border"
                  />
                  Allow comments
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={downloadsEnabled}
                    onChange={(event) => setDownloadsEnabled(event.target.checked)}
                    className="size-4 rounded border-border"
                  />
                  Allow downloads
                </label>
              </div>
            </div>

            {/* ── Cover image ───────────────────────────────── */}
            <div className="space-y-2 sm:col-span-1">
              <Label className="flex items-center gap-1.5">
                <ImageIcon className="size-3.5" />
                Cover image
              </Label>
              <p className="text-[11px] text-muted-foreground">
                The thumbnail that appears on feed cards and the detail header.
              </p>
              <input
                ref={coverRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCoverPick}
              />
              {coverPreview ? (
                <div className="relative overflow-hidden rounded-lg border border-border">
                  <img
                    src={coverPreview}
                    alt=""
                    className="aspect-[5/3] w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setCoverImage(null)}
                    className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-background/90 text-foreground shadow-sm transition-colors hover:bg-background"
                    title="Remove cover image"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => coverRef.current?.click()}
                  className="flex aspect-[5/3] w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-muted/20 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-muted/40"
                >
                  <ImagePlus className="size-5" />
                  Upload cover image
                </button>
              )}
            </div>

            {/* ── Video promo ───────────────────────────────── */}
            <div className="space-y-2 sm:col-span-1">
              <Label className="flex items-center gap-1.5">
                <Video className="size-3.5" />
                Video promo
              </Label>
              <p className="text-[11px] text-muted-foreground">
                A short video that introduces your research. Thumbnail is generated automatically.
              </p>
              <input
                ref={videoPromoRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleVideoPromoPick}
              />
              {videoPromoPreview ? (
                <div className="relative overflow-hidden rounded-lg border border-border bg-black">
                  <video
                    src={videoPromoPreview}
                    controls
                    playsInline
                    className="aspect-[5/3] w-full bg-black object-contain"
                  />
                  {videoPromoDuration != null ? (
                    <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
                      <Clock className="size-2.5" />
                      {formatDuration(videoPromoDuration)}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setVideoPromo(null)}
                    className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-background/90 text-foreground shadow-sm transition-colors hover:bg-background"
                    title="Remove video promo"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => videoPromoRef.current?.click()}
                  className="flex aspect-[5/3] w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-muted/20 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-muted/40"
                >
                  <Video className="size-5" />
                  Upload video promo
                </button>
              )}
              {videoPromo ? (
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="truncate">{videoPromo.name}</span>
                  <span className="shrink-0 text-ink-3">· duration extracted server-side</span>
                </div>
              ) : null}
            </div>

            {/* ── Media files ──────────────────────────────── */}
            <div className="space-y-2 sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5">
                  <ImagePlus className="size-3.5" />
                  Media files
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => fileRef.current?.click()}
                >
                  <Plus className="size-4" />
                  Add file
                </Button>
              </div>
              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
              {files.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-center text-xs text-muted-foreground">
                  Figures, datasets, or the full paper — add images, videos, PDFs, or audio. Captions
                  and alt text help accessibility.
                </p>
              ) : (
                <div className="space-y-2">
                  {files.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="space-y-2 rounded-lg border border-border bg-muted/20 p-3"
                    >
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate font-medium">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                      <Input
                        value={captions[index] ?? ''}
                        onChange={(event) => updateCaption(index, event.target.value)}
                        placeholder="Caption (optional, max 500)"
                        maxLength={500}
                      />
                      <Input
                        value={altTexts[index] ?? ''}
                        onChange={(event) => updateAltText(index, event.target.value)}
                        placeholder="Alt text for accessibility (max 300)"
                        maxLength={300}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Sources ─────────────────────────────────── */}
            <div className="space-y-2 sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5">
                  <LibraryBig className="size-3.5" />
                  Sources & citations
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={addSource}
                >
                  <Plus className="size-4" />
                  Add source
                </Button>
              </div>
              {sources.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-center text-xs text-muted-foreground">
                  Add references so readers can verify your work — papers, books, web links, DOIs.
                </p>
              ) : (
                <div className="space-y-2">
                  {sources.map((source, index) => (
                    <div
                      key={index}
                      className="space-y-2 rounded-lg border border-border bg-muted/20 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <select
                          value={source.sourceType}
                          onChange={(event) => updateSource(index, 'sourceType', event.target.value)}
                          className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                        >
                          {SOURCE_TYPES.map((type) => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => removeSource(index)}
                          className="text-muted-foreground hover:text-destructive"
                          title="Remove source"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                      <Input
                        value={source.title}
                        onChange={(event) => updateSource(index, 'title', event.target.value)}
                        placeholder="Source title *"
                        maxLength={500}
                      />
                      {source.sourceType === 'URL' ? (
                        <Input
                          value={source.url}
                          onChange={(event) => updateSource(index, 'url', event.target.value)}
                          placeholder="https://…"
                        />
                      ) : null}
                      {source.sourceType === 'DOI' ? (
                        <Input
                          value={source.doi}
                          onChange={(event) => updateSource(index, 'doi', event.target.value)}
                          placeholder="10.1234/abcd"
                        />
                      ) : null}
                      {source.sourceType === 'ISBN' ? (
                        <Input
                          value={source.isbn}
                          onChange={(event) => updateSource(index, 'isbn', event.target.value)}
                          placeholder="ISBN"
                          maxLength={20}
                        />
                      ) : null}
                      <Textarea
                        value={source.citationText}
                        onChange={(event) => updateSource(index, 'citationText', event.target.value)}
                        rows={2}
                        placeholder="Full citation text"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            {uploadStatus ? (
              <span className="mr-auto text-xs text-muted-foreground">{uploadStatus}</span>
            ) : null}
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <BookOpen className="size-4 animate-pulse" />
              ) : (
                <Send className="size-4" />
              )}
              {submitting ? (uploadStatus ?? 'Creating…') : 'Create draft'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
