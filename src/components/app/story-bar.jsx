import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Plus } from 'lucide-react'

import { Skeleton } from '@/components/ui/skeleton'
import { UserAvatar } from '@/components/app/user-avatar'
import { StoryCreator } from '@/components/app/story-creator'
import { StoryViewer } from '@/components/app/story-viewer'
import { useAuth } from '@/features/auth/auth-context'
import { getStoryTray, storyTrayStreamUrl } from '@/features/stories/stories.api'
import { cn } from '@/lib/utils'
import { getAvatarUrl, getFullName, getHandle, resolveMediaUrl } from '@/lib/format'

// ── Shimmer tile ──────────────────────────────────────────────────────
function StoryTileSkeleton({ index }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.05 }}
      className="flex shrink-0 flex-col items-center gap-2"
    >
      <div className="size-[68px] rounded-full shimmer" />
      <div className="h-2 w-12 rounded-full shimmer" />
    </motion.div>
  )
}

// ── Single author tile ────────────────────────────────────────────────
function StoryTile({ group, index, onClick }) {
  const { hasUnseen, author } = group
  const name = getFullName(author) || getHandle(author)

  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 12, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay: Math.min(index, 8) * 0.045,
        type: 'spring',
        stiffness: 320,
        damping: 26,
      }}
      whileHover={{ y: -4, scale: 1.04 }}
      whileTap={{ scale: 0.93 }}
      className="flex shrink-0 flex-col items-center gap-2 outline-none"
    >
      {/* Ring */}
      <div className="relative">
        {hasUnseen ? (
          /* Unseen — animated conic gradient ring */
          <motion.div
            className="size-[72px] rounded-full p-[2.5px]"
            style={{
              background: 'conic-gradient(from 0deg, var(--brand), #B57417, #514999, var(--brand))',
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
          >
            <div className="size-full rounded-full bg-card p-[2.5px]">
              <UserAvatar
                user={author}
                className="size-full rounded-full text-[18px]"
              />
            </div>
          </motion.div>
        ) : (
          /* Seen — static gray ring */
          <div
            className="size-[72px] rounded-full p-[2.5px]"
            style={{ background: 'rgba(0,0,0,0.15)' }}
          >
            <div className="size-full rounded-full bg-card p-[2.5px]">
              <UserAvatar
                user={author}
                className="size-full rounded-full text-[18px] opacity-70"
              />
            </div>
          </div>
        )}

        {/* Unseen indicator dot */}
        {hasUnseen ? (
          <motion.div
            className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full bg-brand"
            style={{ boxShadow: '0 0 0 2px var(--card)' }}
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1.8, repeat: Infinity }}
          />
        ) : null}
      </div>

      <span className="w-[70px] truncate text-center text-[11.5px] leading-tight text-ink-3">
        {name}
      </span>
    </motion.button>
  )
}

// ── Own "Add story" tile ──────────────────────────────────────────────
function AddStoryTile({ user, onClick }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 12, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      whileHover={{ y: -4, scale: 1.04 }}
      whileTap={{ scale: 0.93 }}
      className="flex shrink-0 flex-col items-center gap-2 outline-none"
    >
      <div className="relative">
        {/* Avatar ring — dashed brand border */}
        <div
          className="size-[72px] overflow-hidden rounded-full"
          style={{ boxShadow: '0 0 0 2px var(--border)' }}
        >
          <UserAvatar user={user} className="size-full text-[20px]" />
        </div>

        {/* Plus badge */}
        <motion.div
          className="absolute -bottom-0.5 -right-0.5 flex size-6 items-center justify-center rounded-full bg-brand text-white"
          style={{ boxShadow: '0 0 0 2px var(--card)' }}
          whileHover={{ scale: 1.15, rotate: 90 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        >
          <Plus className="size-3.5" strokeWidth={2.5} />
        </motion.div>
      </div>

      <span className="text-[11.5px] font-medium text-brand">Your story</span>
    </motion.button>
  )
}

// ── Empty state (no stories yet) ─────────────────────────────────────
function EmptyTrayState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center gap-2 py-1 text-ink-3"
    >
      <p className="text-[13px] italic">Follow people to see their stories here.</p>
    </motion.div>
  )
}

// ── Main story bar ────────────────────────────────────────────────────
export function StoryBar() {
  const { user, isAuthenticated, session } = useAuth()
  const [groups,       setGroups]       = useState([])
  const [loading,      setLoading]      = useState(true)
  const [creatorOpen,  setCreatorOpen]  = useState(false)
  const [viewerGroups, setViewerGroups] = useState(null)
  const [viewerIndex,  setViewerIndex]  = useState(0)
  const esRef = useRef(null)

  // Initial load
  useEffect(() => {
    if (!isAuthenticated) { setLoading(false); return }
    let cancelled = false
    getStoryTray()
      .then((data) => { if (!cancelled) setGroups(Array.isArray(data) ? data : []) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [isAuthenticated])

  // Live tray SSE
  useEffect(() => {
    if (!isAuthenticated) return
    const url = storyTrayStreamUrl(session?.accessToken)
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
      {/* Bar card */}
      <div
        className="relative overflow-hidden rounded-2xl border-[0.5px] border-border bg-card"
        style={{ boxShadow: 'var(--shadow-sm)' }}
      >
        {/* Subtle top gradient line */}
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(15,110,86,0.4), rgba(181,116,23,0.5), rgba(81,73,153,0.4), transparent)',
          }}
        />

        <div className="scrollbar-none flex items-end gap-4 overflow-x-auto px-5 py-5">
          {isAuthenticated ? (
            <AddStoryTile user={user} onClick={() => setCreatorOpen(true)} />
          ) : null}

          {loading ? (
            Array.from({ length: 5 }).map((_, i) => <StoryTileSkeleton key={i} index={i} />)
          ) : groups.length === 0 && isAuthenticated ? (
            <EmptyTrayState />
          ) : (
            groups.map((group, i) => (
              <StoryTile
                key={group.author?.id ?? i}
                group={group}
                index={i}
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

      <AnimatePresence>
        {viewerGroups ? (
          <StoryViewer
            groups={viewerGroups}
            initialGroupIndex={viewerIndex}
            onClose={() => setViewerGroups(null)}
          />
        ) : null}
      </AnimatePresence>
    </>
  )
}
