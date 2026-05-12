import {
  Archive,
  BookOpen,
  Code2,
  Database,
  FileText,
  Film,
  Globe,
  Hash,
  ImageIcon,
  Library,
  Music,
  Quote,
  Sheet,
} from 'lucide-react'

// ── Backend MediaType (research/enums/MediaType.java) ─────────────
export const MEDIA_TYPE_META = {
  IMAGE:       { label: 'Image',       icon: ImageIcon, tone: 'text-violet-600 dark:text-violet-300', bg: 'bg-violet-500/10' },
  VIDEO:       { label: 'Video',       icon: Film,      tone: 'text-rose-600 dark:text-rose-300',     bg: 'bg-rose-500/10' },
  AUDIO:       { label: 'Audio',       icon: Music,     tone: 'text-amber-600 dark:text-amber-300',   bg: 'bg-amber-500/10' },
  DOCUMENT:    { label: 'Document',    icon: FileText,  tone: 'text-sky-600 dark:text-sky-300',       bg: 'bg-sky-500/10' },
  SPREADSHEET: { label: 'Spreadsheet', icon: Sheet,     tone: 'text-emerald-600 dark:text-emerald-300', bg: 'bg-emerald-500/10' },
  DATASET:     { label: 'Dataset',     icon: Database,  tone: 'text-cyan-600 dark:text-cyan-300',     bg: 'bg-cyan-500/10' },
  CODE:        { label: 'Code',        icon: Code2,     tone: 'text-indigo-600 dark:text-indigo-300', bg: 'bg-indigo-500/10' },
  ARCHIVE:     { label: 'Archive',     icon: Archive,   tone: 'text-orange-600 dark:text-orange-300', bg: 'bg-orange-500/10' },
  OTHER:       { label: 'File',        icon: FileText,  tone: 'text-zinc-600 dark:text-zinc-300',     bg: 'bg-zinc-500/10' },
}

export function getMediaTypeMeta(mediaType) {
  return MEDIA_TYPE_META[mediaType] ?? MEDIA_TYPE_META.OTHER
}

/**
 * Resolve a backend MediaType from a browser File. Mirrors the server's
 * `resolveMediaType(mimeType)` so the UI can show a consistent icon/colour
 * even before the upload completes and the canonical value comes back.
 */
export function inferMediaTypeFromMime(mimeType) {
  if (!mimeType) return 'OTHER'
  const lower = mimeType.toLowerCase()
  if (lower.startsWith('image/')) return 'IMAGE'
  if (lower.startsWith('video/')) return 'VIDEO'
  if (lower.startsWith('audio/')) return 'AUDIO'
  if (lower === 'application/pdf') return 'DOCUMENT'
  if (lower.includes('wordprocessingml') || lower.includes('msword')) return 'DOCUMENT'
  if (lower.includes('presentationml') || lower.includes('powerpoint')) return 'DOCUMENT'
  if (lower.includes('spreadsheetml') || lower.includes('excel') || lower === 'text/csv') {
    return 'SPREADSHEET'
  }
  if (
    lower === 'application/zip' ||
    lower.includes('tar') ||
    lower.includes('rar') ||
    lower.includes('7z') ||
    lower.includes('gzip')
  ) {
    return 'ARCHIVE'
  }
  return 'OTHER'
}

export function formatFileSize(bytes) {
  if (bytes == null) return ''
  const num = Number(bytes)
  if (!Number.isFinite(num) || num <= 0) return ''
  if (num < 1024) return `${num} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = num / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`
}

// ── Backend SourceType (research/enums/SourceType.java) ──────────
// Per the IRC Scholar design spec, every source row carries a typed
// monospace pill with a category color so the corpus of evidence reads
// at a glance. Mapping (backend enum → spec accent):
//   URL        → purple (violet)  — the web bucket
//   DOI        → warning amber    — peer-reviewed identifiers
//   ISBN       → danger rust      — book identifiers (was BOOK in spec)
//   MEDIA_FILE → muted            — attached files
//   MANUAL     → success sage     — free-form citations
export const SOURCE_TYPE_META = {
  URL: {
    label: 'Web link',
    icon: Globe,
    tone: 'text-accent-violet',
    bg: 'bg-[color-mix(in_oklch,var(--accent-violet)_14%,transparent)]',
  },
  DOI: {
    label: 'DOI',
    icon: Hash,
    tone: 'text-accent-amber',
    bg: 'bg-[color-mix(in_oklch,var(--accent-amber)_16%,transparent)]',
  },
  ISBN: {
    label: 'Book',
    icon: BookOpen,
    tone: 'text-accent-rust',
    bg: 'bg-[color-mix(in_oklch,var(--accent-rust)_14%,transparent)]',
  },
  MEDIA_FILE: {
    label: 'File',
    icon: Library,
    tone: 'text-ink-2',
    bg: 'bg-muted',
  },
  MANUAL: {
    label: 'Citation',
    icon: Quote,
    tone: 'text-accent-sage',
    bg: 'bg-[color-mix(in_oklch,var(--accent-sage)_14%,transparent)]',
  },
}

export const SOURCE_TYPE_OPTIONS = [
  { value: 'URL',        label: 'Web link' },
  { value: 'DOI',        label: 'DOI' },
  { value: 'ISBN',       label: 'Book / ISBN' },
  { value: 'MANUAL',     label: 'Manual citation' },
]

export function getSourceTypeMeta(sourceType) {
  return SOURCE_TYPE_META[sourceType] ?? SOURCE_TYPE_META.MANUAL
}

export function getSourceLink(source) {
  if (!source) return null
  if (source.url) return source.url
  if (source.doi) return `https://doi.org/${encodeURIComponent(source.doi)}`
  if (source.fileUrl) return source.fileUrl
  return null
}
