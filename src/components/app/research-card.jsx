import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  Bookmark,
  Download,
  Eye,
  Heart,
  MessageCircle,
  Play,
  Quote,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { RoleBadge } from '@/components/app/role-badge'
import { UserAvatar } from '@/components/app/user-avatar'
import { useInView } from '@/hooks/use-in-view'
import { useResearchStream } from '@/hooks/use-research-stream'
import { cn } from '@/lib/utils'
import {
  formatNumber,
  getFullName,
  getHandle,
  resolveMediaUrl,
} from '@/lib/format'
import { RelativeTime } from '@/components/app/relative-time'

// Spec §08 ResearchStatus → pill mapping.
const STATUS_META = {
  PUBLISHED: { label: 'Published', className: 'pill-success' },
  DRAFT:     { label: 'Draft',     className: 'pill-warn' },
  ARCHIVED:  { label: 'Archived',  className: 'pill-mute' },
  RETRACTED: { label: 'Retracted', className: 'pill-danger' },
}

/**
 * ResearchCard — manuscript-cover style paper card.
 *
 * Self-manages its live counters: when the card is in (or near) the
 * viewport, it subscribes to its per-research SSE channel and patches
 * `viewCount`, `downloadCount`, `reactionCount`, `commentCount`,
 * `saveCount`, `shareCount`, and `citationCount` as the backend
 * broadcasts them. When the card scrolls offscreen the EventSource
 * tears down so a long feed doesn't hold a dozen open connections.
 *
 * Counts are wrapped in `LiveCount` which animates a subtle pulse on
 * change so the reader's eye registers the bump.
 */
export function ResearchCard({ item: incoming }) {
  // Local mirror so SSE-driven counter updates re-render the card
  // without forcing every caller to thread an `onChange` prop.
  const [item, setItem] = useState(incoming)

  // Sync from props when the parent passes a fresh row (e.g. a new
  // page lands, or the parent invalidates after a write). We compare
  // by id so SSE patches don't get clobbered by a parent re-render
  // that's still holding the older snapshot.
  useEffect(() => {
    setItem((current) =>
      current?.id === incoming?.id ? { ...current, ...incoming } : incoming,
    )
  }, [incoming])

  const [setLiveRef, inView] = useInView({ rootMargin: '300px 0px 300px 0px' })

  const patch = useCallback(
    (next) => setItem((current) => ({ ...current, ...next })),
    [],
  )

  useResearchStream(
    item?.id,
    {
      RESEARCH_UPDATED: (payload) => {
        if (!payload?.id) return
        // Preserve viewer-specific bookkeeping the broadcast omits.
        patch({
          ...payload,
          currentUserSaved: item.currentUserSaved,
          currentUserReaction: item.currentUserReaction,
        })
      },
      VIEW_COUNT_UPDATED: (payload) => {
        if (payload?.viewCount == null) return
        patch({ viewCount: payload.viewCount })
      },
      DOWNLOAD_COUNT_UPDATED: (payload) => {
        if (payload?.downloadCount == null) return
        patch({ downloadCount: payload.downloadCount })
      },
      SAVE_COUNT_UPDATED: (payload) => {
        if (payload?.saveCount == null) return
        patch({ saveCount: payload.saveCount })
      },
      SHARE_COUNT_UPDATED: (payload) => {
        if (payload?.shareCount == null) return
        patch({ shareCount: payload.shareCount })
      },
      CITATION_COUNT_UPDATED: (payload) => {
        if (payload?.citationCount == null) return
        patch({ citationCount: payload.citationCount })
      },
      REACTION_ADDED: (payload) => {
        if (payload == null) return
        patch({ reactionCount: payload.reactionCount ?? item.reactionCount })
      },
      REACTION_REMOVED: (payload) => {
        if (payload == null) return
        patch({ reactionCount: payload.reactionCount ?? item.reactionCount })
      },
      COMMENT_CREATED: (payload) => {
        const next = payload?.commentCount ?? (item.commentCount ?? 0) + 1
        patch({ commentCount: next })
      },
      COMMENT_DELETED: (payload) => {
        const next =
          payload?.commentCount ?? Math.max(0, (item.commentCount ?? 0) - 1)
        patch({ commentCount: next })
      },
      REPLY_CREATED: (payload) => {
        const next = payload?.commentCount ?? (item.commentCount ?? 0) + 1
        patch({ commentCount: next })
      },
    },
    { enabled: inView },
  )

  if (!item) return null

  const author = {
    id: item.researcherId,
    username: item.researcherUsername,
    fullName: item.researcherFullName,
    profileImage: item.researcherProfileImage,
    role: 'RESEARCHER',
  }
  const cover = resolveMediaUrl(item.coverImageUrl)
  const videoThumb = resolveMediaUrl(item.videoPromoThumbnailUrl)
  const href = `/research/${item.slug ?? item.id}`
  const status = STATUS_META[item.status] ?? STATUS_META.PUBLISHED
  const hasMedia = Boolean(cover || videoThumb)
  const authorHandle = getHandle(author)
  const authorName = getFullName(author) || authorHandle || 'Researcher'

  return (
    <Link
      ref={setLiveRef}
      to={href}
      className={cn(
        'group card-hover block overflow-hidden rounded-xl border-[0.5px] border-border bg-paper',
      )}
    >
      {hasMedia ? (
        <div className="relative aspect-[5/3] w-full overflow-hidden bg-muted">
          {videoThumb ? (
            <>
              <img
                src={videoThumb}
                alt={item.title}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
              />
              <span className="absolute inset-0 grid place-items-center">
                <span className="grid size-12 place-items-center rounded-full bg-paper/90 text-ink shadow-soft backdrop-blur transition-transform group-hover:scale-110">
                  <Play className="size-5 translate-x-[1px]" />
                </span>
              </span>
            </>
          ) : (
            <img
              src={cover}
              alt={item.title}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
            />
          )}
          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {item.status ? (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium leading-none backdrop-blur',
                    status.className,
                  )}
                >
                  {status.label}
                </span>
              ) : null}
              {item.currentUserSaved ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-ink/85 px-2 py-0.5 text-[11px] font-medium text-paper backdrop-blur">
                  <Bookmark className="size-2.5 fill-current" />
                  Saved
                </span>
              ) : null}
            </div>
            {item.ircId ? (
              <span className="inline-flex items-center rounded-sm bg-paper/90 px-2 py-0.5 font-mono text-[10px] font-medium text-ink-2 backdrop-blur">
                {item.ircId}
              </span>
            ) : null}
          </div>
        </div>
      ) : (
        /* Manuscript "book" cover — a stylized fallback */
        <div
          className="relative grid h-[180px] place-items-center overflow-hidden border-b border-border"
          style={{
            backgroundImage:
              'linear-gradient(135deg, color-mix(in oklch, var(--brand) 12%, var(--paper)) 0 6px, var(--paper) 6px 18px)',
          }}
        >
          <div
            className="relative w-[58%] rounded-l-[4px] rounded-r-[8px] border border-border bg-paper p-3.5"
            style={{
              boxShadow:
                '-4px 0 0 -1px var(--paper), -4px 0 0 0 var(--border), -8px 0 0 -1px var(--paper), -8px 0 0 0 var(--border)',
            }}
          >
            <div className="space-y-1.5">
              <div className="h-[3px] w-[70%] rounded-full bg-brand" />
              <div className="h-[3px] w-full rounded-full bg-ink/10" />
              <div className="h-[3px] w-full rounded-full bg-ink/10" />
              <div className="h-[3px] w-[60%] rounded-full bg-ink/10" />
              <div className="h-[3px] w-[80%] rounded-full bg-ink/10" />
              <div className="h-[3px] w-[55%] rounded-full bg-ink/10" />
            </div>
            <div
              className="mt-3 h-px w-full"
              style={{
                background:
                  'linear-gradient(90deg, transparent, var(--border), transparent)',
              }}
            />
            <div className="mt-3 space-y-1">
              <div className="h-[3px] w-[45%] rounded-full bg-ink/10" />
              <div className="h-[3px] w-[35%] rounded-full bg-ink/10" />
            </div>
          </div>
          {item.peerReviewed ?? item.status === 'PUBLISHED' ? (
            <span
              className="absolute bottom-3.5 right-3.5 size-[26px] rounded-full border-2 border-paper"
              style={{
                background: 'var(--gold)',
                boxShadow:
                  '0 2px 6px -2px color-mix(in oklch, var(--gold) 60%, transparent)',
              }}
              title="Published"
            />
          ) : null}
          {item.ircId ? (
            <span className="absolute right-3 top-3 inline-flex items-center rounded-md bg-paper/90 px-2 py-0.5 font-mono text-[10px] font-medium text-ink-2 backdrop-blur">
              {item.ircId}
            </span>
          ) : null}
        </div>
      )}

      <div className="space-y-3 p-4 sm:p-5 md:p-6">
        {/* Identifier strip per spec §08 — status pill · IRC sequence ·
            DOI · date, mono identifiers separated by hairlines. */}
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-3">
          {!hasMedia && item.status ? (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium leading-none',
                status.className,
              )}
            >
              {status.label}
            </span>
          ) : null}
          {!hasMedia && item.ircId ? (
            <span className="font-mono text-[11px] text-ink-2">{item.ircId}</span>
          ) : null}
          {item.doi ? (
            <>
              <span aria-hidden className="text-ink-4">·</span>
              <span className="font-mono text-[11px]">
                DOI: <span className="text-ink-2">{item.doi}</span>
              </span>
            </>
          ) : null}
          <span aria-hidden className="ml-auto" />
          <RelativeTime
            entity={item}
            title={item.formattedDate || undefined}
            className="font-mono text-[11px]"
          />
        </div>

        {/* Title — Newsreader serif per spec */}
        <h3
          dir="auto"
          className="font-display text-[22px] font-medium leading-[1.15] tracking-[-0.018em] text-ink text-balance group-hover:text-brand transition-colors"
        >
          {item.title}
        </h3>

        {/* Abstract */}
        {item.abstractText || item.description ? (
          <p
            dir="auto"
            className="line-clamp-3 text-[14px] leading-[1.65] text-ink-2"
          >
            {item.abstractText ?? item.description}
          </p>
        ) : null}

        {/* Tags — quiet, monospace hashtag chips */}
        {item.tags?.length ? (
          <div className="flex flex-wrap gap-1.5">
            {item.tags.slice(0, 6).map((tag) => (
              <span
                key={tag}
                className="rounded-sm bg-muted px-2 py-0.5 text-[12px] text-ink-3 transition-colors hover:text-ink"
              >
                #{tag}
              </span>
            ))}
          </div>
        ) : null}

        {/* Footer — author + metric row */}
        <div className="flex items-center gap-3 border-t-[0.5px] border-border pt-3">
          <UserAvatar user={author} className="size-[28px]" />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="block truncate text-[13px] font-medium text-ink">
                {authorName}
              </span>
              <RoleBadge role="RESEARCHER" size="xs" />
            </div>
            {authorHandle ? (
              <p className="truncate font-mono text-[10.5px] text-ink-3">
                @{authorHandle}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-3 text-[11.5px] text-ink-3">
            {item.citationCount ? (
              <LiveCount
                value={item.citationCount}
                icon={Quote}
                label="Citations"
              />
            ) : null}
            <LiveCount
              value={item.viewCount ?? 0}
              icon={Eye}
              label="Views"
              showZero
            />
            <LiveCount
              value={item.reactionCount ?? 0}
              icon={Heart}
              label="Reactions"
              showZero
            />
            <LiveCount
              value={item.commentCount ?? 0}
              icon={MessageCircle}
              label="Comments"
              className="hidden sm:inline-flex"
              showZero
            />
            <LiveCount
              value={item.saveCount ?? 0}
              icon={Bookmark}
              label="Saves"
              className="hidden sm:inline-flex"
              showZero
            />
            <LiveCount
              value={item.downloadCount ?? 0}
              icon={Download}
              label="Downloads"
              className="hidden md:inline-flex"
              showZero
            />
          </div>
        </div>
      </div>
    </Link>
  )
}

/**
 * Single tabular-nums counter that pulses subtly when its value
 * changes. The pulse comes from re-keying the inner span on `value`,
 * so motion's enter animation runs each time the count flips.
 *
 * `showZero` keeps the counter visible at zero (used for view /
 * reaction / comment counts that always belong on the row); without
 * it the counter renders nothing when value is 0 (citations, etc).
 */
export function LiveCount({
  value,
  icon: Icon,
  label,
  className,
  showZero = false,
}) {
  if (!showZero && !value) return null
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 tabular-nums',
        className,
      )}
      title={label}
    >
      {Icon ? <Icon className="size-3.5" /> : null}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: 6, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -6, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 460, damping: 30 }}
          className="inline-block"
        >
          {formatNumber(value)}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
