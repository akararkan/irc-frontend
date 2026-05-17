import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive,
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Check,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Globe,
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
  Share2,
  ShieldAlert,
  Trash2,
  UploadCloud,
  Users,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion, useScroll, useSpring } from 'motion/react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
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
import { useTranslation } from 'react-i18next'
import { bumpCounter, setCounter } from '@/lib/counter-store'
import { useCooldown } from '@/lib/rate-limit-cooldown'
import { seedFromResponse, setReacted, setSaved } from '@/lib/my-reaction-store'

const VISIBILITY_META = {
  PUBLIC: { label: 'Public', icon: Globe, hint: 'Anyone can read' },
  FOLLOWERS_ONLY: { label: 'Followers', icon: Users, hint: 'Only your followers' },
  PRIVATE: { label: 'Private', icon: Lock, hint: 'Only you' },
}

const STATUS_META = {
  PUBLISHED: { label: 'Published', tone: 'bg-[#ECFDF5] text-[#065F46]' },
  DRAFT: { label: 'Draft', tone: 'bg-[#FFFBEB] text-[#B45309]' },
  ARCHIVED: { label: 'Archived', tone: 'bg-secondary text-ink-3' },
  RETRACTED: { label: 'Retracted', tone: 'bg-destructive/10 text-destructive' },
  SCHEDULED: { label: 'Scheduled', tone: 'bg-[#ECFEFF] text-[#0891B2]' },
}

const SOURCE_TYPE_LABEL = {
  URL: 'Web link',
  DOI: 'DOI',
  ISBN: 'Book',
  MEDIA_FILE: 'File',
  MANUAL: 'Reference',
}

/* ── Helpers ─────────────────────────────────────────────────── */
function looksLikeUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value ?? '')
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
  return keywords
    .split(/[,;]/)
    .map((k) => k.trim())
    .filter(Boolean)
}

function estimateReadingMinutes(text) {
  if (!text) return 0
  const words = text.trim().split(/\s+/).length
  return Math.max(1, Math.round(words / 220))
}

/* ── Reading progress bar ────────────────────────────────────── */
function ReadingProgress({ targetRef }) {
  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ['start start', 'end end'],
  })
  const scaleX = useSpring(scrollYProgress, { stiffness: 220, damping: 30, mass: 0.4 })
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[2.5px] origin-left bg-[#0891B2]"
      style={{ scaleX }}
    />
  )
}

/* ── Copy button ─────────────────────────────────────────────── */
function CopyButton({ value, label = 'Copy', variant = 'ghost', size = 'sm', className }) {
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
      className={cn('rounded-lg', className)}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? 'Copied' : label}
    </Button>
  )
}

/* ── Reading tabs ────────────────────────────────────────────── */
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
    <div className="sticky top-14 z-10 -mx-2 mb-2 flex items-center gap-5 overflow-x-auto border-b border-border bg-background/90 px-2 backdrop-blur scrollbar-none">
      {tabs.map((tab) => {
        const isActive = active === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => jump(tab.id)}
            className={cn(
              'relative inline-flex items-baseline gap-2 py-3 text-[13px] font-medium transition-colors',
              isActive ? 'text-[#0891B2]' : 'text-ink-3 hover:text-ink',
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
                className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-[#0891B2]"
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

/* ── Abstract block ──────────────────────────────────────────── */
function AbstractBlock({ text }) {
  const [expanded, setExpanded] = useState(false)
  const { i18n } = useTranslation()
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
  const uiIsEnglish = i18n.language === 'en'

  return (
    <div>
      <div className="space-y-4 font-serif text-[17.5px] leading-[1.78] text-ink">
        {visible.map((paragraph, index) => {
          const isRtl = startsWithRtl(paragraph)
          const showDropCap = index === 0 && uiIsEnglish && !isRtl
          if (!showDropCap) {
            return (
              <p key={index} dir="auto" className="whitespace-pre-wrap break-words">
                <MentionText text={paragraph} />
              </p>
            )
          }
          const firstChar = paragraph.charAt(0)
          const rest = paragraph.slice(1)
          return (
            <p key={index} dir="auto" className="whitespace-pre-wrap break-words">
              <span
                aria-hidden
                className="float-left mr-2 mt-1 font-serif text-[64px] font-semibold leading-[0.85] tracking-[-0.04em] text-[#0891B2] sm:text-[80px]"
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
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border bg-paper px-3.5 py-1.5 text-[12px] font-medium text-ink-2 transition-colors hover:border-[#0891B2]/40 hover:text-[#0891B2]"
        >
          {expanded ? 'Hide full abstract' : 'Show full abstract'}
          <ChevronDown className={cn('size-3.5 transition-transform', expanded && 'rotate-180')} />
        </button>
      ) : null}
    </div>
  )
}

/* ── Action bar button ───────────────────────────────────────── */
function ResearchAction({ icon: Icon, filled, label, onClick, disabled, active, tone = 'neutral' }) {
  const tones = {
    neutral: 'border-border text-ink-2 hover:border-[#0891B2]/40 hover:text-[#0891B2]',
    rose: 'border-rose-300 bg-rose-50 text-rose-600',
    cyan: 'border-[#67E8F9] bg-[#ECFEFF] text-[#0891B2]',
    primary: 'border-[#0891B2] bg-[#0891B2] text-white hover:bg-[#0E7490]',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-lg border px-3.5 text-[12.5px] font-medium transition-colors disabled:opacity-50',
        active ? tones[tone] : tones.neutral,
        tone === 'primary' && tones.primary,
      )}
    >
      {Icon ? (
        <Icon className={cn('size-[15px]', filled && 'fill-current')} strokeWidth={1.8} />
      ) : null}
      {label}
    </button>
  )
}

/* ── Editorial hero ──────────────────────────────────────────── */
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
  const coAuthors = Array.isArray(research.coAuthors) ? research.coAuthors : []

  const publishedDate = research.publishedAt ? new Date(research.publishedAt) : null
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
    { value: research.reactionCount, label: 'Likes' },
    { value: research.commentCount, label: 'Comments' },
    { value: research.citationCount, label: 'Citations' },
    { value: research.saveCount, label: 'Saves' },
    { value: research.shareCount, label: 'Shares' },
    { value: research.downloadCount, label: 'Downloads' },
  ]

  const allAuthors = [leadAuthor, ...coAuthors]
  const authorNames = allAuthors
    .map((a) => getFullName(a) || getHandle(a))
    .filter(Boolean)
    .join(', ')

  return (
    <section className="relative isolate space-y-7 pb-2">
      {/* Identifier strip */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-[10.5px] uppercase tracking-wider text-ink-3">
        {statusMeta ? (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em]',
              statusMeta.tone,
            )}
          >
            <Check className="size-3" strokeWidth={2.4} />
            {statusMeta.label}
          </span>
        ) : null}
        {research.ircId ? (
          <>
            <span aria-hidden className="text-ink-4">·</span>
            <span className="tabular-nums">{research.ircId}</span>
          </>
        ) : null}
        {research.doi ? (
          <>
            <span aria-hidden className="text-ink-4">·</span>
            <a
              href={`https://doi.org/${research.doi}`}
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-[#0891B2] hover:underline"
              title="Open DOI in a new tab"
            >
              DOI: {research.doi}
            </a>
          </>
        ) : null}
        <span className="inline-flex items-center gap-1.5">
          <VisibilityIcon className="size-3" strokeWidth={1.7} />
          {visibility.label}
        </span>
        {readingMinutes ? (
          <>
            <span aria-hidden className="text-ink-4">·</span>
            <span>{readingMinutes} min read</span>
          </>
        ) : null}
      </div>

      {/* Cover */}
      {cover ? (
        <div className="relative aspect-[16/6] w-full overflow-hidden rounded-2xl bg-secondary">
          <img src={cover} alt={research.title} className="h-full w-full object-cover" />
          <span
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-paper to-transparent"
          />
        </div>
      ) : null}

      {/* Title */}
      <h1
        dir="auto"
        className="font-display text-[32px] font-semibold leading-[1.08] tracking-[-0.02em] text-ink sm:text-[42px]"
      >
        {research.title}
      </h1>

      {/* Authors + date + follow */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border-b border-border pb-7">
        <div className="flex items-center gap-4">
          <div className="flex -space-x-2.5">
            {allAuthors.slice(0, 5).map((author, i) => (
              <Link
                key={author.id ?? author.username ?? i}
                to={author.username ? `/profile/${getRawUsername(author)}` : '#'}
                className="relative block rounded-full ring-2 ring-paper"
                style={{ zIndex: allAuthors.length - i }}
                title={getFullName(author) || getHandle(author) || 'Author'}
              >
                <UserAvatar user={author} className="size-11 rounded-full" />
              </Link>
            ))}
          </div>
          <div className="leading-tight">
            <p className="font-display text-[15px] font-medium tracking-[-0.005em] text-ink">
              {authorNames}
            </p>
            {dateLabel ? (
              <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-ink-3">
                Published {dateLabel}
              </p>
            ) : null}
          </div>
        </div>
        {leadAuthor.username ? (
          <Link
            to={`/profile/${leadAuthor.username}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#0891B2] bg-paper px-4 py-2 text-[12.5px] font-medium text-[#0891B2] transition-colors hover:bg-[#ECFEFF]"
          >
            <span className="text-[15px] leading-none">+</span>
            Follow {coAuthors.length ? 'authors' : 'author'}
          </Link>
        ) : null}
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-2">
        <ResearchAction
          icon={Heart}
          filled={reactionActive}
          active={reactionActive}
          tone="rose"
          label={
            reactionCooldown > 0
              ? `${reactionCooldown}s`
              : reactionActive
                ? 'Liked'
                : 'Like'
          }
          disabled={working || reactionCooldown > 0}
          onClick={() => (reactionActive ? onClearReaction() : onPickReaction('LIKE'))}
        />
        <ResearchAction
          icon={research.currentUserSaved ? BookmarkCheck : Bookmark}
          active={Boolean(research.currentUserSaved)}
          tone="cyan"
          label={
            saveCooldown > 0
              ? `Wait ${saveCooldown}s`
              : research.currentUserSaved
                ? 'Saved'
                : 'Save'
          }
          disabled={saveCooldown > 0}
          onClick={onSave}
        />
        <ResearchAction icon={Quote} label="Cite" onClick={onCite} />
        <ResearchAction icon={Share2} label="Share" onClick={onShare} />
        {downloadsEnabled && (research.mediaFiles?.length ?? 0) > 0 ? (
          <ResearchAction
            icon={Download}
            label="Download"
            tone="primary"
            active
            onClick={onDownload}
          />
        ) : null}
      </div>

      {/* Metric strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {metrics.map(({ value, label }) => (
          <div
            key={label}
            className="rounded-xl border border-border px-4 py-3"
          >
            <p className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink-3">
              {label}
            </p>
            <p className="mt-1.5 font-display text-[20px] font-semibold leading-none tabular-nums text-ink">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={value ?? 0}
                  initial={{ y: 8, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -8, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 460, damping: 30 }}
                  className="inline-block"
                >
                  {formatNumber(value ?? 0)}
                </motion.span>
              </AnimatePresence>
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ── Sticky compact title bar ────────────────────────────────── */
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
      className="pointer-events-auto fixed inset-x-0 top-0 z-40 hidden border-b border-border bg-background/90 backdrop-blur lg:block"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2 sm:px-6">
        <UserAvatar user={author} className="size-7 rounded-full" />
        <div className="min-w-0 flex-1">
          <p dir="auto" className="truncate text-[13px] font-semibold tracking-tight">
            {research.title}
          </p>
          <p className="truncate text-[11px] text-ink-3">
            {research.researcherFullName ?? getHandle(author)}
          </p>
        </div>
        <div className="hidden items-center gap-1.5 sm:flex">
          <button
            type="button"
            onClick={() =>
              research.currentUserReactionType ? onReact(null) : onReact('LIKE')
            }
            disabled={working || reactionCooldown > 0}
            className={cn(
              'inline-flex h-8 items-center gap-1 rounded-lg border px-3 text-[12px] font-medium transition-colors',
              research.currentUserReactionType
                ? 'border-rose-300 bg-rose-50 text-rose-600'
                : 'border-border text-ink-2 hover:text-ink',
            )}
          >
            <Heart
              className={cn('size-3.5', research.currentUserReactionType && 'fill-current')}
              strokeWidth={1.8}
            />
            {research.currentUserReactionType ? 'Liked' : 'Like'}
          </button>
          <button
            type="button"
            onClick={onSave}
            className={cn(
              'inline-flex h-8 items-center gap-1 rounded-lg border px-3 text-[12px] font-medium transition-colors',
              research.currentUserSaved
                ? 'border-[#67E8F9] bg-[#ECFEFF] text-[#0891B2]'
                : 'border-border text-ink-2 hover:text-ink',
            )}
          >
            {research.currentUserSaved ? (
              <BookmarkCheck className="size-3.5" />
            ) : (
              <Bookmark className="size-3.5" />
            )}
            {research.currentUserSaved ? 'Saved' : 'Save'}
          </button>
          <button
            type="button"
            onClick={onShare}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-3 text-[12px] font-medium text-ink-2 transition-colors hover:text-ink"
          >
            <Share2 className="size-3.5" />
            Share
          </button>
        </div>
      </div>
    </motion.div>
  )
}

/* ── Keyword card ────────────────────────────────────────────── */
function KeywordCard({ keywords, tags }) {
  if (!keywords.length && !tags?.length) return null
  return (
    <Card className="overflow-hidden rounded-2xl border-border bg-card">
      <CardContent className="space-y-3 p-4">
        {tags?.length ? (
          <div className="space-y-1.5">
            <p className="font-mono text-[9.5px] font-medium uppercase tracking-[0.14em] text-ink-3">
              Tags
            </p>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-[#ECFEFF] px-2.5 py-0.5 font-mono text-[11px] text-[#0891B2]"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        {keywords.length ? (
          <div className="space-y-1.5">
            <p className="font-mono text-[9.5px] font-medium uppercase tracking-[0.14em] text-ink-3">
              Keywords
            </p>
            <div className="flex flex-wrap gap-1.5">
              {keywords.map((keyword) => (
                <span
                  key={keyword}
                  className="inline-flex items-center rounded-full border border-border bg-paper px-2.5 py-0.5 text-[11px] text-ink"
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

/* ── Citation card ───────────────────────────────────────────── */
function CitationCard({ research }) {
  if (!research.citation && !research.shareUrl) return null
  return (
    <Card
      id="research-citations"
      className="overflow-hidden rounded-2xl border-border bg-card scroll-mt-24"
    >
      <CardContent className="space-y-4 p-4">
        {research.citation ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 font-mono text-[9.5px] font-medium uppercase tracking-[0.14em] text-ink-3">
                <Quote className="size-3" />
                How to cite
              </p>
              <CopyButton value={research.citation} label="Copy" />
            </div>
            <p className="whitespace-pre-wrap rounded-xl border border-dashed border-border bg-secondary/40 p-3 font-serif text-[13px] leading-relaxed">
              {research.citation}
            </p>
          </div>
        ) : null}

        {research.shareUrl ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 font-mono text-[9.5px] font-medium uppercase tracking-[0.14em] text-ink-3">
                <Link2 className="size-3" />
                Share link
              </p>
              <CopyButton value={research.shareUrl} label="Copy" />
            </div>
            <code className="block truncate rounded-lg border border-border bg-secondary px-2.5 py-1.5 font-mono text-[11px] text-ink-3">
              {research.shareUrl}
            </code>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

/* ── Media file tile ─────────────────────────────────────────── */
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
        className="flex aspect-[4/3] items-center justify-center bg-secondary/60 p-6 transition-opacity hover:opacity-90"
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-paper shadow-sm">
            <FileText className="size-6 text-ink-3" />
          </span>
          <span className="text-[12px] font-medium text-ink">
            Open {media.mimeType?.split('/')?.[1]?.toUpperCase() ?? 'file'}
          </span>
        </div>
      </a>
    )
  })()

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      {Body}
      <div className="flex items-start justify-between gap-3 px-3.5 py-2.5 text-[12px]">
        <div className="min-w-0 flex-1">
          {media.caption || media.originalFileName ? (
            <p className="truncate font-medium text-ink">
              {media.caption || media.originalFileName}
            </p>
          ) : null}
          <div className="mt-0.5 flex items-center gap-2 text-ink-3">
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
            className="shrink-0 text-ink-3 transition-colors hover:text-ink"
            title="Open original"
          >
            <ExternalLink className="size-3.5" />
          </a>
        ) : null}
      </div>
    </div>
  )
}

/* ── Source / reference item ─────────────────────────────────── */
function SourceItem({ source, index }) {
  const typeLabel = SOURCE_TYPE_LABEL[source.sourceType] ?? 'Reference'
  return (
    <li className="relative pl-10">
      <span
        className="absolute left-0 top-1 grid size-7 place-items-center rounded-full border border-border bg-paper font-mono text-[11px] font-semibold tabular-nums text-ink-3"
        aria-hidden
      >
        {index + 1}
      </span>
      <div className="space-y-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-wider text-ink-3">
            {typeLabel}
          </span>
          <p className="font-serif text-[15px] font-semibold leading-snug text-ink">
            {source.title}
          </p>
        </div>
        {source.citationText ? (
          <p className="whitespace-pre-wrap font-serif text-[13.5px] leading-relaxed text-ink-3">
            {source.citationText}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[11px]">
          {source.doi ? (
            <a
              href={`https://doi.org/${source.doi}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[#0891B2] hover:underline"
            >
              <Link2 className="size-3" />
              DOI · {source.doi}
            </a>
          ) : null}
          {source.isbn ? (
            <span className="inline-flex items-center gap-1 text-ink-3">
              ISBN · {source.isbn}
            </span>
          ) : null}
          {source.url && !source.doi ? (
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[#0891B2] hover:underline"
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
              className="inline-flex items-center gap-1 text-[#0891B2] hover:underline"
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

/* ── Section heading ─────────────────────────────────────────── */
function SectionHeading({ icon: Icon, title, count }) {
  return (
    <div className="flex items-center gap-2">
      {Icon ? <Icon className="size-3.5 text-ink-3" /> : null}
      <h2 className="font-mono text-[9.5px] font-medium uppercase tracking-[0.16em] text-ink-3">
        {title}
      </h2>
      {count != null ? (
        <span className="text-[11px] text-ink-3">· {count}</span>
      ) : null}
      <span className="ml-2 h-px flex-1 bg-border" aria-hidden />
    </div>
  )
}

/* ── Mobile sticky action bar ────────────────────────────────── */
function MobileStickyActions({ research, working, onPick, onClear, onSave, onShare }) {
  const liked = Boolean(research.currentUserReactionType)
  const reactionCooldown = useCooldown('reaction')
  return (
    <div
      className="fixed inset-x-0 z-30 mx-3 flex items-center gap-1 rounded-full border border-border bg-background/95 p-1 backdrop-blur lg:hidden"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 4.5rem)' }}
    >
      <button
        type="button"
        onClick={() => (liked ? onClear() : onPick('LIKE'))}
        disabled={working || reactionCooldown > 0}
        className={cn(
          'inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full text-[12.5px] font-medium transition-colors',
          liked ? 'bg-rose-50 text-rose-600' : 'text-ink-3',
        )}
      >
        <Heart className={cn('size-4', liked && 'fill-current')} strokeWidth={1.8} />
        {reactionCooldown > 0 ? `${reactionCooldown}s` : liked ? 'Liked' : 'Like'}
      </button>
      <button
        type="button"
        onClick={onSave}
        className={cn(
          'inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full text-[12.5px] font-medium transition-colors',
          research.currentUserSaved ? 'bg-[#ECFEFF] text-[#0891B2]' : 'text-ink-3',
        )}
      >
        {research.currentUserSaved ? (
          <BookmarkCheck className="size-4" />
        ) : (
          <Bookmark className="size-4" />
        )}
        Save
      </button>
      <button
        type="button"
        onClick={onShare}
        className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full text-[12.5px] font-medium text-ink-3"
      >
        <Share2 className="size-4" />
        Share
      </button>
    </div>
  )
}

/* ── Video promo ─────────────────────────────────────────────── */
function VideoPromo({ url, thumbnail, duration }) {
  const [playing, setPlaying] = useState(false)
  if (!url) return null
  const thumbUrl = resolveMediaUrl(thumbnail)
  const videoUrl = resolveMediaUrl(url)

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-black">
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
          className="group relative block aspect-video w-full overflow-hidden"
          aria-label="Play promo"
        >
          {thumbUrl ? (
            <img
              src={thumbUrl}
              alt="Video promo"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#1A1F2E] to-[#0B0E16]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-black/15" />
          <span className="absolute inset-0 grid place-items-center">
            <motion.span
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22 }}
              className="grid size-[84px] place-items-center rounded-full bg-white text-black shadow-xl"
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

/* ─── ResearchDetailPage ─────────────────────────────────────── */
export function ResearchDetailPage() {
  const { idOrSlug } = useParams()
  const navigate = useNavigate()
  const { user: currentUser, isAuthenticated } = useAuth()
  const toast = useToast()

  const { i18n: i18nInst } = useTranslation()

  const articleRef = useRef(null)
  const heroRef = useRef(null)
  const commentsRef = useRef(null)
  const [showStickyBar, setShowStickyBar] = useState(false)

  const [research, setResearch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [lifecycleWorking, setLifecycleWorking] = useState(false)

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
          if (data) seedFromResponse('research', data, { authoritative: true })
        }
        if (data?.id) recordResearchView(data.id).catch(() => {})
      } catch (error) {
        if (!cancelled) {
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
      REACTION_ADDED: (payload) => {
        const id = research?.id
        if (!payload || !id) return
        if (currentUser?.id && payload.actorId === currentUser.id) return
        const next = payload.reactionCount
        if (next == null) return
        setCounter('research', id, 'rx', next)
        setResearch((current) => (current ? { ...current, reactionCount: next } : current))
      },
      REACTION_REMOVED: (payload) => {
        const id = research?.id
        if (!payload || !id) return
        if (currentUser?.id && payload.actorId === currentUser.id) return
        const next = payload.reactionCount
        if (next == null) return
        setCounter('research', id, 'rx', next)
        setResearch((current) => (current ? { ...current, reactionCount: next } : current))
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
      const result = await shareResearch(research.id)
      const url =
        result?.shortUrl ??
        result?.canonicalUrl ??
        (typeof result === 'string' ? result : null) ??
        window.location.href
      if (navigator.share) {
        await navigator.share({ title: research.title, url })
      } else {
        await navigator.clipboard.writeText(url)
        toast.success('Link copied to clipboard.')
      }
      setResearch((current) => ({
        ...current,
        shareUrl: url,
        shareCount: result?.shareCount ?? (current?.shareCount ?? 0) + 1,
      }))
    } catch {
      /* user cancelled or unsupported */
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

  const keywords = useMemo(() => parseKeywords(research?.keywords), [research?.keywords])
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
        <Skeleton className="aspect-[16/7] w-full rounded-2xl" />
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

  const isOwner = Boolean(currentUser?.id && currentUser.id === research.researcherId)
  const visibility = VISIBILITY_META[research.visibility] ?? VISIBILITY_META.PUBLIC
  const scheduledDate = research.scheduledPublishAt
    ? new Date(research.scheduledPublishAt)
    : null
  const status = research.status ?? null
  const commentsEnabled = research.commentsEnabled !== false
  const downloadsEnabled = research.downloadsEnabled !== false

  const description = research.description ?? ''
  const descriptionIsRtl = startsWithRtl(description)
  const uiIsEnglish = i18nInst.language === 'en'
  const dropCap = uiIsEnglish && !descriptionIsRtl ? description.trim().charAt(0) : ''
  const descriptionRest = dropCap ? description.trim().slice(1) : description.trim()

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
          className="rounded-lg text-ink-3 hover:text-ink"
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
              className="rounded-lg"
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
                  className="rounded-lg"
                  title="More actions"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-xl">
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
        <main className="space-y-10 lg:col-span-8">
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
                      className="rounded-full bg-[#ECFEFF] px-2.5 py-1 font-mono text-[11px] text-[#0891B2]"
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
              <div dir="auto" className="font-serif text-[18px] leading-[1.78] text-ink">
                {dropCap ? (
                  <span
                    aria-hidden
                    className="float-left mr-3 mt-1 font-serif text-[64px] font-semibold leading-none tracking-[-0.04em] text-[#0891B2] sm:text-[80px]"
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
            <section id="research-references" className="space-y-3 scroll-mt-24">
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

          {/* Discussion */}
          <section id="research-discussion" className="space-y-4 scroll-mt-24">
            <SectionHeading
              icon={MessageCircle}
              title="Discussion"
              count={formatNumber(research.commentCount ?? 0)}
            />

            {!commentsEnabled ? (
              <p className="rounded-2xl border border-dashed border-border bg-secondary/40 px-4 py-3 text-[13px] text-ink-3">
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

        {/* Right rail */}
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
