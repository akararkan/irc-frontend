import { useEffect, useState } from 'react'

const BROWSER_PERMISSION_KEY = 'irc-browser-notification-permission-asked'

export function safeNotificationsApi() {
  if (typeof window === 'undefined') return null
  if (!('Notification' in window)) return null
  return window.Notification
}

/**
 * Returns `{ supported, permission, askedBefore, request }` so any UI
 * surface can offer an "Enable browser notifications" affordance.
 *
 * Browsers don't dispatch a permission-change event reliably, so the hook
 * re-reads `Notification.permission` after a request resolves.
 */
export function useBrowserNotificationPermission() {
  const Notif = safeNotificationsApi()
  const supported = Boolean(Notif)
  const [permission, setPermission] = useState(
    supported ? Notif.permission : 'unsupported',
  )

  useEffect(() => {
    if (!supported) return
    setPermission(Notif.permission)
  }, [supported, Notif])

  const askedBefore =
    typeof window !== 'undefined' &&
    window.localStorage?.getItem(BROWSER_PERMISSION_KEY) === '1'

  async function request() {
    if (!supported) return 'unsupported'
    try {
      const next = await Notif.requestPermission()
      if (typeof window !== 'undefined') {
        window.localStorage?.setItem(BROWSER_PERMISSION_KEY, '1')
      }
      setPermission(next)
      return next
    } catch {
      return Notif.permission
    }
  }

  return {
    supported,
    permission,
    askedBefore,
    request,
  }
}
