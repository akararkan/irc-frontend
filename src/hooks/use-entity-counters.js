import { useMemo } from 'react'

import { applyCounterEvent } from '@/lib/counter-events'
import { POST_REALTIME_EVENTS } from '@/hooks/use-post-stream'
import { RESEARCH_REALTIME_EVENTS } from '@/hooks/use-research-stream'
import { QUESTION_REALTIME_EVENTS } from '@/hooks/use-question-stream'
import { useSseStream } from '@/hooks/use-sse-stream'
import { postStreamUrl } from '@/features/posts/posts.api'
import { researchStreamUrl } from '@/features/research/research.api'
import { questionStreamUrl } from '@/features/qna/qna.api'

const CONFIG = {
  post: { events: POST_REALTIME_EVENTS, urlBuilder: postStreamUrl },
  research: { events: RESEARCH_REALTIME_EVENTS, urlBuilder: researchStreamUrl },
  question: { events: QUESTION_REALTIME_EVENTS, urlBuilder: questionStreamUrl },
}

/**
 * One subscription per detail page — opens the canonical per-entity
 * SSE stream and dispatches every counter-bearing event into the
 * global counter store. Every <Counter/> on the page reads from that
 * store via {@link import('@/lib/counter-store').useCounter}, so the
 * page itself doesn't have to write per-event handlers anymore.
 *
 * Callers can still pass extra `handlers` (entity-specific events like
 * RESEARCH_PUBLISHED, ANSWER_ACCEPTED, …) — those run *in addition* to
 * the counter-store dispatch.
 *
 * Returns the underlying `{ isConnected }` for "Live" pip rendering.
 */
export function useEntityCounters(kind, entityId, options = {}) {
  const config = CONFIG[kind]
  if (!config) {
    throw new Error(`useEntityCounters: unknown kind "${kind}"`)
  }
  const { handlers: extraHandlers, enabled = true, onReconnect } = options

  // Build a single `onEvent` that drains every counter from the payload
  // and then fans out to any caller-provided handlers. Memoized so the
  // underlying SSE connection isn't rebuilt on every render.
  const handlers = useMemo(() => {
    return {
      ...(extraHandlers ?? {}),
      onEvent: (type, payload) => {
        applyCounterEvent(kind, entityId, payload)
        extraHandlers?.onEvent?.(type, payload)
      },
    }
  }, [kind, entityId, extraHandlers])

  return useSseStream(entityId, handlers, {
    urlBuilder: config.urlBuilder,
    eventNames: config.events,
    enabled,
    onReconnect,
  })
}
