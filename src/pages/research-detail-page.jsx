import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive,
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Calendar,
  Check,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Globe,
  Hash,
  Heart,
  Image as ImageIcon,
  Link2,
  Loader2,
  Lock,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Play,
  Quote,
  Send,
  Share2,
  ShieldAlert,
  Trash2,
  UploadCloud,
  Users,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion, useScroll, useSpring } from 'motion/react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AudioPlayer } from '@/components/app/audio-player'
import { EditResearchDialog } from '@/components/app/edit-research-dialog'
import { EmptyState } from '@/components/app/empty-state'
import { MentionText } from '@/components/app/mention-text'
import { ResearchComments } from '@/components/app/research-comments'
import { RoleBadge } from '@/components/app/role-badge'
import { UserAvatar } from '@/components/app/user-avatar'
import {
  archiveResearch,
  deleteResearch,
  getResearch,
  getResearchBySlug,
  publishResearch,
  reactToResearch,
  recordResearchCitation,
  recordResearchView,
  removeResearchReaction,
  requestResearchDownload,
  retractResearch,
  saveResearch,
  shareResearch,
  unpublishResearch,
  unsaveResearch,
} from '@/features/research/research.api'
import { useResearchStream } from '@/hooks/use-research-stream'
import { useAuth } from '@/features/auth/auth-context'
import { useToast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import { extractApiMessage } from '@/lib/api-error'
import {
  formatNumber,
  getFullName,
  getHandle,
  getRawUsername,
  resolveMediaUrl,
  startsWithRtl,
} from '@/lib/format'
import { RelativeTime } from '@/components/app/relative-time'
import { bumpCounter, setCounter } from '@/lib/counter-store'
import { useCooldown } from '@/lib/rate-limit-cooldown'
import {
  seedFromResponse,
  setReacted,
  setSaved,
} from '@/lib/my-reaction-store'
const VISIBILITY_META = {
  PUBLIC: { label: 'Public', icon: Globe, hint: 'Anyone can read' },
  FOLLOWERS_ONLY: { label: 'Followers', icon: Users, hint: 'Only your followers' },
  PRIVATE: { label: 'Private', icon: Lock, hint: 'Only you' },
}

// Status palette per IRC Scholar spec — PUBLISHED success, DRAFT
// warning amber, ARCHIVED muted, RETRACTED danger, SCHEDULED info.
const STATUS_META = {
  PUBLISHED: {
    label: 'Published',
    tone: 'bg-[color-mix(in_oklch,var(--accent-sage)_14%,transparent)] text-accent-sage',
  },
  DRAFT: {
    label: 'Draft',
    tone: 'bg-[color-mix(in_oklch,var(--accent-amber)_16%,transparent)] text-accent-amber',
  },
  ARCHIVED: {
    label: 'Archived',
    tone: 'bg-muted text-ink-3',
  },
  RETRACTED: {
    label: 'Retracted',
    tone: 'bg-[color-mix(in_oklch,var(--accent-rust)_14%,transparent)] text-accent-rust',
  },
  SCHEDULED: {
    label: 'Scheduled',
    tone: 'bg-[color-mix(in_oklch,var(--accent-sky)_12%,transparent)] text-accent-sky',
  },
}

const SOURCE_TYPE_LABEL = {
  URL: 'Web link',
  DOI: 'DOI',
  ISBN: 'Book',
  MEDIA_FILE: 'File',
  MANUAL: 'Reference',
}

// ─── Helpers ────────────────────────────────────────────────────────
function looksLikeUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value ?? '',
  )
}

function formatBytes(bytes) {
  if (!bytes || Number.isNaN(bytes)) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`
}

function formatDuration(seconds) {
  if (!seconds || seconds < 0) return ''
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${String(secs).padStart(2, '0')}`
}

function parseKeywords(keywords) {
  if (!keywords) return []
  return keywords.split(/[,;]/).map((k) => k.trim()).filter(Boolean)
}

function estimateReadingMinutes(text) {
  if (!text) return 0
  const words = text.trim().split(/\s+/).length
  return Math.max(1, Math.round(words / 220))
}

// ─── Reading progress bar ───────────────────────────────────────────
function ReadingProgress({ targetRef }) {
  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ['start start', 'end end'],
  })
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 220,
    damping: 30,
    mass: 0.4,
  })
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[2px] origin-left bg-foreground"
      style={{ scaleX }}
    />
  )
}

// ─── Copy button ────────────────────────────────────────────────────
function CopyButton({
  value,
  label = 'Copy',
  variant = 'ghost',
  size = 'sm',
  className,
}) {
  const toast = useToast()
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success(`${label} copied.`)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      toast.error('Could not copy.')
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleCopy}
      className={cn('rounded-full', className)}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? 'Copied' : label}
    </Button>
  )
}

// ─── Reading tabs — anchor nav for the main column ─────────────────
function ReadingTabs({ sourcesCount, citationsCount, commentsCount }) {
  const tabs = [
    { id: 'research-abstract', label: 'Abstract' },
    { id: 'research-references', label: 'References', count: sourcesCount },
    { id: 'research-citations', label: 'Citations', count: citationsCount },
    { id: 'research-discussion', label: 'Discussion', count: commentsCount },
  ]
  const [active, setActive] = useState('research-abstract')

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
        if (visible.length) {
          const top = visible.reduce((a, b) =>
            a.boundingClientRect.top < b.boundingClientRect.top ? a : b,
          )
          setActive(top.target.id)
        }
      },
      { rootMargin: '-30% 0px -55% 0px', threshold: [0, 0.3] },
    )
    tabs.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [])

  function jump(id) {
    const el = document.getElementById(id)
    if (!el) return
    setActive(id)
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="sticky top-14 z-10 -mx-2 mb-2 flex items-center gap-5 overflow-x-auto border-b-[0.5px] border-border bg-background/90 px-2 backdrop-blur scrollbar-none">
      {tabs.map((tab) => {
        const isActive = active === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => jump(tab.id)}
            className={cn(
              'relative inline-flex items-baseline gap-2 py-3 text-[13px] font-medium transition-colors',
              isActive ? 'text-ink' : 'text-ink-3 hover:text-ink',
            )}
          >
            <span>{tab.label}</span>
            {typeof tab.count === 'number' && tab.count > 0 ? (
              <span className="font-mono text-[11px] tabular-nums text-ink-4">
                {formatNumber(tab.count)}
              </span>
            ) : null}
            {isActive ? (
              <motion.span
                layoutId="reading-tab-underline"
                className="absolute inset-x-0 -bottom-px h-[1.5px] rounded-full bg-ink"
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

// ─── Abstract block — drop-cap on the first paragraph, optional
// "Show full abstract" toggle when the text overflows the preview. ──
function AbstractBlock({ text }) {
  const [expanded, setExpanded] = useState(false)
  const paragraphs = useMemo(
    () =>
      String(text || '')
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean),
    [text],
  )
  if (!paragraphs.length) return null
  const long = paragraphs.length > 1
  const visible = expanded || !long ? paragraphs : paragraphs.slice(0, 1)

  return (
    <div>
      <div className="space-y-4 font-serif text-[17.5px] leading-[1.78] text-ink">
        {visible.map((paragraph, index) => {
          // Drop caps are a Latin print convention — Arabic letters
          // connect to one another so isolating the first letter
          // looks broken, and the 80-px scale jars next to the
          // Arabic naskh body type. Skip the flourish entirely on
          // RTL paragraphs and render straight serif body copy
          // instead.
          const isRtl = startsWithRtl(paragraph)
          if (isRtl) {
            return (
              <p
                key={index}
                dir="auto"
                className="whitespace-pre-wrap break-words"
              >
                <MentionText text={paragraph} />
              </p>
            )
          }
          const firstChar = paragraph.charAt(0)
          const rest = paragraph.slice(1)
          return (
            <p
              key={index}
              dir="auto"
              className="whitespace-pre-wrap break-words"
            >
              <span
                aria-hidden
                className="float-left mr-2 mt-1 font-serif text-[64px] font-semibold leading-[0.85] tracking-[-0.04em] text-ink sm:text-[80px]"
              >
                {firstChar}
              </span>
              <MentionText text={rest} />
            </p>
          )
        })}
      </div>
      {long ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full border-[0.5px] border-border bg-paper px-3.5 py-1.5 text-[12px] font-medium text-ink-2 transition-colors hover:border-ink/30 hover:text-ink"
        >
          {expanded ? 'Hide full abstract' : 'Show full abstract'}
          <ChevronDown
            className={cn(
              'size-3.5 transition-transform',
              expanded && 'rotate-180',
            )}
          />
        </button>
      ) : null}
    </div>
  )
}

// ─── Editorial hero ─────────────────────────────────────────────────
//
// Single text-first card per spec § Research:
//   identifier strip → title → authors row → action bar → metric strip
//
// The identifier strip is one horizontal row, in mono uppercase, with
// hairline dividers between segments — Status pill | IRC sequence id |
// DOI | publication date (right-aligned).
function EditorialHero({
  research,
  status,
  visibility,
  scheduledDate,
  readingMinutes,
  working,
  downloadsEnabled,
  onPickReaction,
  onClearReaction,
  onSave,
  onShare,
  onCite,
  onDownload,
}) {
  const cover = resolveMediaUrl(research.coverImageUrl)
  const VisibilityIcon = visibility.icon
  const statusMeta = STATUS_META[status] ?? null
  const reactionCooldown = useCooldown('reaction')
  const saveCooldown = useCooldown('social')

  const leadAuthor = {
    id: research.researcherId,
    username: research.researcherUsername,
    fullName: research.researcherFullName,
    profileImage: research.researcherProfileImage,
    role: research.researcherRole ?? 'RESEARCHER',
    verified: research.researcherVerified ?? true,
  }
  const coAuthors = Array.isArray(research.coAuthors)
    ? research.coAuthors
    : []

  const publishedDate = research.publishedAt
    ? new Date(research.publishedAt)
    : null
  const dateLabel = publishedDate
    ? publishedDate.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : scheduledDate
      ? `Scheduled · ${scheduledDate.toLocaleDateString()}`
      : null

  const reactionActive = Boolean(
    research.currentUserReacted || research.currentUserReactionType,
  )

  const metrics = [
    { value: research.viewCount, label: 'Views' },
    { value: research.downloadCount, label: 'Downloads' },
    { value: research.citationCount, label: 'Citations' },
    { value: research.saveCount, label: 'Saves' },
    { value: research.commentCount, label: 'Comments' },
  ]

  return (
    <section className="relative isolate overflow-hidden rounded-2xl border-[0.5px] border-border bg-paper shadow-[0_24px_60px_-32px_oklch(0_0_0/0.18)]">
      {/* ── Identifier strip ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b-[0.5px] border-border bg-secondary/30 px-6 py-3 sm:px-8">
        {statusMeta ? (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]',
              statusMeta.tone,
            )}
          >
            <Check className="size-3" strokeWidth={2.4} />
            {statusMeta.label}
          </span>
        ) : null}

        {research.ircId ? (
          <span className="font-mono text-[11px] tabular-nums tracking-[0.04em] text-ink-3">
            {research.ircId}
          </span>
        ) : null}

        {research.doi ? (
          <span className="text-ink-4">·</span>
        ) : null}
        {research.doi ? (
          <a
            href={`https://doi.org/${research.doi}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[11px] text-ink-3 transition-colors hover:text-ink hover:underline"
            title="Open DOI in a new tab"
          >
            DOI: {research.doi}
          </a>
        ) : null}

        <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-3">
          <VisibilityIcon className="size-3" strokeWidth={1.6} />
          {visibility.label}
        </span>

        {dateLabel ? (
          <span className="ml-auto font-mono text-[11px] tabular-nums text-ink-3">
            {dateLabel}
          </span>
        ) : null}
      </div>

      {/* ── Optional cover (kept for visual interest when present) ── */}
      {cover ? (
        <div className="relative aspect-[16/6] w-full overflow-hidden bg-muted">
          <img
            src={cover}
            alt={research.title}
            className="h-full w-full object-cover"
          />
          <span
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-paper to-transparent"
          />
        </div>
      ) : null}

      {/* ── Title + authors + actions ─────────────────────────────── */}
      <div className="space-y-7 px-6 py-7 sm:px-8 sm:py-8">
        {/* Title */}
        <h1
          dir="auto"
          className="font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.012em] text-ink sm:text-[36px]"
        >
          {research.title}
        </h1>

        {readingMinutes ? (
          <p className="-mt-3 text-[12px] text-ink-3">
            <span className="font-mono">{readingMinutes}</span> min read
          </p>
        ) : null}

        {/* Authors row */}
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <AuthorPill author={leadAuthor} label="Lead researcher" verified />
            {coAuthors.map((coAuthor) => (
              <AuthorPill
                key={coAuthor.id ?? coAuthor.username}
                author={coAuthor}
                label="Co-author"
              />
            ))}
          </div>
          {leadAuthor.username ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              asChild
            >
              <Link to={`/profile/${leadAuthor.username}`}>
                <span className="text-[15px] leading-none">+</span>
                Follow {coAuthors.length ? 'authors' : 'author'}
              </Link>
            </Button>
          ) : null}
        </div>

        {/* Action bar */}
        <div className="flex flex-wrap items-center gap-2">
          {downloadsEnabled && (research.mediaFiles?.length ?? 0) > 0 ? (
            <Button
              type="button"
              onClick={onDownload}
              className="h-9 gap-1.5 rounded-full bg-brand px-4 text-[12.5px] font-semibold text-brand-foreground hover:bg-brand/90"
            >
              <Download className="size-3.5" strokeWidth={2} />
              Download PDF
            </Button>
          ) : null}

          <Button
            type="button"
            variant="outline"
            onClick={onCite}
            className="h-9 gap-1.5 rounded-full px-4 text-[12.5px]"
          >
            <Quote className="size-3.5" strokeWidth={1.8} />
            Cite
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={onSave}
            disabled={saveCooldown > 0}
            title={
              saveCooldown > 0
                ? `Rate limit — try again in ${saveCooldown}s`
                : undefined
            }
            className={cn(
              'h-9 gap-1.5 rounded-full px-4 text-[12.5px]',
              research.currentUserSaved && 'border-brand/50 text-brand',
            )}
          >
            {research.currentUserSaved ? (
              <BookmarkCheck className="size-3.5" strokeWidth={1.8} />
            ) : (
              <Bookmark className="size-3.5" strokeWidth={1.8} />
            )}
            {saveCooldown > 0
              ? `Wait ${saveCooldown}s`
              : research.currentUserSaved ? 'Saved' : 'Save'}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={onShare}
            className="h-9 gap-1.5 rounded-full px-4 text-[12.5px]"
          >
            <Share2 className="size-3.5" strokeWidth={1.8} />
            Share
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() =>
              reactionActive ? onClearReaction() : onPickReaction('LIKE')
            }
            disabled={working || reactionCooldown > 0}
            aria-pressed={reactionActive}
            aria-label={
              reactionCooldown > 0
                ? `Try again in ${reactionCooldown}s`
                : reactionActive ? 'Unlike' : 'Like'
            }
            title={
              reactionCooldown > 0
                ? `Rate limit — try again in ${reactionCooldown}s`
                : undefined
            }
            className={cn(
              'h-9 gap-1.5 rounded-full px-4 text-[12.5px]',
              reactionActive &&
                'border-transparent bg-rose-500/15 text-rose-600',
            )}
          >
            <Heart
              className={cn('size-4', reactionActive && 'fill-current')}
              strokeWidth={1.8}
            />
            {reactionActive ? 'Liked' : 'Like'}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="size-9 rounded-full"
            aria-label="More"
            title="More"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </div>

        {/* Metric strip — every value ticks live via the page-level
            useResearchStream subscription (VIEW_COUNT_UPDATED,
            DOWNLOAD_COUNT_UPDATED, CITATION_COUNT_UPDATED, SAVE_COUNT_UPDATED,
            and COMMENT_CREATED/DELETED). Keying each motion.span on the
            current value gives us a soft mount/exit so the change is
            visible rather than silent. */}
        <div className="-mx-6 mt-6 grid grid-cols-3 gap-px overflow-hidden border-y-[0.5px] border-border bg-border sm:-mx-8 sm:grid-cols-5">
          {metrics.map(({ value, label }) => (
            <div
              key={label}
              className="flex flex-col items-center justify-center gap-1 bg-paper px-3 py-5 text-center"
            >
              <p className="font-display text-[22px] font-semibold leading-none tracking-[-0.012em] tabular-nums text-ink sm:text-[26px]">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={value ?? 0}
                    initial={{ y: 8, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -8, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 460, damping: 30 }}
                    className="live-flash inline-block"
                  >
                    {formatNumber(value ?? 0)}
                  </motion.span>
                </AnimatePresence>
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
                {label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Author pill — avatar + name + mono role label ─────────────────
function AuthorPill({ author, label, verified }) {
  const showVerified = Boolean(verified ?? author.verified)
  return (
    <div className="flex items-center gap-3">
      <Link
        to={author.username ? `/profile/${getRawUsername(author)}` : '#'}
        className="shrink-0"
      >
        <UserAvatar user={author} className="size-10" />
      </Link>
      <div className="min-w-0 leading-tight">
        <Link
          to={author.username ? `/profile/${getRawUsername(author)}` : '#'}
          className="inline-flex items-center gap-1 text-[14px] font-semibold tracking-tight text-ink hover:underline"
        >
          <span className="truncate">
            {getFullName(author) || getHandle(author) || 'Unknown'}
          </span>
          {showVerified ? (
            <Check
              className="size-3.5 text-brand"
              strokeWidth={2.4}
              aria-label="Verified"
            />
          ) : null}
        </Link>
        <p className="mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-3">
          {label}
          {showVerified ? ' · VERIFIED' : ''}
        </p>
      </div>
    </div>
  )
}

// ─── Sticky compact title bar (appears on scroll) ───────────────────
function StickyTitleBar({ visible, research, onReact, onSave, onShare, working }) {
  const reactionCooldown = useCooldown('reaction')
  const author = {
    username: research.researcherUsername,
    fullName: research.researcherFullName,
    profileImage: research.researcherProfileImage,
  }
  return (
    <motion.div
      initial={false}
      animate={{ y: visible ? 0 : -64, opacity: visible ? 1 : 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      className="pointer-events-auto fixed inset-x-0 top-0 z-40 hidden border-b border-border/60 bg-background/85 backdrop-blur lg:block"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2 sm:px-6">
        <UserAvatar user={author} className="size-7" />
        <div className="min-w-0 flex-1">
          <p
            dir="auto"
            className="truncate text-sm font-semibold tracking-tight"
          >
            {research.title}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {research.researcherFullName ?? getHandle(author)}
          </p>
        </div>
        <div className="hidden items-center gap-1 sm:flex">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              research.currentUserReactionType ? onReact(null) : onReact('LIKE')
            }
            disabled={working || reactionCooldown > 0}
            aria-pressed={Boolean(research.currentUserReactionType)}
            aria-label={
              reactionCooldown > 0
                ? `Try again in ${reactionCooldown}s`
                : research.currentUserReactionType ? 'Unlike' : 'Like'
            }
            title={
              reactionCooldown > 0
                ? `Rate limit — try again in ${reactionCooldown}s`
                : undefined
            }
            className={cn(
              'h-7 rounded-full gap-1 transition-all duration-200 active:scale-95',
              research.currentUserReactionType &&
                'bg-rose-500/15 text-rose-600 ring-1 ring-rose-500/30',
            )}
          >
            <Heart
              className={cn(
                'size-3.5',
                research.currentUserReactionType && 'fill-current',
              )}
              strokeWidth={1.8}
            />
            <span>
              {research.currentUserReactionType ? 'Liked' : 'Like'}
            </span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onSave}
            className={cn(
              'h-7 rounded-full',
              research.currentUserSaved && 'text-foreground',
            )}
          >
            {research.currentUserSaved ? (
              <BookmarkCheck className="size-3.5" />
            ) : (
              <Bookmark className="size-3.5" />
            )}
            {research.currentUserSaved ? 'Saved' : 'Save'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onShare}
            className="h-7 rounded-full"
          >
            <Share2 className="size-3.5" />
            Share
          </Button>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Author card (right rail) ───────────────────────────────────────
function AuthorCard({ research }) {
  const author = {
    id: research.researcherId,
    username: research.researcherUsername,
    fullName: research.researcherFullName,
    profileImage: research.researcherProfileImage,
    role: 'RESEARCHER',
  }
  return (
    <Card className="overflow-hidden rounded-2xl border border-border bg-card">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-3">
          <Link to={`/profile/${getRawUsername(author)}`} className="shrink-0">
            <UserAvatar
              user={author}
              className="size-12 ring-2 ring-background shadow-sm"
            />
          </Link>
          <div className="min-w-0">
            <Link
              to={`/profile/${getRawUsername(author)}`}
              className="block truncate text-sm font-semibold hover:underline"
            >
              {getFullName(author) || getHandle(author)}
            </Link>
            {getHandle(author) ? (
              <p className="truncate text-xs text-muted-foreground">
                @{getHandle(author)}
              </p>
            ) : null}
          </div>
          <RoleBadge role="RESEARCHER" size="xs" className="ml-auto shrink-0" />
        </div>
        <Button
          asChild
          variant="outline"
          size="sm"
          className="h-8 w-full justify-center rounded-full"
        >
          <Link to={`/profile/${getRawUsername(author)}`}>View profile</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

// ─── Stats grid ────────────────────────────────────────────────────
function StatsRail({ research }) {
  const stats = [
    { icon: Eye, value: research.viewCount, label: 'views' },
    { icon: Heart, value: research.reactionCount, label: 'reactions' },
    { icon: MessageCircle, value: research.commentCount, label: 'comments' },
    { icon: Bookmark, value: research.saveCount, label: 'saves' },
    { icon: Share2, value: research.shareCount, label: 'shares' },
    { icon: Quote, value: research.citationCount, label: 'citations' },
  ]
  return (
    <Card className="overflow-hidden rounded-2xl border border-border bg-card">
      <CardContent className="grid grid-cols-3 gap-px overflow-hidden bg-border p-0">
        {stats.map(({ icon: Icon, value, label }) => (
          <div
            key={label}
            className="flex flex-col items-center justify-center gap-1 bg-card px-2 py-3 text-center"
          >
            <Icon className="size-3.5 text-muted-foreground" />
            <p className="font-mono text-sm font-semibold tabular-nums">
              {formatNumber(value ?? 0)}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// ─── Action rail (right rail) ───────────────────────────────────────
function ActionRail({
  research,
  working,
  downloadsEnabled,
  onPick,
  onClear,
  onSave,
  onShare,
  onCite,
  onDownload,
}) {
  const reactionCooldown = useCooldown('reaction')
  return (
    <Card className="overflow-hidden rounded-2xl border border-border bg-card">
      <CardContent className="space-y-2 p-3">
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            research.currentUserReactionType ? onClear() : onPick('LIKE')
          }
          disabled={working || reactionCooldown > 0}
          aria-pressed={Boolean(research.currentUserReactionType)}
          aria-label={
            reactionCooldown > 0
              ? `Try again in ${reactionCooldown}s`
              : research.currentUserReactionType ? 'Unlike' : 'Like'
          }
          title={
            reactionCooldown > 0
              ? `Rate limit — try again in ${reactionCooldown}s`
              : undefined
          }
          className={cn(
            'h-10 w-full justify-start gap-2 rounded-xl transition-all duration-200 active:scale-[0.98]',
            research.currentUserReactionType &&
              'bg-rose-500/15 text-rose-600 ring-1 ring-rose-500/30',
          )}
        >
          <Heart
            className={cn(
              'size-4',
              research.currentUserReactionType && 'fill-current',
            )}
            strokeWidth={1.8}
          />
          <span className="font-medium">
            {research.currentUserReactionType ? 'Liked' : 'Like'}
          </span>
          <span className="ml-auto font-mono text-xs tabular-nums text-muted-foreground">
            {formatNumber(research.reactionCount ?? 0)}
          </span>
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onSave}
          className={cn(
            'h-10 w-full justify-start gap-2 rounded-xl',
            research.currentUserSaved && 'text-foreground',
          )}
        >
          {research.currentUserSaved ? (
            <BookmarkCheck className="size-4" />
          ) : (
            <Bookmark className="size-4" />
          )}
          <span className="font-medium">
            {research.currentUserSaved ? 'Saved' : 'Save'}
          </span>
          <span className="ml-auto font-mono text-xs tabular-nums text-muted-foreground">
            {formatNumber(research.saveCount ?? 0)}
          </span>
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onShare}
          className="h-10 w-full justify-start gap-2 rounded-xl"
        >
          <Share2 className="size-4" />
          <span className="font-medium">Share</span>
          <span className="ml-auto font-mono text-xs tabular-nums text-muted-foreground">
            {formatNumber(research.shareCount ?? 0)}
          </span>
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCite}
          className="h-10 w-full justify-start gap-2 rounded-xl"
        >
          <Quote className="size-4" />
          <span className="font-medium">Cite</span>
          <span className="ml-auto font-mono text-xs tabular-nums text-muted-foreground">
            {formatNumber(research.citationCount ?? 0)}
          </span>
        </Button>
        {downloadsEnabled && (research.mediaFiles?.length ?? 0) > 0 ? (
          <Button
            type="button"
            variant="outline"
            onClick={onDownload}
            className="h-10 w-full justify-start gap-2 rounded-xl"
          >
            <Download className="size-4" />
            <span className="font-medium">Download</span>
            <span className="ml-auto font-mono text-xs tabular-nums text-muted-foreground">
              {formatNumber(research.downloadCount ?? 0)}
            </span>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}

// ─── Keyword chips ──────────────────────────────────────────────────
function KeywordCard({ keywords, tags }) {
  if (!keywords.length && !tags?.length) return null
  return (
    <Card className="overflow-hidden rounded-2xl border border-border bg-card">
      <CardContent className="space-y-3 p-4">
        {tags?.length ? (
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Tags
            </p>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="rounded-full text-[11px]"
                >
                  #{tag}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
        {keywords.length ? (
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Keywords
            </p>
            <div className="flex flex-wrap gap-1.5">
              {keywords.map((keyword) => (
                <span
                  key={keyword}
                  className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-0.5 text-[11px] text-foreground"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

// ─── Citation card ──────────────────────────────────────────────────
function CitationCard({ research }) {
  if (!research.citation && !research.shareUrl) return null
  return (
    <Card
      id="research-citations"
      className="overflow-hidden rounded-2xl border border-border bg-card scroll-mt-24"
    >
      <CardContent className="space-y-4 p-4">
        {research.citation ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                <Quote className="size-3" />
                How to cite
              </p>
              <CopyButton value={research.citation} label="Copy" />
            </div>
            <p className="whitespace-pre-wrap rounded-xl border border-dashed border-border bg-muted/30 p-3 font-serif text-[13px] leading-relaxed">
              {research.citation}
            </p>
          </div>
        ) : null}

        {research.shareUrl ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                <Link2 className="size-3" />
                Share link
              </p>
              <CopyButton value={research.shareUrl} label="Copy" />
            </div>
            <code className="block truncate rounded-lg border border-border bg-muted px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground">
              {research.shareUrl}
            </code>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

// ─── Media file tile ────────────────────────────────────────────────
function MediaFileTile({ media }) {
  const url = resolveMediaUrl(media.fileUrl)
  const thumb = resolveMediaUrl(media.thumbnailUrl)
  const type = media.mediaType
  const isImage = type === 'IMAGE' || media.mimeType?.startsWith('image/')
  const isVideo = type === 'VIDEO' || media.mimeType?.startsWith('video/')
  const isAudio = type === 'AUDIO' || media.mimeType?.startsWith('audio/')

  if (isAudio) {
    return (
      <div className="overflow-hidden rounded-2xl border border-border bg-card p-3">
        <AudioPlayer
          src={url}
          variant="rich"
          trackKind="music"
          subtitle={media.mimeType}
          title={media.caption || media.originalFileName || 'Audio'}
          showDownload
        />
      </div>
    )
  }

  const Body = (() => {
    if (isVideo) {
      return (
        <video
          src={url}
          poster={thumb}
          controls
          playsInline
          preload="metadata"
          className="aspect-video w-full bg-black object-contain"
        />
      )
    }
    if (isImage) {
      return (
        <a href={url} target="_blank" rel="noreferrer" className="group block">
          <img
            src={url}
            alt={media.altText ?? media.caption ?? ''}
            loading="lazy"
            className="aspect-[4/3] w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
          />
        </a>
      )
    }
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-muted to-muted/50 p-6 transition-opacity hover:opacity-90"
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-background shadow-sm">
            <FileText className="size-6 text-muted-foreground" />
          </span>
          <span className="text-xs font-semibold text-foreground">
            Open {media.mimeType?.split('/')?.[1]?.toUpperCase() ?? 'file'}
          </span>
        </div>
      </a>
    )
  })()

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-[0_18px_40px_-30px_oklch(0_0_0/0.25)]">
      {Body}
      <div className="flex items-start justify-between gap-3 px-3.5 py-2.5 text-xs">
        <div className="min-w-0 flex-1">
          {media.caption || media.originalFileName ? (
            <p className="truncate font-medium text-foreground">
              {media.caption || media.originalFileName}
            </p>
          ) : null}
          <div className="mt-0.5 flex items-center gap-2 text-muted-foreground">
            {media.mimeType ? <span className="truncate">{media.mimeType}</span> : null}
            {media.fileSize ? (
              <>
                <span aria-hidden>·</span>
                <span>{formatBytes(media.fileSize)}</span>
              </>
            ) : null}
            {media.durationSeconds ? (
              <>
                <span aria-hidden>·</span>
                <span>{formatDuration(media.durationSeconds)}</span>
              </>
            ) : null}
          </div>
        </div>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
            title="Open original"
          >
            <ExternalLink className="size-3.5" />
          </a>
        ) : null}
      </div>
    </div>
  )
}

// ─── Source / reference item (numbered) ─────────────────────────────
function SourceItem({ source, index }) {
  const typeLabel = SOURCE_TYPE_LABEL[source.sourceType] ?? 'Reference'
  return (
    <li className="group/source relative pl-9">
      <span
        className="absolute left-0 top-1 grid size-7 place-items-center rounded-full border border-border bg-background font-mono text-[11px] font-semibold tabular-nums text-muted-foreground"
        aria-hidden
      >
        {index + 1}
      </span>
      <div className="space-y-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <Badge
            variant="outline"
            className="rounded-full text-[10px] uppercase tracking-wider"
          >
            {typeLabel}
          </Badge>
          <p className="font-serif text-[15px] font-semibold leading-snug text-foreground">
            {source.title}
          </p>
        </div>
        {source.citationText ? (
          <p className="whitespace-pre-wrap font-serif text-[13.5px] leading-relaxed text-muted-foreground">
            {source.citationText}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[11px]">
          {source.doi ? (
            <a
              href={`https://doi.org/${source.doi}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-foreground hover:underline"
            >
              <Link2 className="size-3" />
              DOI · {source.doi}
            </a>
          ) : null}
          {source.isbn ? (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              ISBN · {source.isbn}
            </span>
          ) : null}
          {source.url && !source.doi ? (
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-foreground hover:underline"
            >
              <ExternalLink className="size-3" />
              Open link
            </a>
          ) : null}
          {source.fileUrl ? (
            <a
              href={resolveMediaUrl(source.fileUrl)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-foreground hover:underline"
            >
              <Download className="size-3" />
              {source.originalFileName ?? 'Download'}
            </a>
          ) : null}
        </div>
      </div>
    </li>
  )
}

// ─── Section heading (in main column) ───────────────────────────────
function SectionHeading({ icon: Icon, title, count }) {
  return (
    <div className="flex items-center gap-2">
      {Icon ? <Icon className="size-3.5 text-muted-foreground" /> : null}
      <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </h2>
      {count != null ? (
        <span className="text-[11px] text-muted-foreground">· {count}</span>
      ) : null}
      <span className="ml-2 h-px flex-1 bg-border" aria-hidden />
    </div>
  )
}

// ─── Mobile sticky action bar ───────────────────────────────────────
function MobileStickyActions({ research, working, onPick, onClear, onSave, onShare }) {
  const liked = Boolean(research.currentUserReactionType)
  const reactionCooldown = useCooldown('reaction')
  return (
    <div
      className="fixed inset-x-0 z-30 mx-3 flex items-center gap-1 rounded-full border border-border bg-background/95 p-1 shadow-[0_18px_40px_-20px_oklch(0_0_0/0.25)] backdrop-blur lg:hidden"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 4.5rem)',
      }}
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => (liked ? onClear() : onPick('LIKE'))}
        disabled={working || reactionCooldown > 0}
        aria-pressed={liked}
        aria-label={
          reactionCooldown > 0
            ? `Try again in ${reactionCooldown}s`
            : liked ? 'Unlike' : 'Like'
        }
        className={cn(
          'h-9 flex-1 gap-1.5 rounded-full transition-all duration-200 active:scale-95',
          liked
            ? 'bg-rose-500/15 text-rose-600 ring-1 ring-rose-500/30'
            : 'text-muted-foreground',
        )}
      >
        <Heart
          className={cn('size-4', liked && 'fill-current')}
          strokeWidth={1.8}
        />
        <span className="font-medium">
          {reactionCooldown > 0 ? `${reactionCooldown}s` : liked ? 'Liked' : 'Like'}
        </span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onSave}
        className={cn(
          'h-9 flex-1 rounded-full text-muted-foreground',
          research.currentUserSaved && 'text-foreground',
        )}
      >
        {research.currentUserSaved ? (
          <BookmarkCheck className="size-4" />
        ) : (
          <Bookmark className="size-4" />
        )}
        Save
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onShare}
        className="h-9 flex-1 rounded-full text-muted-foreground"
      >
        <Share2 className="size-4" />
        Share
      </Button>
    </div>
  )
}

// ─── Page component ─────────────────────────────────────────────────
export function ResearchDetailPage() {
  const { idOrSlug } = useParams()
  const navigate = useNavigate()
  const { user: currentUser, isAuthenticated } = useAuth()
  const toast = useToast()

  const articleRef = useRef(null)
  const heroRef = useRef(null)
  const commentsRef = useRef(null)
  const [showStickyBar, setShowStickyBar] = useState(false)

  const [research, setResearch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [lifecycleWorking, setLifecycleWorking] = useState(false)

  // Sticky bar visibility based on hero scroll
  useEffect(() => {
    const target = heroRef.current
    if (!target || typeof IntersectionObserver === 'undefined') return undefined
    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyBar(!entry.isIntersecting),
      { threshold: 0, rootMargin: '-72px 0px 0px 0px' },
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [research?.id])

  // Load research
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const data = looksLikeUuid(idOrSlug)
          ? await getResearch(idOrSlug)
          : await getResearchBySlug(idOrSlug)
        if (!cancelled) {
          setResearch(data)
          // Research's mapper resolves the viewer's row authoritatively,
          // so this seed is the canonical "did I react / save" truth.
          if (data) seedFromResponse('research', data, { authoritative: true })
        }
        if (data?.id) recordResearchView(data.id).catch(() => {})
      } catch (error) {
        if (!cancelled) {
          // 404 is the canonical "not visible to you" signal from the
          // backend — covers both "doesn't exist" and "viewer is in a
          // block edge with the researcher". Skip the toast and let the
          // EmptyState below explain it.
          const status = error?.response?.status ?? error?.status
          if (status !== 404) {
            toast.error(extractApiMessage(error, 'Could not load research.'))
          }
          setResearch(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [idOrSlug, toast])

  // ── Realtime ─────────────────────────────────────────────────
  // Subscribe to /api/v1/researches/{id}/stream so every counter and
  // every comment / reply / deletion lands live without a refetch.
  // Backend uses atomic clamp-at-zero UPDATEs for every counter, so
  // the values arriving here are authoritative — we trust them over
  // any optimistic local +1 / -1.
  useResearchStream(
    research?.id,
    {
      RESEARCH_UPDATED: (payload) => {
        if (!payload?.id) return
        setResearch((current) =>
          current ? { ...current, ...payload, myReaction: current.myReaction } : current,
        )
      },
      RESEARCH_PUBLISHED: (payload) => {
        if (!payload?.id) return
        setResearch((current) =>
          current ? { ...current, ...payload, status: 'PUBLISHED' } : current,
        )
      },
      RESEARCH_DELETED: () => {
        toast.info('This research was removed by its author.')
        navigate('/research', { replace: true })
      },
      // Own-actor guard: when the SSE echoes the viewer's own toggle,
      // the optimistic update + DELETE-response reconciliation in
      // handlePickReaction / handleClearReaction already wrote the
      // authoritative count locally. Adopting payload.reactionCount
      // here would clobber that with whatever number the backend
      // snapshotted at broadcast time (which can lag the read-after-
      // write). Other viewers' reactions still update the count live.
      REACTION_ADDED: (payload) => {
        const id = research?.id
        if (!payload || !id) return
        if (currentUser?.id && payload.actorId === currentUser.id) return
        const next = payload.reactionCount
        if (next == null) return
        setCounter('research', id, 'rx', next)
        setResearch((current) =>
          current ? { ...current, reactionCount: next } : current,
        )
      },
      REACTION_REMOVED: (payload) => {
        const id = research?.id
        if (!payload || !id) return
        if (currentUser?.id && payload.actorId === currentUser.id) return
        const next = payload.reactionCount
        if (next == null) return
        setCounter('research', id, 'rx', next)
        setResearch((current) =>
          current ? { ...current, reactionCount: next } : current,
        )
      },
      COMMENT_CREATED: (payload) => {
        const id = research?.id
        if (!payload || !id) return
        const next = payload.commentCount
        if (next != null) setCounter('research', id, 'cm', next)
        setResearch((current) =>
          current
            ? { ...current, commentCount: next ?? (current.commentCount ?? 0) + 1 }
            : current,
        )
        commentsRef.current?.applyRealtimeEvent('COMMENT_CREATED', payload)
      },
      COMMENT_DELETED: (payload) => {
        const id = research?.id
        if (!payload || !id) return
        const next = payload.commentCount
        if (next != null) setCounter('research', id, 'cm', next)
        setResearch((current) =>
          current
            ? {
                ...current,
                commentCount: next ?? Math.max(0, (current.commentCount ?? 0) - 1),
              }
            : current,
        )
        commentsRef.current?.applyRealtimeEvent('COMMENT_DELETED', payload)
      },
      REPLY_CREATED: (payload) => {
        if (!payload) return
        commentsRef.current?.applyRealtimeEvent('REPLY_CREATED', payload)
      },
      COMMENT_EDITED: (payload) => {
        if (!payload) return
        commentsRef.current?.applyRealtimeEvent('COMMENT_EDITED', payload)
      },
      COMMENT_REACTION_ADDED: (payload) => {
        if (!payload) return
        commentsRef.current?.applyRealtimeEvent('COMMENT_REACTION_ADDED', payload)
      },
      COMMENT_REACTION_REMOVED: (payload) => {
        if (!payload) return
        commentsRef.current?.applyRealtimeEvent('COMMENT_REACTION_REMOVED', payload)
      },
      VIEW_COUNT_UPDATED: (payload) => {
        const id = research?.id
        if (!id || payload?.viewCount == null) return
        setCounter('research', id, 'vw', payload.viewCount)
        setResearch((current) =>
          current ? { ...current, viewCount: payload.viewCount } : current,
        )
      },
      DOWNLOAD_COUNT_UPDATED: (payload) => {
        const id = research?.id
        if (!id || payload?.downloadCount == null) return
        setCounter('research', id, 'dl', payload.downloadCount)
        setResearch((current) =>
          current ? { ...current, downloadCount: payload.downloadCount } : current,
        )
      },
      SAVE_COUNT_UPDATED: (payload) => {
        const id = research?.id
        if (!id || payload?.saveCount == null) return
        // Own-actor guard: handleToggleSave already wrote the
        // authoritative count from the HTTP response.
        if (currentUser?.id && payload.actorId === currentUser.id) return
        setCounter('research', id, 'sv', payload.saveCount)
        setResearch((current) =>
          current ? { ...current, saveCount: payload.saveCount } : current,
        )
      },
      SHARE_COUNT_UPDATED: (payload) => {
        const id = research?.id
        if (!id || payload?.shareCount == null) return
        setCounter('research', id, 'sh', payload.shareCount)
        setResearch((current) =>
          current ? { ...current, shareCount: payload.shareCount } : current,
        )
      },
      CITATION_COUNT_UPDATED: (payload) => {
        const id = research?.id
        if (!id || payload?.citationCount == null) return
        setCounter('research', id, 'ct', payload.citationCount)
        setResearch((current) =>
          current ? { ...current, citationCount: payload.citationCount } : current,
        )
      },
    },
    {
      // Catch-up after a reconnect: re-fetch the root entity so any
      // counter we missed during the outage lands authoritatively.
      onReconnect: () => {
        if (!research?.id) return
        getResearch(research.id)
          .then((data) => {
            if (data) {
              setResearch((current) =>
                current
                  ? { ...current, ...data, myReaction: current.myReaction }
                  : data,
              )
            }
          })
          .catch(() => {})
      },
    },
  )

  async function handlePickReaction(type) {
    if (!isAuthenticated) {
      toast.info('Sign in to react.')
      return
    }
    if (working) return
    if (type == null) return handleClearReaction()
    const previous = research
    const wasReacting = Boolean(research?.currentUserReacted)
    const previousReactionCount = research?.reactionCount ?? 0
    setResearch((current) => ({
      ...current,
      currentUserReacted: true,
      currentUserReactionType: type,
      reactionCount: wasReacting
        ? current.reactionCount
        : (current?.reactionCount ?? 0) + 1,
    }))
    setReacted('research', research.id, true, type)
    if (!wasReacting) bumpCounter('research', research.id, 'rx', previousReactionCount, +1)
    setWorking(true)
    try {
      await reactToResearch(research.id, type)
    } catch (error) {
      setResearch(previous)
      setReacted(
        'research',
        research.id,
        Boolean(previous?.currentUserReacted),
        previous?.currentUserReactionType ?? null,
      )
      if (!wasReacting) setCounter('research', research.id, 'rx', previousReactionCount)
      toast.error(extractApiMessage(error, 'Could not react.'))
    } finally {
      setWorking(false)
    }
  }

  async function handleClearReaction() {
    if (working || !research?.currentUserReacted) return
    const previous = research
    const previousReactionCount = research?.reactionCount ?? 0
    setResearch((current) => ({
      ...current,
      currentUserReacted: false,
      currentUserReactionType: null,
      reactionCount: Math.max(0, (current?.reactionCount ?? 0) - 1),
    }))
    setReacted('research', research.id, false)
    bumpCounter('research', research.id, 'rx', previousReactionCount, -1)
    setWorking(true)
    try {
      // DELETE now returns 200 with the full ResearchResponse — adopt
      // the authoritative reactionCount + currentUserReacted:false in
      // case the optimistic decrement lagged behind another viewer's
      // concurrent reaction.
      const updated = await removeResearchReaction(research.id)
      if (updated?.id) {
        setResearch((current) => (current ? { ...current, ...updated } : updated))
        if (updated.reactionCount != null) {
          setCounter('research', research.id, 'rx', updated.reactionCount)
        }
      }
    } catch (error) {
      setResearch(previous)
      setReacted(
        'research',
        research.id,
        Boolean(previous?.currentUserReacted),
        previous?.currentUserReactionType ?? null,
      )
      setCounter('research', research.id, 'rx', previousReactionCount)
      toast.error(extractApiMessage(error, 'Could not remove reaction.'))
    } finally {
      setWorking(false)
    }
  }

  async function handleToggleSave() {
    if (!isAuthenticated) {
      toast.info('Sign in to save research.')
      return
    }
    const previous = research
    const wasSaved = Boolean(research.currentUserSaved)
    const previousSaveCount = research?.saveCount ?? 0
    // Optimistic flip first so the toggle feels instant.
    setResearch((current) => ({
      ...current,
      currentUserSaved: !wasSaved,
      saveCount: wasSaved
        ? Math.max(0, (current?.saveCount ?? 0) - 1)
        : (current?.saveCount ?? 0) + 1,
    }))
    setSaved('research', research.id, !wasSaved)
    bumpCounter('research', research.id, 'sv', previousSaveCount, wasSaved ? -1 : +1)
    try {
      // Both endpoints return the updated ResearchResponse — reconcile
      // against authoritative saveCount + currentUserSaved so the
      // optimistic delta never drifts under concurrent savers.
      const updated = wasSaved
        ? await unsaveResearch(research.id)
        : await saveResearch(research.id)
      if (updated?.id) {
        setResearch((current) => (current ? { ...current, ...updated } : updated))
        if (updated.saveCount != null) {
          setCounter('research', research.id, 'sv', updated.saveCount)
        }
        if (updated.currentUserSaved != null) {
          setSaved('research', research.id, Boolean(updated.currentUserSaved))
        }
      }
      if (!wasSaved) toast.success('Saved to your library.')
    } catch (error) {
      setResearch(previous)
      setSaved('research', research.id, wasSaved)
      setCounter('research', research.id, 'sv', previousSaveCount)
      toast.error(extractApiMessage(error, 'Could not update save state.'))
    }
  }

  async function handleShare() {
    try {
      const shareUrl = research.shareUrl || (await shareResearch(research.id))
      const url = typeof shareUrl === 'string' ? shareUrl : window.location.href
      if (navigator.share) {
        await navigator.share({ title: research.title, url })
      } else {
        await navigator.clipboard.writeText(url)
        toast.success('Link copied to clipboard.')
      }
      setResearch((current) => ({
        ...current,
        shareUrl: typeof shareUrl === 'string' ? shareUrl : current?.shareUrl,
        shareCount: (current?.shareCount ?? 0) + 1,
      }))
    } catch {
      // user cancelled or unsupported
    }
  }

  async function handleDownload() {
    try {
      const result = await requestResearchDownload(research.id)
      const url = typeof result === 'string' ? result : result?.url
      if (url) {
        window.open(url, '_blank', 'noreferrer')
      } else {
        toast.info('No download available for this research.')
      }
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not prepare download.'))
    }
  }

  async function handleRecordCitation() {
    try {
      await recordResearchCitation(research.id)
      setResearch((current) => ({
        ...current,
        citationCount: (current?.citationCount ?? 0) + 1,
      }))
      toast.success('Citation recorded.')
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not record citation.'))
    }
  }

  async function runLifecycle(action, label) {
    if (lifecycleWorking) return
    setLifecycleWorking(true)
    try {
      const updated = await action(research.id)
      setResearch((current) => ({ ...current, ...updated }))
      toast.success(`Research ${label}.`)
    } catch (error) {
      toast.error(extractApiMessage(error, `Could not ${label} this research.`))
    } finally {
      setLifecycleWorking(false)
    }
  }

  async function handleDelete() {
    if (lifecycleWorking) return
    if (!confirm(`Delete "${research.title}"? This cannot be undone.`)) return
    setLifecycleWorking(true)
    try {
      await deleteResearch(research.id)
      toast.success('Research deleted.')
      navigate('/research', { replace: true })
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not delete research.'))
    } finally {
      setLifecycleWorking(false)
    }
  }

  const keywords = useMemo(
    () => parseKeywords(research?.keywords),
    [research?.keywords],
  )
  const mediaFiles = useMemo(
    () =>
      [...(research?.mediaFiles ?? [])].sort(
        (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0),
      ),
    [research?.mediaFiles],
  )
  const sources = useMemo(
    () =>
      [...(research?.sources ?? [])].sort(
        (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0),
      ),
    [research?.sources],
  )
  const readingMinutes = useMemo(
    () =>
      estimateReadingMinutes(
        `${research?.abstractText ?? ''}\n${research?.description ?? ''}`,
      ),
    [research?.abstractText, research?.description],
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="aspect-[16/7] w-full rounded-[28px]" />
        <Skeleton className="h-10 w-3/4 rounded-2xl" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    )
  }

  if (!research) {
    return (
      <EmptyState
        title="This research isn't available"
        description="It may have been removed, unpublished, or the researcher has restricted who can see it."
        action={
          <Button asChild size="sm" variant="outline" className="rounded-full">
            <Link to="/research">Back to research</Link>
          </Button>
        }
      />
    )
  }

  const isOwner = Boolean(
    currentUser?.id && currentUser.id === research.researcherId,
  )
  const visibility =
    VISIBILITY_META[research.visibility] ?? VISIBILITY_META.PUBLIC
  const scheduledDate = research.scheduledPublishAt
    ? new Date(research.scheduledPublishAt)
    : null
  const status = research.status ?? null
  const commentsEnabled = research.commentsEnabled !== false
  const downloadsEnabled = research.downloadsEnabled !== false

  const description = research.description ?? ''
  // Drop cap is Latin-only. Arabic / Kurdish letters connect to one
  // another, so isolating the first character renders it in its
  // standalone form — visually broken and out of place against
  // naskh body type. Skip the flourish when the article opens in RTL.
  const descriptionIsRtl = startsWithRtl(description)
  const dropCap = descriptionIsRtl ? '' : description.trim().charAt(0)
  const descriptionRest = descriptionIsRtl
    ? description.trim()
    : description.trim().slice(1)

  return (
    <article ref={articleRef} className="relative space-y-8 pb-20 lg:pb-12">
      <ReadingProgress targetRef={articleRef} />
      <StickyTitleBar
        visible={showStickyBar}
        research={research}
        onReact={handlePickReaction}
        onSave={handleToggleSave}
        onShare={handleShare}
        working={working}
      />

      {/* Back row */}
      <div className="flex items-center justify-between gap-3">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="rounded-full text-muted-foreground hover:text-foreground"
        >
          <Link to="/research">
            <ArrowLeft className="size-4" />
            All research
          </Link>
        </Button>

        {isOwner ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="size-4" />
              Edit
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="rounded-full"
                  title="More actions"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {status !== 'PUBLISHED' ? (
                  <DropdownMenuItem
                    onSelect={() => runLifecycle(publishResearch, 'published')}
                    disabled={lifecycleWorking}
                  >
                    <UploadCloud className="mr-2 size-4" />
                    Publish
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onSelect={() => runLifecycle(unpublishResearch, 'unpublished')}
                    disabled={lifecycleWorking}
                  >
                    <UploadCloud className="mr-2 size-4 rotate-180" />
                    Unpublish (back to draft)
                  </DropdownMenuItem>
                )}
                {status !== 'ARCHIVED' ? (
                  <DropdownMenuItem
                    onSelect={() => runLifecycle(archiveResearch, 'archived')}
                    disabled={lifecycleWorking}
                  >
                    <Archive className="mr-2 size-4" />
                    Archive
                  </DropdownMenuItem>
                ) : null}
                {status !== 'RETRACTED' ? (
                  <DropdownMenuItem
                    onSelect={() => runLifecycle(retractResearch, 'retracted')}
                    disabled={lifecycleWorking}
                  >
                    <ShieldAlert className="mr-2 size-4" />
                    Retract
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={handleDelete}
                  disabled={lifecycleWorking}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 size-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}
      </div>

      {/* Hero */}
      <div ref={heroRef}>
        <EditorialHero
          research={research}
          status={status}
          visibility={visibility}
          scheduledDate={scheduledDate}
          readingMinutes={readingMinutes}
          working={working}
          downloadsEnabled={downloadsEnabled}
          onPickReaction={handlePickReaction}
          onClearReaction={handleClearReaction}
          onSave={handleToggleSave}
          onShare={handleShare}
          onCite={handleRecordCitation}
          onDownload={handleDownload}
        />
      </div>

      {/* Two-column reading area */}
      <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
        {/* Main column */}
        <main className="space-y-10 lg:col-span-8">
          {/* Reading tabs — smooth-anchor jump between primary
              sections. Active section follows scroll. */}
          <ReadingTabs
            sourcesCount={sources.length}
            citationsCount={research.citationCount ?? 0}
            commentsCount={research.commentCount ?? 0}
          />

          {/* Abstract */}
          {research.abstractText ? (
            <section id="research-abstract" className="space-y-4 scroll-mt-24">
              <AbstractBlock text={research.abstractText} />
              {Array.isArray(research.tags) && research.tags.length ? (
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {research.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-muted px-2.5 py-1 font-mono text-[11px] text-ink-2"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {/* Description */}
          {description ? (
            <section className="space-y-3">
              <SectionHeading icon={Quote} title="Article" />
              <div
                dir="auto"
                className="font-serif text-[18px] leading-[1.78] text-foreground"
              >
                {dropCap ? (
                  <span
                    aria-hidden
                    className="float-left mr-3 mt-1 font-serif text-[64px] font-semibold leading-none tracking-[-0.04em] text-foreground sm:text-[80px]"
                  >
                    {dropCap}
                  </span>
                ) : null}
                <p className="whitespace-pre-wrap break-words">
                  <MentionText text={descriptionRest} />
                </p>
              </div>
            </section>
          ) : null}

          {/* Video promo */}
          {research.videoPromoUrl ? (
            <section className="space-y-3">
              <SectionHeading
                icon={Play}
                title="Video promo"
                count={
                  research.videoPromoDurationSeconds
                    ? formatDuration(research.videoPromoDurationSeconds)
                    : null
                }
              />
              <VideoPromo
                url={research.videoPromoUrl}
                thumbnail={research.videoPromoThumbnailUrl}
                duration={research.videoPromoDurationSeconds}
              />
            </section>
          ) : null}

          {/* Media */}
          {mediaFiles.length ? (
            <section className="space-y-3">
              <SectionHeading
                icon={ImageIcon}
                title="Media & attachments"
                count={mediaFiles.length}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                {mediaFiles.map((media) => (
                  <MediaFileTile key={media.id} media={media} />
                ))}
              </div>
            </section>
          ) : null}

          {/* Sources */}
          {sources.length ? (
            <section
              id="research-references"
              className="space-y-3 scroll-mt-24"
            >
              <SectionHeading
                icon={Link2}
                title="Sources & references"
                count={sources.length}
              />
              <ol className="space-y-5">
                {sources.map((source, index) => (
                  <SourceItem key={source.id} source={source} index={index} />
                ))}
              </ol>
            </section>
          ) : null}

          {/* Discussion — rich threaded comments (1-level nest), live
              via the existing useResearchStream SSE wiring. */}
          <section
            id="research-discussion"
            className="space-y-4 scroll-mt-24"
          >
            <SectionHeading
              icon={MessageCircle}
              title="Discussion"
              count={formatNumber(research.commentCount ?? 0)}
            />

            {!commentsEnabled ? (
              <p className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                Comments are disabled for this research.
              </p>
            ) : (
              <ResearchComments
                ref={commentsRef}
                researchId={research.id}
                researcherId={research.researcherId}
                initialCount={research.commentCount ?? 0}
                onCountChange={(next) =>
                  setResearch((current) =>
                    current ? { ...current, commentCount: next } : current,
                  )
                }
              />
            )}
          </section>
        </main>

        {/* Right rail — keywords + citation card. Action bar / stats /
            author have moved into the hero, so the rail stays quiet
            and contextual. */}
        <aside className="lg:col-span-4">
          <div className="space-y-4 lg:sticky lg:top-20">
            <KeywordCard keywords={keywords} tags={research.tags} />
            <CitationCard research={research} />
          </div>
        </aside>
      </div>

      {/* Mobile sticky actions */}
      <MobileStickyActions
        research={research}
        working={working}
        onPick={handlePickReaction}
        onClear={handleClearReaction}
        onSave={handleToggleSave}
        onShare={handleShare}
      />

      {isOwner ? (
        <EditResearchDialog
          research={research}
          open={editOpen}
          onOpenChange={setEditOpen}
          onUpdated={(updated) =>
            setResearch((current) => ({ ...current, ...updated }))
          }
        />
      ) : null}
    </article>
  )
}

// ─── Video promo (kept inline, polished) ────────────────────────────
//
// Big black 16:9 surface. Centered white play button, single label
// "📹 Video abstract · {duration}" in the bottom-left in mono.
function VideoPromo({ url, thumbnail, duration }) {
  const [playing, setPlaying] = useState(false)
  if (!url) return null
  const thumbUrl = resolveMediaUrl(thumbnail)
  const videoUrl = resolveMediaUrl(url)

  return (
    <div className="relative overflow-hidden rounded-2xl border-[0.5px] border-border bg-black">
      {playing ? (
        <video
          src={videoUrl}
          controls
          autoPlay
          playsInline
          className="aspect-video w-full bg-black"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="group/promo relative block aspect-video w-full overflow-hidden"
          aria-label="Play promo"
        >
          {thumbUrl ? (
            <img
              src={thumbUrl}
              alt="Video promo"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover/promo:scale-[1.04]"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#1a1714] to-[#0c0a08]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-black/15" />
          <span className="absolute inset-0 grid place-items-center">
            <motion.span
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22 }}
              className="grid size-[88px] place-items-center rounded-full bg-white text-black shadow-[0_18px_48px_-10px_rgba(0,0,0,0.55)]"
            >
              <Play className="size-8 translate-x-[3px] fill-black" />
            </motion.span>
          </span>
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-md bg-black/55 px-2 py-1 font-mono text-[11px] font-medium tabular-nums text-white backdrop-blur">
            <Play className="size-3 fill-white" strokeWidth={1.5} />
            Video abstract
            {duration ? ` · ${formatDuration(duration)}` : null}
          </span>
        </button>
      )}
    </div>
  )
}
