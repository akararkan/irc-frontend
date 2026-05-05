import { postStreamUrl } from '@/features/posts/posts.api'
import { useSseStream } from '@/hooks/use-sse-stream'

// PostRealtimeEventType values broadcast by the backend's per-post SSE
// channel. Listed explicitly so each event becomes a named SSE listener
// (matches Spring's `SseEmitter.event().name(...)`) rather than relying
// on the unnamed `message` channel.
//
// Adding a new server-side event type? Append it here and any handler
// passed to `usePostStream` will start receiving it.
export const POST_REALTIME_EVENTS = [
  'POST_UPDATED',
  'POST_DELETED',
  'POST_REACTED',
  'POST_REACTION_REMOVED',
  'POST_COMMENTED',
  'POST_COMMENT_UPDATED',
  'POST_COMMENT_DELETED',
  'POST_COMMENT_REACTED',
  'POST_COMMENT_REACTION_REMOVED',
  'POST_SHARED',
  'POST_VIEWED',
  'POST_MENTIONED',
]

/**
 * Subscribe to a post's realtime SSE stream.
 *
 * `handlers` is an object whose keys are PostRealtimeEventType values
 * (e.g. `POST_UPDATED`) plus an optional catch-all `onEvent(type, payload)`.
 * Pass `enabled: false` to stand the connection down without unmounting
 * the host component (e.g. when comments are collapsed).
 */
export function usePostStream(postId, handlers, { enabled = true } = {}) {
  return useSseStream(postId, handlers, {
    urlBuilder: postStreamUrl,
    eventNames: POST_REALTIME_EVENTS,
    enabled,
  })
}
