import { RotateCcw, Sparkles } from 'lucide-react'
import { cn } from 'cn'
import { useWorkspace } from '@/state/WorkspaceProvider'

// The Stitch-style rollback timeline — shared by the "Agent Log" modal
// (opened from Ask Devsign) and the right floating toolbar's History
// flyout, so both surfaces stay in sync with a single implementation.
function RollbackHistoryList({ onRollback }) {
  const { historyEntries, activeHistoryId, rollbackTo } = useWorkspace()
  const ordered = [...historyEntries].reverse()

  function handleRollback(id) {
    rollbackTo(id)
    onRollback?.(id)
  }

  return (
    <div className="relative pl-5">
      <div className="absolute top-1 bottom-1 left-[7px] w-px bg-border" />

      {ordered.map((entry) => {
        const isActive = entry.id === activeHistoryId
        return (
          <button
            key={entry.id}
            type="button"
            onClick={() => handleRollback(entry.id)}
            className="group relative mb-3 block w-full text-left last:mb-0"
          >
            <span
              className={cn(
                'absolute -left-5 top-1.5 flex size-2.5 items-center justify-center rounded-full border-2 bg-card',
                isActive
                  ? 'border-primary'
                  : 'border-border group-hover:border-muted-foreground'
              )}
            >
              {isActive && <span className="size-1 rounded-full bg-primary" />}
            </span>

            <div
              className={cn(
                'rounded-xl border px-2.5 py-2 transition-colors group-hover:border-primary/40',
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
            </div>
          </button>
        )
      })}
    </div>
  )
}

export default RollbackHistoryList
