import { userActivityStreamUrl } from '@/features/activity/activity.api'
import { useAuth } from '@/features/auth/auth-context'
import { useSseStream } from '@/hooks/use-sse-stream'

// UserActivityRealtimeEvent values broadcast by the backend on the
// per-user channel `irc:activity:{userId}`. Listed explicitly so each
// becomes a named SSE listener — matches Spring's
// `SseEmitter.event().name(...)` and survives field renames.
//
// New activity types from the server? Append the type name here and
// any handler passed to `useMyActivityStream` will start receiving it.
export const USER_ACTIVITY_REALTIME_EVENTS = [
  // Posts / reels
  'POST_REACTION',
  'POST_COMMENT',
  'POST_COMMENT_REACTION',
  'POST_SHARE',
  'REEL_WATCH',
  // Search / discovery
  'GLOBAL_SEARCH',
  'HASHTAG_SEARCH',
  'MENTION_LOOKUP',
  'PROFILE_VIEW',
  // Q&A
  'QNA_QUESTION_CREATED',
  'QNA_ANSWER_CREATED',
  'QNA_REANSWER_CREATED',
  'QNA_ANSWER_REACTION',
  'QNA_BEST_ANSWER_VOTE',
  'QNA_ANSWER_FEEDBACK',
  // Lifecycle
  'ACTIVITY_DELETED',
  'ACTIVITY_CLEARED',
]

/**
 * Subscribe to the *current user's* activity SSE stream.
 *
 * Unlike the per-resource streams (post / question / research) this
 * one isn't keyed by an entity id — there is one channel per signed-in
 * user. We pass a synthetic resourceId so the underlying generic SSE
 * hook still has a stable identity for its dependency array.
 *
 * `handlers` is an object whose keys are UserActivityRealtimeEvent
 * values (e.g. `POST_REACTION`) plus an optional catch-all
 * `onEvent(type, payload)`. Pass `enabled: false` to stand the
 * connection down without unmounting the host component.
 */
export function useMyActivityStream(handlers, { enabled = true } = {}) {
  const { user, isAuthenticated } = useAuth()
  // Re-keying on user.id makes the underlying SSE hook tear down and
  // reconnect when the signed-in identity changes (account swap).
  const resourceId = isAuthenticated && user?.id ? `me:${user.id}` : null
  return useSseStream(resourceId, handlers, {
    urlBuilder: userActivityStreamUrl,
    eventNames: USER_ACTIVITY_REALTIME_EVENTS,
    enabled,
  })
}
