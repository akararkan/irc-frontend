import { useEffect, useState } from 'react'
import { Link2, Loader2, Mail, Phone, Plus, Trash2 } from 'lucide-react'

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/app/empty-state'
import { PageHeader } from '@/components/app/page-header'
import { UserAvatar } from '@/components/app/user-avatar'
import { ActivityPanel } from '@/pages/activity-page'
import { useAuth } from '@/features/auth/auth-context'
import {
  addContact,
  addLink,
  deleteContact,
  deleteLink,
  updateProfile,
  uploadProfileImage,
} from '@/features/users/users.api'
import { useToast } from '@/components/ui/toaster'
import { extractApiMessage } from '@/lib/api-error'

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

function prettyPlatform(value) {
  return value.replace('_', ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())
}

function ProfileForm() {
  const { user, refreshCurrentUser } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState({
    fname: '',
    lname: '',
    location: '',
    profileBio: '',
    selfDescriber: '',
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!user) return
    setForm({
      fname: user.fname ?? '',
      lname: user.lname ?? '',
      location: user.location ?? '',
      profileBio: user.profileBio ?? '',
      selfDescriber: user.selfDescriber ?? '',
    })
  }, [user])

  function handleChange(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    try {
      await updateProfile(form)
      await refreshCurrentUser()
      toast.success('Profile updated.')
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not update profile.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleAvatarChange(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      await uploadProfileImage(file)
      await refreshCurrentUser()
      toast.success('Profile photo updated.')
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not upload photo.'))
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  if (!user) return null

  return (
    <Card>
      <CardContent className="space-y-6 p-5">
        <div className="flex flex-wrap items-center gap-4">
          <UserAvatar user={user} className="size-16 ring-2 ring-gold/40" />
          <div className="space-y-1.5">
            <Label htmlFor="avatar" className="text-sm font-medium">
              Profile photo
            </Label>
            <input
              id="avatar"
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              disabled={uploading}
              className="block text-sm file:mr-3 file:rounded-full file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary-foreground"
            />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fname">First name</Label>
              <Input id="fname" name="fname" value={form.fname} onChange={handleChange} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lname">Last name</Label>
              <Input id="lname" name="lname" value={form.lname} onChange={handleChange} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              name="location"
              value={form.location}
              onChange={handleChange}
              placeholder="City, Country"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profileBio">Bio</Label>
            <Textarea
              id="profileBio"
              name="profileBio"
              value={form.profileBio}
              onChange={handleChange}
              rows={3}
              placeholder="A short description shown on your profile."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="selfDescriber">About</Label>
            <Textarea
              id="selfDescriber"
              name="selfDescriber"
              value={form.selfDescriber}
              onChange={handleChange}
              rows={5}
              placeholder="Tell the community more about your work, specialisation, and interests."
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

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
    setItems(user?.links ?? [])
  }, [user?.links])

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
    setItems(user?.contacts ?? [])
  }, [user?.contacts])

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

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your profile, links, and contact channels." />
      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="links">Links</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <ProfileForm />
        </TabsContent>
        <TabsContent value="links">
          <LinksList />
        </TabsContent>
        <TabsContent value="contacts">
          <ContactsList />
        </TabsContent>
        <TabsContent value="activity">
          <Card>
            <CardContent className="space-y-4 p-5">
              <ActivityPanel embedded />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
