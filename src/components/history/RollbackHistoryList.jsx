import { Archive, ArchiveRestore, RotateCcw, Sparkles } from 'lucide-react'
import { cn } from 'cn'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useWorkspace } from '@/state/WorkspaceProvider'

function EmptyState({ message }) {
  return (
    <p className="rounded-xl border border-dashed px-3 py-6 text-center text-[11px] text-muted-foreground">
      {message}
    </p>
  )
}

// The Stitch-style rollback timeline — shared by the "Agent Log" modal
// (opened from Ask Devsign) and the right floating toolbar's History
// flyout, so both surfaces stay in sync with a single implementation.
function RollbackHistoryList({ onRollback }) {
  const {
    historyEntries,
    activeHistoryId,
    rollbackTo,
    archiveHistoryEntry,
    restoreHistoryEntry,
  } = useWorkspace()

  const active = [...historyEntries].filter((e) => !e.archived).reverse()
  const archived = [...historyEntries].filter((e) => e.archived).reverse()

  function handleRollback(id) {
    rollbackTo(id)
    onRollback?.(id)
  }

  function handleArchive(entry) {
    archiveHistoryEntry(entry.id)
    toast('Archived from history', {
      description: entry.label,
      action: { label: 'Undo', onClick: () => restoreHistoryEntry(entry.id) },
    })
  }

  function handleRestore(entry) {
    restoreHistoryEntry(entry.id)
    toast('Restored to active history', { description: entry.label })
  }

  return (
    <Tabs defaultValue="active" className="min-h-0 flex-1">
      <TabsList className="w-full shrink-0">
        <TabsTrigger value="active">Active</TabsTrigger>
        <TabsTrigger value="archived">
          Archived{archived.length > 0 ? ` (${archived.length})` : ''}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="active" className="mt-2 min-h-0">
        {active.length === 0 ? (
          <EmptyState message="No history yet." />
        ) : (
          <div className="relative pl-5">
            <div className="absolute top-1 bottom-1 left-[7px] w-px bg-border" />

            {active.map((entry) => {
              const isActive = entry.id === activeHistoryId
              return (
                <div key={entry.id} className="group relative mb-3 last:mb-0">
                  <span
                    className={cn(
                      'absolute -left-5 top-1.5 flex size-2.5 items-center justify-center rounded-full border-2 bg-card',
                      isActive ? 'border-primary' : 'border-border group-hover:border-muted-foreground'
                    )}
                  >
                    {isActive && <span className="size-1 rounded-full bg-primary" />}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleRollback(entry.id)}
                    className={cn(
                      'block w-full rounded-xl border py-2 pr-8 pl-2.5 text-left transition-colors group-hover:border-primary/40',
                      isActive ? 'border-primary/40 bg-primary/5' : 'border-border bg-background'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                      <span>{entry.timestamp}</span>
                      {isActive && (
                        <span className="flex items-center gap-1 font-medium text-primary">
                          <RotateCcw className="size-2.5" />
                          Current
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-foreground">
                      {entry.prompt && <Sparkles className="size-3 shrink-0 text-primary" />}
                      {entry.label}
                    </p>
                    {entry.prompt && (
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        &ldquo;{entry.prompt}&rdquo;
                      </p>
                    )}
                  </button>

                  {!isActive && (
                    <button
                      type="button"
                      onClick={() => handleArchive(entry)}
                      title="Archive this entry"
                      className="absolute top-2 right-2 hidden size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive group-hover:flex group-focus-within:flex"
                    >
                      <Archive className="size-3.5" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </TabsContent>

      <TabsContent value="archived" className="mt-2 min-h-0">
        {archived.length === 0 ? (
          <EmptyState message="No archived history yet." />
        ) : (
          <div className="flex flex-col gap-2">
            {archived.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-2 rounded-xl border border-border bg-background/60 py-2 pr-2 pl-2.5 opacity-80 transition-opacity hover:opacity-100"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-muted-foreground">{entry.timestamp}</p>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs font-medium text-foreground">
                    {entry.prompt && <Sparkles className="size-3 shrink-0 text-primary" />}
                    {entry.label}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRestore(entry)}
                  title="Restore to active history"
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
                >
                  <ArchiveRestore className="size-3" />
                  Restore
                </button>
              </div>
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  )
}

export default RollbackHistoryList
