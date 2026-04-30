import {
  Bookmark,
  Download,
  Eye,
  Heart,
  MessageCircle,
  Play,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { RoleBadge } from '@/components/app/role-badge'
import { UserAvatar } from '@/components/app/user-avatar'
import { cn } from '@/lib/utils'
import { displayTime, formatNumber, resolveMediaUrl } from '@/lib/format'

const STATUS_CLASS = {
  PUBLISHED: 'bg-emerald-500/15 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300',
  DRAFT: 'bg-muted text-muted-foreground ring-border',
  ARCHIVED: 'bg-amber-500/15 text-amber-700 ring-amber-500/25 dark:text-amber-300',
  RETRACTED: 'bg-rose-500/15 text-rose-700 ring-rose-500/25 dark:text-rose-300',
}

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

  return (
    <Card className="group overflow-hidden border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <Link to={href} className="block">
        <div className="relative aspect-[5/3] w-full overflow-hidden bg-muted">
          {videoThumb ? (
            <>
              <img src={videoThumb} alt={item.title} className="h-full w-full object-cover" />
              <span className="absolute inset-0 grid place-items-center">
                <span className="grid size-12 place-items-center rounded-full bg-background/90 text-foreground shadow-lg backdrop-blur transition-transform group-hover:scale-110">
                  <Play className="size-5 translate-x-[1px]" />
                </span>
              </span>
            </>
          ) : cover ? (
            <img src={cover} alt={item.title} className="h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 grid place-items-center bg-muted">
              <span className="text-5xl font-semibold text-muted-foreground/30">
                {item.title?.[0]?.toUpperCase() ?? 'R'}
              </span>
            </div>
          )}
          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {item.status ? (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ring-1 backdrop-blur',
                    STATUS_CLASS[item.status] ?? STATUS_CLASS.PUBLISHED,
                  )}
                >
                  {item.status}
                </span>
              ) : null}
              {item.currentUserSaved ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-foreground/80 px-2 py-0.5 text-[10px] font-medium text-background backdrop-blur">
                  <Bookmark className="size-2.5 fill-current" />
                  Saved
                </span>
              ) : null}
            </div>
            {item.ircId ? (
              <span className="inline-flex items-center rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-mono font-medium text-foreground backdrop-blur">
                {item.ircId}
              </span>
            ) : null}
          </div>
        </div>
      </Link>

      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span title={item.formattedDate || ''}>{displayTime(item)}</span>
          {item.doi ? (
            <>
              <span aria-hidden>·</span>
              <span>DOI · {item.doi}</span>
            </>
          ) : null}
          {item.citationCount ? (
            <>
              <span aria-hidden>·</span>
              <span>{formatNumber(item.citationCount)} citations</span>
            </>
          ) : null}
        </div>

        <Link
          to={href}
          className="block text-lg font-semibold leading-snug tracking-tight hover:underline"
        >
          {item.title}
        </Link>
        {item.abstractText || item.description ? (
          <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
            {item.abstractText ?? item.description}
          </p>
        ) : null}

        {item.tags?.length ? (
          <div className="flex flex-wrap gap-1.5">
            {item.tags.slice(0, 6).map((tag) => (
              <Badge key={tag} variant="secondary" className="rounded-full bg-muted">
                #{tag}
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="flex items-center gap-3 border-t pt-3">
          <Link to={`/profile/${author.username ?? ''}`}>
            <UserAvatar user={author} className="size-9" />
          </Link>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="flex flex-wrap items-center gap-1.5">
              <Link
                to={`/profile/${author.username ?? ''}`}
                className="block truncate text-sm font-semibold hover:underline"
              >
                {author.fullName ?? author.username}
              </Link>
              <RoleBadge role="RESEARCHER" size="xs" />
            </div>
            <p className="truncate text-xs text-muted-foreground">@{author.username}</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1" title="Views">
              <Eye className="size-3.5" />
              {formatNumber(item.viewCount ?? 0)}
            </span>
            <span className="inline-flex items-center gap-1" title="Reactions">
              <Heart className="size-3.5" />
              {formatNumber(item.reactionCount ?? 0)}
            </span>
            <span className="inline-flex items-center gap-1" title="Comments">
              <MessageCircle className="size-3.5" />
              {formatNumber(item.commentCount ?? 0)}
            </span>
            <span className="inline-flex items-center gap-1" title="Saves">
              <Bookmark className="size-3.5" />
              {formatNumber(item.saveCount ?? 0)}
            </span>
            <span className="inline-flex items-center gap-1" title="Downloads">
              <Download className="size-3.5" />
              {formatNumber(item.downloadCount ?? 0)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
