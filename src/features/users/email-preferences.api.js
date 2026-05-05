import { api } from '@/api/client'

// ══════════════════════════════════════════════════════════════
//  EMAIL PREFERENCES  —  /api/v1/users/me/email-preferences
//
//  Per-category opt-out for the email pipeline. Each setting maps to
//  a NotificationCategory bucket on the server:
//
//    - emailNotificationsEnabled (master)
//    - emailSocialEnabled        (POSTS / QNA / RESEARCH)
//    - emailMentionsEnabled      (USER_MENTIONED)
//    - emailSystemEnabled        (system / admin alerts)
// ══════════════════════════════════════════════════════════════

export async function getEmailPreferences() {
  const response = await api.get('/api/v1/users/me/email-preferences')
  return response.data ?? {}
}

/** Partial update — any omitted field keeps its value server-side. */
export async function updateEmailPreferences(patch) {
  const response = await api.patch('/api/v1/users/me/email-preferences', patch)
  return response.data ?? {}
}

/** One-click kill switch — turns off the master `emailNotificationsEnabled`. */
export async function unsubscribeAllEmail() {
  await api.post('/api/v1/users/me/email-preferences/unsubscribe-all')
}

/**
 * Sends a minimal test message to the current user's email column.
 * Bypasses the notification pipeline so the user can verify SMTP
 * health independently of any per-event filtering / throttling.
 */
export async function sendTestEmail() {
  const response = await api.post('/api/v1/users/me/email-preferences/test')
  return response.data ?? {}
}
