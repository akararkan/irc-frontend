import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import {
  Download,
  Gauge,
  Mic,
  Music,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
} from 'lucide-react'

import { cn } from '@/lib/utils'

const SPEEDS = [1, 1.25, 1.5, 2]
const SKIP_SECONDS = 10

// ─── Peak extraction (Web Audio API) ───────────────────────────────
async function decodePeaks(url, samples, signal) {
  if (!url || typeof window === 'undefined') return null
  const Ctor = window.AudioContext || window.webkitAudioContext
  if (!Ctor) return null
  let ctx
  try {
    const response = await fetch(url, {
      mode: 'cors',
      credentials: 'omit',
      signal,
    })
    if (!response.ok) return null
    const buffer = await response.arrayBuffer()
    if (signal?.aborted) return null
    ctx = new Ctor()
    const decoded = await ctx.decodeAudioData(buffer)
    const data = decoded.getChannelData(0)
    const blockSize = Math.max(1, Math.floor(data.length / samples))
    const peaks = new Array(samples).fill(0)
    let max = 0
    for (let i = 0; i < samples; i++) {
      const start = i * blockSize
      const end = Math.min(start + blockSize, data.length)
      let sumSquares = 0
      for (let j = start; j < end; j++) {
        const v = data[j]
        sumSquares += v * v
      }
      const rms = Math.sqrt(sumSquares / Math.max(1, end - start))
      peaks[i] = rms
      if (rms > max) max = rms
    }
    return max > 0 ? peaks.map((v) => Math.min(1, v / max)) : peaks
  } catch {
    return null
  } finally {
    if (ctx) ctx.close().catch(() => {})
  }
}

// Stable-but-organic fallback so layout never collapses while decoding.
function syntheticPeaks(samples, seed = 11) {
  const out = new Array(samples)
  let s = seed
  function rand() {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
  for (let i = 0; i < samples; i++) {
    const wave =
      Math.abs(Math.sin(i * 0.45) * 0.65 + Math.sin(i * 0.18) * 0.25)
    out[i] = 0.18 + Math.min(0.82, wave + rand() * 0.22)
  }
  return out
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00'
  const total = Math.max(0, Math.floor(seconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ─── Waveform ──────────────────────────────────────────────────────
function BarLayer({ bars, className }) {
  return (
    <div className="absolute inset-0 flex items-center gap-[2px]">
      {bars.map((value, i) => (
        <span
          key={i}
          aria-hidden
          className={cn('flex-1 rounded-full', className)}
          style={{ height: `${Math.max(8, value * 100)}%` }}
        />
      ))}
    </div>
  )
}

function Waveform({
  peaks,
  progress,
  onSeek,
  onScrub,
  height = 56,
}) {
  const wrapRef = useRef(null)
  const draggingRef = useRef(false)

  const fraction = useCallback((event) => {
    const el = wrapRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    const x = (event.touches?.[0]?.clientX ?? event.clientX) - rect.left
    return Math.min(1, Math.max(0, x / rect.width))
  }, [])

  useEffect(() => {
    function move(event) {
      if (!draggingRef.current) return
      onScrub?.(fraction(event))
    }
    function up(event) {
      if (!draggingRef.current) return
      draggingRef.current = false
      onSeek?.(fraction(event))
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [fraction, onSeek, onScrub])

  function handleDown(event) {
    event.preventDefault()
    draggingRef.current = true
    onSeek?.(fraction(event))
  }

  const playedClip = `inset(0 ${(1 - progress) * 100}% 0 0)`
  const playedColor = 'bg-foreground'
  const restColor = 'bg-foreground/15'

  return (
    <div
      ref={wrapRef}
      onPointerDown={handleDown}
      role="slider"
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={progress}
      tabIndex={0}
      className="group/wave relative w-full cursor-pointer touch-none select-none focus:outline-none"
      style={{ height }}
    >
      <BarLayer bars={peaks} className={restColor} />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{ clipPath: playedClip, WebkitClipPath: playedClip }}
      >
        <BarLayer bars={peaks} className={playedColor} />
      </div>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-1 w-px bg-foreground/80 transition-opacity"
        style={{
          left: `calc(${progress * 100}% - 0.5px)`,
          opacity: progress > 0 && progress < 1 ? 1 : 0,
        }}
      />
    </div>
  )
}

// ─── AudioPlayer ───────────────────────────────────────────────────
export function AudioPlayer({
  src,
  title,
  subtitle,
  variant = 'rich',
  trackKind = 'voice',
  className,
  samples,
  showDownload = false,
}) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [scrubProgress, setScrubProgress] = useState(null)
  const [duration, setDuration] = useState(0)
  const [muted, setMuted] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [peaks, setPeaks] = useState(null)

  const barCount = samples ?? (variant === 'compact' ? 56 : 96)
  const fallback = useMemo(
    () => syntheticPeaks(barCount, trackKind === 'music' ? 23 : 11),
    [barCount, trackKind],
  )

  useEffect(() => {
    setPeaks(null)
    if (!src) {
      setPeaks(fallback)
      return undefined
    }
    const controller =
      typeof AbortController !== 'undefined' ? new AbortController() : null
    let cancelled = false
    decodePeaks(src, barCount, controller?.signal).then((result) => {
      if (cancelled) return
      setPeaks(result ?? fallback)
    })
    return () => {
      cancelled = true
      controller?.abort()
    }
  }, [src, barCount, fallback])

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed
  }, [speed])

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted
  }, [muted])

  function togglePlay() {
    const audio = audioRef.current
    if (!audio || !src) return
    if (playing) audio.pause()
    else audio.play().catch(() => setPlaying(false))
  }

  function skip(deltaSeconds) {
    const audio = audioRef.current
    if (!audio || !duration) return
    audio.currentTime = Math.min(
      duration,
      Math.max(0, audio.currentTime + deltaSeconds),
    )
  }

  function cycleSpeed() {
    setSpeed((current) => SPEEDS[(SPEEDS.indexOf(current) + 1) % SPEEDS.length])
  }

  function seekTo(fraction) {
    const audio = audioRef.current
    if (!audio || !duration) return
    audio.currentTime = duration * fraction
    setProgress(fraction)
    setScrubProgress(null)
  }

  const displayedProgress = scrubProgress ?? progress
  const displayedTime = duration * displayedProgress
  const displayedSpeedLabel = `${speed}×`

  const rich = variant === 'rich'
  const feed = variant === 'feed'
  const KindIcon = trackKind === 'music' ? Music : Mic

  // ─── Feed variant ─────────────────────────────────────────────────
  // Minimal in-card player: outlined play button + waveform + timer.
  // No title/subtitle/controls so the player doesn't compete with the
  // post body. Matches the spec voice-post card mock.
  if (feed) {
    return (
      <div
        className={cn(
          'flex items-center gap-4 rounded-lg border-[0.5px] border-line bg-muted/40 px-4 py-3.5',
          className,
        )}
      >
        {/* Outlined ghost play/pause button */}
        <motion.button
          type="button"
          whileTap={{ scale: 0.93 }}
          onClick={togglePlay}
          disabled={!src}
          aria-label={playing ? 'Pause' : 'Play'}
          className={cn(
            'relative grid size-11 shrink-0 place-items-center rounded-full border-[0.5px] border-ink/20 bg-background text-ink shadow-sm transition-colors hover:border-ink/40 hover:bg-bg-soft disabled:opacity-50',
          )}
        >
          {playing ? (
            <Pause className="size-4" />
          ) : (
            <Play className="size-4 translate-x-[1px] fill-ink" />
          )}
          {playing ? (
            <motion.span
              aria-hidden
              className="absolute inset-0 rounded-full ring-1 ring-ink/15"
              animate={{ scale: [1, 1.22, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 1.8, repeat: Infinity }}
            />
          ) : null}
        </motion.button>

        {/* Waveform — takes all available space */}
        <div className="min-w-0 flex-1">
          <Waveform
            peaks={peaks ?? fallback}
            progress={displayedProgress}
            onSeek={seekTo}
            onScrub={setScrubProgress}
            height={44}
          />
        </div>

        {/* Position / duration counter */}
        <p className="shrink-0 font-mono text-[11.5px] tabular-nums text-fg-muted">
          <span className="text-ink">{formatTime(displayedTime)}</span>
          <span className="mx-1 opacity-40">/</span>
          {formatTime(duration)}
        </p>

        {src ? (
          <audio
            ref={audioRef}
            src={src}
            preload="metadata"
            className="hidden"
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration ?? 0)}
            onDurationChange={(e) => setDuration(e.currentTarget.duration ?? 0)}
            onTimeUpdate={(e) => {
              const el = e.currentTarget
              if (!el.duration) return
              setProgress(el.currentTime / el.duration)
            }}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => { setPlaying(false); setProgress(0) }}
          />
        ) : null}
      </div>
    )
  }

  // ─── Rich / compact variants (unchanged) ──────────────────────────
  return (
    <div
      className={cn(
        'relative isolate overflow-hidden',
        rich
          ? 'rounded-3xl border border-foreground/10 bg-card p-5 shadow-[0_1px_0_oklch(1_0_0/0.6)_inset,0_22px_60px_-30px_oklch(0_0_0/0.18)]'
          : 'rounded-lg border border-line bg-card/80 p-3',
        className,
      )}
    >
      {rich ? (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background:
                'radial-gradient(120% 80% at 85% -10%, oklch(0.62 0.12 285 / 0.28), transparent 60%), radial-gradient(80% 100% at -10% 110%, oklch(0.62 0.10 220 / 0.18), transparent 60%)',
            }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 opacity-[0.04]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, oklch(0 0 0) 1px, transparent 0)',
              backgroundSize: '14px 14px',
            }}
          />
        </>
      ) : null}

      <div className="flex items-center gap-4">
        <motion.button
          type="button"
          whileTap={{ scale: 0.92 }}
          whileHover={{ scale: 1.04 }}
          onClick={togglePlay}
          disabled={!src}
          aria-label={playing ? 'Pause' : 'Play'}
          className={cn(
            'relative grid shrink-0 place-items-center rounded-full bg-foreground text-background shadow-md transition-shadow hover:shadow-lg disabled:opacity-50',
            rich ? 'size-14' : 'size-10',
          )}
        >
          {playing ? (
            <Pause className={rich ? 'size-5' : 'size-4'} />
          ) : (
            <Play
              className={cn(
                rich ? 'size-5' : 'size-4',
                'translate-x-[1px] fill-background',
              )}
            />
          )}
          {rich && playing ? (
            <motion.span
              aria-hidden
              className="absolute inset-0 rounded-full ring-2 ring-foreground/20"
              animate={{ scale: [1, 1.18, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 1.6, repeat: Infinity }}
            />
          ) : null}
        </motion.button>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex min-w-0 items-baseline justify-between gap-3">
            <div className="min-w-0">
              {subtitle ? (
                <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  <KindIcon className="size-2.5" />
                  {subtitle}
                </p>
              ) : null}
              {title ? (
                <p className="truncate text-sm font-semibold tracking-tight text-foreground">
                  {title}
                </p>
              ) : null}
            </div>
            <p className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
              <span className="text-foreground">{formatTime(displayedTime)}</span>
              <span className="mx-1 opacity-40">/</span>
              {formatTime(duration)}
            </p>
          </div>

          <Waveform
            peaks={peaks ?? fallback}
            progress={displayedProgress}
            onSeek={seekTo}
            onScrub={setScrubProgress}
            height={rich ? 56 : 36}
          />

          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => skip(-SKIP_SECONDS)}
                disabled={!duration}
                className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground disabled:opacity-40"
                title={`Back ${SKIP_SECONDS}s`}
                aria-label={`Back ${SKIP_SECONDS} seconds`}
              >
                <RotateCcw className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => skip(SKIP_SECONDS)}
                disabled={!duration}
                className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground disabled:opacity-40"
                title={`Forward ${SKIP_SECONDS}s`}
                aria-label={`Forward ${SKIP_SECONDS} seconds`}
              >
                <RotateCw className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={cycleSpeed}
                className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold tabular-nums text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
                title="Playback speed"
              >
                <Gauge className="size-3" />
                {displayedSpeedLabel}
              </button>
            </div>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
                aria-label={muted ? 'Unmute' : 'Mute'}
              >
                {muted ? (
                  <VolumeX className="size-3.5" />
                ) : (
                  <Volume2 className="size-3.5" />
                )}
              </button>
              {showDownload && src ? (
                <a
                  href={src}
                  download
                  rel="noreferrer"
                  className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
                  aria-label="Download"
                >
                  <Download className="size-3.5" />
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {src ? (
        <audio
          ref={audioRef}
          src={src}
          preload="metadata"
          className="hidden"
          onLoadedMetadata={(event) =>
            setDuration(event.currentTarget.duration ?? 0)
          }
          onDurationChange={(event) =>
            setDuration(event.currentTarget.duration ?? 0)
          }
          onTimeUpdate={(event) => {
            const el = event.currentTarget
            if (!el.duration) return
            setProgress(el.currentTime / el.duration)
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false)
            setProgress(0)
          }}
        />
      ) : null}
    </div>
  )
}
