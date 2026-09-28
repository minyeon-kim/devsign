import { History, RotateCcw } from 'lucide-react'
import { cn } from 'cn'
import { ACCENT_SOFT } from '@/components/mergestudio/floatingStyles'
import { useWorkspace } from '@/state/WorkspaceProvider'

// Inline, right under an AI reply that changed the project (Replit style):
// the checkpoint that change made, with "Rollback here" — undo from the
// conversation itself instead of going to History. It opens the same
// "Rollback to checkpoint" confirmation (via `onRollback`). The checkpoint
// you're on shows "Current" instead.
function ChatCheckpoint({ historyId, onRollback }) {
  const { historyEntries, activeHistoryId } = useWorkspace()
  const entry = historyEntries.find((h) => h.id === historyId)
  if (!entry) return null
  const current = entry.id === activeHistoryId

  return (
    <div className="mt-1.5 flex max-w-[85%] items-center gap-2 rounded-xl bg-white/[0.03] py-1.5 pr-1.5 pl-2.5 text-[11px] text-slate-500">
      <History className="size-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">Checkpoint · {entry.timestamp}</span>
      {current ? (
        <span className={cn('shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold', ACCENT_SOFT)}>Current</span>
      ) : (
        <button
          type="button"
          onClick={() => onRollback(entry.id)}
          className="flex h-6 shrink-0 items-center gap-1 rounded-full bg-white/[0.06] px-2.5 font-medium text-slate-200 transition-colors hover:bg-white/[0.1] hover:text-white"
        >
          <RotateCcw className="size-3" />
          Rollback here
        </button>
      )}
    </div>
  )
}

export default ChatCheckpoint
