import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from 'cn'
import ConflictModal from '@/components/modals/ConflictModal'
import { STAGE_DOT_CLASS, STAGE_LABEL, allConflictRecords, isOpen } from '@/lib/conflicts'

// The dashboard's primary checklist: every open design/code conflict
// across projects, resolved or not, in one scannable list — the same
// role "Daily Tasks" plays in a generic task tool, mapped onto DevSign's
// actual unit of work (a conflict, not a to-do). Status here is local,
// session-only state (mock data + React state, no shared store) — the
// full /conflicts page holds its own independent copy.
function ConflictChecklist() {
  const navigate = useNavigate()
  const [conflicts, setConflicts] = useState(allConflictRecords)
  const [activeConflictId, setActiveConflictId] = useState(null)

  const activeConflict = conflicts.find((c) => c.id === activeConflictId) ?? null
  const firstOpen = conflicts.find(isOpen)

  function handleUpdate(id, patch) {
    setConflicts((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  function handleOpenMergeStudio(conflict) {
    setActiveConflictId(null)
    navigate(`/projects/${conflict.projectId}/workspace`, { state: { openMergeStudio: true } })
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Active conflicts</h3>
        <button
          type="button"
          onClick={() => navigate('/conflicts')}
          className="rounded-full border border-border px-3 py-1 text-[11px] font-medium text-foreground/70 transition-colors hover:bg-muted"
        >
          See more
        </button>
      </div>

      <ul className="mt-2 flex flex-col">
        {conflicts.map((conflict) => (
          <li key={conflict.id} className="border-b border-border/60 last:border-b-0">
            <button
              type="button"
              onClick={() => setActiveConflictId(conflict.id)}
              className="flex w-full items-center justify-between gap-3 rounded-md py-2.5 text-left transition-colors hover:bg-muted/50"
            >
              <div className="min-w-0">
                <p className="truncate text-xs text-foreground/90">{conflict.title}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {conflict.projectName} · {conflict.file}
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className={cn('size-1.5 rounded-full', STAGE_DOT_CLASS[conflict.reviewStage])} />
                {STAGE_LABEL[conflict.reviewStage]}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => handleOpenMergeStudio(firstOpen ?? conflicts[0])}
        className="mt-4 h-10 w-full rounded-full bg-primary text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Open Merge Studio
      </button>

      <ConflictModal
        conflict={activeConflict}
        onOpenChange={(open) => !open && setActiveConflictId(null)}
        onUpdate={handleUpdate}
        onOpenMergeStudio={handleOpenMergeStudio}
      />
    </div>
  )
}

export default ConflictChecklist
