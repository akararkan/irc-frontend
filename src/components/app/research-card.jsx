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
import { useAuth } from '@/features/auth/auth-context'
import { useInView } from '@/hooks/use-in-view'
import { useResearchStream } from '@/hooks/use-research-stream'
import { cn } from '@/lib/utils'
import { formatNumber, getFullName, getHandle, resolveMediaUrl } from '@/lib/format'
import { RelativeTime } from '@/components/app/relative-time'

const STATUS_META = {
  PUBLISHED: { label: 'Published', className: 'bg-[#ECFDF5] text-[#065F46]' },
  DRAFT: { label: 'Draft', className: 'bg-[#FFFBEB] text-[#B45309]' },
  ARCHIVED: { label: 'Archived', className: 'bg-secondary text-fg-muted' },
  RETRACTED: { label: 'Retracted', className: 'bg-destructive/10 text-destructive' },
}

export function ResearchCard({ item: incoming }) {
  const { user: currentUser } = useAuth()
  const [item, setItem] = useState(incoming)

  useEffect(() => {
    setItem((current) =>
      current?.id === incoming?.id ? { ...current, ...incoming } : incoming,
    )
  }, [incoming])

  const [setLiveRef, inView] = useInView({ rootMargin: '300px 0px 300px 0px' })

  const patch = useCallback((next) => setItem((current) => ({ ...current, ...next })), [])

  useResearchStream(
    item?.id,
    {
      RESEARCH_UPDATED: (payload) => {
        if (!payload?.id) return
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
        if (currentUser?.id && payload.actorId === currentUser.id) return
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
        if (currentUser?.id && payload.actorId === currentUser.id) return
        patch({ reactionCount: payload.reactionCount ?? item.reactionCount })
      },
      REACTION_REMOVED: (payload) => {
        if (payload == null) return
        if (currentUser?.id && payload.actorId === currentUser.id) return
        patch({ reactionCount: payload.reactionCount ?? item.reactionCount })
      },
      COMMENT_CREATED: (payload) => {
        const next = payload?.commentCount ?? (item.commentCount ?? 0) + 1
        patch({ commentCount: next })
      },
      COMMENT_DELETED: (payload) => {
        const next = payload?.commentCount ?? Math.max(0, (item.commentCount ?? 0) - 1)
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
  const authorHandle = getHandle(author)
  const authorName = getFullName(author) || authorHandle || 'Researcher'

  return (
    <Link
      ref={setLiveRef}
      to={href}
      className="group block overflow-hidden rounded-lg border border-line bg-background transition-colors hover:border-[#0891B2]/40"
      style={{ boxShadow: 'var(--shadow-xs)' }}
    >
      {/* ── Cover ─────────────────────────────────────────── */}
      <div className="relative h-36 w-full overflow-hidden">
        {videoThumb ? (
          <>
            <img
              src={videoThumb}
              alt={item.title}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
            />
            <span className="absolute inset-0 grid place-items-center bg-black/15">
              <span className="grid size-12 place-items-center rounded-full bg-background/90 text-ink backdrop-blur transition-transform group-hover:scale-110">
                <Play className="size-5 translate-x-[1px]" />
              </span>
            </span>
          </>
        ) : cover ? (
          <img
            src={cover}
            alt={item.title}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          />
        ) : (
          <div
            className="grid h-full place-items-center"
            style={{ background: 'linear-gradient(135deg, #0E5566 0%, #0891B2 100%)' }}
          >
            <div className="flex w-16 flex-col gap-1 rounded-md bg-white/92 p-2.5 shadow-lg">
              <span className="h-[3px] rounded-full bg-[#0891B2]" />
              <span className="h-[3px] rounded-full bg-slate-300" />
              <span className="h-[3px] rounded-full bg-slate-300" />
              <span className="h-[3px] w-3/5 rounded-full bg-slate-300" />
              <span className="h-[3px] rounded-full bg-slate-300" />
              <span className="h-[3px] w-3/5 rounded-full bg-slate-300" />
            </div>
          </div>
        )}

        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {item.status ? (
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium leading-none backdrop-blur',
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
            <span className="inline-flex items-center rounded-md bg-background/90 px-2 py-0.5 font-mono text-[10px] font-medium text-fg-soft backdrop-blur">
              {item.ircId}
            </span>
          ) : null}
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────── */}
      <div className="space-y-2.5 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10.5px] text-fg-muted">
          {item.doi ? (
            <span>
              DOI: <span className="text-fg-soft">{item.doi}</span>
            </span>
          ) : null}
          <span aria-hidden className="ml-auto" />
          <RelativeTime
            entity={item}
            title={item.formattedDate || undefined}
            className="font-mono text-[10.5px]"
          />
        </div>

        <h3
          dir="auto"
          className="text-balance font-semibold text-[19px] font-semibold leading-[1.2] tracking-[-0.012em] text-ink transition-colors group-hover:text-[#0891B2]"
        >
          {item.title}
        </h3>

        {item.abstractText || item.description ? (
          <p dir="auto" className="line-clamp-3 text-[13.5px] leading-[1.6] text-fg-soft">
            {item.abstractText ?? item.description}
          </p>
        ) : null}

        {item.tags?.length ? (
          <div className="flex flex-wrap gap-1.5">
            {item.tags.slice(0, 5).map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-bg-soft px-2 py-0.5 text-[11.5px] text-fg-muted transition-colors group-hover:text-ink"
              >
                #{tag}
              </span>
            ))}
          </div>
        ) : null}

        {/* Footer */}
        <div className="flex items-center gap-2.5 border-t border-line pt-3">
          <UserAvatar user={author} className="size-7 rounded-full" />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="block truncate text-[12.5px] font-medium text-ink">
                {authorName}
              </span>
              <RoleBadge role="RESEARCHER" size="xs" />
            </div>
            {authorHandle ? (
              <p className="truncate font-mono text-[10px] text-fg-muted">@{authorHandle}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2.5 text-[11px] text-fg-muted">
            {item.citationCount ? (
              <LiveCount value={item.citationCount} icon={Quote} label="Citations" />
            ) : null}
            <LiveCount value={item.viewCount ?? 0} icon={Eye} label="Views" showZero />
            <LiveCount value={item.reactionCount ?? 0} icon={Heart} label="Reactions" showZero />
            <LiveCount
              value={item.commentCount ?? 0}
              icon={MessageCircle}
              label="Comments"
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

export function LiveCount({ value, icon: Icon, label, className, showZero = false }) {
  if (!showZero && !value) return null
  return (
    <span className={cn('inline-flex items-center gap-1 tabular-nums', className)} title={label}>
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
