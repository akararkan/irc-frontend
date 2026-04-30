import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  Clapperboard,
  CornerDownLeft,
  FileText,
  Globe,
  Image as ImageIcon,
  Loader2,
  Lock,
  MapPin,
  Mic,
  Music,
  Square,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { AudioPlayer } from '@/components/app/audio-player'
import { UserAvatar } from '@/components/app/user-avatar'
import { useAuth } from '@/features/auth/auth-context'
import { createPost, createPostWithFiles } from '@/features/posts/posts.api'
import { useToast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import { extractApiMessage } from '@/lib/api-error'
import { formatFileSize } from '@/lib/qna-media'

const MAX_FILES = 4
const MAX_TEXT = 5000
const VOICE_BAR_COUNT = 64

const VISIBILITY_OPTIONS = [
  { value: 'PUBLIC', label: 'Public', icon: Globe, hint: 'Anyone on the platform.' },
  { value: 'FOLLOWERS_ONLY', label: 'Followers', icon: Users, hint: 'Only people who follow you.' },
  { value: 'ONLY_ME', label: 'Only me', icon: Lock, hint: 'Saved but not shared.' },
]

const POST_TYPES = [
  {
    value: 'TEXT',
    label: 'Note',
    icon: FileText,
    accept: '',
    placeholder: "What's on your mind?",
    accent: 'oklch(0.62_0.10_220/0.18)',
  },
  {
    value: 'EMBEDDED',
    label: 'Photo / Video',
    icon: ImageIcon,
    accept: 'image/*,video/*',
    multiple: true,
    placeholder: 'Add a caption for your photos or videos…',
    accent: 'oklch(0.72_0.14_75/0.18)',
  },
  {
    value: 'VOICE_POST',
    label: 'Voice',
    icon: Mic,
    accept: 'audio/*',
    placeholder: 'Add a note for your voice message…',
    accent: 'oklch(0.62_0.12_285/0.18)',
  },
  {
    value: 'REEL',
    label: 'Reel',
    icon: Clapperboard,
    accept: 'video/*',
    placeholder: 'Describe your short video…',
    accent: 'oklch(0.62_0.13_38/0.18)',
  },
]

// ─── Helpers ────────────────────────────────────────────────────────
function fileIsVideo(file) {
  return file.type.startsWith('video/')
}
function fileIsAudio(file) {
  return file.type.startsWith('audio/')
}

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return undefined
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
  ]
  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported(candidate)) return candidate
  }
  return undefined
}

function extensionFromMime(mime) {
  if (!mime) return 'webm'
  if (mime.includes('mp4')) return 'm4a'
  if (mime.includes('ogg')) return 'ogg'
  return 'webm'
}

function formatRecorderTime(seconds) {
  const total = Math.max(0, Math.floor(seconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

// Pulls a single frame out of a local video so we can show a poster image
// (and bail out gracefully when the browser can't decode the codec at all —
// the dreaded "No video with supported format and MIME type found" case).
function useVideoThumbnail(url) {
  const [state, setState] = useState({
    thumbnail: null,
    duration: null,
    width: null,
    height: null,
    extracting: true,
    error: false,
  })

  useEffect(() => {
    if (!url) return undefined
    let cancelled = false
    setState({
      thumbnail: null,
      duration: null,
      width: null,
      height: null,
      extracting: true,
      error: false,
    })

    const video = document.createElement('video')
    video.preload = 'auto'
    video.muted = true
    video.playsInline = true
    video.crossOrigin = 'anonymous'

    function teardown() {
      try {
        video.pause()
      } catch {
        /* element may already be detached */
      }
      video.removeAttribute('src')
      try {
        video.load()
      } catch {
        /* element may already be detached */
      }
    }

    function fail() {
      if (!cancelled) {
        setState((prev) => ({ ...prev, extracting: false, error: true }))
      }
      teardown()
    }

    function captureFrame() {
      if (cancelled) {
        teardown()
        return
      }
      try {
        const w = video.videoWidth
        const h = video.videoHeight
        if (!w || !h) {
          fail()
          return
        }
        const maxDim = 720
        const scale = Math.min(1, maxDim / Math.max(w, h))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(w * scale))
        canvas.height = Math.max(1, Math.round(h * scale))
        const ctx = canvas.getContext('2d')
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
        if (cancelled) {
          teardown()
          return
        }
        setState({
          thumbnail: dataUrl,
          duration: Number.isFinite(video.duration) ? video.duration : null,
          width: w,
          height: h,
          extracting: false,
          error: false,
        })
      } catch {
        fail()
        return
      }
      teardown()
    }

    function onLoadedMetadata() {
      if (cancelled) {
        teardown()
        return
      }
      const target = Math.min(0.5, (video.duration || 1) / 4)
      video.addEventListener('seeked', captureFrame, { once: true })
      try {
        video.currentTime = target
      } catch {
        fail()
      }
    }

    video.addEventListener('error', fail, { once: true })
    video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true })
    video.src = url

    return () => {
      cancelled = true
      teardown()
    }
  }, [url])

  return state
}

// ─── Visibility menu ────────────────────────────────────────────────
function VisibilityMenu({ value, onChange }) {
  const option =
    VISIBILITY_OPTIONS.find((item) => item.value === value) ?? VISIBILITY_OPTIONS[0]
  const Icon = option.icon
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 rounded-full border-border bg-background"
        >
          <Icon className="size-3.5" />
          {option.label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {VISIBILITY_OPTIONS.map((item) => {
          const ItemIcon = item.icon
          const active = item.value === value
          return (
            <DropdownMenuItem
              key={item.value}
              onSelect={() => onChange(item.value)}
              className={cn('gap-3 py-2', active && 'bg-muted')}
            >
              <ItemIcon className="size-4" />
              <div className="leading-tight">
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.hint}</p>
              </div>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── DropZone ───────────────────────────────────────────────────────
function DropZone({ onFiles, accept, multiple = true, hint, className, children }) {
  const [drag, setDrag] = useState(false)
  const inputRef = useRef(null)

  function handleFiles(list) {
    const files = Array.from(list ?? []).filter(Boolean)
    if (files.length) onFiles(files)
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault()
        setDrag(true)
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(event) => {
        event.preventDefault()
        setDrag(false)
        handleFiles(event.dataTransfer?.files)
      }}
      onClick={() => inputRef.current?.click()}
      className={cn(
        'group/drop relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-8 text-center transition-colors hover:border-foreground/30 hover:bg-muted/50',
        drag && 'border-foreground/40 bg-muted/70',
        className,
      )}
    >
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={accept || undefined}
        className="hidden"
        onChange={(event) => {
          handleFiles(event.target.files)
          event.target.value = ''
        }}
      />
      {children ?? (
        <>
          <span className="grid size-10 place-items-center rounded-full bg-foreground/5 text-muted-foreground transition-colors group-hover/drop:bg-foreground/10 group-hover/drop:text-foreground">
            <Upload className="size-4" />
          </span>
          <p className="text-sm font-medium text-foreground">
            {drag ? 'Drop to attach' : 'Drag & drop, or click to browse'}
          </p>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </>
      )}
    </div>
  )
}

// ─── File previews (for EMBEDDED) ───────────────────────────────────
function FilePreview({ file, onRemove }) {
  const url = useMemo(() => URL.createObjectURL(file), [file])
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  const video = fileIsVideo(file)
  const audio = fileIsAudio(file)
  return (
    <div className="group/preview relative overflow-hidden rounded-xl border border-border bg-muted">
      {audio ? (
        <div className="px-2 py-2">
          <AudioPlayer
            src={url}
            variant="compact"
            trackKind="music"
            title={file.name}
          />
        </div>
      ) : video ? (
        <video
          src={url}
          controls
          className="aspect-square w-full bg-black object-contain"
        />
      ) : (
        <img src={url} alt="" className="aspect-square w-full object-cover" />
      )}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onRemove()
        }}
        className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-background/90 text-muted-foreground shadow ring-1 ring-border transition-colors hover:text-foreground"
        aria-label="Remove"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}

function FilePreviewGrid({ files, onRemove }) {
  if (!files.length) return null
  return (
    <div
      className={cn(
        'grid gap-2',
        files.length === 1 ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-4',
      )}
    >
      {files.map((file, index) => (
        <FilePreview
          key={`${file.name}-${file.size}-${index}`}
          file={file}
          onRemove={() => onRemove(index)}
        />
      ))}
    </div>
  )
}

// ─── Reel preview ───────────────────────────────────────────────────
function ReelPreview({ file, onClear }) {
  const url = useMemo(() => URL.createObjectURL(file), [file])
  useEffect(() => () => URL.revokeObjectURL(url), [url])

  const { thumbnail, duration, width, height, extracting, error } =
    useVideoThumbnail(url)
  const [playbackError, setPlaybackError] = useState(false)

  useEffect(() => {
    setPlaybackError(false)
  }, [url])

  const isVertical = width && height ? height >= width : true
  const aspectClass = isVertical ? 'aspect-[9/14]' : 'aspect-video'
  const widthClass = isVertical ? 'max-w-[260px]' : 'max-w-md'
  const showFallback = playbackError || error

  return (
    <div className="space-y-2">
      <div
        className={cn(
          'relative mx-auto w-full overflow-hidden rounded-2xl border border-border bg-black',
          widthClass,
        )}
      >
        {showFallback ? (
          <div
            className={cn(
              'relative grid w-full place-items-center text-white',
              aspectClass,
            )}
          >
            {thumbnail ? (
              <img
                src={thumbnail}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/45 to-black/85" />
            <div className="relative flex flex-col items-center gap-2 px-6 text-center">
              <span className="grid size-12 place-items-center rounded-full bg-white/15 backdrop-blur">
                <Clapperboard className="size-5" />
              </span>
              <p className="text-sm font-medium">Preview unavailable here</p>
              <p className="text-xs text-white/75">
                This browser can't play that codec, but the video will still
                upload normally.
              </p>
            </div>
          </div>
        ) : (
          <video
            src={url}
            poster={thumbnail || undefined}
            controls
            playsInline
            preload="metadata"
            onError={() => setPlaybackError(true)}
            className={cn('w-full bg-black object-contain', aspectClass)}
          />
        )}

        {extracting && !showFallback ? (
          <div className="pointer-events-none absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2 py-1 text-[10px] font-medium text-white backdrop-blur">
            <Loader2 className="size-3 animate-spin" />
            Generating preview…
          </div>
        ) : null}

        <button
          type="button"
          onClick={onClear}
          className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-black/55 text-white backdrop-blur transition-colors hover:bg-black/75"
          aria-label="Remove"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 px-2 text-[11px] text-muted-foreground">
        <span className="max-w-[180px] truncate font-medium text-foreground">
          {file.name}
        </span>
        {duration ? (
          <>
            <span aria-hidden>·</span>
            <span className="tabular-nums">{formatRecorderTime(duration)}</span>
          </>
        ) : null}
        {width && height ? (
          <>
            <span aria-hidden>·</span>
            <span className="tabular-nums">
              {width}×{height}
            </span>
          </>
        ) : null}
        {file.size ? (
          <>
            <span aria-hidden>·</span>
            <span>{formatFileSize(file.size)}</span>
          </>
        ) : null}
      </div>
    </div>
  )
}

// ─── Voice recorder ─────────────────────────────────────────────────
function VoiceRecorder({ value, previewUrl, onCapture, onClear, onError }) {
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [bars, setBars] = useState(() => new Array(VOICE_BAR_COUNT).fill(0.05))

  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const ctxRef = useRef(null)
  const rafRef = useRef(null)
  const timerRef = useRef(null)
  const startedAtRef = useRef(0)

  function cleanup() {
    cancelAnimationFrame(rafRef.current)
    clearInterval(timerRef.current)
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (ctxRef.current) {
      ctxRef.current.close().catch(() => {})
      ctxRef.current = null
    }
  }

  useEffect(() => () => cleanup(), [])

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      onError?.('Recording is not supported in this browser.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = pickMimeType()
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      )
      recorderRef.current = recorder
      const chunks = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunks, {
          type: recorder.mimeType || 'audio/webm',
        })
        const ext = extensionFromMime(blob.type)
        const file = new File([blob], `voice-${Date.now()}.${ext}`, {
          type: blob.type,
        })
        const url = URL.createObjectURL(blob)
        onCapture(file, url)
        cleanup()
        setRecording(false)
        setElapsed(0)
      }
      recorder.start(120)
      startedAtRef.current = performance.now()
      setRecording(true)
      setElapsed(0)
      timerRef.current = setInterval(() => {
        setElapsed((performance.now() - startedAtRef.current) / 1000)
      }, 100)

      const Ctor = window.AudioContext || window.webkitAudioContext
      const ctx = new Ctor()
      ctxRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)
      const stride = Math.max(1, Math.floor(data.length / VOICE_BAR_COUNT))

      function tick() {
        analyser.getByteFrequencyData(data)
        const next = new Array(VOICE_BAR_COUNT)
        for (let i = 0; i < VOICE_BAR_COUNT; i++) {
          let sum = 0
          for (let j = 0; j < stride; j++) sum += data[i * stride + j] || 0
          next[i] = sum / stride / 255
        }
        setBars(next)
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    } catch {
      cleanup()
      setRecording(false)
      onError?.('Microphone access was denied.')
    }
  }

  function stopRecording() {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
  }

  if (value && previewUrl) {
    return (
      <div className="space-y-3">
        <AudioPlayer
          src={previewUrl}
          title={value.name}
          subtitle="Recorded"
          variant="rich"
          trackKind="voice"
        />
        <div className="flex items-center justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="rounded-full text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
            Discard & retake
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative isolate overflow-hidden rounded-3xl border border-foreground/10 bg-card p-5 shadow-[0_1px_0_oklch(1_0_0/0.5)_inset,0_22px_60px_-30px_oklch(0_0_0/0.18)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-60"
        style={{
          background:
            'radial-gradient(120% 80% at 85% -10%, oklch(0.62 0.12 285 / 0.20), transparent 60%)',
        }}
      />
      <div className="flex flex-col items-center gap-4">
        <motion.button
          type="button"
          onClick={recording ? stopRecording : startRecording}
          whileTap={{ scale: 0.94 }}
          className={cn(
            'relative grid size-16 place-items-center rounded-full text-background shadow-md transition-all',
            recording
              ? 'bg-destructive text-destructive-foreground'
              : 'bg-foreground hover:shadow-lg',
          )}
          aria-label={recording ? 'Stop recording' : 'Start recording'}
        >
          {recording ? (
            <Square className="size-5 fill-destructive-foreground" />
          ) : (
            <Mic className="size-6" />
          )}
          {recording ? (
            <motion.span
              aria-hidden
              className="absolute inset-0 rounded-full ring-4 ring-destructive/30"
              animate={{ scale: [1, 1.25, 1], opacity: [0.7, 0, 0.7] }}
              transition={{ duration: 1.6, repeat: Infinity }}
            />
          ) : null}
        </motion.button>

        <div className="text-center">
          <p className="font-mono text-2xl font-semibold tabular-nums tracking-tight">
            {formatRecorderTime(elapsed)}
          </p>
          <p className="mt-0.5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {recording ? 'Recording…' : 'Tap to record'}
          </p>
        </div>

        <div className="flex h-12 w-full items-center gap-[2px]">
          {bars.map((value, i) => (
            <span
              key={i}
              aria-hidden
              className={cn(
                'flex-1 rounded-full transition-[height] duration-75',
                recording ? 'bg-foreground/85' : 'bg-foreground/20',
              )}
              style={{
                height: `${Math.max(4, (recording ? value : 0.04 + Math.abs(Math.sin(i * 0.4)) * 0.18) * 100)}%`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── PostComposer ───────────────────────────────────────────────────
export function PostComposer({ onPosted, bare = false }) {
  const { user } = useAuth()
  const toast = useToast()

  const [postType, setPostType] = useState('TEXT')
  const [text, setText] = useState('')
  const [visibility, setVisibility] = useState('PUBLIC')
  const [files, setFiles] = useState([])

  const [voiceFile, setVoiceFile] = useState(null)
  const [voicePreviewUrl, setVoicePreviewUrl] = useState(null)

  const [reelFile, setReelFile] = useState(null)

  const [showLocation, setShowLocation] = useState(false)
  const [locationName, setLocationName] = useState('')

  const [showAudioTrack, setShowAudioTrack] = useState(false)
  const [audioTrackName, setAudioTrackName] = useState('')
  const [audioTrackUrl, setAudioTrackUrl] = useState('')

  const [submitting, setSubmitting] = useState(false)

  useEffect(
    () => () => {
      if (voicePreviewUrl) URL.revokeObjectURL(voicePreviewUrl)
    },
    [voicePreviewUrl],
  )

  if (!user) return null

  const activeType = POST_TYPES.find((t) => t.value === postType) ?? POST_TYPES[0]
  const supportsAudioTrack = postType === 'EMBEDDED' || postType === 'REEL'
  const charactersLeft = MAX_TEXT - text.length

  function resetAll() {
    setPostType('TEXT')
    setText('')
    setFiles([])
    if (voicePreviewUrl) URL.revokeObjectURL(voicePreviewUrl)
    setVoiceFile(null)
    setVoicePreviewUrl(null)
    setReelFile(null)
    setLocationName('')
    setShowLocation(false)
    setAudioTrackName('')
    setAudioTrackUrl('')
    setShowAudioTrack(false)
  }

  function changeType(next) {
    setPostType(next)
    setFiles([])
    setReelFile(null)
    if (next !== 'VOICE_POST') {
      if (voicePreviewUrl) URL.revokeObjectURL(voicePreviewUrl)
      setVoiceFile(null)
      setVoicePreviewUrl(null)
    }
  }

  function handleEmbeddedFiles(picked) {
    setFiles((current) => {
      const next = [...current, ...picked].slice(0, MAX_FILES)
      return next
    })
  }

  function handleReelFile(picked) {
    const file = picked[0]
    if (!file) return
    if (!fileIsVideo(file)) {
      toast.info('Reels need a video file.')
      return
    }
    setReelFile(file)
  }

  function handleVoiceUpload(picked) {
    const file = picked[0]
    if (!file) return
    if (!fileIsAudio(file)) {
      toast.info('Voice posts need an audio file.')
      return
    }
    if (voicePreviewUrl) URL.revokeObjectURL(voicePreviewUrl)
    const url = URL.createObjectURL(file)
    setVoiceFile(file)
    setVoicePreviewUrl(url)
  }

  function clearVoice() {
    if (voicePreviewUrl) URL.revokeObjectURL(voicePreviewUrl)
    setVoiceFile(null)
    setVoicePreviewUrl(null)
  }

  function captureVoice(file, url) {
    if (voicePreviewUrl) URL.revokeObjectURL(voicePreviewUrl)
    setVoiceFile(file)
    setVoicePreviewUrl(url)
  }

  function canSubmit() {
    if (submitting) return false
    const trimmed = text.trim()
    if (postType === 'TEXT') return trimmed.length > 0
    if (postType === 'EMBEDDED') return files.length > 0 || trimmed.length > 0
    if (postType === 'REEL') return Boolean(reelFile)
    if (postType === 'VOICE_POST') return Boolean(voiceFile)
    return false
  }

  function collectUploadFiles() {
    if (postType === 'EMBEDDED') return files
    if (postType === 'REEL') return reelFile ? [reelFile] : []
    if (postType === 'VOICE_POST') return voiceFile ? [voiceFile] : []
    return []
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!canSubmit()) return

    setSubmitting(true)
    try {
      const trimmed = text.trim()
      const data = {
        postType,
        textContent: trimmed || undefined,
        visibility,
      }
      if (locationName.trim()) data.locationName = locationName.trim()
      if (supportsAudioTrack && (audioTrackUrl.trim() || audioTrackName.trim())) {
        data.audioTrackUrl = audioTrackUrl.trim() || undefined
        data.audioTrackName = audioTrackName.trim() || undefined
      }

      const uploads = collectUploadFiles()
      const created = uploads.length
        ? await createPostWithFiles({ data, files: uploads })
        : await createPost(data)

      onPosted?.(created)
      resetAll()
      toast.success(`${activeType.label} shared.`)
    } catch (error) {
      toast.error(
        extractApiMessage(error, `Could not share your ${activeType.label.toLowerCase()}.`),
      )
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────
  const formNode = (
    <form onSubmit={handleSubmit} className="flex gap-3">
      <UserAvatar user={user} className="hidden size-10 shrink-0 sm:block" />

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {/* Type tabs */}
        <div className="flex items-center gap-1 rounded-full border border-border bg-muted/40 p-1">
          {POST_TYPES.map((item) => {
            const Icon = item.icon
            const active = item.value === postType
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => changeType(item.value)}
                className={cn(
                  'relative flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                  active
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="composerTypePill"
                    className="absolute inset-0 rounded-full bg-background shadow-sm ring-1 ring-border"
                    transition={{ type: 'spring', stiffness: 360, damping: 30 }}
                  />
                ) : null}
                <span className="relative z-10 inline-flex items-center gap-1.5">
                  <Icon className="size-3.5" />
                  <span className="hidden sm:inline">{item.label}</span>
                </span>
              </button>
            )
          })}
        </div>

        {/* Text area */}
        <div className="relative">
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value.slice(0, MAX_TEXT))}
            placeholder={activeType.placeholder}
            rows={postType === 'TEXT' ? 3 : 2}
            className={cn(
              'resize-none rounded-2xl border-0 bg-muted/50 px-4 py-3 leading-relaxed shadow-none focus-visible:ring-1',
              postType === 'TEXT'
                ? 'min-h-[88px] text-base'
                : 'min-h-[64px] text-[15px]',
            )}
          />
          {text.length > MAX_TEXT - 200 ? (
            <span
              className={cn(
                'absolute bottom-2 right-3 text-[11px] font-mono tabular-nums',
                charactersLeft < 0 ? 'text-destructive' : 'text-muted-foreground',
              )}
            >
              {charactersLeft}
            </span>
          ) : null}
        </div>

        {/* Type-specific panel */}
        <AnimatePresence mode="popLayout">
          <motion.div
            key={postType}
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            {postType === 'EMBEDDED' ? (
              <>
                {files.length > 0 ? (
                  <FilePreviewGrid
                    files={files}
                    onRemove={(i) =>
                      setFiles((current) => current.filter((_, j) => j !== i))
                    }
                  />
                ) : null}
                {files.length < MAX_FILES ? (
                  <DropZone
                    onFiles={handleEmbeddedFiles}
                    accept="image/*,video/*"
                    multiple
                    hint={`Up to ${MAX_FILES} files · images, videos`}
                  />
                ) : null}
              </>
            ) : null}

            {postType === 'REEL' ? (
              reelFile ? (
                <ReelPreview file={reelFile} onClear={() => setReelFile(null)} />
              ) : (
                <DropZone
                  onFiles={handleReelFile}
                  accept="video/*"
                  multiple={false}
                  hint="Vertical video looks best · 9:16"
                >
                  <span className="grid size-10 place-items-center rounded-full bg-foreground/5 text-muted-foreground">
                    <Clapperboard className="size-4" />
                  </span>
                  <p className="text-sm font-medium text-foreground">
                    Drop a video, or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Vertical video works best · 9:16
                  </p>
                </DropZone>
              )
            ) : null}

            {postType === 'VOICE_POST' ? (
              <div className="space-y-3">
                <VoiceRecorder
                  value={voiceFile}
                  previewUrl={voicePreviewUrl}
                  onCapture={captureVoice}
                  onClear={clearVoice}
                  onError={(message) => toast.error(message)}
                />
                {!voiceFile ? (
                  <DropZone
                    onFiles={handleVoiceUpload}
                    accept="audio/*"
                    multiple={false}
                    hint="…or upload an existing audio file"
                  >
                    <span className="grid size-10 place-items-center rounded-full bg-foreground/5 text-muted-foreground">
                      <Music className="size-4" />
                    </span>
                    <p className="text-sm font-medium text-foreground">
                      Upload audio file
                    </p>
                    <p className="text-xs text-muted-foreground">
                      mp3 · m4a · ogg · wav · webm
                    </p>
                  </DropZone>
                ) : null}
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>

        {/* Detail pills (location, audio track, visibility) */}
        <AnimatePresence initial={false}>
          {showLocation ? (
            <motion.div
              key="loc"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2 rounded-2xl border border-dashed border-border bg-muted/30 px-3 py-2">
                <MapPin className="size-4 shrink-0 text-muted-foreground" />
                <Input
                  value={locationName}
                  onChange={(event) => setLocationName(event.target.value)}
                  placeholder="Where is this from?"
                  className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowLocation(false)
                    setLocationName('')
                  }}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="size-4" />
                </button>
              </div>
            </motion.div>
          ) : null}

          {showAudioTrack && supportsAudioTrack ? (
            <motion.div
              key="track"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="space-y-2 rounded-2xl border border-dashed border-border bg-muted/30 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <Music className="size-4 shrink-0 text-muted-foreground" />
                  <Input
                    value={audioTrackName}
                    onChange={(event) => setAudioTrackName(event.target.value)}
                    placeholder="Track name"
                    className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setShowAudioTrack(false)
                      setAudioTrackName('')
                      setAudioTrackUrl('')
                    }}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                    aria-label="Close"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <Input
                  value={audioTrackUrl}
                  onChange={(event) => setAudioTrackUrl(event.target.value)}
                  placeholder="Track URL (https://…)"
                  className="h-8"
                />
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                'rounded-full text-muted-foreground hover:text-foreground',
                showLocation && locationName && 'text-foreground',
              )}
              onClick={() => setShowLocation((v) => !v)}
            >
              <MapPin className="size-4" />
              <span className="hidden sm:inline">
                {locationName ? locationName : 'Location'}
              </span>
            </Button>

            {supportsAudioTrack ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  'rounded-full text-muted-foreground hover:text-foreground',
                  showAudioTrack && (audioTrackName || audioTrackUrl) && 'text-foreground',
                )}
                onClick={() => setShowAudioTrack((v) => !v)}
              >
                <Music className="size-4" />
                <span className="hidden sm:inline">
                  {audioTrackName || audioTrackUrl ? 'Track set' : 'Audio'}
                </span>
              </Button>
            ) : null}

            <VisibilityMenu value={visibility} onChange={setVisibility} />
          </div>

          <Button
            type="submit"
            size="default"
            className="h-9 gap-1.5 rounded-full px-4"
            disabled={!canSubmit()}
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CornerDownLeft className="size-3.5" />
            )}
            {submitting ? 'Sharing…' : `Share ${activeType.label.toLowerCase()}`}
          </Button>
        </div>
      </div>
    </form>
  )

  if (bare) return formNode

  return (
    <Card
      className={cn(
        'relative isolate overflow-hidden rounded-3xl border border-border bg-card shadow-sm',
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-px h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent, oklch(0.62 0.12 285 / 0.4), oklch(0.72 0.14 75 / 0.4), oklch(0.62 0.13 38 / 0.4), transparent)',
        }}
      />
      <CardContent className="space-y-4 px-4 py-4 sm:px-5">{formNode}</CardContent>
    </Card>
  )
}

