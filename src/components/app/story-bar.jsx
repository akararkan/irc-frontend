import { useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'

import { UserAvatar } from '@/components/app/user-avatar'
import { StoryCreator } from '@/components/app/story-creator'
import { StoryViewer } from '@/components/app/story-viewer'
import { useAuth } from '@/features/auth/auth-context'
import { getStoryTray, storyTrayStreamUrl } from '@/features/stories/stories.api'
import { getFullName, getHandle } from '@/lib/format'

// Skeleton tile — editorial, hairline border
function StoryTileSkeleton() {
  return (
    <div className="flex shrink-0 flex-col items-center gap-2">
      <div className="size-14 rounded-full shimmer" />
      <div className="h-2 w-12 rounded-sm shimmer" />
    </div>
  )
}

// Single author tile — solid black ring when unseen, gray when viewed
function StoryTile({ group, onClick }) {
  const { hasUnseen, author } = group
  const name = getFullName(author) || getHandle(author)

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-16 shrink-0 flex-col items-center gap-2 outline-none"
    >
      <div
        className={`size-14 rounded-full p-[2px] transition-colors ${
          hasUnseen ? 'bg-fg' : 'bg-line'
        }`}
      >
        <div className="size-full rounded-full bg-background p-[2px]">
          <UserAvatar
            user={author}
            className="size-full rounded-full text-[13px]"
          />
        </div>
      </div>
      <span className="w-16 truncate text-center text-[11.5px] leading-tight text-fg-soft">
        {name}
      </span>
    </button>
  )
}

// Own "Add story" tile — dashed border, no fill
function AddStoryTile({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-16 shrink-0 flex-col items-center gap-2 outline-none"
    >
      <div className="grid size-14 place-items-center rounded-full border border-dashed border-line-strong">
        <Plus className="size-5 text-fg-faint" strokeWidth={1.5} />
      </div>
      <span className="text-[11.5px] leading-tight text-fg-soft">Your story</span>
    </button>
  )
}

function EmptyTrayState() {
  return (
    <div className="flex items-center gap-2 py-1 text-fg-muted">
      <p className="text-[12.5px]">Follow people to see their stories here.</p>
    </div>
  )
}

export function StoryBar() {
  const { user, isAuthenticated, session } = useAuth()
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [creatorOpen, setCreatorOpen] = useState(false)
  const [viewerGroups, setViewerGroups] = useState(null)
  const [viewerIndex, setViewerIndex] = useState(0)
  const esRef = useRef(null)

  useEffect(() => {
    if (!isAuthenticated) { setLoading(false); return }
    let cancelled = false
    getStoryTray()
      .then((data) => { if (!cancelled) setGroups(Array.isArray(data) ? data : []) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) return
    const url = storyTrayStreamUrl(session?.accessToken)
    if (!url) return           // stub returns null — skip connecting
    const es = new EventSource(url)
    esRef.current = es

    es.addEventListener('new_story', (e) => {
      try {
        const ev = JSON.parse(e.data)
        setGroups((prev) => {
          const idx = prev.findIndex((g) => g.author?.id === ev.authorId)
          const stub = {
            id: ev.storyId,
            storyType: ev.storyType,
            thumbnailUrl: ev.thumbnailUrl,
            backgroundValue: ev.backgroundValue,
            expiresAt: ev.expiresAt,
          }
          if (idx >= 0) {
            const updated = [...prev]
            updated[idx] = { ...updated[idx], stories: [stub, ...updated[idx].stories], hasUnseen: true }
            return updated
          }
          return [{
            author: { id: ev.authorId, username: ev.authorUsername, avatarUrl: ev.authorAvatarUrl },
            stories: [stub],
            hasUnseen: true,
          }, ...prev]
        })
      } catch { /* ignore */ }
    })

    es.addEventListener('story_removed', (e) => {
      try {
        const { storyId, authorId } = JSON.parse(e.data)
        setGroups((prev) =>
          prev
            .map((g) => g.author?.id === authorId
              ? { ...g, stories: g.stories.filter((s) => s.id !== storyId) }
              : g
            )
            .filter((g) => g.stories.length > 0)
        )
      } catch { /* ignore */ }
    })

    return () => { es.close(); esRef.current = null }
  }, [isAuthenticated, session?.accessToken])

  function openViewer(index) {
    setViewerGroups(groups)
    setViewerIndex(index)
  }

  function handleCreated(newStory) {
    if (!user) return
    setGroups((prev) => {
      const idx = prev.findIndex((g) => g.author?.id === user.id)
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = { ...updated[idx], stories: [newStory, ...updated[idx].stories] }
        return updated
      }
      return [{ author: user, stories: [newStory], hasUnseen: false }, ...prev]
    })
  }

  if (!isAuthenticated && !loading && groups.length === 0) return null

  return (
    <>
      <div className="rounded-lg border border-line bg-background">
        <div className="scrollbar-none flex items-end gap-5 overflow-x-auto px-5 py-4">
          {isAuthenticated ? (
            <AddStoryTile onClick={() => setCreatorOpen(true)} />
          ) : null}

          {loading ? (
            Array.from({ length: 5 }).map((_, i) => <StoryTileSkeleton key={i} />)
          ) : groups.length === 0 && isAuthenticated ? (
            <EmptyTrayState />
          ) : (
            groups.map((group, i) => (
              <StoryTile
                key={group.author?.id ?? i}
                group={group}
                onClick={() => openViewer(i)}
              />
            ))
          )}
        </div>
      </div>

      <StoryCreator
        open={creatorOpen}
        onOpenChange={setCreatorOpen}
        onCreated={handleCreated}
      />

      {viewerGroups ? (
        <StoryViewer
          groups={viewerGroups}
          initialGroupIndex={viewerIndex}
          onClose={() => setViewerGroups(null)}
        />
      ) : null}
    </>
  )
}
