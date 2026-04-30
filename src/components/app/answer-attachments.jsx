import { useRef, useState } from 'react'
import {
  Download,
  ExternalLink,
  Loader2,
  Paperclip,
  Plus,
  Trash2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AudioPlayer } from '@/components/app/audio-player'
import {
  deleteAnswerAttachment,
  uploadAnswerAttachment,
} from '@/features/qna/qna.api'
import { useToast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import { extractApiMessage } from '@/lib/api-error'
import { resolveMediaUrl } from '@/lib/format'
import { formatFileSize, getMediaTypeMeta } from '@/lib/qna-media'

/**
 * Force-download a remote file. Uses fetch + blob so the browser actually
 * downloads instead of navigating (the `download` HTML attribute is ignored
 * for cross-origin URLs, which is most S3/R2 URLs).
 *
 * Falls back to opening in a new tab if the fetch fails (CORS, etc).
 */
async function downloadFile(url, filename) {
  if (!url) return false
  try {
    const response = await fetch(url, { mode: 'cors', credentials: 'omit' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename || 'attachment'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(blobUrl), 4000)
    return true
  } catch {
    // CORS / network failure — open in new tab so user can save manually
    window.open(url, '_blank', 'noopener,noreferrer')
    return false
  }
}

function AttachmentTile({ attachment, canManage, onDelete }) {
  const meta = getMediaTypeMeta(attachment.mediaType)
  const Icon = meta.icon
  const fileUrl = resolveMediaUrl(attachment.fileUrl)
  const thumbnailUrl = resolveMediaUrl(attachment.thumbnailUrl)
  const sizeText = formatFileSize(attachment.fileSize)
  const filename = attachment.originalFileName || 'attachment'

  const [downloading, setDownloading] = useState(false)

  async function handleDownload(event) {
    event?.preventDefault()
    event?.stopPropagation()
    if (!fileUrl || downloading) return
    setDownloading(true)
    try {
      await downloadFile(fileUrl, filename)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <article className="group/attachment relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-foreground/20">
      {/* ── Preview area ─────────────────────────────────────── */}
      {attachment.mediaType === 'IMAGE' && fileUrl ? (
        <a
          href={fileUrl}
          target="_blank"
          rel="noreferrer"
          className="block aspect-[4/3] overflow-hidden bg-muted"
          title="Open image"
        >
          <img
            src={fileUrl}
            alt={attachment.caption || filename}
            loading="lazy"
            className="size-full object-cover transition-transform duration-700 group-hover/attachment:scale-[1.02]"
          />
        </a>
      ) : attachment.mediaType === 'VIDEO' && fileUrl ? (
        <video
          src={fileUrl}
          poster={thumbnailUrl}
          controls
          playsInline
          preload="metadata"
          className="aspect-[4/3] w-full bg-black object-contain"
        />
      ) : attachment.mediaType === 'AUDIO' && fileUrl ? (
        <div className="px-3 pt-3">
          <AudioPlayer
            src={fileUrl}
            title={filename}
            subtitle={attachment.caption || meta.label}
            variant="compact"
            trackKind="voice"
          />
        </div>
      ) : (
        // Documents / archives / unknown — clickable preview tile
        <a
          href={fileUrl ?? '#'}
          target="_blank"
          rel="noreferrer"
          className="flex aspect-[4/3] flex-col items-center justify-center gap-2 bg-muted/40 transition-colors hover:bg-muted"
          title="Open file"
        >
          <span
            className={cn(
              'grid size-16 place-items-center rounded-2xl',
              meta.bg,
              meta.tone,
            )}
          >
            <Icon className="size-7" />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Click to open
          </span>
        </a>
      )}

      {/* ── Info + actions ───────────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-2 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
              meta.bg,
              meta.tone,
            )}
          >
            <Icon className="size-2.5" />
            {meta.label}
          </span>
          {sizeText ? (
            <span className="text-[11px] text-muted-foreground">{sizeText}</span>
          ) : null}
          {canManage ? (
            <button
              type="button"
              onClick={() => onDelete?.(attachment.id)}
              className="ml-auto inline-flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              title="Delete attachment"
              aria-label="Delete attachment"
            >
              <Trash2 className="size-3.5" />
            </button>
          ) : null}
        </div>

        {attachment.originalFileName ? (
          <p className="truncate text-[13px] font-medium" title={filename}>
            {filename}
          </p>
        ) : null}

        {attachment.caption ? (
          <p className="line-clamp-2 text-[12px] text-muted-foreground">
            {attachment.caption}
          </p>
        ) : null}

        {/* Action row — Open + Download */}
        <div className="mt-1 flex items-center gap-1.5">
          {fileUrl ? (
            <a
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[11.5px] font-semibold text-foreground transition-colors hover:bg-muted"
            >
              <ExternalLink className="size-3" />
              Open
            </a>
          ) : null}
          {fileUrl ? (
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-2.5 py-1 text-[11.5px] font-semibold text-background transition-colors hover:bg-foreground/85 disabled:opacity-60"
            >
              {downloading ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Download className="size-3" />
              )}
              {downloading ? 'Downloading…' : 'Download'}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  )
}

export function AnswerAttachments({
  questionId,
  answerId,
  attachments = [],
  canManage = false,
  onChange,
}) {
  const toast = useToast()
  const fileInputRef = useRef(null)
  const [uploadingName, setUploadingName] = useState(null)

  const hasAttachments = attachments.length > 0

  async function handleFiles(event) {
    const picked = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!picked.length) return

    const baseOrder = attachments.length
    let next = attachments
    for (let i = 0; i < picked.length; i += 1) {
      const file = picked[i]
      setUploadingName(file.name)
      try {
        const uploaded = await uploadAnswerAttachment(
          questionId,
          answerId,
          file,
          { displayOrder: baseOrder + i },
        )
        next = [...next, uploaded]
        onChange?.(next)
      } catch (error) {
        toast.error(extractApiMessage(error, `Failed to upload ${file.name}.`))
      }
    }
    setUploadingName(null)
  }

  async function handleDelete(attachmentId) {
    if (!confirm('Remove this attachment?')) return
    try {
      await deleteAnswerAttachment(questionId, answerId, attachmentId)
      onChange?.(attachments.filter((item) => item.id !== attachmentId))
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not delete attachment.'))
    }
  }

  if (!hasAttachments && !canManage) return null

  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-2">
        <Paperclip className="size-3 text-muted-foreground" />
        <h4 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Attachments
        </h4>
        {hasAttachments ? (
          <span className="text-[11px] text-muted-foreground">
            · {attachments.length}
          </span>
        ) : null}
        <span className="ml-auto h-px flex-1 bg-border" aria-hidden />
        {canManage ? (
          <>
            <Input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFiles}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1 rounded-full text-xs"
              onClick={() => fileInputRef.current?.click()}
              disabled={Boolean(uploadingName)}
            >
              {uploadingName ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Plus className="size-3.5" />
              )}
              {uploadingName ? 'Uploading…' : 'Add'}
            </Button>
          </>
        ) : null}
      </div>

      {hasAttachments ? (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {attachments.map((attachment) => (
            <AttachmentTile
              key={attachment.id}
              attachment={attachment}
              canManage={canManage}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <p className="text-[12px] text-muted-foreground">No attachments yet.</p>
      )}

      {uploadingName ? (
        <p className="text-[11px] text-muted-foreground">
          Uploading <span className="font-medium">{uploadingName}</span>…
        </p>
      ) : null}
    </section>
  )
}
