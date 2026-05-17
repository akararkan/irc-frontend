import { BadgeCheck, BookOpen, GraduationCap, Microscope, Shield, ShieldCheck, Swords, User } from 'lucide-react'

// Role colour mapping mirrors the IRC Scholar design spec:
//   Scholar      → info  (sky)     · mortarboard icon
//   Researcher   → success (sage)  · microscope icon
//   Moderator    → purple          · swords icon
//   Editor       → indigo          · book-open icon
//   Admin        → warning (amber) · shield icon
//   Super admin  → danger  (rust)  · shield-check icon
//   User         → no badge (returned null in getRoleInfo for non-mapped)
// Each className uses the semantic `pill-*` utilities so the badge
// reads identically to the static spec mockups.
const ROLE_MAP = {
  USER: {
    label: 'Member',
    icon: User,
    className: 'pill-mute',
    dotClass: 'bg-ink-3',
  },
  SCHOLAR: {
    label: 'Scholar',
    icon: GraduationCap,
    className: 'pill-info',
    dotClass: 'bg-info-fg',
  },
  RESEARCHER: {
    label: 'Researcher',
    icon: Microscope,
    className: 'pill-success',
    dotClass: 'bg-ok-fg',
  },
  MODERATOR: {
    label: 'Moderator',
    icon: Swords,
    className: 'pill-purple',
    dotClass: 'bg-purple-500',
  },
  EDITOR: {
    label: 'Editor',
    icon: BookOpen,
    className: 'pill-indigo',
    dotClass: 'bg-indigo-500',
  },
  ADMIN: {
    label: 'Admin',
    icon: Shield,
    className: 'pill-warn',
    dotClass: 'bg-warn-fg',
  },
  SUPER_ADMIN: {
    label: 'Super admin',
    icon: ShieldCheck,
    className: 'pill-danger',
    dotClass: 'bg-danger-fg',
  },
}

/**
 * Authorities mirror what the backend actually enforces. Keep these in
 * sync with the @PreAuthorize annotations on the Spring controllers and
 * the role checks inside services.
 *
 *  Roles (Role.java): USER, SCHOLAR, RESEARCHER, MODERATOR, EDITOR, ADMIN, SUPER_ADMIN.
 *  Default role on registration is USER (AuthServiceImpl).
 *
 *  ───────────────────────────────────────────────────────────────────
 *  Posts / post comments  (PostController, PostCommentController)
 *      Any authenticated user. Ownership = author can edit/delete.
 *
 *  Research social  (ResearchSocialController)
 *      Any authenticated user can react/save/share/comment.
 *      Ownership = comment author can edit/delete.
 *      Research author may also moderate comments on their research.
 *
 *  Research authoring  (ResearchController + ResearchServiceImpl#1249)
 *      hasAnyRole('SCHOLAR','RESEARCHER','ADMIN','SUPER_ADMIN').
 *      Ownership: must own the research to mutate.
 *
 *  Q&A area  (QuestionServiceImpl#findScholarOrThrow, line 443)
 *      SCHOLAR | ADMIN | SUPER_ADMIN  only. RESEARCHER is excluded.
 *      USER is read-only.
 *
 *  Q&A management  (canManageQuestion #456 / canManageAnswer #467)
 *      - lock/unlock answers, set limit, accept/unaccept, add/edit/
 *        delete feedback: question author OR admin/super-admin.
 *      - edit/delete answer: answer author OR question author OR admin.
 *      - edit own question / delete own question: question author only
 *        (admins also pass through canManageQuestion).
 */

// Roles that can author research. Admins moderate the platform but
// don't publish original scholarship under their administrative seat —
// only Scholars and Researchers create content.
export const ROLE_CAN_PUBLISH_RESEARCH = new Set([
  'SCHOLAR',
  'RESEARCHER',
])

// Roles that can ask a question / open a new Q&A thread. Asking a
// question is treated as content authoring (same gate as research) —
// only Scholars and Researchers may open threads. Admins still
// moderate via `canManageQuestion`.
export const ROLE_CAN_USE_QNA = new Set([
  'SCHOLAR',
  'RESEARCHER',
])

// Roles that can author an answer or reanswer — same Scholar +
// Researcher set as the asker pool.
export const ROLE_CAN_ANSWER_QNA = new Set([
  'SCHOLAR',
  'RESEARCHER',
])

// Site-wide moderators — used for "admin override" checks that mirror the
// backend's `requester.getRole() == ADMIN || SUPER_ADMIN` shortcuts.
// MODERATOR can act on content but cannot manage the platform itself.
export const ROLE_ADMIN_LIKE = new Set(['MODERATOR', 'ADMIN', 'SUPER_ADMIN'])

// Roles that can manage the research peer-review queue (Editor seat).
export const ROLE_CAN_EDIT_RESEARCH_QUEUE = new Set(['EDITOR', 'ADMIN', 'SUPER_ADMIN'])

/**
 * Roles whose answers in Q&A get an "Expert answer" visual treatment
 * (subtle accent border + chip). Scholar is the canonical case; we
 * include researchers and admins for consistency.
 */
export const ROLE_EXPERT_ANSWERER = new Set([
  'SCHOLAR',
  'RESEARCHER',
  'MODERATOR',
  'ADMIN',
  'SUPER_ADMIN',
])

export function getRoleInfo(role) {
  if (!role) return null
  return ROLE_MAP[role] ?? {
    label: role,
    icon: BadgeCheck,
    className: 'pill-mute',
    dotClass: 'bg-muted-foreground',
  }
}

export function canPublishResearch(user) {
  return Boolean(user?.role && ROLE_CAN_PUBLISH_RESEARCH.has(user.role))
}

export function canUseQna(user) {
  return Boolean(user?.role && ROLE_CAN_USE_QNA.has(user.role))
}

export function canAskQuestion(user) {
  return Boolean(user?.role && ROLE_CAN_USE_QNA.has(user.role))
}

export function canAnswerQuestion(user) {
  return Boolean(user?.role && ROLE_CAN_ANSWER_QNA.has(user.role))
}

/**
 * Marking an answer as "best" is the question author's privilege alone
 * — only they decide which answer resolves their question. Admins do
 * NOT override this (they can still delete or moderate, but the
 * editorial judgement of "this is the best answer" belongs to the
 * person who asked).
 *
 * Callers must pass the `question` so we can compare authors. The
 * old single-arg signature (just `user`) is rejected since it can't
 * answer the underlying question.
 */
export function canVoteBestAnswer(user, question) {
  if (!user || !question) return false
  if (!user.id) return false
  return user.id === question.authorId
}

export function isAdminLike(user) {
  return Boolean(user?.role && ROLE_ADMIN_LIKE.has(user.role))
}

export function canManageQuestion(user, question) {
  if (!user || !question) return false
  if (user.id && user.id === question.authorId) return true
  return isAdminLike(user)
}

export function canManageAnswer(user, question, answer) {
  if (!user || !question || !answer) return false
  if (user.id && user.id === answer.authorId) return true
  return canManageQuestion(user, question)
}

export function isExpertAnswerer(role) {
  return Boolean(role && ROLE_EXPERT_ANSWERER.has(role))
}
