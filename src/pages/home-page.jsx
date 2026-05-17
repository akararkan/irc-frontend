import { useRef } from 'react'
import { motion } from 'motion/react'

import { CommunityComposer } from '@/components/app/community-composer'
import { CommunityMasthead } from '@/components/app/community-masthead'
import { ContactsRail } from '@/components/app/contacts-rail'
import { ReelStrip } from '@/components/app/reel-strip'
import { StoryBar } from '@/components/app/story-bar'
import { UnifiedFeed } from '@/components/app/unified-feed'
import { useAuth } from '@/features/auth/auth-context'

// ── Ornament section divider ─────────────────────────────────────────
function SectionDivider({ label }) {
  return (
    <div className="flex items-center gap-4 py-1">
      <div
        className="h-px flex-1"
        style={{
          background:
            'linear-gradient(to right, transparent, color-mix(in oklch, var(--foreground) 12%, transparent))',
        }}
      />
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="inline-block size-1.5 rotate-45"
          style={{ background: 'var(--gold)' }}
        />
        <span className="font-display text-[11.5px] italic tracking-[0.06em] text-ink-4">
          {label}
        </span>
        <span
          aria-hidden
          className="inline-block size-1.5 rotate-45"
          style={{ background: 'var(--gold)' }}
        />
      </div>
      <div
        className="h-px flex-1"
        style={{
          background:
            'linear-gradient(to left, transparent, color-mix(in oklch, var(--foreground) 12%, transparent))',
        }}
      />
    </div>
  )
}

export function HomePage() {
  const { isAuthenticated } = useAuth()
  const feedRef    = useRef(null)
  const composerRef = useRef(null)

  function handlePosted(newPost) {
    feedRef.current?.insertPost(newPost)
  }

  function handleCreateReel() {
    composerRef.current?.openWith('REEL')
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
      {/* ── Main column ── */}
      <div className="min-w-0 space-y-5">
        {/* Hero masthead */}
        <CommunityMasthead />

        {/* Stories */}
        <StoryBar />

        {/* Reels */}
        <ReelStrip onCreateReel={handleCreateReel} />

        {/* Section divider */}
        <SectionDivider label="today's discussion" />

        {/* Composer — authenticated only */}
        {isAuthenticated ? (
          <CommunityComposer ref={composerRef} onPosted={handlePosted} />
        ) : null}

        {/* Feed */}
        <UnifiedFeed ref={feedRef} />
      </div>

      {/* ── Right rail (desktop) ── */}
      {isAuthenticated ? (
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 28, delay: 0.1 }}
          className="hidden xl:block"
        >
          <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-1">
            <ContactsRail />
          </div>
        </motion.div>
      ) : null}
    </div>
  )
}
