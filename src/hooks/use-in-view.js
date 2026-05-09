import { useEffect, useState } from 'react'

/**
 * Track whether a DOM node is intersecting the viewport. Returns a
 * boolean that flips true once the element crosses the threshold
 * (default: 1 px) and goes false when it scrolls fully out.
 *
 * Stays `true` while the element remains visible — handy for gating
 * expensive work (per-card SSE streams, autoplay, eager media loads)
 * to "things the reader is likely looking at".
 *
 * `rootMargin` widens the trigger box: the default `0px 0px 200px 0px`
 * starts the subscription a screen-and-a-bit before the card scrolls
 * in (so live counts are already up to date by the time it lands), and
 * keeps it open ~200 px past the bottom edge before tearing down.
 *
 * @param {{ rootMargin?: string, threshold?: number, once?: boolean }} options
 *   `once` makes the hook latch true forever after the first intersect
 *   — useful for "load once, never reload" patterns.
 * @returns {[(node: Element | null) => void, boolean]} ref callback + visibility
 */
export function useInView({ rootMargin = '200px 0px 200px 0px', threshold = 0, once = false } = {}) {
  const [node, setNode] = useState(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    if (!node) return undefined
    if (once && inView) return undefined
    if (typeof IntersectionObserver === 'undefined') {
      // Server-render / very old browser — fall back to "always in view".
      setInView(true)
      return undefined
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        const next = entry.isIntersecting
        setInView((prev) => {
          if (prev === next) return prev
          if (once && next) {
            // Latch and disconnect — saves the listener after first hit.
            observer.disconnect()
          }
          return next
        })
      },
      { rootMargin, threshold },
    )
    observer.observe(node)
    return () => observer.disconnect()
    // `inView` is intentionally listed so we can short-circuit when
    // `once` already latched true.
  }, [node, rootMargin, threshold, once, inView])

  return [setNode, inView]
}
