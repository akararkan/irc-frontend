import { useCallback, useEffect, useState } from 'react'
import {
  AtSign,
  BadgeCheck,
  BellRing,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  ImagePlus,
  Link2,
  Loader2,
  Lock,
  LogOut,
  Mail,
  MailCheck,
  Phone,
  Plus,
  Send,
  Settings as SettingsIcon,
  Shield,
  Trash2,
  Upload,
  User,
  Users,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/app/empty-state'
import { UserAvatar } from '@/components/app/user-avatar'
import { useAuth } from '@/features/auth/auth-context'
import {
  addContact,
  addLink,
  deleteContact,
  deleteCoverImage,
  deleteLink,
  deleteProfileImage,
  updateProfile,
  updateUserProfile,
  uploadCoverImage,
  uploadProfileImage,
} from '@/features/users/users.api'
import {
  getEmailPreferences,
  sendTestEmail,
  unsubscribeAllEmail,
  updateEmailPreferences,
} from '@/features/users/email-preferences.api'
import { useToast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import { extractApiMessage, friendlyApiMessage } from '@/lib/api-error'
import { getAvatarUrl, getCoverUrl } from '@/lib/format'

const LINK_PLATFORMS = [
  'PERSONAL_WEBSITE',
  'FACEBOOK',
  'TWITTER',
  'INSTAGRAM',
  'LINKEDIN',
  'YOUTUBE',
  'GITHUB',
  'ORCID',
  'RESEARCHGATE',
  'GOOGLE_SCHOLAR',
  'TELEGRAM',
  'OTHER',
]

const CONTACT_PLATFORMS = [
  'EMAIL',
  'PHONE',
  'TELEGRAM',
  'WHATSAPP',
  'SIGNAL',
  'VIBER',
  'SKYPE',
  'OTHER',
]

const CONTENT_LANGUAGES = [
  { value: 'EN', label: 'English' },
  { value: 'AR', label: 'Arabic (العربية)' },
  { value: 'CKB', label: 'Sorani Kurdish (کوردی)' },
]

function prettyPlatform(value) {
  return value.replace('_', ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())
}

// ─── Shared form-row layout ─────────────────────────────────────────
function FieldRow({ label, hint, hintMono, children, noBorder = false }) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-4 py-7 sm:grid-cols-[1fr_1.6fr] sm:gap-10',
        !noBorder && 'border-b-[0.5px] border-border',
      )}
    >
      <div className="pt-0.5">
        <p className="font-mono text-[11px] uppercase tracking-wider text-ink-3">{label}</p>
        {hint ? (
          <p className="mt-1 font-display text-[13px] italic leading-[1.5] text-ink-3">
            {hint}
            {hintMono ? (
              <> <code className="font-mono not-italic">{hintMono}</code></>
            ) : null}
          </p>
        ) : null}
      </div>
      <div>{children}</div>
    </div>
  )
}

// ─── Profile form (identity + public profile layer) ─────────────────
function ProfileForm() {
  const { user, refreshCurrentUser } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState({
    fname: '',
    lname: '',
    username: '',
    displayName: '',
    location: '',
    selfDescriber: '',
    profileBio: '',
  })
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)

  function buildForm(u) {
    return {
      fname: u.fname ?? '',
      lname: u.lname ?? '',
      username: u.username ?? '',
      displayName: u.profile?.displayName ?? '',
      location: u.profile?.location ?? u.location ?? '',
      selfDescriber: u.profile?.selfDescriber ?? u.selfDescriber ?? '',
      profileBio: u.profile?.profileBio ?? u.profileBio ?? '',
    }
  }

  useEffect(() => {
    if (!user) return
    setForm(buildForm(user))
    setDirty(false)
  }, [user])

  function handleChange(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setDirty(true)
  }

  function handleDiscard() {
    if (!user) return
    setForm(buildForm(user))
    setDirty(false)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    try {
      await Promise.all([
        updateProfile({ fname: form.fname, lname: form.lname, username: form.username }),
        updateUserProfile({
          displayName: form.displayName || null,
          location: form.location,
          selfDescriber: form.selfDescriber,
          profileBio: form.profileBio,
        }),
      ])
      await refreshCurrentUser()
      toast.success('Profile updated.')
      setDirty(false)
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not update profile.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleAvatarUpload(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    try {
      await uploadProfileImage(file)
      await refreshCurrentUser()
      toast.success('Photo updated.')
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not upload photo.'))
    } finally {
      setUploadingAvatar(false)
      event.target.value = ''
    }
  }

  async function handleAvatarRemove() {
    setUploadingAvatar(true)
    try {
      await deleteProfileImage()
      await refreshCurrentUser()
      toast.success('Photo removed.')
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not remove photo.'))
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function handleCoverUpload(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setUploadingCover(true)
    try {
      await uploadCoverImage(file)
      await refreshCurrentUser()
      toast.success('Cover image updated.')
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not upload cover image.'))
    } finally {
      setUploadingCover(false)
      event.target.value = ''
    }
  }

  async function handleCoverRemove() {
    setUploadingCover(true)
    try {
      await deleteCoverImage()
      await refreshCurrentUser()
      toast.success('Cover image removed.')
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not remove cover image.'))
    } finally {
      setUploadingCover(false)
    }
  }

  if (!user) return null

  const hasCover = Boolean(getCoverUrl(user))
  const hasAvatar = Boolean(getAvatarUrl(user))

  return (
    <div>
      <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ink-3">
        Account · Profile
      </p>
      <h2 className="font-display text-[32px] font-semibold leading-[1.05] tracking-[-0.018em] text-ink sm:text-[38px]">
        Your public profile.
      </h2>
      <p className="mt-2 font-display text-[14px] italic leading-[1.6] text-ink-3">
        Name, avatar, cover image, bio, and public tagline.
      </p>

      <form onSubmit={handleSubmit} className="mt-8">
        {/* AVATAR */}
        <FieldRow label="Photo" hint="Shown everywhere next to your name.">
          <div className="flex items-center gap-4">
            <UserAvatar user={user} className="size-[72px] rounded-2xl text-[24px]" />
            <label
              className={cn(
                'inline-flex cursor-pointer items-center gap-1.5 rounded-xl border-[0.5px] border-border px-4 py-2.5 text-[13px] font-medium text-ink transition-colors hover:bg-secondary',
                uploadingAvatar && 'cursor-not-allowed opacity-50',
              )}
            >
              <Upload className="size-3.5" strokeWidth={1.8} />
              {uploadingAvatar ? 'Uploading…' : 'Upload'}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleAvatarUpload}
                disabled={uploadingAvatar}
              />
            </label>
            {hasAvatar ? (
              <button
                type="button"
                onClick={handleAvatarRemove}
                disabled={uploadingAvatar}
                className="text-[13px] font-medium text-ink-3 transition-colors hover:text-ink disabled:opacity-50"
              >
                Remove
              </button>
            ) : null}
          </div>
        </FieldRow>

        {/* COVER IMAGE */}
        <FieldRow label="Cover image" hint="Banner shown at the top of your profile page.">
          <div className="space-y-3">
            {hasCover ? (
              <div className="relative overflow-hidden rounded-xl border-[0.5px] border-border">
                <img
                  src={getCoverUrl(user)}
                  alt="Cover"
                  className="h-24 w-full object-cover"
                />
              </div>
            ) : (
              <div className="flex h-24 items-center justify-center rounded-xl border-[0.5px] border-dashed border-border bg-muted/30">
                <span className="text-[12px] text-ink-3">No cover image</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <label
                className={cn(
                  'inline-flex cursor-pointer items-center gap-1.5 rounded-xl border-[0.5px] border-border px-4 py-2.5 text-[13px] font-medium text-ink transition-colors hover:bg-secondary',
                  uploadingCover && 'cursor-not-allowed opacity-50',
                )}
              >
                <ImagePlus className="size-3.5" strokeWidth={1.8} />
                {uploadingCover ? 'Uploading…' : hasCover ? 'Replace' : 'Upload'}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleCoverUpload}
                  disabled={uploadingCover}
                />
              </label>
              {hasCover ? (
                <button
                  type="button"
                  onClick={handleCoverRemove}
                  disabled={uploadingCover}
                  className="text-[13px] font-medium text-ink-3 transition-colors hover:text-ink disabled:opacity-50"
                >
                  Remove
                </button>
              ) : null}
            </div>
          </div>
        </FieldRow>

        {/* DISPLAY NAME */}
        <FieldRow label="Display name" hint="Public name shown on your profile. For organisations, use the org name.">
          <Input
            id="displayName"
            name="displayName"
            value={form.displayName}
            onChange={handleChange}
            placeholder={`${form.fname} ${form.lname}`.trim() || 'Your display name'}
            className="rounded-xl"
          />
        </FieldRow>

        {/* NAME */}
        <FieldRow label="Name" hint="First and last — used in emails and auth.">
          <div className="flex gap-3">
            <Input
              id="fname"
              name="fname"
              value={form.fname}
              onChange={handleChange}
              placeholder="First"
              className="rounded-xl"
            />
            <Input
              id="lname"
              name="lname"
              value={form.lname}
              onChange={handleChange}
              placeholder="Last"
              className="rounded-xl"
            />
          </div>
        </FieldRow>

        {/* USERNAME */}
        <FieldRow label="Username" hint="Public handle.">
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] font-medium text-ink-3">
              @
            </span>
            <Input
              id="username"
              name="username"
              value={form.username}
              onChange={handleChange}
              placeholder="yourhandle"
              className="rounded-xl pl-8"
            />
          </div>
        </FieldRow>

        {/* SELF-DESCRIBER */}
        <FieldRow label="Tagline" hint="One-line description shown under your name.">
          <Input
            id="selfDescriber"
            name="selfDescriber"
            value={form.selfDescriber}
            onChange={handleChange}
            placeholder="Researcher in Uṣūl al-Fiqh and Comparative Fiqh"
            className="rounded-xl"
          />
        </FieldRow>

        {/* LOCATION */}
        <FieldRow label="Location" hint="City, country.">
          <Input
            id="location"
            name="location"
            value={form.location}
            onChange={handleChange}
            placeholder="Sulaymaniyah, Kurdistan Region"
            className="rounded-xl"
          />
        </FieldRow>

        {/* BIO */}
        <FieldRow label="Bio" hint="Longer description shown on your profile page." noBorder>
          <Textarea
            id="profileBio"
            name="profileBio"
            value={form.profileBio}
            onChange={handleChange}
            rows={5}
            placeholder="Tell the community about your work, specialisation, and interests."
            className="rounded-xl"
          />
        </FieldRow>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-8">
          <button
            type="button"
            onClick={handleDiscard}
            disabled={saving || !dirty}
            className="rounded-xl border-[0.5px] border-border px-6 py-3 text-[14px] font-medium text-ink transition-colors hover:bg-secondary disabled:opacity-40"
          >
            Discard
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl border-[0.5px] border-ink bg-ink px-6 py-3 text-[14px] font-semibold text-paper transition-colors hover:bg-ink-2 disabled:opacity-50"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                Saving…
              </span>
            ) : (
              'Save changes'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Academic / institutional profile panel ─────────────────────────
function AcademicPanel() {
  const { user, refreshCurrentUser } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState({
    academicTitle: '',
    institutionName: '',
    websiteUrl: '',
    contentLanguage: 'EN',
    isForHire: false,
  })
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  function buildForm(u) {
    return {
      academicTitle: u.profile?.academicTitle ?? '',
      institutionName: u.profile?.institutionName ?? '',
      websiteUrl: u.profile?.websiteUrl ?? u.website ?? '',
      contentLanguage: u.profile?.contentLanguage ?? 'EN',
      isForHire: u.profile?.isForHire ?? false,
    }
  }

  useEffect(() => {
    if (!user) return
    setForm(buildForm(user))
    setDirty(false)
  }, [user])

  function handleChange(event) {
    const { name, value, type, checked } = event.target
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
    setDirty(true)
  }

  function handleDiscard() {
    if (!user) return
    setForm(buildForm(user))
    setDirty(false)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    try {
      await updateUserProfile({
        academicTitle: form.academicTitle || null,
        institutionName: form.institutionName || null,
        websiteUrl: form.websiteUrl || null,
        contentLanguage: form.contentLanguage,
        isForHire: form.isForHire,
      })
      await refreshCurrentUser()
      toast.success('Academic profile updated.')
      setDirty(false)
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not update academic profile.'))
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null

  return (
    <div>
      <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ink-3">
        Account · Academic
      </p>
      <h2 className="font-display text-[32px] font-semibold leading-[1.05] tracking-[-0.018em] text-ink sm:text-[38px]">
        Academic profile.
      </h2>
      <p className="mt-2 font-display text-[14px] italic leading-[1.6] text-ink-3">
        Institution, title, website, and content language.
      </p>

      <form onSubmit={handleSubmit} className="mt-8">
        {/* ACADEMIC TITLE */}
        <FieldRow label="Academic title" hint="Your formal title at your institution.">
          <Input
            id="academicTitle"
            name="academicTitle"
            value={form.academicTitle}
            onChange={handleChange}
            placeholder="Professor of Islamic Jurisprudence"
            className="rounded-xl"
          />
        </FieldRow>

        {/* INSTITUTION */}
        <FieldRow label="Institution" hint="University, research center, or Islamic institution.">
          <Input
            id="institutionName"
            name="institutionName"
            value={form.institutionName}
            onChange={handleChange}
            placeholder="University of Sulaymaniyah"
            className="rounded-xl"
          />
        </FieldRow>

        {/* WEBSITE */}
        <FieldRow label="Website" hint="Personal or institutional website.">
          <Input
            id="websiteUrl"
            name="websiteUrl"
            type="url"
            value={form.websiteUrl}
            onChange={handleChange}
            placeholder="https://example.com"
            className="rounded-xl"
          />
        </FieldRow>

        {/* CONTENT LANGUAGE */}
        <FieldRow label="Content language" hint="The primary language you publish in.">
          <div className="flex flex-wrap gap-2">
            {CONTENT_LANGUAGES.map((lang) => (
              <label
                key={lang.value}
                className={cn(
                  'inline-flex cursor-pointer items-center gap-2 rounded-xl border-[0.5px] px-4 py-2.5 text-[13px] font-medium transition-colors',
                  form.contentLanguage === lang.value
                    ? 'border-ink bg-ink text-paper'
                    : 'border-border text-ink-2 hover:bg-secondary',
                )}
              >
                <input
                  type="radio"
                  name="contentLanguage"
                  value={lang.value}
                  checked={form.contentLanguage === lang.value}
                  onChange={handleChange}
                  className="sr-only"
                />
                {lang.label}
              </label>
            ))}
          </div>
        </FieldRow>

        {/* IS FOR HIRE */}
        <FieldRow label="Available for consultation" hint="Show a badge that you're open to lectures or consultations." noBorder>
          <label className="inline-flex cursor-pointer items-center gap-3">
            <div
              role="switch"
              aria-checked={form.isForHire}
              onClick={() => {
                setForm((f) => ({ ...f, isForHire: !f.isForHire }))
                setDirty(true)
              }}
              className={cn(
                'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors',
                form.isForHire
                  ? 'bg-emerald-500/80 hover:bg-emerald-500'
                  : 'bg-muted hover:bg-muted-foreground/20',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'inline-block size-5 rounded-full bg-background shadow-sm transition-transform',
                  form.isForHire ? 'translate-x-[22px]' : 'translate-x-[2px]',
                )}
              />
            </div>
            <span className="text-[13px] font-medium text-ink">
              {form.isForHire ? 'Available for consultation' : 'Not currently available'}
            </span>
          </label>
        </FieldRow>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-8">
          <button
            type="button"
            onClick={handleDiscard}
            disabled={saving || !dirty}
            className="rounded-xl border-[0.5px] border-border px-6 py-3 text-[14px] font-medium text-ink transition-colors hover:bg-secondary disabled:opacity-40"
          >
            Discard
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl border-[0.5px] border-ink bg-ink px-6 py-3 text-[14px] font-semibold text-paper transition-colors hover:bg-ink-2 disabled:opacity-50"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                Saving…
              </span>
            ) : (
              'Save changes'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Scholar verification panel ──────────────────────────────────────
//
// Verification is admin-assigned only — there is no self-service apply
// flow. This panel just shows the viewer their current account type and
// tier; an admin can promote them via the admin dashboard.

function prettyEnum(value) {
  if (!value) return '—'
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase())
}

function VerificationPanel() {
  const { user } = useAuth()
  if (!user) return null

  const currentTier = user.verificationTier ?? 'NONE'
  const currentType = user.accountType ?? 'REGULAR'
  const isVerified =
    currentType === 'VERIFIED_SCHOLAR' || currentType === 'VERIFIED_RESEARCHER'

  return (
    <div>
      <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ink-3">
        Account · Verification
      </p>
      <h2 className="font-display text-[32px] font-semibold leading-[1.05] tracking-[-0.018em] text-ink sm:text-[38px]">
        Scholar verification.
      </h2>
      <p className="mt-2 font-display text-[14px] italic leading-[1.6] text-ink-3">
        Verification is granted by platform admins. Reach out if you believe
        your account should be promoted.
      </p>

      <div className="mt-8 space-y-6">
        <Card>
          <CardContent className="p-5">
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Current status
            </p>
            <div className="flex flex-wrap gap-6">
              <div className="space-y-1">
                <p className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
                  Account type
                </p>
                <p className="text-sm font-semibold">{prettyEnum(currentType)}</p>
              </div>
              <div className="space-y-1">
                <p className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
                  Verification tier
                </p>
                <p className="text-sm font-semibold">
                  {currentTier === 'NONE' ? 'None' : prettyEnum(currentTier)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {isVerified ? (
          <Card>
            <CardContent className="flex items-start gap-3 p-5">
              <CheckCircle2
                className="mt-0.5 size-5 shrink-0 text-emerald-600"
                strokeWidth={1.8}
              />
              <div>
                <p className="text-[13.5px] font-semibold text-emerald-700 dark:text-emerald-400">
                  Your account is verified.
                </p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  Contact an admin if you need to update your verification tier.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  )
}

// ─── Links panel ─────────────────────────────────────────────────────
function AddLinkDialog({ onAdded }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [platform, setPlatform] = useState('PERSONAL_WEBSITE')
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting || !url.trim()) return
    setSubmitting(true)
    try {
      const created = await addLink({
        platform,
        url: url.trim(),
        description: description.trim(),
        isPublic: true,
        displayOrder: 0,
      })
      onAdded?.(created)
      setOpen(false)
      setUrl('')
      setDescription('')
      toast.success('Link added.')
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not add link.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="rounded-full">
          <Plus className="size-4" />
          Add link
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add a link</DialogTitle>
            <DialogDescription>Showcase your work or social profiles.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-3">
            <div className="space-y-1.5">
              <Label>Platform</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" className="w-full justify-start">
                    {prettyPlatform(platform)}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="max-h-72 w-56 overflow-y-auto">
                  {LINK_PLATFORMS.map((value) => (
                    <DropdownMenuItem key={value} onSelect={() => setPlatform(value)}>
                      {prettyPlatform(value)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="link-url">URL</Label>
              <Input
                id="link-url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://example.com"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="link-desc">Label</Label>
              <Input
                id="link-desc"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Shown as the link text (optional)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !url.trim()}>
              {submitting ? 'Adding…' : 'Add link'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function LinksList() {
  const { user, refreshCurrentUser } = useAuth()
  const toast = useToast()
  const [items, setItems] = useState([])

  useEffect(() => {
    setItems(user?.profile?.links ?? user?.links ?? [])
  }, [user?.profile?.links, user?.links])

  async function handleDelete(id) {
    try {
      await deleteLink(id)
      setItems((current) => current.filter((item) => item.id !== id))
      refreshCurrentUser().catch(() => {})
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not remove link.'))
    }
  }

  async function handleAdded(link) {
    setItems((current) => [...current, link])
    refreshCurrentUser().catch(() => {})
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Links</p>
            <p className="text-xs text-muted-foreground">
              Add your publications, personal site, or social handles.
            </p>
          </div>
          <AddLinkDialog onAdded={handleAdded} />
        </div>

        {items.length === 0 ? (
          <EmptyState icon={Link2} title="No links" description="Add a personal website or publication link." />
        ) : (
          <div className="space-y-2">
            {items.map((link) => (
              <div
                key={link.id}
                className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2"
              >
                <Link2 className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-sm font-medium text-primary hover:underline"
                  >
                    {link.description || link.url}
                  </a>
                  <p className="text-xs text-muted-foreground">{prettyPlatform(link.platform)}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-full text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(link.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Contacts panel ──────────────────────────────────────────────────
function AddContactDialog({ onAdded }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [platform, setPlatform] = useState('EMAIL')
  const [value, setValue] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting || !value.trim()) return
    setSubmitting(true)
    try {
      const created = await addContact({ platform, value: value.trim(), isPublic })
      onAdded?.(created)
      setOpen(false)
      setValue('')
      toast.success('Contact added.')
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not add contact.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="rounded-full">
          <Plus className="size-4" />
          Add contact
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add a contact</DialogTitle>
            <DialogDescription>Let people reach you through your preferred channel.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-3">
            <div className="space-y-1.5">
              <Label>Channel</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" className="w-full justify-start">
                    {prettyPlatform(platform)}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                  {CONTACT_PLATFORMS.map((item) => (
                    <DropdownMenuItem key={item} onSelect={() => setPlatform(item)}>
                      {prettyPlatform(item)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-value">Value</Label>
              <Input
                id="contact-value"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="email@example.com or +000 000 0000"
                required
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(event) => setIsPublic(event.target.checked)}
                className="size-4 rounded border-border"
              />
              Visible on your public profile
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !value.trim()}>
              {submitting ? 'Adding…' : 'Add contact'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ContactsList() {
  const { user, refreshCurrentUser } = useAuth()
  const toast = useToast()
  const [items, setItems] = useState([])

  useEffect(() => {
    setItems(user?.profile?.contacts ?? user?.contacts ?? [])
  }, [user?.profile?.contacts, user?.contacts])

  async function handleDelete(id) {
    try {
      await deleteContact(id)
      setItems((current) => current.filter((item) => item.id !== id))
      refreshCurrentUser().catch(() => {})
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not remove contact.'))
    }
  }

  async function handleAdded(contact) {
    setItems((current) => [...current, contact])
    refreshCurrentUser().catch(() => {})
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Contacts</p>
            <p className="text-xs text-muted-foreground">
              Channels where people can reach you.
            </p>
          </div>
          <AddContactDialog onAdded={handleAdded} />
        </div>

        {items.length === 0 ? (
          <EmptyState icon={Mail} title="No contacts" description="Add an email or phone number." />
        ) : (
          <div className="space-y-2">
            {items.map((contact) => {
              const Icon = contact.platform === 'PHONE' ? Phone : Mail
              return (
                <div
                  key={contact.id}
                  className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2"
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{contact.value}</p>
                    <p className="text-xs text-muted-foreground">
                      {prettyPlatform(contact.platform)} · {contact.isPublic ? 'Public' : 'Private'}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="rounded-full text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(contact.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Email preferences panel ────────────────────────────────────────
const PREFERENCE_ROWS = [
  {
    key: 'emailSocialEnabled',
    title: 'Activity from people you follow',
    description:
      'Posts you engage with, comments and reactions on your content, and replies to your answers.',
    icon: Users,
  },
  {
    key: 'emailMentionsEnabled',
    title: '@mentions',
    description:
      'When someone tags you in a post, comment, question, answer, or research entry.',
    icon: AtSign,
  },
  {
    key: 'emailSystemEnabled',
    title: 'System & account messages',
    description:
      'Account changes, security alerts, and platform-wide announcements.',
    icon: SettingsIcon,
  },
]

function ToggleSwitch({ checked, onChange, disabled, ariaLabel }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked
          ? 'bg-emerald-500/80 hover:bg-emerald-500'
          : 'bg-muted hover:bg-muted-foreground/20',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'inline-block size-5 rounded-full bg-background shadow-sm transition-transform',
          checked ? 'translate-x-[22px]' : 'translate-x-[2px]',
        )}
      />
    </button>
  )
}

function EmailPreferencesPanel() {
  const { user } = useAuth()
  const toast = useToast()
  const [prefs, setPrefs] = useState(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [testing, setTesting] = useState(false)
  const [unsubscribing, setUnsubscribing] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getEmailPreferences()
      setPrefs(data)
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not load email preferences.'))
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function setPref(key, value) {
    if (!prefs || working) return
    const previous = prefs
    setPrefs((current) => ({ ...current, [key]: value }))
    setWorking(true)
    try {
      const updated = await updateEmailPreferences({ [key]: value })
      setPrefs((current) => ({ ...current, ...updated }))
    } catch (error) {
      setPrefs(previous)
      toast.error(extractApiMessage(error, 'Could not update preference.'))
    } finally {
      setWorking(false)
    }
  }

  async function handleSendTest() {
    if (testing) return
    setTesting(true)
    try {
      await sendTestEmail()
      toast.success(
        user?.email
          ? `Test email queued — check ${user.email} (and the spam folder).`
          : 'Test email queued — check your inbox (and the spam folder).',
      )
    } catch (error) {
      toast.error(friendlyApiMessage(error, 'Could not send test email.'))
    } finally {
      setTesting(false)
    }
  }

  async function handleUnsubscribeAll() {
    if (unsubscribing) return
    if (!confirm('Turn off all email notifications? You can re-enable them anytime.'))
      return
    setUnsubscribing(true)
    try {
      await unsubscribeAllEmail()
      await refresh()
      toast.success('All email notifications turned off.')
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not unsubscribe.'))
    } finally {
      setUnsubscribing(false)
    }
  }

  if (loading || !prefs) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  const masterOn = prefs.emailNotificationsEnabled !== false
  const sendingTo = user?.email

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                'grid size-10 shrink-0 place-items-center rounded-full',
                masterOn
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              <BellRing className="size-5" strokeWidth={1.9} />
            </span>
            <div className="leading-tight">
              <p className="text-[14px] font-semibold">All email notifications</p>
              <p className="mt-1 max-w-md text-[12.5px] text-muted-foreground">
                {sendingTo ? (
                  <>
                    We send to <span className="font-medium text-foreground">{sendingTo}</span>.
                    Turn the master switch off and nothing will land in your inbox.
                  </>
                ) : (
                  'Turn the master switch off and nothing will land in your inbox.'
                )}
              </p>
            </div>
          </div>
          <ToggleSwitch
            checked={masterOn}
            onChange={(value) => setPref('emailNotificationsEnabled', value)}
            disabled={working}
            ariaLabel="Master email switch"
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="space-y-1">
            <p className="text-sm font-semibold">Categories</p>
            <p className="text-xs text-muted-foreground">
              Fine-tune which kinds of activity reach your inbox. The master switch above takes precedence.
            </p>
          </div>
          <div className="divide-y divide-border">
            {PREFERENCE_ROWS.map((row) => {
              const Icon = row.icon
              const value = prefs[row.key] !== false
              return (
                <div
                  key={row.key}
                  className={cn(
                    'flex items-start justify-between gap-4 py-3.5 first:pt-0 last:pb-0',
                    !masterOn && 'opacity-50',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-foreground">
                      <Icon className="size-4" strokeWidth={1.8} />
                    </span>
                    <div className="leading-tight">
                      <p className="text-[13.5px] font-medium">{row.title}</p>
                      <p className="mt-0.5 max-w-md text-[12px] text-muted-foreground">
                        {row.description}
                      </p>
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={value && masterOn}
                    onChange={(next) => setPref(row.key, next)}
                    disabled={working || !masterOn}
                    ariaLabel={row.title}
                  />
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
              <MailCheck className="size-4" strokeWidth={1.9} />
            </span>
            <div className="leading-tight">
              <p className="text-[13.5px] font-semibold">Send a test email</p>
              <p className="mt-1 max-w-md text-[12px] text-muted-foreground">
                Bypasses the notification pipeline so you can verify SMTP delivery is healthy.
                If it lands in spam, mark it "Not spam" — future activity emails will then land in Inbox.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={handleSendTest}
            disabled={testing}
          >
            {testing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            {testing ? 'Sending…' : 'Send test'}
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={handleUnsubscribeAll}
          disabled={unsubscribing || !masterOn}
        >
          {unsubscribing ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Unsubscribe from everything
        </Button>
      </div>
    </div>
  )
}

// ─── Password panel ─────────────────────────────────────────────────
function PasswordPanel() {
  const { changePassword } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [show, setShow] = useState({ current: false, next: false, confirm: false })
  const [saving, setSaving] = useState(false)
  const [fieldError, setFieldError] = useState(null)

  function handleChange(event) {
    const { name, value } = event.target
    setForm((f) => ({ ...f, [name]: value }))
    setFieldError(null)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (form.newPassword !== form.confirmPassword) {
      setFieldError('confirm')
      toast.error('New passwords do not match.')
      return
    }
    if (form.newPassword.length < 8) {
      setFieldError('next')
      toast.error('New password must be at least 8 characters.')
      return
    }
    setSaving(true)
    try {
      await changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword })
      toast.success('Password updated. Other devices have been signed out.')
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setFieldError(null)
    } catch (error) {
      const code = error?.response?.data?.code ?? error?.code ?? ''
      if (code === 'AUTH_CURRENT_PASSWORD_INVALID') {
        setFieldError('current')
        toast.error('Current password is incorrect.')
      } else if (code === 'AUTH_NEW_PASSWORD_SAME_AS_CURRENT') {
        setFieldError('next')
        toast.error('New password must be different from your current one.')
      } else {
        toast.error(extractApiMessage(error, 'Could not change password.'))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ink-3">Account · Password</p>
      <h2 className="font-display text-[32px] font-semibold leading-[1.05] tracking-[-0.018em] text-ink sm:text-[38px]">
        Change password.
      </h2>
      <p className="mt-2 font-display text-[14px] italic leading-[1.6] text-ink-3">
        Changing your password signs out every other device. You stay logged in here.
      </p>

      <form onSubmit={handleSubmit} className="mt-8">
        <FieldRow label="Current password" hint="Your existing password.">
          <div className="relative">
            <input
              type={show.current ? 'text' : 'password'}
              name="currentPassword"
              value={form.currentPassword}
              onChange={handleChange}
              autoComplete="current-password"
              required
              className={cn(
                'w-full rounded-xl border-[0.5px] border-border bg-paper px-4 py-3 pr-10 text-[15px] text-ink outline-none ring-0 transition-colors focus:border-ink/50 focus:ring-1 focus:ring-ink/20',
                fieldError === 'current' && 'border-destructive focus:border-destructive',
              )}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShow((s) => ({ ...s, current: !s.current }))}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink"
              tabIndex={-1}
              aria-label={show.current ? 'Hide password' : 'Show password'}
            >
              {show.current ? <EyeOff className="size-4" strokeWidth={1.5} /> : <Eye className="size-4" strokeWidth={1.5} />}
            </button>
          </div>
        </FieldRow>

        <FieldRow label="New password" hint="At least 8 characters.">
          <div className="relative">
            <input
              type={show.next ? 'text' : 'password'}
              name="newPassword"
              value={form.newPassword}
              onChange={handleChange}
              autoComplete="new-password"
              required
              minLength={8}
              className={cn(
                'w-full rounded-xl border-[0.5px] border-border bg-paper px-4 py-3 pr-10 text-[15px] text-ink outline-none ring-0 transition-colors focus:border-ink/50 focus:ring-1 focus:ring-ink/20',
                fieldError === 'next' && 'border-destructive focus:border-destructive',
              )}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShow((s) => ({ ...s, next: !s.next }))}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink"
              tabIndex={-1}
              aria-label={show.next ? 'Hide password' : 'Show password'}
            >
              {show.next ? <EyeOff className="size-4" strokeWidth={1.5} /> : <Eye className="size-4" strokeWidth={1.5} />}
            </button>
          </div>
        </FieldRow>

        <FieldRow label="Confirm new password" hint="Type it again." noBorder>
          <div className="relative">
            <input
              type={show.confirm ? 'text' : 'password'}
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              autoComplete="new-password"
              required
              className={cn(
                'w-full rounded-xl border-[0.5px] border-border bg-paper px-4 py-3 pr-10 text-[15px] text-ink outline-none ring-0 transition-colors focus:border-ink/50 focus:ring-1 focus:ring-ink/20',
                fieldError === 'confirm' && 'border-destructive focus:border-destructive',
              )}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShow((s) => ({ ...s, confirm: !s.confirm }))}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink"
              tabIndex={-1}
              aria-label={show.confirm ? 'Hide password' : 'Show password'}
            >
              {show.confirm ? <EyeOff className="size-4" strokeWidth={1.5} /> : <Eye className="size-4" strokeWidth={1.5} />}
            </button>
          </div>
        </FieldRow>

        <div className="flex justify-end pt-8">
          <button
            type="submit"
            disabled={saving || !form.currentPassword || !form.newPassword || !form.confirmPassword}
            className="rounded-xl border-[0.5px] border-ink bg-ink px-6 py-3 text-[14px] font-semibold text-paper transition-colors hover:bg-ink-2 disabled:opacity-50"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                Updating…
              </span>
            ) : (
              'Update password'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Sidebar nav ────────────────────────────────────────────────────
const NAV_SECTIONS = [
  {
    label: 'Profile',
    items: [
      { id: 'profile', label: 'Profile', icon: User },
      { id: 'academic', label: 'Academic', icon: GraduationCap },
      { id: 'links', label: 'Links', icon: Link2 },
      { id: 'contacts', label: 'Contacts', icon: Phone },
    ],
  },
  {
    label: 'Account',
    items: [
      { id: 'password', label: 'Password', icon: Lock },
      { id: 'verification', label: 'Verification', icon: BadgeCheck },
    ],
  },
  {
    label: 'Notifications',
    items: [
      { id: 'email', label: 'Email preferences', icon: Mail },
    ],
  },
  {
    label: 'Security',
    items: [
      { id: 'twofactor', label: 'Two-factor', icon: Shield },
      { id: 'signout', label: 'Sign out everywhere', icon: LogOut },
    ],
  },
  {
    label: 'Danger',
    items: [
      { id: 'delete', label: 'Delete account', icon: Trash2, danger: true },
    ],
  },
]

function SettingsNav({ active, onSelect }) {
  return (
    <nav className="space-y-6">
      {NAV_SECTIONS.map((section) => (
        <div key={section.label}>
          <p className="mb-2 px-3 font-mono text-[10px] uppercase tracking-wider text-ink-4">
            {section.label}
          </p>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const Icon = item.icon
              const isActive = active === item.id
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(item.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors',
                      isActive
                        ? 'bg-paper text-ink shadow-[0_0_0_0.5px_var(--border)]'
                        : item.danger
                          ? 'text-destructive hover:bg-muted/60'
                          : 'text-ink-3 hover:bg-muted/60 hover:text-ink',
                    )}
                  >
                    <Icon
                      className={cn(
                        'size-4 shrink-0',
                        isActive ? 'text-ink' : item.danger ? 'text-destructive' : 'text-ink-3',
                      )}
                      strokeWidth={1.5}
                    />
                    {item.label}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

export function SettingsPage() {
  const [panel, setPanel] = useState('profile')

  function renderPanel() {
    switch (panel) {
      case 'profile':
        return <ProfileForm />
      case 'academic':
        return <AcademicPanel />
      case 'verification':
        return <VerificationPanel />
      case 'password':
        return <PasswordPanel />
      case 'links':
        return (
          <>
            <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ink-3">Profile · Links</p>
            <h2 className="mb-8 font-display text-[32px] font-semibold leading-tight tracking-[-0.018em] text-ink">
              Your links.
            </h2>
            <LinksList />
          </>
        )
      case 'contacts':
        return (
          <>
            <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ink-3">Profile · Contacts</p>
            <h2 className="mb-8 font-display text-[32px] font-semibold leading-tight tracking-[-0.018em] text-ink">
              Contact channels.
            </h2>
            <ContactsList />
          </>
        )
      case 'email':
        return (
          <>
            <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ink-3">Notifications · Email</p>
            <h2 className="mb-8 font-display text-[32px] font-semibold leading-tight tracking-[-0.018em] text-ink">
              Email preferences.
            </h2>
            <EmailPreferencesPanel />
          </>
        )
      default:
        return (
          <div className="flex h-48 items-center justify-center text-[14px] text-ink-3">
            Coming soon.
          </div>
        )
    }
  }

  return (
    <div className="flex min-h-[60vh] gap-0 overflow-hidden">
      {/* ── Sidebar ────────────────────────────────────────────── */}
      <aside className="w-[220px] shrink-0 border-r-[0.5px] border-border bg-secondary/30 px-4 py-6 sm:w-[240px]">
        <SettingsNav active={panel} onSelect={setPanel} />
      </aside>

      {/* ── Main content ───────────────────────────────────────── */}
      <main className="min-w-0 flex-1 bg-paper px-8 py-8 sm:px-12">
        {renderPanel()}
      </main>
    </div>
  )
}
