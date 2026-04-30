import { BadgeCheck, FlaskConical, GraduationCap, Shield, ShieldCheck, User } from 'lucide-react'

const ROLE_MAP = {
  USER: {
    label: 'Member',
    icon: User,
    className: 'bg-slate-500/10 text-slate-600 ring-slate-500/20 dark:text-slate-300',
    dotClass: 'bg-slate-500',
  },
  SCHOLAR: {
    label: 'Scholar',
    icon: GraduationCap,
    className: 'bg-sky-500/15 text-sky-700 ring-sky-500/25 dark:text-sky-300',
    dotClass: 'bg-sky-500',
  },
  RESEARCHER: {
    label: 'Researcher',
    icon: FlaskConical,
    className: 'bg-violet-500/15 text-violet-700 ring-violet-500/25 dark:text-violet-300',
    dotClass: 'bg-violet-500',
  },
  ADMIN: {
    label: 'Admin',
    icon: Shield,
    className: 'bg-amber-500/15 text-amber-700 ring-amber-500/25 dark:text-amber-300',
    dotClass: 'bg-amber-500',
  },
  SUPER_ADMIN: {
    label: 'Super admin',
    icon: ShieldCheck,
    className: 'bg-rose-500/15 text-rose-700 ring-rose-500/25 dark:text-rose-300',
    dotClass: 'bg-rose-500',
  },
}

/**
 * Authorities mirror what the backend actually enforces. Keep these in
 * sync with the @PreAuthorize annotations on the Spring controllers and
 * the role checks inside services.
 *
 *  Roles (Role.java): USER, SCHOLAR, RESEARCHER, ADMIN, SUPER_ADMIN.
 *  Default role on registration is SCHOLAR (AuthServiceImpl).
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

// Roles that can author research.
export const ROLE_CAN_PUBLISH_RESEARCH = new Set([
  'SCHOLAR',
  'RESEARCHER',
  'ADMIN',
  'SUPER_ADMIN',
])

// Roles that can write in the Q&A area at all (ask, answer, give feedback).
export const ROLE_CAN_USE_QNA = new Set([
  'SCHOLAR',
  'ADMIN',
  'SUPER_ADMIN',
])

// Site-wide moderators — used for "admin override" checks that mirror the
// backend's `requester.getRole() == ADMIN || SUPER_ADMIN` shortcuts.
export const ROLE_ADMIN_LIKE = new Set(['ADMIN', 'SUPER_ADMIN'])

/**
 * Roles whose answers in Q&A get an "Expert answer" visual treatment
 * (subtle accent border + chip). Scholar is the canonical case; we
 * include researchers and admins for consistency.
 */
export const ROLE_EXPERT_ANSWERER = new Set([
  'SCHOLAR',
  'RESEARCHER',
  'ADMIN',
  'SUPER_ADMIN',
])

export function getRoleInfo(role) {
  if (!role) return null
  return ROLE_MAP[role] ?? {
    label: role,
    icon: BadgeCheck,
    className: 'bg-muted text-muted-foreground ring-border',
    dotClass: 'bg-muted-foreground',
  }
}

export function canPublishResearch(user) {
  return Boolean(user?.role && ROLE_CAN_PUBLISH_RESEARCH.has(user.role))
}

/** True if the user is allowed to ask, answer, or post in the Q&A area. */
export function canUseQna(user) {
  return Boolean(user?.role && ROLE_CAN_USE_QNA.has(user.role))
}

/** ADMIN or SUPER_ADMIN — used for the admin-override branches. */
export function isAdminLike(user) {
  return Boolean(user?.role && ROLE_ADMIN_LIKE.has(user.role))
}

/**
 * Mirror of `QuestionServiceImpl#canManageQuestion`: question author
 * OR an admin/super-admin. Gates lock/unlock, set limit, accept,
 * give/edit/delete feedback, and delete question.
 */
export function canManageQuestion(user, question) {
  if (!user || !question) return false
  if (user.id && user.id === question.authorId) return true
  return isAdminLike(user)
}

/**
 * Mirror of `QuestionServiceImpl#canManageAnswer`: answer author OR
 * question author OR admin/super-admin. Gates edit/delete answer.
 */
export function canManageAnswer(user, question, answer) {
  if (!user || !question || !answer) return false
  if (user.id && user.id === answer.authorId) return true
  return canManageQuestion(user, question)
}

export function isExpertAnswerer(role) {
  return Boolean(role && ROLE_EXPERT_ANSWERER.has(role))
}
