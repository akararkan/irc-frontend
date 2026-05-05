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
import { cn } from '@/lib/utils'
import { formatNumber, resolveMediaUrl } from '@/lib/format'
import { RelativeTime } from '@/components/app/relative-time'

const STATUS_META = {
  PUBLISHED: {
    label: 'Published',
    className:
      'bg-[color-mix(in_oklch,var(--accent-sage)_14%,transparent)] text-accent-sage ring-[color-mix(in_oklch,var(--accent-sage)_25%,transparent)]',
  },
  DRAFT:     { label: 'Draft',     className: 'bg-muted text-ink-3 ring-border' },
  ARCHIVED:  {
    label: 'Archived',
    className:
      'bg-[color-mix(in_oklch,var(--accent-amber)_14%,transparent)] text-accent-amber ring-[color-mix(in_oklch,var(--accent-amber)_25%,transparent)]',
  },
  RETRACTED: {
    label: 'Retracted',
    className:
      'bg-[color-mix(in_oklch,var(--accent-rust)_14%,transparent)] text-accent-rust ring-[color-mix(in_oklch,var(--accent-rust)_25%,transparent)]',
  },
}

/**
 * ResearchCard — manuscript-cover style paper card.
 * When a real cover image / video thumb exists we still honor it (top
 * media tile); otherwise we render a stylized "book" cover with a gilt
 * peer-review dot. Two-column on desktop, stacked on mobile.
 */
export function ResearchCard({ item }) {
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

  return (
    <Link
      to={href}
      className={cn(
        'group block overflow-hidden rounded-2xl border border-border bg-paper',
        'transition-all hover:-translate-y-px hover:border-brand/25',
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
                    'inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] ring-1 backdrop-blur',
                    status.className,
                  )}
                >
                  {status.label}
                </span>
              ) : null}
              {item.currentUserSaved ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-ink/85 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-paper backdrop-blur">
                  <Bookmark className="size-2.5 fill-current" />
                  Saved
                </span>
              ) : null}
            </div>
            {item.ircId ? (
              <span className="inline-flex items-center rounded-md bg-paper/90 px-2 py-0.5 font-mono text-[10px] font-medium text-ink backdrop-blur">
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

      <div className="space-y-3 p-4 md:p-[18px]">
        {/* Eyebrow row */}
        <div className="flex flex-wrap items-center gap-2.5 text-[12px] text-ink-3">
          {item.category ? (
            <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-gold-2">
              {item.category}
            </span>
          ) : null}
          <RelativeTime entity={item} title={item.formattedDate || undefined} />
          {item.doi ? (
            <>
              <span aria-hidden className="text-ink-4">·</span>
              <span className="font-mono text-[11px]">DOI · {item.doi}</span>
            </>
          ) : null}
        </div>

        {/* Title */}
        <h3 className="font-display text-[19px] font-semibold leading-[1.25] tracking-[-0.012em] text-ink text-balance group-hover:text-brand">
          {item.title}
        </h3>

        {/* Abstract */}
        {item.abstractText || item.description ? (
          <p className="line-clamp-3 text-[13.5px] leading-[1.55] text-ink-3">
            {item.abstractText ?? item.description}
          </p>
        ) : null}

        {/* Tags */}
        {item.tags?.length ? (
          <div className="flex flex-wrap gap-1.5">
            {item.tags.slice(0, 6).map((tag) => (
              <span
                key={tag}
                className="rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-[11px] text-ink-2 transition-colors hover:border-brand/40 hover:bg-brand-soft hover:text-brand"
              >
                #{tag}
              </span>
            ))}
          </div>
        ) : null}

        {/* Footer */}
        <div className="flex items-center gap-3 border-t border-dashed border-border pt-3">
          <UserAvatar user={author} className="size-8" />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="block truncate text-[13px] font-semibold text-ink-2">
                {author.fullName ?? author.username}
              </span>
              <RoleBadge role="RESEARCHER" size="xs" />
            </div>
            <p className="truncate text-[11px] text-ink-3">{author.username}</p>
          </div>
          <div className="flex items-center gap-3 text-[11.5px] text-ink-3">
            {item.citationCount ? (
              <span className="inline-flex items-center gap-1 tabular-nums" title="Citations">
                <Quote className="size-3.5" />
                {formatNumber(item.citationCount)}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1 tabular-nums" title="Views">
              <Eye className="size-3.5" />
              {formatNumber(item.viewCount ?? 0)}
            </span>
            <span className="inline-flex items-center gap-1 tabular-nums" title="Reactions">
              <Heart className="size-3.5" />
              {formatNumber(item.reactionCount ?? 0)}
            </span>
            <span className="hidden items-center gap-1 tabular-nums sm:inline-flex" title="Comments">
              <MessageCircle className="size-3.5" />
              {formatNumber(item.commentCount ?? 0)}
            </span>
            <span className="hidden items-center gap-1 tabular-nums sm:inline-flex" title="Saves">
              <Bookmark className="size-3.5" />
              {formatNumber(item.saveCount ?? 0)}
            </span>
            <span className="hidden items-center gap-1 tabular-nums md:inline-flex" title="Downloads">
              <Download className="size-3.5" />
              {formatNumber(item.downloadCount ?? 0)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
