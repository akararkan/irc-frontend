import { researchStreamUrl } from '@/features/research/research.api'
import { useSseStream } from '@/hooks/use-sse-stream'

// ResearchRealtimeEventType values broadcast on
// `/api/v1/researches/{id}/stream`. Each becomes a named SSE listener
// (matches Spring's `SseEmitter.event().name(...)`). Append new types
// here when the backend grows them — handler routing picks them up
// automatically.
export const RESEARCH_REALTIME_EVENTS = [
  'RESEARCH_UPDATED',
  'RESEARCH_DELETED',
  'RESEARCH_PUBLISHED',
  'REACTION_ADDED',
  'REACTION_CHANGED',
  'REACTION_REMOVED',
  'COMMENT_CREATED',
  'COMMENT_DELETED',
  'REPLY_CREATED',
  'VIEW_COUNT_UPDATED',
  'DOWNLOAD_COUNT_UPDATED',
  'SAVE_COUNT_UPDATED',
  'SHARE_COUNT_UPDATED',
  'CITATION_COUNT_UPDATED',
]

/**
 * Subscribe to a research's realtime SSE stream.
 *
 * `handlers` is an object keyed by ResearchRealtimeEventType, plus an
 * optional catch-all `onEvent(type, payload)`. `enabled: false` keeps
 * the connection torn down without unmounting the host component.
 *
 * `onReconnect` is fired after every *re*-connection (not the initial
 * connect) so the page can re-fetch its entity to backfill anything
 * that landed during the outage — counter values are denormalized on
 * the row, so a single GET reconciles cleanly.
 */
export function useResearchStream(researchId, handlers, options = {}) {
  return useSseStream(researchId, handlers, {
    urlBuilder: researchStreamUrl,
    eventNames: RESEARCH_REALTIME_EVENTS,
    enabled: options.enabled ?? true,
    onReconnect: options.onReconnect,
  })
}
