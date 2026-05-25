import { useEffect, useRef, useState } from 'react'
import { Music, Pause, Play, Search, Upload, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getSoundsByCategory } from '@/features/sounds/sounds.api'
import { cn } from '@/lib/utils'

const CATEGORIES = [
  { value: 'NASHEED',           label: 'Nasheed' },
  { value: 'QURAN_RECITATION',  label: 'Quran recitation' },
  { value: 'LECTURE_CLIP',      label: 'Lecture clip' },
  { value: 'NATURE',            label: 'Nature' },
  { value: 'ORIGINAL',          label: 'Original' },
  { value: 'PLATFORM_MUSIC',    label: 'Platform music' },
]

/* ── Waveform placeholder ─────────────────────────────────────── */
function MiniWaveform({ playing }) {
  const bars = [40, 70, 55, 85, 45, 65, 90, 50, 75, 60, 80, 45, 70, 55, 85]
  return (
    <div className="flex h-6 items-center gap-[2px]">
      {bars.map((h, i) => (
        <span
          key={i}
          className={cn(
            'w-[2px] rounded-full transition-all duration-150',
            playing ? 'bg-fg' : 'bg-line-strong',
          )}
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  )
}

/* ── Single sound row ─────────────────────────────────────────── */
function SoundRow({ sound, selected, onSelect }) {
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef(null)
  const isSelected = selected?.soundId === sound.soundId

  function togglePlay(e) {
    e.stopPropagation()
    if (!sound.audioUrl) return
    if (!audioRef.current) {
      audioRef.current = new Audio(sound.audioUrl)
      audioRef.current.onended = () => setPlaying(false)
    }
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      audioRef.current.play().catch(() => {})
      setPlaying(true)
    }
  }

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  return (
    <div
      onClick={() => onSelect(isSelected ? null : sound)}
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 transition-colors',
        isSelected
          ? 'border-fg bg-fg text-background'
          : 'border-line bg-background hover:bg-bg-soft',
      )}
    >
      {/* Play button */}
      <button
        type="button"
        onClick={togglePlay}
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-full border transition-colors',
          isSelected
            ? 'border-background/30 bg-background/20 text-background'
            : 'border-line bg-bg-soft text-fg-soft hover:bg-bg-muted',
        )}
        aria-label={playing ? 'Pause preview' : 'Play preview'}
      >
        {playing
          ? <Pause className="size-3.5" strokeWidth={2} />
          : <Play  className="size-3.5 translate-x-[1px]" strokeWidth={2} />
        }
      </button>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className={cn(
          'truncate text-[13.5px] font-semibold',
          isSelected ? 'text-background' : 'text-fg',
        )}>
          {sound.title}
        </p>
        <div className={cn(
          'mt-0.5 flex items-center gap-2 font-mono text-[10.5px]',
          isSelected ? 'text-background/70' : 'text-fg-muted',
        )}>
          <span>{sound.artistName}</span>
          {sound.durationSeconds ? (
            <>
              <span>·</span>
              <span>{Math.floor(sound.durationSeconds / 60)}:{String(sound.durationSeconds % 60).padStart(2, '0')}</span>
            </>
          ) : null}
        </div>
      </div>

      {/* Waveform */}
      <MiniWaveform playing={playing && !isSelected} />

      {/* Selected check */}
      {isSelected ? (
        <div className="shrink-0">
          <div className="flex size-5 items-center justify-center rounded-full bg-background">
            <span className="text-fg text-[10px] font-bold">✓</span>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/* ── SoundPicker dialog ─────────────────────────────────────────── */
export function SoundPicker({ open, onOpenChange, value, onChange }) {
  const [category, setCategory] = useState('NASHEED')
  const [sounds, setSounds] = useState([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!open) return
    setLoading(true)
    getSoundsByCategory(category, { pageSize: 30 })
      .then((data) => setSounds(Array.isArray(data) ? data : []))
      .catch(() => setSounds([]))
      .finally(() => setLoading(false))
  }, [open, category])

  const filtered = query.trim()
    ? sounds.filter(
        (s) =>
          s.title?.toLowerCase().includes(query.toLowerCase()) ||
          s.artistName?.toLowerCase().includes(query.toLowerCase()),
      )
    : sounds

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[80vh] max-w-lg flex-col gap-0 rounded-lg border-line p-0">
        <DialogHeader className="border-b border-line px-5 pb-0 pt-5">
          <DialogTitle className="flex items-center gap-2 text-[15px] font-semibold">
            <Music className="size-4 text-fg-muted" strokeWidth={1.7} />
            Sound library
          </DialogTitle>

          {/* Category tabs */}
          <div className="scrollbar-none flex gap-0 overflow-x-auto border-b border-line pb-px pt-3">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setCategory(cat.value)}
                className={cn(
                  'shrink-0 whitespace-nowrap px-3 pb-3 text-[12.5px] font-medium transition-colors',
                  category === cat.value
                    ? 'border-b-2 border-fg text-fg'
                    : 'text-fg-muted hover:text-fg',
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </DialogHeader>

        {/* Search */}
        <div className="border-b border-line px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-fg-muted" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search sounds…"
              className="h-8 rounded-md border-line bg-bg-soft pl-8 text-[12.5px] placeholder:text-fg-faint"
            />
          </div>
        </div>

        {/* Currently selected */}
        {value ? (
          <div className="flex items-center gap-3 border-b border-line bg-bg-soft px-4 py-2.5">
            <Music className="size-3.5 shrink-0 text-fg-muted" strokeWidth={1.7} />
            <p className="flex-1 truncate text-[12.5px] font-medium text-fg">
              {value.title}
              <span className="ml-2 text-fg-muted">· {value.artistName}</span>
            </p>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-fg-muted transition-colors hover:text-fg"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : null}

        {/* Sound list */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-fg-muted">
              <span className="text-[12.5px]">Loading sounds…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-fg-muted">
              <Music className="size-8 text-fg-faint" strokeWidth={1.5} />
              <p className="text-[12.5px]">No sounds found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((s) => (
                <SoundRow
                  key={s.soundId}
                  sound={s}
                  selected={value}
                  onSelect={onChange}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-fg-muted transition-colors hover:text-fg"
          >
            <Upload className="size-3.5" strokeWidth={1.7} />
            Upload sound
          </button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-md border-line text-[12.5px]"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-8 rounded-md bg-fg text-[12.5px] text-background hover:bg-fg-soft"
              onClick={() => onOpenChange(false)}
            >
              {value ? 'Confirm sound' : 'No sound'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ── Compact sound chip (for use in the composer toolbar) ─────── */
export function SoundChip({ sound, onClick, onRemove }) {
  if (!sound) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5 rounded-sm border border-line bg-bg-soft px-2.5 py-1.5 text-[12px] font-medium text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
      >
        <Music className="size-3.5" strokeWidth={1.7} />
        Add sound
      </button>
    )
  }

  return (
    <div className="inline-flex items-center gap-1.5 rounded-sm border border-line bg-bg-soft px-2.5 py-1.5">
      <Music className="size-3.5 shrink-0 text-fg-muted" strokeWidth={1.7} />
      <span className="max-w-[140px] truncate text-[12px] font-medium text-fg">
        {sound.title}
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 text-fg-muted transition-colors hover:text-fg"
      >
        <X className="size-3" />
      </button>
    </div>
  )
}
