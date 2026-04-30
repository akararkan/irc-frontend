import { useRef } from 'react'

import { CommunityComposer } from '@/components/app/community-composer'
import { ContactsRail } from '@/components/app/contacts-rail'
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
      <div className="min-w-0 space-y-6">
        <ReelStrip />

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
