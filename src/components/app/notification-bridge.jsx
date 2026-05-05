import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { useNotifications } from '@/features/notifications/notifications-context'
import { useToast } from '@/components/ui/toaster'
import { safeNotificationsApi } from '@/lib/browser-notifications'
import { notificationHref } from '@/lib/notifications'
import { playNotificationChime } from '@/lib/notification-sound'

/**
 * Track the original document title and a "pending unread" badge so we
 * can flash `(N) Original Title` while the tab is blurred and restore
 * cleanly on focus. Lives at module scope so re-mounts of the bridge
 * (e.g. on route change) don't lose the count.
 */
let originalTitle = null
let pendingUnseen = 0

function rememberTitle() {
  if (originalTitle == null && typeof document !== 'undefined') {
    originalTitle = document.title
  }
}

function applyTitleBadge() {
  if (typeof document === 'undefined') return
  rememberTitle()
  const base = originalTitle ?? document.title
  if (pendingUnseen > 0) {
    const label = pendingUnseen > 99 ? '99+' : pendingUnseen
    document.title = `(${label}) ${base}`
  } else {
    document.title = base
  }
}

function clearTitleBadge() {
  pendingUnseen = 0
  applyTitleBadge()
}

function bumpTitleBadge() {
  rememberTitle()
  pendingUnseen += 1
  applyTitleBadge()
}

/**
 * Headless component that bridges the SSE notification stream into the
 * surfaces a user actually sees while doing other things in the app:
 *
 *   1. Toaster pop-up — clickable, routes to the notification's target.
 *   2. Browser-native push (when the tab is hidden / blurred) — only
 *      fires when permission is already granted; we never auto-prompt
 *      here because Chrome punishes auto-prompted permissions.
 *   3. Soft chime via Web Audio (opt-out via the notifications page).
 *   4. Document-title flash — `(3) IRC` while the tab is blurred,
 *      restored on focus so users notice activity from another window.
 *
 * Mounted once at the app shell. Suppresses itself on the /notifications
 * page (no point double-surfacing where the user is already reading).
 */
export function NotificationBridge() {
  const { subscribeIncoming } = useNotifications()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  // Latest pathname must be readable from the SSE callback without
  // tearing down the subscription on every route change.
  const pathnameRef = useRef(location.pathname)
  useEffect(() => {
    pathnameRef.current = location.pathname
  }, [location.pathname])

  // Clear the title badge as soon as the user comes back to the tab —
  // they've now "seen" the activity even before opening notifications.
  useEffect(() => {
    function handleVisibility() {
      if (!document.hidden) clearTitleBadge()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleVisibility)
      // Also clean up if the bridge unmounts (sign-out etc.).
      clearTitleBadge()
    }
  }, [])

  useEffect(() => {
    if (typeof subscribeIncoming !== 'function') return undefined

    return subscribeIncoming((notification) => {
      if (!notification || notification.isRead) return
      // The user is literally on the notifications screen — let them
      // see the row appear in-place rather than blasting a toast.
      if (pathnameRef.current === '/notifications') return

      const href = notificationHref(notification)
      const title = notification.title?.trim() || 'New activity'
      const body = notification.body?.trim() || ''

      toast.toast({
        tone: 'info',
        title,
        message: body || 'Someone reacted to your activity.',
        action: href
          ? {
              label: 'Open',
              onClick: () => navigate(href),
            }
          : undefined,
      })

      // Soft chime — no-ops cleanly when the user has it muted, when
      // the AudioContext can't resume (privacy mode), or when the page
      // hasn't received its first user gesture yet.
      playNotificationChime()

      // Title badge fires whenever the tab isn't focused — covers both
      // hidden-tab and another-window-foregrounded cases.
      if (typeof document !== 'undefined' && document.hidden) {
        bumpTitleBadge()
      }

      // Browser-native push — only when the tab is genuinely hidden.
      const Notif = safeNotificationsApi()
      if (Notif && Notif.permission === 'granted' && document.hidden) {
        try {
          const native = new Notif(title, {
            body,
            tag: `irc-notification-${notification.id}`,
            renotify: false,
          })
          native.onclick = () => {
            window.focus()
            if (href) navigate(href)
            native.close()
          }
        } catch {
          // Some browsers throw under tighter privacy modes — non-fatal.
        }
      }
    })
  }, [subscribeIncoming, toast, navigate])

  return null
}
