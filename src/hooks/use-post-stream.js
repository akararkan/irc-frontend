import { postStreamUrl } from '@/features/posts/posts.api'
import { useSseStream } from '@/hooks/use-sse-stream'

// PostRealtimeEventType values broadcast by the backend's per-post SSE
// channel. Listed explicitly so each event becomes a named SSE listener
// (matches Spring's `SseEmitter.event().name(...)`) rather than relying
// on the unnamed `message` channel.
//
// Adding a new server-side event type? Append it here and any handler
// passed to `usePostStream` will start receiving it.
// Backend's PostRealtimeEventType — names MUST match the enum exactly
// since Spring's SSE emitter uses `event().name(eventType.name())`. A
// mismatch silently drops every event, which is what bit us before.
// Reactions are single-LIKE (Instagram heart). The backend no longer
// emits *_CHANGED variants; only ADDED / REMOVED. SAVE_COUNT_UPDATED
// fires when a viewer bookmarks / unbookmarks the post.
export const POST_REALTIME_EVENTS = [
  'POST_UPDATED',
  'POST_DELETED',
  'REACTION_ADDED',
  'REACTION_REMOVED',
  'COMMENT_CREATED',
  'COMMENT_EDITED',
  'COMMENT_DELETED',
  'REPLY_CREATED',
  'COMMENT_REACTION_ADDED',
  'COMMENT_REACTION_REMOVED',
  'VIEW_COUNT_UPDATED',
  'SHARE_COUNT_UPDATED',
  'SAVE_COUNT_UPDATED',
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
