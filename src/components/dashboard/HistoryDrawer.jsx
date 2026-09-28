import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, RotateCcw, Sparkles } from 'lucide-react'
import { cn } from 'cn'
import RollbackCheckpointModal from '@/components/history/RollbackCheckpointModal'
import { ACCENT_SOFT } from '@/components/mergestudio/floatingStyles'
import { diffStats } from '@/lib/lineDiff'
import { useWorkspace } from '@/state/WorkspaceProvider'

// The drawer behind the activity bar's History icon: the project's
// checkpoints, newest first, beside whatever you're working on (the
// Workspace stays visible). Each shows what it was, when, how far its code
// is from now, and "Rollback here" (confirmed in the "Rollback to
// checkpoint" dialog). The full-page History — with the side-by-side
// compare — is one link away at the top.
function HistoryDrawer({ project }) {
  const { historyEntries, activeHistoryId } = useWorkspace()
  const [rollbackId, setRollbackId] = useState(null)
  const checkpoints = [...historyEntries].filter((e) => !e.archived).reverse()
  const current = historyEntries.find((e) => e.id === activeHistoryId)

  return (
    <div className="flex flex-col gap-1.5 pb-2">
      <Link
        to={`/projects/${project.id}/history`}
        className="mb-1 flex h-8 items-center justify-between rounded-lg px-2.5 text-[12px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <span>
          {checkpoints.length} checkpoints · compare in full view
        </span>
        <ArrowUpRight className="size-3.5" />
      </Link>

      {checkpoints.map((entry) => {
        const isCurrent = entry.id === activeHistoryId
        const stats = diffStats(current?.snapshot.lines, entry.snapshot.lines)
        return (
          <article
            key={entry.id}
            className={cn('rounded-xl px-3 py-2.5 transition-colors', isCurrent ? 'bg-white/[0.05]' : 'bg-white/[0.02] hover:bg-white/[0.04]')}
          >
            <p className="flex items-center gap-1.5 text-[11px] text-slate-500 tabular-nums">
              {entry.prompt && <Sparkles className="size-3 shrink-0 text-emerald-300" />}
              <span className="min-w-0 truncate">{entry.timestamp}</span>
              {isCurrent && <span className={cn('ml-auto shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold', ACCENT_SOFT)}>Current</span>}
            </p>
            <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-slate-100" title={entry.label}>
              {entry.label}
            </p>
            {!isCurrent && (
              <div className="mt-2 flex items-center gap-2">
                <span className="font-mono text-[10.5px] text-slate-500">
                  <span className="text-emerald-300">+{stats.added}</span> <span className="text-red-300">−{stats.removed}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setRollbackId(entry.id)}
                  className="ml-auto flex h-6 items-center gap-1 rounded-full bg-white/[0.06] px-2.5 text-[11px] font-medium text-slate-200 transition-colors hover:bg-white/[0.1] hover:text-white"
                >
                  <RotateCcw className="size-3" />
                  Rollback here
                </button>
              </div>
            )}
          </article>
        )
      })}

      <RollbackCheckpointModal key={rollbackId} entryId={rollbackId} onOpenChange={(open) => !open && setRollbackId(null)} />
    </div>
  )
}

export default HistoryDrawer
