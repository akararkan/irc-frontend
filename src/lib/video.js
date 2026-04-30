/**
 * Reads a video file's duration (in seconds) client-side by loading
 * its metadata into an offscreen <video> element. Returns null if the
 * browser can't decode the file (corrupt, unsupported codec, etc.).
 */
export function probeVideoDuration(file) {
  if (!file || !file.type?.startsWith('video/')) {
    return Promise.resolve(null)
  }
  return new Promise((resolve) => {
    const el = document.createElement('video')
    el.preload = 'metadata'
    const cleanup = () => {
      try {
        URL.revokeObjectURL(el.src)
      } catch {
        // ignore
      }
    }
    el.onloadedmetadata = () => {
      const d = el.duration
      cleanup()
      resolve(Number.isFinite(d) && d > 0 ? d : null)
    }
    el.onerror = () => {
      cleanup()
      resolve(null)
    }
    el.src = URL.createObjectURL(file)
  })
}

/** Formats seconds as m:ss — e.g. 120 → "2:00". */
export function formatDuration(seconds) {
  if (seconds == null || Number.isNaN(seconds) || seconds < 0) return ''
  const total = Math.round(seconds)
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
}
