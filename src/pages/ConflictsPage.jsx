import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, GitMerge } from 'lucide-react'
import { cn } from 'cn'
import DashboardLayout from '@/components/dashboard/DashboardLayout'
import { Button } from '@/components/ui/button'
import ConflictModal from '@/components/modals/ConflictModal'
import { REVIEW_STAGES, STAGE_DOT_CLASS, STAGE_LABEL, allConflictRecords } from '@/lib/conflicts'

const FILTERS = [{ id: 'all', label: 'All' }, ...REVIEW_STAGES]

// The full list behind the dashboard's "Active conflicts" widget's "See
// more" — same conflictChecklist mock data, its own independent local
// status state (no shared store between the two views, consistent with
// the rest of this app's per-page mock state).
function ConflictsPage() {
  const navigate = useNavigate()
  const [conflicts, setConflicts] = useState(allConflictRecords)
  const [filter, setFilter] = useState('all')
  const [activeConflictId, setActiveConflictId] = useState(null)

  const activeConflict = conflicts.find((c) => c.id === activeConflictId) ?? null
  const visible = filter === 'all' ? conflicts : conflicts.filter((c) => c.reviewStage === filter)

  function handleUpdate(id, patch) {
    setConflicts((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  function handleOpenMergeStudio(conflict) {
    setActiveConflictId(null)
    navigate(`/projects/${conflict.projectId}/workspace`, { state: { openMergeStudio: true } })
  }

  return (
    <DashboardLayout>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" title="Back to dashboard" nativeButton={false} render={<Link to="/dashboard" />}>
          <ArrowLeft className="size-3.5" />
        </Button>
        <GitMerge className="size-5 text-muted-foreground" />
        <h1 className="text-lg font-semibold text-foreground">Conflict Points</h1>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {FILTERS.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={filter === option.id}
            onClick={() => setFilter(option.id)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              filter === option.id
                ? 'border-transparent bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:text-foreground'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
        {visible.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">No conflict points match this filter.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border/60">
            {visible.map((conflict) => (
              <button
                key={conflict.id}
                type="button"
                onClick={() => setActiveConflictId(conflict.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground/90">{conflict.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {conflict.projectName} · {conflict.file}
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-xs font-medium text-foreground/80">
                  <span className={cn('size-1.5 rounded-full', STAGE_DOT_CLASS[conflict.reviewStage])} />
                  {STAGE_LABEL[conflict.reviewStage]}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <ConflictModal
        conflict={activeConflict}
        onOpenChange={(open) => !open && setActiveConflictId(null)}
        onUpdate={handleUpdate}
        onOpenMergeStudio={handleOpenMergeStudio}
      />
    </DashboardLayout>
  )
}

export default ConflictsPage
