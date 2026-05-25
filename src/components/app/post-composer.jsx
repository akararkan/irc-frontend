import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  AtSign,
  ChevronDown,
  Mic,
  Image as ImageIcon,
  Video,
  PenLine,
  Globe,
  Lock,
  Loader2,
  Link2,
  MapPin,
  Music,
  Plus,
  Repeat2,
  Send,
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
import { AudioPlayer } from '@/components/app/audio-player'
import { MentionTextarea } from '@/components/app/mention-textarea'
import { SoundChip, SoundPicker } from '@/components/app/sound-picker'
import { UserAvatar } from '@/components/app/user-avatar'
import { useAuth } from '@/features/auth/auth-context'
import { createPost, createPostWithFiles } from '@/features/posts/posts.api'
import { useToast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import { extractApiMessage } from '@/lib/api-error'
import { formatFileSize } from '@/lib/qna-media'

const MAX_FILES = 4
const MAX_TEXT = 5000
const VOICE_BAR_COUNT = 56
const MAX_REEL_DURATION_SECONDS = 90

const VISIBILITY_OPTIONS = [
  { value: 'PUBLIC', label: 'Public', icon: Globe, hint: 'Anyone on the platform.' },
  {
    value: 'FOLLOWERS_ONLY',
    label: 'Followers',
    icon: Users,
    hint: 'Only people who follow you.',
  },
  { value: 'ONLY_ME', label: 'Only me', icon: Lock, hint: 'Saved but not shared.' },
]

const POST_TYPES = [
  {
    value: 'TEXT',
    label: 'Text',
    icon: PenLine,
    placeholder: "What's on your mind? Share a thought, citation, or finding…",
  },
  {
    value: 'EMBEDDED',
    label: 'Embedded',
    icon: ImageIcon,
    placeholder: 'Add a caption for your photos or videos…',
  },
  {
    value: 'VOICE_POST',
    label: 'Voice',
    icon: Mic,
    placeholder: 'Add a note for your voice message…',
  },
  {
    value: 'REEL',
    label: 'Reel',
    icon: Video,
    placeholder: 'Describe your short video…',
  },
  {
    value: 'REPOST',
    label: 'Repost',
    icon: Repeat2,
    placeholder: 'Add your thoughts on this repost…',
  },
  {
    value: 'LINK',
    label: 'Link',
    icon: Link2,
    placeholder: 'Share a link with a caption…',
  },
]

/* ── Helpers ─────────────────────────────────────────────────── */

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
      if (!cancelled) setState((prev) => ({ ...prev, extracting: false, error: true }))
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

/* ── Visibility menu ─────────────────────────────────────────── */
function VisibilityMenu({ value, onChange }) {
  const option =
    VISIBILITY_OPTIONS.find((item) => item.value === value) ?? VISIBILITY_OPTIONS[0]
  const Icon = option.icon
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-7 items-center gap-1 rounded-sm border border-line bg-bg-soft px-2 text-[12px] font-medium text-fg-soft transition-colors hover:border-line-strong hover:text-fg"
        >
          <Icon className="size-3" strokeWidth={1.7} />
          {option.label}
          <ChevronDown className="size-3 opacity-60" strokeWidth={1.7} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 rounded-md p-1">
        {VISIBILITY_OPTIONS.map((item) => {
          const ItemIcon = item.icon
          const active = item.value === value
          return (
            <DropdownMenuItem
              key={item.value}
              onSelect={() => onChange(item.value)}
              className={cn(
                'gap-3 rounded-lg py-2',
                active ? 'bg-bg-soft text-fg' : 'text-ink-2',
              )}
            >
              <ItemIcon className="size-4" />
              <div className="leading-tight">
                <p className="text-[13px] font-medium">{item.label}</p>
                <p className="text-[11.5px] text-fg-muted">{item.hint}</p>
              </div>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* ── DropZone ────────────────────────────────────────────────── */
function DropZone({ onFiles, accept, multiple = true, hint, tone = 'cyan', children }) {
  const [drag, setDrag] = useState(false)
  const inputRef = useRef(null)

  function handleFiles(list) {
    const files = Array.from(list ?? []).filter(Boolean)
    if (files.length) onFiles(files)
  }

  const tones = {
    cyan: 'bg-[#ECFEFF] text-[#0891B2]',
    violet: 'bg-[#F5F3FF] text-[#7C3AED]',
    amber: 'bg-[#FFFBEB] text-[#B45309]',
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
        'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-[1.5px] border-dashed border-line bg-bg-soft px-6 py-7 text-center transition-colors',
        'hover:border-line-strong',
        drag && 'border-fg bg-bg-soft',
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
          <span
            className={cn(
              'grid size-11 place-items-center rounded-full',
              tones[tone] ?? tones.cyan,
            )}
          >
            <Upload className="size-[17px]" strokeWidth={1.8} />
          </span>
          <p className="text-[13.5px] font-medium text-ink">
            {drag ? 'Drop to attach' : 'Drag & drop, or click to browse'}
          </p>
          {hint ? <p className="text-[11.5px] text-fg-muted">{hint}</p> : null}
        </>
      )}
    </div>
  )
}

/* ── Carousel thumbnail (HTML spec §2.1 style) ───────────────── */
function CarouselThumb({ file, index, onRemove }) {
  const url = useMemo(() => URL.createObjectURL(file), [file])
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  const video = fileIsVideo(file)
  const audio = fileIsAudio(file)
  const label = audio ? 'AUD' : video ? 'VID' : 'IMG'

  return (
    <div className="relative size-[88px] shrink-0 overflow-hidden rounded-md border border-line bg-bg-muted">
      {audio ? (
        <div className="flex h-full w-full items-center justify-center">
          <Music className="size-6 text-fg-faint" strokeWidth={1.5} />
        </div>
      ) : video ? (
        <video src={url} className="h-full w-full object-cover" preload="metadata" muted />
      ) : (
        <img src={url} alt="" className="h-full w-full object-cover" />
      )}
      {/* Number badge */}
      <span className="absolute left-1.5 top-1.5 rounded-[3px] bg-fg/70 px-1 font-mono text-[9.5px] font-medium text-background">
        {index + 1}
      </span>
      {/* Remove */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        className="absolute right-1.5 top-1.5 grid size-[18px] place-items-center rounded-[3px] bg-fg/70 text-background transition-colors hover:bg-fg"
        aria-label="Remove"
      >
        <X className="size-2.5" strokeWidth={2.5} />
      </button>
      {/* Type label */}
      <span className="absolute bottom-1.5 left-1.5 rounded-[3px] bg-fg/70 px-1 font-mono text-[8.5px] uppercase tracking-wide text-background">
        {label}
      </span>
    </div>
  )
}

function CarouselPreview({ files, onRemove, onAdd, maxFiles }) {
  const inputRef = useRef(null)
  return (
    <div className="flex flex-wrap gap-1.5">
      {files.map((file, i) => (
        <CarouselThumb
          key={`${file.name}-${file.size}-${i}`}
          file={file}
          index={i}
          onRemove={() => onRemove(i)}
        />
      ))}
      {files.length < maxFiles ? (
        <>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => { if (e.target.files?.length) { onAdd(Array.from(e.target.files)); e.target.value = '' } }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex size-[88px] items-center justify-center rounded-md border border-dashed border-line-strong bg-bg-soft transition-colors hover:border-fg hover:bg-bg-muted"
          >
            <Plus className="size-5 text-fg-faint" strokeWidth={1.5} />
          </button>
        </>
      ) : null}
    </div>
  )
}

/* ── Reel preview ────────────────────────────────────────────── */
function ReelPreview({ file, onClear }) {
  const url = useMemo(() => URL.createObjectURL(file), [file])
  useEffect(() => () => URL.revokeObjectURL(url), [url])

  const { thumbnail, duration, width, height, extracting, error } = useVideoThumbnail(url)
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
          'relative mx-auto w-full overflow-hidden rounded-md border border-line bg-black',
          widthClass,
        )}
      >
        {showFallback ? (
          <div
            className={cn('relative grid w-full place-items-center text-white', aspectClass)}
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
                <Video className="size-5" />
              </span>
              <p className="text-[13px] font-medium">Preview unavailable here</p>
              <p className="text-[11.5px] text-white/75">
                This browser can't play that codec, but the video will still upload
                normally.
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

      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 px-2 text-[11px] text-fg-muted">
        <span className="max-w-[180px] truncate font-medium text-ink">{file.name}</span>
        {duration ? (
          <>
            <span aria-hidden>·</span>
            <span
              className={cn(
                'tabular-nums',
                duration > MAX_REEL_DURATION_SECONDS && 'font-semibold text-destructive',
              )}
            >
              {formatRecorderTime(duration)} / 1:30
            </span>
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

/* ── Voice recorder ──────────────────────────────────────────── */
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
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      recorderRef.current = recorder
      const chunks = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
        const ext = extensionFromMime(blob.type)
        const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: blob.type })
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
            className="rounded-lg text-fg-muted hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
            Discard & retake
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-md border border-line bg-bg-soft p-5">
      <div className="flex flex-col items-center gap-4">
        <motion.button
          type="button"
          onClick={recording ? stopRecording : startRecording}
          whileTap={{ scale: 0.94 }}
          className={cn(
            'relative grid size-16 place-items-center rounded-full text-white transition-colors',
            recording ? 'bg-destructive' : 'bg-[#B45309] hover:bg-[#92400E]',
          )}
          aria-label={recording ? 'Stop recording' : 'Start recording'}
        >
          {recording ? (
            <Square className="size-5 fill-current" />
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
          <p className="font-mono text-[26px] font-semibold tabular-nums leading-none text-ink">
            {formatRecorderTime(elapsed)}
          </p>
          <p className="mt-1 text-[10.5px] font-medium uppercase tracking-[0.16em] text-fg-muted">
            {recording ? 'Recording…' : 'Tap to record'}
          </p>
        </div>

        <div className="flex h-11 w-full items-center gap-[2px]">
          {bars.map((value, i) => (
            <span
              key={i}
              aria-hidden
              className={cn(
                'flex-1 rounded-full transition-[height] duration-75',
                recording ? 'bg-neg' : 'bg-bg-muted',
              )}
              style={{
                height: `${Math.max(
                  4,
                  (recording ? value : 0.04 + Math.abs(Math.sin(i * 0.4)) * 0.18) * 100,
                )}%`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── PostComposer ───────────────────────────────────────────── */
export function PostComposer({
  onPosted,
  bare = false,
  initialType = 'TEXT',
  initialVisibility = 'PUBLIC',
}) {
  const { user } = useAuth()
  const toast = useToast()

  const [postType, setPostType] = useState(initialType)
  const [text, setText] = useState('')
  const [visibility, setVisibility] = useState(initialVisibility)
  const [files, setFiles] = useState([])

  const [voiceFile, setVoiceFile] = useState(null)
  const [voicePreviewUrl, setVoicePreviewUrl] = useState(null)

  const [reelFile, setReelFile] = useState(null)

  const [showLocation, setShowLocation] = useState(false)
  const [locationName, setLocationName] = useState('')

  const [showAudioTrack, setShowAudioTrack] = useState(false)
  const [audioTrackName, setAudioTrackName] = useState('')
  const [audioTrackUrl, setAudioTrackUrl] = useState('')

  const [selectedSound, setSelectedSound] = useState(null)
  const [soundPickerOpen, setSoundPickerOpen] = useState(false)

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
    setFiles((current) => [...current, ...picked].slice(0, MAX_FILES))
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
      const data = { postType, textContent: trimmed || undefined, visibility }
      if (locationName.trim()) data.locationName = locationName.trim()
      if (supportsAudioTrack && (audioTrackUrl.trim() || audioTrackName.trim())) {
        data.audioTrackUrl = audioTrackUrl.trim() || undefined
        data.audioTrackName = audioTrackName.trim() || undefined
      }
      if (selectedSound?.soundId) data.soundId = selectedSound.soundId

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

  // ── Icon-only tool button (footer) ───────────────────────────
  function ToolBtn({ icon: Icon, on, onClick, title }) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        className={cn(
          'grid size-8 place-items-center rounded-md transition-colors',
          on ? 'text-fg' : 'text-fg-muted hover:bg-bg-soft hover:text-fg',
        )}
      >
        <Icon className="size-[15px]" strokeWidth={1.8} />
      </button>
    )
  }

  // File input ref for the image/video toolbar button
  const mediaInputRef = useRef(null)

  const formNode = (
    <form onSubmit={handleSubmit} className="flex flex-col">
      {/* ── Type tabs bar ─────────────────────────────────────── */}
      <div className="scrollbar-none flex gap-0 overflow-x-auto border-b border-line bg-bg-soft px-3 py-2">
        {POST_TYPES.map((item) => {
          const Icon = item.icon
          const active = item.value === postType
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => changeType(item.value)}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-[7px] text-[12.5px] font-medium transition-colors',
                active
                  ? 'bg-fg text-background'
                  : 'text-fg-muted hover:bg-background hover:text-fg',
              )}
            >
              <Icon className="size-[13px]" strokeWidth={1.8} />
              {item.label}
            </button>
          )
        })}
      </div>

      {/* ── Body ─────────────────────────────────────────────── */}
      <div className="px-4 py-4 space-y-3">
        {/* Author row + visibility */}
        <div className="flex items-center gap-3">
          <UserAvatar user={user} className="size-8 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-semibold text-fg leading-none">
              {[user.fname, user.lname].filter(Boolean).join(' ') || user.username || 'You'}
            </p>
          </div>
          <VisibilityMenu value={visibility} onChange={setVisibility} />
        </div>

        {/* Textarea */}
        <MentionTextarea
          value={text}
          onChange={(next) => setText(next.slice(0, MAX_TEXT))}
          placeholder={activeType.placeholder}
          rows={postType === 'TEXT' ? 5 : 3}
          allowFollowersToken
          className={cn(
            'w-full resize-none border-0 bg-transparent p-0 text-[14.5px] leading-[1.6] text-fg shadow-none placeholder:text-fg-faint focus-visible:ring-0 focus-visible:ring-offset-0',
            'min-h-[80px]',
          )}
        />

        {/* EMBEDDED carousel */}
        {postType === 'EMBEDDED' && files.length > 0 ? (
          <CarouselPreview
            files={files}
            onRemove={(i) => setFiles((curr) => curr.filter((_, j) => j !== i))}
            onAdd={handleEmbeddedFiles}
            maxFiles={MAX_FILES}
          />
        ) : null}

        {/* EMBEDDED empty drop zone */}
        {postType === 'EMBEDDED' && files.length === 0 ? (
          <DropZone
            onFiles={handleEmbeddedFiles}
            accept="image/*,video/*"
            multiple
            hint={`Up to ${MAX_FILES} files · images and videos`}
          />
        ) : null}

        {/* REEL */}
        {postType === 'REEL' ? (
          reelFile ? (
            <ReelPreview file={reelFile} onClear={() => setReelFile(null)} />
          ) : (
            <DropZone onFiles={handleReelFile} accept="video/*" multiple={false}>
              <span className="grid size-10 place-items-center rounded-full bg-bg-muted text-fg-muted">
                <Video className="size-5" strokeWidth={1.8} />
              </span>
              <p className="text-[13.5px] font-medium text-fg">
                Drop a video, or click to browse
              </p>
              <p className="text-[11.5px] text-fg-muted">Vertical 9:16 · max 1:30</p>
            </DropZone>
          )
        ) : null}

        {/* VOICE */}
        {postType === 'VOICE_POST' ? (
          <div className="space-y-3">
            <VoiceRecorder
              value={voiceFile}
              previewUrl={voicePreviewUrl}
              onCapture={captureVoice}
              onClear={clearVoice}
              onError={(msg) => toast.error(msg)}
            />
            {!voiceFile ? (
              <DropZone onFiles={handleVoiceUpload} accept="audio/*" multiple={false}>
                <span className="grid size-10 place-items-center rounded-full bg-bg-muted text-fg-muted">
                  <Mic className="size-5" strokeWidth={1.8} />
                </span>
                <p className="text-[13.5px] font-medium text-fg">Upload an audio file</p>
                <p className="font-mono text-[11px] text-fg-muted">mp3 · m4a · ogg · wav</p>
              </DropZone>
            ) : null}
          </div>
        ) : null}

        {/* Audio track (EMBEDDED with bg music) */}
        {showAudioTrack && supportsAudioTrack && postType !== 'REEL' ? (
          <div className="flex items-center gap-2 rounded-md border border-line bg-bg-soft px-3 py-2.5">
            <Music className="size-4 shrink-0 text-fg-muted" />
            <Input
              value={audioTrackName}
              onChange={(e) => setAudioTrackName(e.target.value)}
              placeholder="Track name…"
              className="h-7 flex-1 border-0 bg-transparent px-0 text-[13px] shadow-none placeholder:text-fg-faint focus-visible:ring-0"
            />
            <button type="button" onClick={() => { setShowAudioTrack(false); setAudioTrackName(''); setAudioTrackUrl('') }} className="text-fg-muted hover:text-fg">
              <X className="size-3.5" />
            </button>
          </div>
        ) : null}

        {/* Location chip */}
        {showLocation ? (
          <div className="flex items-center gap-2 rounded-md border border-line bg-bg-soft px-3 py-2">
            <MapPin className="size-[13px] shrink-0 text-fg-muted" />
            <Input
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder="Location name…"
              className="h-7 flex-1 border-0 bg-transparent px-0 text-[12.5px] shadow-none placeholder:text-fg-faint focus-visible:ring-0"
            />
            <button type="button" onClick={() => { setShowLocation(false); setLocationName('') }} className="text-fg-muted hover:text-fg">
              <X className="size-3.5" />
            </button>
          </div>
        ) : null}

        {/* Sound chip for REEL */}
        {postType === 'REEL' && (
          <SoundChip
            sound={selectedSound}
            onClick={() => setSoundPickerOpen(true)}
            onRemove={() => setSelectedSound(null)}
          />
        )}
      </div>

      {/* ── Footer toolbar ────────────────────────────────────── */}
      <div className="flex items-center gap-0.5 border-t border-line bg-bg-soft px-4 py-2.5">
        {/* Image/video button */}
        {postType === 'EMBEDDED' ? (
          <>
            <input
              ref={mediaInputRef}
              type="file"
              multiple
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => { if (e.target.files?.length) { handleEmbeddedFiles(Array.from(e.target.files)); e.target.value = '' } }}
            />
            <ToolBtn
              icon={ImageIcon}
              on={files.length > 0}
              onClick={() => mediaInputRef.current?.click()}
              title="Attach photos or videos"
            />
          </>
        ) : postType === 'REEL' ? (
          <ToolBtn icon={Video} on={!!reelFile} title="Video file" />
        ) : postType === 'VOICE_POST' ? (
          <ToolBtn icon={Mic} on={!!voiceFile} title="Voice recording" />
        ) : (
          <ToolBtn icon={ImageIcon} title="Attach media" />
        )}

        <ToolBtn
          icon={MapPin}
          on={showLocation && !!locationName}
          onClick={() => setShowLocation((v) => !v)}
          title="Add location"
        />

        {supportsAudioTrack && postType !== 'REEL' ? (
          <ToolBtn
            icon={Music}
            on={showAudioTrack}
            onClick={() => setShowAudioTrack((v) => !v)}
            title="Add audio track"
          />
        ) : null}

        <ToolBtn icon={AtSign} title="Mention someone" />

        {/* Counter */}
        <span
          className={cn(
            'ml-auto mr-3 font-mono text-[11.5px] tabular-nums',
            charactersLeft < 0 ? 'text-neg' : charactersLeft < 200 ? 'text-warn' : 'text-fg-faint',
          )}
        >
          {text.length.toLocaleString()} / {MAX_TEXT.toLocaleString()}
        </span>

        {/* Save draft */}
        <button
          type="button"
          className="mr-1.5 inline-flex h-8 items-center rounded-md border border-line bg-background px-3 text-[12.5px] font-medium text-fg-soft transition-colors hover:border-line-strong hover:text-fg"
        >
          Save draft
        </button>

        {/* Publish */}
        <button
          type="submit"
          disabled={!canSubmit()}
          className="inline-flex h-8 items-center rounded-md bg-fg px-4 text-[12.5px] font-medium text-background transition-colors hover:bg-fg-soft disabled:opacity-40"
        >
          {submitting ? <Loader2 className="size-3.5 animate-spin" /> : null}
          {submitting ? 'Publishing…' : 'Publish'}
        </button>
      </div>
    </form>
  )

  const soundPickerEl = (
    <SoundPicker
      open={soundPickerOpen}
      onOpenChange={setSoundPickerOpen}
      value={selectedSound}
      onChange={(s) => { setSelectedSound(s); setSoundPickerOpen(false) }}
    />
  )

  if (bare) return <>{formNode}{soundPickerEl}</>

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-line bg-background">
        {formNode}
      </div>
      {soundPickerEl}
    </>
  )
}
