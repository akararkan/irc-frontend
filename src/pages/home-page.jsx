import { useRef } from 'react'

import { CommunityComposer } from '@/components/app/community-composer'
import { CommunityMasthead } from '@/components/app/community-masthead'
import { ContactsRail } from '@/components/app/contacts-rail'
import { ReelStrip } from '@/components/app/reel-strip'
import { UnifiedFeed } from '@/components/app/unified-feed'
import { useAuth } from '@/features/auth/auth-context'

export function HomePage() {
  const { isAuthenticated } = useAuth()
  const feedRef = useRef(null)
  const composerRef = useRef(null)

  // Unified feed merges posts + research + Q&A into one chronological
  // stream and exposes `insertPost / insertResearch / insertQuestion`
  // imperatives so newly-authored content can slot in optimistically.
  function handlePosted(newPost) {
    feedRef.current?.insertPost(newPost)
  }

  // Lift the reel-creation entry point so the strip's "Create reel"
  // tile pops the same composer dialog that the inline chips use,
  // pre-selected to REEL mode.
  function handleCreateReel() {
    composerRef.current?.openWith('REEL')
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-5">
        <CommunityMasthead />

        <ReelStrip onCreateReel={handleCreateReel} />

        <div className="ornament-rule my-2">
          <span
            aria-hidden
            className="inline-block size-1.5 rotate-45"
            style={{ background: 'var(--gold)' }}
          />
          <span className="font-display text-[12px] italic tracking-[0.04em]">
            today's discussion
          </span>
          <span
            aria-hidden
            className="inline-block size-1.5 rotate-45"
            style={{ background: 'var(--gold)' }}
          />
        </div>

        {isAuthenticated ? (
          <CommunityComposer ref={composerRef} onPosted={handlePosted} />
        ) : null}

        <UnifiedFeed ref={feedRef} />
      </div>

      {isAuthenticated ? (
        <div className="hidden xl:block">
          <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-1">
            <ContactsRail />
          </div>
        </div>
      ) : null}
    </div>
  )
}
