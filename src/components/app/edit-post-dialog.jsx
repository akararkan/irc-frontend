import { useEffect, useState } from 'react'
import { Globe, Loader2, Lock, MapPin, Music, Save, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { updatePost } from '@/features/posts/posts.api'
import { useToast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import { extractApiMessage } from '@/lib/api-error'

const VISIBILITY_OPTIONS = [
  { value: 'PUBLIC', label: 'Public', icon: Globe },
  { value: 'FOLLOWERS_ONLY', label: 'Followers', icon: Users },
  { value: 'ONLY_ME', label: 'Only me', icon: Lock },
]

/**
 * Edit an existing post. The backend PATCH endpoint accepts
 * textContent, visibility, audioTrackUrl, audioTrackName and
 * locationName/Lat/Lng — all optional. Media list and postType
 * are immutable after creation.
 */
export function EditPostDialog({ post, open, onOpenChange, onUpdated }) {
  const toast = useToast()
  const [text, setText] = useState(post?.textContent ?? '')
  const [visibility, setVisibility] = useState(post?.visibility ?? 'PUBLIC')
  const [locationName, setLocationName] = useState(post?.locationName ?? '')
  const [audioTrackUrl, setAudioTrackUrl] = useState(post?.audioTrackUrl ?? '')
  const [audioTrackName, setAudioTrackName] = useState(post?.audioTrackName ?? '')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open && post) {
      setText(post.textContent ?? '')
      setVisibility(post.visibility ?? 'PUBLIC')
      setLocationName(post.locationName ?? '')
      setAudioTrackUrl(post.audioTrackUrl ?? '')
      setAudioTrackName(post.audioTrackName ?? '')
    }
  }, [open, post])

  const supportsAudio = post?.postType === 'REEL' || post?.postType === 'EMBEDDED'

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting) return

    // Build partial payload — only send keys whose value actually changed.
    const payload = {}
    const originalText = post?.textContent ?? ''
    if (text !== originalText) payload.textContent = text
    if (visibility !== (post?.visibility ?? 'PUBLIC')) payload.visibility = visibility
    if (locationName !== (post?.locationName ?? '')) payload.locationName = locationName
    if (supportsAudio) {
      if (audioTrackUrl !== (post?.audioTrackUrl ?? '')) payload.audioTrackUrl = audioTrackUrl
      if (audioTrackName !== (post?.audioTrackName ?? '')) payload.audioTrackName = audioTrackName
    }

    if (Object.keys(payload).length === 0) {
      onOpenChange?.(false)
      return
    }

    setSubmitting(true)
    try {
      const updated = await updatePost(post.id, payload)
      toast.success('Post updated.')
      onUpdated?.(updated)
      onOpenChange?.(false)
    } catch (error) {
      // Backend uses optimistic locking via @Version on Post — a concurrent
      // edit comes back as HTTP 409. Surface it as a refresh prompt rather
      // than a generic error.
      if (error?.response?.status === 409) {
        toast.error('This post was edited elsewhere — please refresh and try again.')
      } else {
        toast.error(extractApiMessage(error, 'Could not update post.'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit post</DialogTitle>
            <DialogDescription>
              Update your caption, visibility or location. Media attachments and post type can't be
              changed after posting.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-post-text">Text</Label>
              <Textarea
                id="edit-post-text"
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={4}
                maxLength={5000}
                placeholder="What's on your mind?"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Visibility</Label>
              <div className="flex flex-wrap gap-2">
                {VISIBILITY_OPTIONS.map((option) => {
                  const Icon = option.icon
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setVisibility(option.value)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                        visibility === option.value
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <Icon className="size-3.5" />
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-post-location" className="flex items-center gap-1.5">
                <MapPin className="size-3.5" />
                Location
              </Label>
              <Input
                id="edit-post-location"
                value={locationName}
                onChange={(event) => setLocationName(event.target.value)}
                placeholder="Where is this from?"
              />
            </div>

            {supportsAudio ? (
              <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
                <Label className="flex items-center gap-1.5">
                  <Music className="size-3.5" />
                  Audio track
                </Label>
                <Input
                  value={audioTrackName}
                  onChange={(event) => setAudioTrackName(event.target.value)}
                  placeholder="Track name"
                />
                <Input
                  value={audioTrackUrl}
                  onChange={(event) => setAudioTrackUrl(event.target.value)}
                  placeholder="Track URL"
                />
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange?.(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {submitting ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
