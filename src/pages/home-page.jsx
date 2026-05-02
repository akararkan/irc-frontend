import { useRef } from 'react'

import { CommunityComposer } from '@/components/app/community-composer'
import { ContactsRail } from '@/components/app/contacts-rail'
import { PageHeader } from '@/components/app/page-header'
import { PostsFeed } from '@/components/app/posts-feed'
import { ReelStrip } from '@/components/app/reel-strip'
import { useAuth } from '@/features/auth/auth-context'

export function HomePage() {
  const { isAuthenticated } = useAuth()
  const feedRef = useRef(null)

  function handlePosted(newPost) {
    feedRef.current?.insertPost(newPost)
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-5">
        <PageHeader
          eyebrow="The community feed"
          title="What scholars are reading today"
          description="A quiet, generous space for citation, debate, and discovery — curated from researchers, editors, and students across our network."
        />

        <ReelStrip />

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
          <CommunityComposer onPosted={handlePosted} />
        ) : null}

        <PostsFeed ref={feedRef} />
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
