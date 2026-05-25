import { useState } from 'react'
import { BookMarked, Check, FolderPlus, Plus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

// Default collections — in a real app these would be fetched from the API.
// The API saves to a named collection via POST /posts/{id}/saves?collection={name}
const DEFAULT_COLLECTIONS = [
  { name: 'Default', count: null },
  { name: 'Quran',   count: null },
  { name: 'Fiqh',    count: null },
  { name: 'Tajweed', count: null },
]

function CollectionTile({ name, count, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors',
        selected
          ? 'border-fg bg-fg text-background'
          : 'border-line bg-background hover:bg-bg-soft',
      )}
    >
      {/* Collection thumb */}
      <div
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-sm border',
          selected ? 'border-background/30 bg-background/15' : 'border-line bg-bg-muted',
        )}
      >
        <BookMarked className={cn('size-4', selected ? 'text-background' : 'text-fg-muted')} strokeWidth={1.7} />
      </div>

      <div className="min-w-0 flex-1">
        <p className={cn(
          'truncate text-[13.5px] font-semibold',
          selected ? 'text-background' : 'text-fg',
        )}>
          {name}
        </p>
        {count != null ? (
          <p className={cn('font-mono text-[10.5px]', selected ? 'text-background/70' : 'text-fg-muted')}>
            {count} items
          </p>
        ) : null}
      </div>

      {selected ? (
        <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-background">
          <Check className="size-3 text-fg" strokeWidth={3} />
        </div>
      ) : (
        <div className="size-5 shrink-0 rounded-full border border-line" />
      )}
    </button>
  )
}

export function SaveCollectionSheet({ open, onOpenChange, onSave }) {
  const [selected, setSelected] = useState('Default')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  function handleConfirm() {
    onSave(selected)
    onOpenChange(false)
  }

  function handleCreate() {
    const name = newName.trim()
    if (!name) return
    setSelected(name)
    setCreating(false)
    setNewName('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-lg border-line p-0">
        <DialogHeader className="border-b border-line px-5 py-4">
          <DialogTitle className="text-[15px] font-semibold">Save to collection</DialogTitle>
        </DialogHeader>

        <div className="space-y-1.5 p-4">
          {DEFAULT_COLLECTIONS.map((col) => (
            <CollectionTile
              key={col.name}
              name={col.name}
              count={col.count}
              selected={selected === col.name}
              onClick={() => setSelected(col.name)}
            />
          ))}

          {/* Create new collection */}
          {creating ? (
            <div className="flex items-center gap-2 rounded-md border border-line px-3 py-2.5">
              <Input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
                placeholder="Collection name…"
                className="h-7 border-0 bg-transparent p-0 text-[13.5px] focus-visible:ring-0"
              />
              <button
                type="button"
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="shrink-0 text-[12px] font-medium text-fg disabled:opacity-40"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => { setCreating(false); setNewName('') }}
                className="shrink-0 text-fg-muted transition-colors hover:text-fg"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex w-full items-center gap-3 rounded-md border border-dashed border-line px-3 py-2.5 text-left transition-colors hover:border-line-strong hover:bg-bg-soft"
            >
              <div className="grid size-9 shrink-0 place-items-center rounded-sm border border-dashed border-line bg-bg-soft text-fg-faint">
                <FolderPlus className="size-4" strokeWidth={1.7} />
              </div>
              <p className="text-[13.5px] text-fg-muted">Create new collection</p>
            </button>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-md border-line text-[12.5px]"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-8 rounded-md bg-fg px-4 text-[12.5px] text-background hover:bg-fg-soft"
            onClick={handleConfirm}
          >
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
