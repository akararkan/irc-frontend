import { useCallback, useEffect, useState } from 'react'
import { BookOpenText, Archive, Ban, CheckCircle2, EyeOff, FileText, MoreHorizontal, Trash2 } from 'lucide-react'
import { Navigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/app/empty-state'
import { PageHeader } from '@/components/app/page-header'
import { ResearchCard } from '@/components/app/research-card'
import { ResearchComposerButton } from '@/components/app/research-composer'
import {
  archiveResearch,
  deleteResearch,
  getMyAllResearch,
  getMyDrafts,
  publishResearch,
  retractResearch,
  unpublishResearch,
} from '@/features/research/research.api'
import { useAuth } from '@/features/auth/auth-context'
import { useToast } from '@/components/ui/toaster'
import { canPublishResearch } from '@/lib/roles'
import { extractApiMessage } from '@/lib/api-error'

function ResearchRow({ item, onUpdated, onDeleted }) {
  const toast = useToast()

  async function run(label, action) {
    try {
      const updated = await action()
      onUpdated?.(updated)
      toast.success(label)
    } catch (error) {
      toast.error(extractApiMessage(error, 'Action failed.'))
    }
  }

  return (
    <div className="space-y-2">
      <ResearchCard item={item} />
      <div className="flex flex-wrap items-center justify-end gap-1.5 px-1">
        {item.status === 'DRAFT' ? (
          <Button
            size="sm"
            className="rounded-full"
            onClick={() => run('Published.', () => publishResearch(item.id))}
          >
            <CheckCircle2 className="size-4" />
            Publish
          </Button>
        ) : item.status === 'PUBLISHED' ? (
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            onClick={() => run('Unpublished.', () => unpublishResearch(item.id))}
          >
            <EyeOff className="size-4" />
            Unpublish
          </Button>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" className="rounded-full text-muted-foreground">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => run('Archived.', () => archiveResearch(item.id))}>
              <Archive className="mr-2 size-4" />
              Archive
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => run('Retracted.', () => retractResearch(item.id))}>
              <Ban className="mr-2 size-4" />
              Retract
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={async () => {
                if (!confirm('Delete this research? This cannot be undone.')) return
                try {
                  await deleteResearch(item.id)
                  onDeleted?.(item.id)
                  toast.success('Research deleted.')
                } catch (error) {
                  toast.error(extractApiMessage(error, 'Could not delete.'))
                }
              }}
            >
              <Trash2 className="mr-2 size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

export function MyResearchPage() {
  const { user, isLoading } = useAuth()
  const toast = useToast()
  const [drafts, setDrafts] = useState([])
  const [all, setAll] = useState([])
  const [loadingDrafts, setLoadingDrafts] = useState(true)
  const [loadingAll, setLoadingAll] = useState(true)

  const loadAll = useCallback(async () => {
    setLoadingAll(true)
    try {
      const data = await getMyAllResearch({ page: 0, size: 30 })
      setAll(data?.content ?? [])
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not load your research.'))
    } finally {
      setLoadingAll(false)
    }
  }, [toast])

  const loadDrafts = useCallback(async () => {
    setLoadingDrafts(true)
    try {
      const data = await getMyDrafts({ page: 0, size: 30 })
      setDrafts(data?.content ?? [])
    } catch (error) {
      toast.error(extractApiMessage(error, 'Could not load drafts.'))
    } finally {
      setLoadingDrafts(false)
    }
  }, [toast])

  useEffect(() => {
    if (user && canPublishResearch(user)) {
      loadDrafts()
      loadAll()
    }
  }, [user, loadDrafts, loadAll])

  if (isLoading) return <Skeleton className="h-8 w-48" />
  if (!canPublishResearch(user)) {
    return <Navigate to="/research" replace />
  }

  function syncUpdated(updated) {
    if (!updated?.id) return
    const merge = (list) => list.map((item) => (item.id === updated.id ? { ...item, ...updated } : item))
    setDrafts(merge)
    setAll(merge)
    // If status changed, refresh drafts to respect filtering
    if (updated.status && updated.status !== 'DRAFT') {
      setDrafts((current) => current.filter((item) => item.id !== updated.id))
    }
  }

  function syncDeleted(id) {
    setDrafts((current) => current.filter((item) => item.id !== id))
    setAll((current) => current.filter((item) => item.id !== id))
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My research"
        description="Manage drafts, published work, and archives."
        action={
          <ResearchComposerButton onCreated={(created) => created && setDrafts((current) => [created, ...current])} />
        }
      />

      <Tabs defaultValue="drafts">
        <TabsList>
          <TabsTrigger value="drafts">Drafts · {drafts.length}</TabsTrigger>
          <TabsTrigger value="all">All · {all.length}</TabsTrigger>
        </TabsList>

        <TabsContent value="drafts">
          {loadingDrafts ? (
            <Skeleton className="h-72 rounded-xl" />
          ) : drafts.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No drafts"
              description="Start a new research draft from the Publish research button."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {drafts.map((item) => (
                <ResearchRow key={item.id} item={item} onUpdated={syncUpdated} onDeleted={syncDeleted} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="all">
          {loadingAll ? (
            <Skeleton className="h-72 rounded-xl" />
          ) : all.length === 0 ? (
            <EmptyState
              icon={BookOpenText}
              title="Nothing here yet"
              description="Your research across all statuses will appear here."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {all.map((item) => (
                <ResearchRow key={item.id} item={item} onUpdated={syncUpdated} onDeleted={syncDeleted} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
