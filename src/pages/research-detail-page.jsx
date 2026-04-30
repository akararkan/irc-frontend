import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive,
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Calendar,
  Check,
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
import { motion, useScroll, useSpring } from 'motion/react'

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
import { ReactionPicker } from '@/components/app/reaction-picker'
import { ReactionSummary } from '@/components/app/reaction-summary'
import { RoleBadge } from '@/components/app/role-badge'
import { UserAvatar } from '@/components/app/user-avatar'
import {
  addResearchComment,
  archiveResearch,
  deleteResearch,
  getResearch,
  getResearchBySlug,
  getResearchComments,
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
import { useAuth } from '@/features/auth/auth-context'
import { useToast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import { extractApiMessage } from '@/lib/api-error'
import {
  displayTime,
  formatNumber,
  getFullName,
  resolveMediaUrl,
} from '@/lib/format'
const VISIBILITY_META = {
  PUBLIC: { label: 'Public', icon: Globe, hint: 'Anyone can read' },
  FOLLOWERS_ONLY: { label: 'Followers', icon: Users, hint: 'Only your followers' },
  PRIVATE: { label: 'Private', icon: Lock, hint: 'Only you' },
}

const STATUS_META = {
  PUBLISHED: { label: 'Published', tone: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
  DRAFT: { label: 'Draft', tone: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  ARCHIVED: { label: 'Archived', tone: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-400' },
  RETRACTED: { label: 'Retracted', tone: 'bg-rose-500/15 text-rose-700 dark:text-rose-400' },
  SCHEDULED: { label: 'Scheduled', tone: 'bg-sky-500/15 text-sky-700 dark:text-sky-400' },
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

// ─── Editorial hero ─────────────────────────────────────────────────
function EditorialHero({ research, status, visibility, scheduledDate, readingMinutes }) {
  const cover = resolveMediaUrl(research.coverImageUrl)
  const VisibilityIcon = visibility.icon
  const statusMeta = STATUS_META[status] ?? null

  return (
    <section className="relative isolate overflow-hidden rounded-[28px] border border-border bg-card shadow-[0_24px_60px_-30px_oklch(0_0_0/0.20)]">
      {/* Top: cover or generative gradient */}
      <div className="relative aspect-[16/7] w-full overflow-hidden bg-muted">
        {cover ? (
          <img
            src={cover}
            alt={research.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              backgroundImage: [
                'radial-gradient(60% 80% at 18% 20%, oklch(0.62 0.12 285 / 0.42), transparent 60%)',
                'radial-gradient(50% 70% at 82% 30%, oklch(0.72 0.14 75 / 0.38), transparent 60%)',
                'radial-gradient(60% 80% at 50% 110%, oklch(0.62 0.13 38 / 0.30), transparent 60%)',
                'linear-gradient(135deg, oklch(0.97 0.005 250), oklch(0.92 0.008 250))',
              ].join(','),
            }}
          />
        )}
        {/* Subtle dot texture over cover */}
        <span
          aria-hidden
          className="absolute inset-0 opacity-[0.07] mix-blend-multiply"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, oklch(0 0 0) 1px, transparent 0)',
            backgroundSize: '20px 20px',
          }}
        />
        {cover ? (
          <span
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-card via-card/60 to-transparent"
          />
        ) : null}
      </div>

      {/* Title block — sits over the hero bottom */}
      <div className="-mt-20 space-y-5 px-6 pb-7 sm:-mt-24 sm:px-10 sm:pb-9">
        {/* Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {statusMeta ? (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]',
                statusMeta.tone,
              )}
            >
              <span className="size-1.5 rounded-full bg-current" />
              {statusMeta.label}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/80 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground backdrop-blur">
            <VisibilityIcon className="size-3" />
            {visibility.label}
          </span>
          {research.ircId ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/80 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground backdrop-blur">
              <Hash className="size-3" />
              {research.ircId}
            </span>
          ) : null}
          {research.publishedAt ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Calendar className="size-3" />
              {displayTime(research)}
            </span>
          ) : scheduledDate ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Calendar className="size-3" />
              Scheduled · {scheduledDate.toLocaleDateString()}
            </span>
          ) : null}
          {readingMinutes ? (
            <span className="text-[11px] text-muted-foreground">
              · {readingMinutes} min read
            </span>
          ) : null}
        </div>

        {/* Title */}
        <h1 className="font-serif text-[34px] font-semibold leading-[1.08] tracking-[-0.015em] text-foreground sm:text-[44px]">
          {research.title}
        </h1>

        {/* DOI */}
        {research.doi ? (
          <a
            href={`https://doi.org/${research.doi}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
          >
            <Link2 className="size-3.5" />
            DOI · {research.doi}
          </a>
        ) : null}
      </div>
    </section>
  )
}

// ─── Sticky compact title bar (appears on scroll) ───────────────────
function StickyTitleBar({ visible, research, onReact, onSave, onShare, working }) {
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
      className="pointer-events-auto fixed inset-x-0 top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2 sm:px-6">
        <UserAvatar user={author} className="size-7" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold tracking-tight">
            {research.title}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {research.researcherFullName ?? author.username}
          </p>
        </div>
        <div className="hidden items-center gap-1 sm:flex">
          <ReactionPicker
            current={research.currentUserReactionType}
            onSelect={onReact}
            onClear={() => onReact(null)}
            disabled={working}
            reactionSet="research"
            trigger={({ toggleDefault, current }) => (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={toggleDefault}
                className={cn(
                  'h-7 rounded-full gap-1 transition-all duration-200 active:scale-95',
                  current && cn(current.color, current.bg, current.ring),
                )}
              >
                <span className="text-[14px] leading-none">
                  {current?.emoji ?? '👍'}
                </span>
                <span>{current?.label ?? 'React'}</span>
              </Button>
            )}
          />
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
          <Link to={`/profile/${author.username ?? ''}`} className="shrink-0">
            <UserAvatar
              user={author}
              className="size-12 ring-2 ring-background shadow-sm"
            />
          </Link>
          <div className="min-w-0">
            <Link
              to={`/profile/${author.username ?? ''}`}
              className="block truncate text-sm font-semibold hover:underline"
            >
              {getFullName(author) || author.username}
            </Link>
            <p className="truncate text-xs text-muted-foreground">
              @{author.username}
            </p>
          </div>
          <RoleBadge role="RESEARCHER" size="xs" className="ml-auto shrink-0" />
        </div>
        <Button
          asChild
          variant="outline"
          size="sm"
          className="h-8 w-full justify-center rounded-full"
        >
          <Link to={`/profile/${author.username ?? ''}`}>View profile</Link>
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
  return (
    <Card className="overflow-hidden rounded-2xl border border-border bg-card">
      <CardContent className="space-y-2 p-3">
        <ReactionPicker
          current={research.currentUserReactionType}
          onSelect={onPick}
          onClear={onClear}
          disabled={working}
          reactionSet="research"
          trigger={({ toggleDefault, current }) => (
            <Button
              type="button"
              variant="outline"
              onClick={toggleDefault}
              className={cn(
                'h-10 w-full justify-start gap-2 rounded-xl transition-all duration-200 active:scale-[0.98]',
                current && cn(current.color, current.bg, current.ring),
              )}
            >
              <span className="text-[16px] leading-none">
                {current?.emoji ?? '👍'}
              </span>
              <span className="font-medium">{current?.label ?? 'React'}</span>
              <span className="ml-auto font-mono text-xs tabular-nums text-muted-foreground">
                {formatNumber(research.reactionCount ?? 0)}
              </span>
            </Button>
          )}
        />
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
    <Card className="overflow-hidden rounded-2xl border border-border bg-card">
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

// ─── Comment item ───────────────────────────────────────────────────
function ResearchComment({ comment }) {
  const author = {
    username: comment.userUsername,
    profileImage: comment.userProfileImage,
    fullName: comment.userFullName,
  }
  return (
    <div className="flex items-start gap-3">
      <Link to={`/profile/${author.username ?? ''}`}>
        <UserAvatar user={author} className="size-9" />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl rounded-tl-md bg-muted px-3.5 py-2.5">
          <Link
            to={`/profile/${author.username ?? ''}`}
            className="block truncate text-sm font-semibold hover:underline"
          >
            {comment.userFullName ?? author.username}
          </Link>
          <p className="mt-0.5 whitespace-pre-wrap text-[14px] leading-[1.45]">
            {comment.content}
          </p>
        </div>
        <p className="mt-1 pl-3 text-[11px] text-muted-foreground">
          {displayTime(comment)}
          {comment.isEdited ? ' · (edited)' : ''}
        </p>
      </div>
    </div>
  )
}

// ─── Mobile sticky action bar ───────────────────────────────────────
function MobileStickyActions({ research, working, onPick, onSave, onShare }) {
  return (
    <div className="fixed inset-x-0 bottom-3 z-30 mx-3 flex items-center gap-1 rounded-full border border-border bg-background/95 p-1 shadow-[0_18px_40px_-20px_oklch(0_0_0/0.25)] backdrop-blur lg:hidden">
      <ReactionPicker
        current={research.currentUserReactionType}
        onSelect={onPick}
        disabled={working}
        reactionSet="research"
        trigger={({ toggleDefault, current }) => (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggleDefault}
            className={cn(
              'h-9 flex-1 gap-1.5 rounded-full transition-all duration-200 active:scale-95',
              current
                ? cn(current.color, current.bg, 'ring-1', current.ring)
                : 'text-muted-foreground',
            )}
          >
            <span className="text-[16px] leading-none">
              {current?.emoji ?? '👍'}
            </span>
            <span className="font-medium">{current?.label ?? 'React'}</span>
          </Button>
        )}
      />
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
  const [showStickyBar, setShowStickyBar] = useState(false)

  const [research, setResearch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [comments, setComments] = useState([])
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
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
        if (!cancelled) setResearch(data)
        if (data?.id) recordResearchView(data.id).catch(() => {})
      } catch (error) {
        if (!cancelled) {
          toast.error(extractApiMessage(error, 'Could not load research.'))
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

  // Load comments
  useEffect(() => {
    if (!research?.id) return undefined
    let cancelled = false
    async function loadComments() {
      setCommentsLoading(true)
      try {
        const data = await getResearchComments(research.id, { page: 0, size: 30 })
        if (!cancelled) setComments(data?.content ?? [])
      } catch {
        if (!cancelled) setComments([])
      } finally {
        if (!cancelled) setCommentsLoading(false)
      }
    }
    loadComments()
    return () => {
      cancelled = true
    }
  }, [research?.id])

  async function handlePickReaction(type) {
    if (!isAuthenticated) {
      toast.info('Sign in to react.')
      return
    }
    if (working) return
    if (type == null) return handleClearReaction()
    const previous = research
    setResearch((current) => ({
      ...current,
      currentUserReacted: true,
      currentUserReactionType: type,
      reactionCount: current?.currentUserReacted
        ? current.reactionCount
        : (current?.reactionCount ?? 0) + 1,
    }))
    setWorking(true)
    try {
      await reactToResearch(research.id, type)
    } catch (error) {
      setResearch(previous)
      toast.error(extractApiMessage(error, 'Could not react.'))
    } finally {
      setWorking(false)
    }
  }

  async function handleClearReaction() {
    if (working || !research?.currentUserReacted) return
    const previous = research
    setResearch((current) => ({
      ...current,
      currentUserReacted: false,
      currentUserReactionType: null,
      reactionCount: Math.max(0, (current?.reactionCount ?? 0) - 1),
    }))
    setWorking(true)
    try {
      await removeResearchReaction(research.id)
    } catch (error) {
      setResearch(previous)
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
    try {
      if (research.currentUserSaved) {
        await unsaveResearch(research.id)
        setResearch((current) => ({
          ...current,
          currentUserSaved: false,
          saveCount: Math.max(0, (current?.saveCount ?? 0) - 1),
        }))
      } else {
        await saveResearch(research.id)
        setResearch((current) => ({
          ...current,
          currentUserSaved: true,
          saveCount: (current?.saveCount ?? 0) + 1,
        }))
        toast.success('Saved to your library.')
      }
    } catch (error) {
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

  async function handleSubmitComment(event) {
    event.preventDefault()
    const value = commentText.trim()
    if (!value || submittingComment) return
    setSubmittingComment(true)
    try {
      const created = await addResearchComment(research.id, { content: value })
      setComments((current) => [created, ...current])
      setCommentText('')
      setResearch((current) => ({
        ...current,
        commentCount: (current?.commentCount ?? 0) + 1,
      }))
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not post comment.'))
    } finally {
      setSubmittingComment(false)
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
        title="Research not found"
        description="It may have been removed, unpublished, or set to private."
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
  const dropCap = description.trim().charAt(0)
  const descriptionRest = description.trim().slice(1)

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
        />
      </div>

      {/* Two-column reading area */}
      <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
        {/* Main column */}
        <main className="space-y-10 lg:col-span-8">
          {/* Abstract */}
          {research.abstractText ? (
            <section className="space-y-3">
              <SectionHeading icon={FileText} title="Abstract" />
              <div className="rounded-2xl border border-border bg-muted/30 p-5">
                <p className="whitespace-pre-wrap font-serif text-[15px] leading-[1.7] text-foreground">
                  {research.abstractText}
                </p>
              </div>
            </section>
          ) : null}

          {/* Description */}
          {description ? (
            <section className="space-y-3">
              <SectionHeading icon={Quote} title="Article" />
              <div className="font-serif text-[18px] leading-[1.78] text-foreground">
                {dropCap ? (
                  <span className="float-left mr-3 mt-1 font-serif text-[64px] font-semibold leading-none tracking-[-0.04em] text-foreground sm:text-[80px]">
                    {dropCap}
                  </span>
                ) : null}
                <p className="whitespace-pre-wrap break-words">
                  {descriptionRest}
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
            <section className="space-y-3">
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

          {/* Comments */}
          <section className="space-y-3">
            <SectionHeading
              icon={MessageCircle}
              title="Comments"
              count={formatNumber(research.commentCount ?? comments.length ?? 0)}
            />

            {!commentsEnabled ? (
              <p className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                Comments are disabled for this research.
              </p>
            ) : isAuthenticated ? (
              <form
                onSubmit={handleSubmitComment}
                className="flex items-end gap-2 rounded-2xl border border-border bg-card px-2 py-2"
              >
                <Textarea
                  value={commentText}
                  onChange={(event) => setCommentText(event.target.value)}
                  placeholder="Share your thoughts on this research…"
                  rows={2}
                  className="min-h-9 resize-none rounded-xl border-0 bg-transparent px-3 py-2 text-sm shadow-none focus-visible:ring-0"
                />
                <Button
                  type="submit"
                  size="icon-sm"
                  className="size-9 rounded-full"
                  disabled={submittingComment || !commentText.trim()}
                >
                  {submittingComment ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Send className="size-3.5" />
                  )}
                </Button>
              </form>
            ) : (
              <p className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                <Link
                  to="/login"
                  className="font-medium text-primary hover:underline"
                >
                  Sign in
                </Link>{' '}
                to leave a comment.
              </p>
            )}

            {commentsLoading ? (
              <div className="flex justify-center py-3 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
              </div>
            ) : comments.length === 0 ? (
              <p className="py-2 text-center text-sm text-muted-foreground">
                No comments yet. Be the first to share your thoughts.
              </p>
            ) : (
              <div className="space-y-4">
                {comments.map((comment) => (
                  <ResearchComment key={comment.id} comment={comment} />
                ))}
              </div>
            )}

            {(research.reactionCount ?? 0) > 0 ? (
              <div className="pt-2">
                <ReactionSummary
                  reactionSet="research"
                  totalCount={research.reactionCount ?? 0}
                  topTypes={
                    research.currentUserReactionType
                      ? [research.currentUserReactionType]
                      : ['LIKE']
                  }
                />
              </div>
            ) : null}
          </section>
        </main>

        {/* Right rail */}
        <aside className="lg:col-span-4">
          <div className="space-y-4 lg:sticky lg:top-20">
            <ActionRail
              research={research}
              working={working}
              downloadsEnabled={downloadsEnabled}
              onPick={handlePickReaction}
              onClear={handleClearReaction}
              onSave={handleToggleSave}
              onShare={handleShare}
              onCite={handleRecordCitation}
              onDownload={handleDownload}
            />
            <AuthorCard research={research} />
            <StatsRail research={research} />
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
          className="group/promo relative block aspect-video w-full overflow-hidden"
          aria-label="Play promo"
        >
          {thumbUrl ? (
            <img
              src={thumbUrl}
              alt="Video promo"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover/promo:scale-105"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-950" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />
          <span className="absolute inset-0 grid place-items-center">
            <span className="grid size-16 place-items-center rounded-full bg-white/95 text-black shadow-2xl backdrop-blur transition-transform group-hover/promo:scale-110">
              <Play className="size-7 translate-x-[2px] fill-black" />
            </span>
          </span>
          {duration ? (
            <span className="absolute bottom-3 right-3 rounded-full bg-black/75 px-2 py-0.5 text-xs font-medium text-white backdrop-blur">
              {formatDuration(duration)}
            </span>
          ) : null}
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-black">
            Promo
          </span>
        </button>
      )}
    </div>
  )
}
