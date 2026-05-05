import { useEffect, useState } from 'react'

/**
 * Notification chime — Web Audio synthesis (no audio file dependency).
 *
 * Two soft sine tones with exponential decay envelopes — the "ding-dong"
 * pattern most apps converge on (Slack, Discord, Telegram). We synthesize
 * instead of bundling an mp3 because:
 *   - zero kilobytes added to the bundle
 *   - the user can swap themes / brand without re-recording
 *   - the same code works on any platform that supports AudioContext
 *
 * Browsers freeze the AudioContext until the first user gesture; we lazy-
 * create it and `resume()` defensively so the first chime after navigation
 * works reliably.
 */

const STORAGE_KEY = 'irc-notification-sound-enabled'
const DEFAULT_VOLUME = 0.32

let audioContext = null

function getAudioContext() {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext || window.webkitAudioContext
  if (!Ctor) return null
  if (!audioContext) {
    try {
      audioContext = new Ctor()
    } catch {
      return null
    }
  }
  if (audioContext.state === 'suspended') {
    // resume() is a Promise — fire and forget; we don't block the chime.
    audioContext.resume?.().catch(() => {})
  }
  return audioContext
}

/**
 * Schedule a single sine-tone "blip" with a short attack and exponential
 * decay so it never clicks on stop. `gainNode` lets the caller chain.
 */
function scheduleBlip(ctx, frequency, startAt, durationSeconds, volume) {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(frequency, startAt)
  // 6ms attack avoids the on-set click; long-tail decay = "soft chime".
  gain.gain.setValueAtTime(0, startAt)
  gain.gain.linearRampToValueAtTime(volume, startAt + 0.006)
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    startAt + durationSeconds,
  )
  oscillator.connect(gain).connect(ctx.destination)
  oscillator.start(startAt)
  oscillator.stop(startAt + durationSeconds + 0.02)
}

/**
 * Play the notification chime. Safe to call from anywhere — no-ops cleanly
 * on browsers without AudioContext, on muted audio sessions, or when the
 * user has turned the preference off.
 */
export function playNotificationChime({ volume = DEFAULT_VOLUME } = {}) {
  if (!isNotificationSoundEnabled()) return
  const ctx = getAudioContext()
  if (!ctx) return
  try {
    const now = ctx.currentTime
    // High note immediately; low note 110ms later — a friendly two-step.
    scheduleBlip(ctx, 880, now, 0.18, volume)
    scheduleBlip(ctx, 660, now + 0.11, 0.22, volume)
  } catch {
    // AudioContext occasionally throws under privacy modes — non-fatal.
  }
}

// ─── Preference (persisted to localStorage) ──────────────────────────

const subscribers = new Set()

export function isNotificationSoundEnabled() {
  if (typeof window === 'undefined') return false
  // Default: ON. The user explicitly asked to be alerted to new
  // notifications. Anyone who finds it intrusive can toggle off in
  // the notifications page header — preference persists.
  return window.localStorage?.getItem(STORAGE_KEY) !== '0'
}

export function setNotificationSoundEnabled(enabled) {
  if (typeof window === 'undefined') return
  window.localStorage?.setItem(STORAGE_KEY, enabled ? '1' : '0')
  // Notify any active hook subscriber so other tabs stay in sync.
  for (const fn of subscribers) {
    try {
      fn(enabled)
    } catch {
      // a misbehaving subscriber must never break the publisher
    }
  }
}

/**
 * React hook — returns `[enabled, setEnabled]`. Stays in sync across
 * components; flips the setting in localStorage so a reload remembers.
 */
export function useNotificationSoundPreference() {
  const [enabled, setLocal] = useState(() => isNotificationSoundEnabled())

  useEffect(() => {
    function handler(next) {
      setLocal(next)
    }
    subscribers.add(handler)
    // Cross-tab sync — `storage` events fire in *other* tabs only.
    function onStorage(event) {
      if (event.key === STORAGE_KEY) {
        setLocal(event.newValue !== '0')
      }
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', onStorage)
    }
    return () => {
      subscribers.delete(handler)
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', onStorage)
      }
    }
  }, [])

  function update(next) {
    const value = Boolean(next)
    setNotificationSoundEnabled(value)
    setLocal(value)
    // Play a preview the moment the user enables — confirms it works.
    if (value) playNotificationChime({ volume: 0.24 })
  }

  return [enabled, update]
}
