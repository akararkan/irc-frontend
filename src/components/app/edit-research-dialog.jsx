import { useEffect, useRef, useState } from 'react'
import {
  Clock,
  ImageIcon,
  ImagePlus,
  LibraryBig,
  Loader2,
  Plus,
  Save,
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
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  addResearchMedia,
  removeResearchCover,
  removeResearchMedia,
  removeResearchVideoPromo,
  updateResearch,
  updateResearchMedia,
  uploadResearchCover,
  uploadResearchVideoPromo,
} from '@/features/research/research.api'
import { useToast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import { extractApiMessage } from '@/lib/api-error'
import { resolveMediaUrl } from '@/lib/format'
import { formatDuration, probeVideoDuration } from '@/lib/video'

const VISIBILITY_OPTIONS = [
  { value: 'PUBLIC', label: 'Public' },
  { value: 'FOLLOWERS_ONLY', label: 'Followers' },
  { value: 'PRIVATE', label: 'Private' },
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

function toLocalDatetime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * Edit an existing research record.
 *
 *  - Core fields (title, description, abstract, keywords, citation, DOI,
 *    visibility, scheduledPublishAt, commentsEnabled, downloadsEnabled, tags,
 *    sources) go through PATCH /api/v1/researches/{id}.
 *  - Cover image and video promo are replaced via their dedicated
 *    multipart endpoints; each has a Remove button too.
 *  - Existing media files can have their caption / altText / displayOrder
 *    patched individually, or be deleted. New media files are uploaded one at
 *    a time against /media.
 */
export function EditResearchDialog({ research, open, onOpenChange, onUpdated }) {
  const toast = useToast()

  const coverRef = useRef(null)
  const videoPromoRef = useRef(null)
  const newMediaRef = useRef(null)

  // Core fields
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
  const [sources, setSources] = useState([])

  // Media slots
  const [coverFile, setCoverFile] = useState(null)
  const [coverPreview, setCoverPreview] = useState(null)
  const [removeCover, setRemoveCover] = useState(false)

  const [videoFile, setVideoFile] = useState(null)
  const [videoPreview, setVideoPreview] = useState(null)
  const [videoDuration, setVideoDuration] = useState(null)
  const [removeVideo, setRemoveVideo] = useState(false)

  const [existingMedia, setExistingMedia] = useState([])
  const [deletedMediaIds, setDeletedMediaIds] = useState(new Set())
  const [editedMedia, setEditedMedia] = useState({}) // { [id]: { caption, altText, displayOrder } }
  const [newMedia, setNewMedia] = useState([]) // { file, caption, altText }

  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState(null)

  useEffect(() => {
    if (!open || !research) return
    setTitle(research.title ?? '')
    setDescription(research.description ?? '')
    setAbstractText(research.abstractText ?? '')
    setKeywords(research.keywords ?? '')
    setCitation(research.citation ?? '')
    setDoi(research.doi ?? '')
    setTagsInput((research.tags ?? []).join(', '))
    setVisibility(research.visibility ?? 'PUBLIC')
    setCommentsEnabled(research.commentsEnabled !== false)
    setDownloadsEnabled(research.downloadsEnabled !== false)
    setScheduledPublishAt(toLocalDatetime(research.scheduledPublishAt))
    setSources(
      (research.sources ?? []).map((src) => ({
        sourceType: src.sourceType ?? 'URL',
        title: src.title ?? '',
        citationText: src.citationText ?? '',
        url: src.url ?? '',
        doi: src.doi ?? '',
        isbn: src.isbn ?? '',
      })),
    )
    setExistingMedia([...(research.mediaFiles ?? [])].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)))
    setEditedMedia({})
    setDeletedMediaIds(new Set())
    setNewMedia([])
    setCoverFile(null)
    setRemoveCover(false)
    setVideoFile(null)
    setRemoveVideo(false)
    setStatus(null)
  }, [open, research])

  useEffect(() => {
    if (!coverFile) {
      setCoverPreview(null)
      return undefined
    }
    const url = URL.createObjectURL(coverFile)
    setCoverPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [coverFile])

  useEffect(() => {
    if (!videoFile) {
      setVideoPreview(null)
      setVideoDuration(null)
      return undefined
    }
    const url = URL.createObjectURL(videoFile)
    setVideoPreview(url)
    setVideoDuration(null)
    let cancelled = false
    probeVideoDuration(videoFile).then((duration) => {
      if (!cancelled) setVideoDuration(duration)
    })
    return () => {
      cancelled = true
      URL.revokeObjectURL(url)
    }
  }, [videoFile])

  if (!research) return null

  function handleCoverPick(event) {
    const picked = event.target.files?.[0]
    event.target.value = ''
    if (!picked) return
    if (!picked.type.startsWith('image/')) {
      toast.error('Cover must be an image.')
      return
    }
    setCoverFile(picked)
    setRemoveCover(false)
  }

  function handleVideoPick(event) {
    const picked = event.target.files?.[0]
    event.target.value = ''
    if (!picked) return
    if (!picked.type.startsWith('video/')) {
      toast.error('Video promo must be a video.')
      return
    }
    setVideoFile(picked)
    setRemoveVideo(false)
  }

  function handleNewMediaPick(event) {
    const picked = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!picked.length) return
    setNewMedia((current) => [
      ...current,
      ...picked.map((file) => ({ file, caption: '', altText: '' })),
    ])
  }

  function toggleDeleteExisting(id) {
    setDeletedMediaIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function updateExistingMeta(id, patch) {
    setEditedMedia((current) => ({
      ...current,
      [id]: { ...(current[id] ?? {}), ...patch },
    }))
  }

  function updateNewMediaField(index, field, value) {
    setNewMedia((current) =>
      current.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    )
  }

  function removeNewMedia(index) {
    setNewMedia((current) => current.filter((_, i) => i !== index))
  }

  function addSource() {
    setSources((current) => [...current, emptySource()])
  }

  function updateSource(index, field, value) {
    setSources((current) =>
      current.map((src, i) => (i === index ? { ...src, [field]: value } : src)),
    )
  }

  function removeSource(index) {
    setSources((current) => current.filter((_, i) => i !== index))
  }

  // Build a PATCH payload containing only fields that actually changed.
  function buildPatchPayload() {
    const payload = {}
    if (title.trim() !== (research.title ?? '')) payload.title = title.trim()
    if (description.trim() !== (research.description ?? '')) payload.description = description.trim()
    if (abstractText.trim() !== (research.abstractText ?? '')) payload.abstractText = abstractText.trim()
    if ((keywords ?? '') !== (research.keywords ?? '')) payload.keywords = keywords.trim() || null
    if ((citation ?? '') !== (research.citation ?? '')) payload.citation = citation.trim() || null
    if ((doi ?? '') !== (research.doi ?? '')) payload.doi = doi.trim() || null
    if (visibility !== (research.visibility ?? 'PUBLIC')) payload.visibility = visibility
    if (commentsEnabled !== (research.commentsEnabled !== false)) payload.commentsEnabled = commentsEnabled
    if (downloadsEnabled !== (research.downloadsEnabled !== false)) payload.downloadsEnabled = downloadsEnabled

    const existingSchedule = toLocalDatetime(research.scheduledPublishAt)
    if (scheduledPublishAt !== existingSchedule) {
      payload.scheduledPublishAt = scheduledPublishAt
        ? new Date(scheduledPublishAt).toISOString()
        : null
    }

    const newTags = parseTags(tagsInput)
    const currentTags = research.tags ?? []
    if (
      newTags.length !== currentTags.length ||
      newTags.some((t, i) => t !== currentTags[i])
    ) {
      payload.tags = newTags
    }

    // Sources — if any changed, edited, added, or removed, send the whole list
    const currentSourceSig = JSON.stringify(
      (research.sources ?? []).map((s) => ({
        sourceType: s.sourceType,
        title: s.title,
        citationText: s.citationText ?? '',
        url: s.url ?? '',
        doi: s.doi ?? '',
        isbn: s.isbn ?? '',
      })),
    )
    const nextSourceSig = JSON.stringify(
      sources.map((s) => ({
        sourceType: s.sourceType,
        title: s.title.trim(),
        citationText: (s.citationText ?? '').trim(),
        url: (s.url ?? '').trim(),
        doi: (s.doi ?? '').trim(),
        isbn: (s.isbn ?? '').trim(),
      })),
    )
    if (currentSourceSig !== nextSourceSig) {
      payload.sources = sources
        .filter((s) => s.title.trim())
        .map((s, index) => ({
          sourceType: s.sourceType,
          title: s.title.trim(),
          citationText: s.citationText.trim() || null,
          url: s.url.trim() || null,
          doi: s.doi.trim() || null,
          isbn: s.isbn.trim() || null,
          displayOrder: index,
        }))
    }

    return payload
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    try {
      let updated = research

      // 1) Core PATCH
      const payload = buildPatchPayload()
      if (Object.keys(payload).length > 0) {
        setStatus('Saving changes…')
        updated = await updateResearch(research.id, payload)
      }

      // 2) Cover image
      if (removeCover && research.coverImageUrl) {
        setStatus('Removing cover image…')
        try {
          updated = await removeResearchCover(research.id)
        } catch (error) {
          toast.error(extractApiMessage(error, 'Could not remove cover image.'))
        }
      }
      if (coverFile) {
        setStatus('Uploading cover image…')
        try {
          updated = await uploadResearchCover(research.id, coverFile)
        } catch (error) {
          toast.error(extractApiMessage(error, 'Cover image upload failed.'))
        }
      }

      // 3) Video promo
      if (removeVideo && research.videoPromoUrl) {
        setStatus('Removing video promo…')
        try {
          updated = await removeResearchVideoPromo(research.id)
        } catch (error) {
          toast.error(extractApiMessage(error, 'Could not remove video promo.'))
        }
      }
      if (videoFile) {
        setStatus('Uploading video promo…')
        try {
          updated = await uploadResearchVideoPromo(research.id, videoFile)
        } catch (error) {
          toast.error(extractApiMessage(error, 'Video promo upload failed.'))
        }
      }

      // 4) Existing media — delete marked + patch edited metadata
      for (const id of deletedMediaIds) {
        setStatus('Removing media…')
        try {
          await removeResearchMedia(research.id, id)
        } catch (error) {
          toast.error(extractApiMessage(error, 'Could not delete a media file.'))
        }
      }
      for (const [id, meta] of Object.entries(editedMedia)) {
        if (deletedMediaIds.has(id)) continue
        const original = existingMedia.find((m) => m.id === id)
        if (!original) continue
        const keys = Object.keys(meta)
        const changed = keys.some((key) => (meta[key] ?? '') !== (original[key] ?? ''))
        if (!changed) continue
        setStatus('Saving media metadata…')
        try {
          await updateResearchMedia(research.id, id, {
            caption: meta.caption ?? null,
            altText: meta.altText ?? null,
            displayOrder: meta.displayOrder,
          })
        } catch (error) {
          toast.error(extractApiMessage(error, 'Could not update media metadata.'))
        }
      }

      // 5) New media — upload each one
      if (newMedia.length > 0) {
        for (let i = 0; i < newMedia.length; i += 1) {
          const item = newMedia[i]
          setStatus(`Uploading media (${i + 1}/${newMedia.length})…`)
          try {
            await addResearchMedia(research.id, item.file, {
              caption: item.caption.trim() || undefined,
              altText: item.altText.trim() || undefined,
            })
          } catch (error) {
            toast.error(extractApiMessage(error, `Could not upload ${item.file.name}.`))
          }
        }
      }

      toast.success('Research updated.')
      onUpdated?.(updated)
      onOpenChange?.(false)
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not update research.'))
    } finally {
      setSubmitting(false)
      setStatus(null)
    }
  }

  const currentCover = coverPreview
    ? coverPreview
    : removeCover
      ? null
      : resolveMediaUrl(research.coverImageUrl)

  const currentVideo = videoPreview
    ? videoPreview
    : removeVideo
      ? null
      : resolveMediaUrl(research.videoPromoUrl)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit research</DialogTitle>
            <DialogDescription>
              Update any field — the frontend sends only the parts that actually changed.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={500}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="edit-description">Short description</Label>
              <Textarea
                id="edit-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="edit-abstract">Abstract</Label>
              <Textarea
                id="edit-abstract"
                value={abstractText}
                onChange={(event) => setAbstractText(event.target.value)}
                rows={5}
                maxLength={5000}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-keywords">Keywords</Label>
              <Input
                id="edit-keywords"
                value={keywords}
                onChange={(event) => setKeywords(event.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-doi">DOI</Label>
              <Input
                id="edit-doi"
                value={doi}
                onChange={(event) => setDoi(event.target.value)}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="edit-citation">Citation</Label>
              <Textarea
                id="edit-citation"
                value={citation}
                onChange={(event) => setCitation(event.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label className="flex items-center gap-1.5">
                <Tag className="size-3.5" />
                Tags
              </Label>
              <Input
                value={tagsInput}
                onChange={(event) => setTagsInput(event.target.value)}
                placeholder="Comma-separated"
              />
            </div>

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
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-schedule">Scheduled publish at</Label>
              <Input
                id="edit-schedule"
                type="datetime-local"
                value={scheduledPublishAt}
                onChange={(event) => setScheduledPublishAt(event.target.value)}
              />
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

            {/* ── Cover ─────────────────────────── */}
            <div className="space-y-2 sm:col-span-1">
              <Label className="flex items-center gap-1.5">
                <ImageIcon className="size-3.5" />
                Cover image
              </Label>
              <input
                ref={coverRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCoverPick}
              />
              {currentCover ? (
                <div className="relative overflow-hidden rounded-lg border border-border">
                  <img src={currentCover} alt="" className="aspect-[5/3] w-full object-cover" />
                  <div className="absolute right-2 top-2 flex gap-1">
                    <button
                      type="button"
                      onClick={() => coverRef.current?.click()}
                      className="rounded-full bg-background/90 px-2 py-1 text-[10px] font-medium shadow-sm transition-colors hover:bg-background"
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCoverFile(null)
                        setRemoveCover(true)
                      }}
                      className="grid size-7 place-items-center rounded-full bg-background/90 text-foreground shadow-sm transition-colors hover:bg-background"
                      title="Remove cover"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => coverRef.current?.click()}
                  className="flex aspect-[5/3] w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-muted/20 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-muted/40"
                >
                  <ImagePlus className="size-5" />
                  Add cover image
                </button>
              )}
            </div>

            {/* ── Video promo ───────────────────── */}
            <div className="space-y-2 sm:col-span-1">
              <Label className="flex items-center gap-1.5">
                <Video className="size-3.5" />
                Video promo
              </Label>
              <input
                ref={videoPromoRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleVideoPick}
              />
              {currentVideo ? (
                <div className="relative overflow-hidden rounded-lg border border-border bg-black">
                  <video
                    src={currentVideo}
                    controls
                    playsInline
                    className="aspect-[5/3] w-full bg-black object-contain"
                  />
                  {(() => {
                    const shownDuration = videoFile
                      ? videoDuration
                      : research.videoPromoDurationSeconds
                    if (shownDuration == null) return null
                    return (
                      <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
                        <Clock className="size-2.5" />
                        {formatDuration(shownDuration)}
                      </span>
                    )
                  })()}
                  <div className="absolute right-2 top-2 flex gap-1">
                    <button
                      type="button"
                      onClick={() => videoPromoRef.current?.click()}
                      className="rounded-full bg-background/90 px-2 py-1 text-[10px] font-medium shadow-sm transition-colors hover:bg-background"
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setVideoFile(null)
                        setRemoveVideo(true)
                      }}
                      className="grid size-7 place-items-center rounded-full bg-background/90 text-foreground shadow-sm transition-colors hover:bg-background"
                      title="Remove video promo"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => videoPromoRef.current?.click()}
                  className="flex aspect-[5/3] w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-muted/20 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-muted/40"
                >
                  <Video className="size-5" />
                  Add video promo
                </button>
              )}
              {videoFile ? (
                <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span className="truncate">{videoFile.name}</span>
                  {videoDuration != null ? (
                    <span className="shrink-0 font-medium text-foreground">
                      {formatDuration(videoDuration)}
                    </span>
                  ) : (
                    <span className="shrink-0">Reading duration…</span>
                  )}
                </div>
              ) : null}
            </div>

            {/* ── Existing media ─────────────────────────── */}
            {existingMedia.length > 0 ? (
              <div className="space-y-2 sm:col-span-2">
                <Label className="flex items-center gap-1.5">
                  <ImagePlus className="size-3.5" />
                  Existing media files
                </Label>
                <div className="space-y-2">
                  {existingMedia.map((media) => {
                    const marked = deletedMediaIds.has(media.id)
                    const edits = editedMedia[media.id] ?? {}
                    return (
                      <div
                        key={media.id}
                        className={cn(
                          'space-y-2 rounded-lg border p-3 text-sm transition-opacity',
                          marked ? 'opacity-50' : '',
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium">
                            {media.caption ?? media.originalFileName ?? media.mediaType}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleDeleteExisting(media.id)}
                            className={cn(
                              'text-xs',
                              marked
                                ? 'text-foreground hover:underline'
                                : 'text-destructive hover:underline',
                            )}
                          >
                            {marked ? 'Undo delete' : 'Delete'}
                          </button>
                        </div>
                        {!marked ? (
                          <>
                            <Input
                              value={edits.caption ?? media.caption ?? ''}
                              onChange={(event) =>
                                updateExistingMeta(media.id, { caption: event.target.value })
                              }
                              placeholder="Caption"
                              maxLength={500}
                            />
                            <Input
                              value={edits.altText ?? media.altText ?? ''}
                              onChange={(event) =>
                                updateExistingMeta(media.id, { altText: event.target.value })
                              }
                              placeholder="Alt text"
                              maxLength={300}
                            />
                          </>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : null}

            {/* ── New media ─────────────────────────── */}
            <div className="space-y-2 sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5">
                  <Plus className="size-3.5" />
                  Add more media
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => newMediaRef.current?.click()}
                >
                  <Plus className="size-4" />
                  Pick files
                </Button>
              </div>
              <input
                ref={newMediaRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleNewMediaPick}
              />
              {newMedia.length > 0 ? (
                <div className="space-y-2">
                  {newMedia.map((item, index) => (
                    <div
                      key={`${item.file.name}-${index}`}
                      className="space-y-2 rounded-lg border border-border bg-muted/20 p-3"
                    >
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate font-medium">{item.file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeNewMedia(index)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                      <Input
                        value={item.caption}
                        onChange={(event) => updateNewMediaField(index, 'caption', event.target.value)}
                        placeholder="Caption (optional, max 500)"
                        maxLength={500}
                      />
                      <Input
                        value={item.altText}
                        onChange={(event) => updateNewMediaField(index, 'altText', event.target.value)}
                        placeholder="Alt text (optional, max 300)"
                        maxLength={300}
                      />
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {/* ── Sources ─────────────────────────── */}
            <div className="space-y-2 sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5">
                  <LibraryBig className="size-3.5" />
                  Sources
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
                  No sources yet. Sources help readers verify your work.
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
                        placeholder="Source title"
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
            {status ? (
              <span className="mr-auto text-xs text-muted-foreground">{status}</span>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange?.(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {submitting ? (status ?? 'Saving…') : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
