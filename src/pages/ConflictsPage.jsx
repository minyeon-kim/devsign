import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, GitMerge } from 'lucide-react'
import { cn } from 'cn'
import DashboardLayout from '@/components/dashboard/DashboardLayout'
import { Button } from '@/components/ui/button'
import ConflictModal, { CONFLICT_STATUSES, STATUS_DOT_CLASS, fromChecklistConflict } from '@/components/modals/ConflictModal'
import { conflictChecklist } from '@/data/mockData'

function toConflictState(c) {
  return { ...c, status: c.resolved ? 'Resolved' : 'Pending' }
}

const FILTERS = ['All', ...CONFLICT_STATUSES]

// The full list behind the dashboard's "Active conflicts" widget's "See
// more" — same conflictChecklist mock data, its own independent local
// status state (no shared store between the two views, consistent with
// the rest of this app's per-page mock state).
function ConflictsPage() {
  const navigate = useNavigate()
  const [conflicts, setConflicts] = useState(() => conflictChecklist.map(toConflictState))
  const [filter, setFilter] = useState('All')
  const [activeConflictId, setActiveConflictId] = useState(null)

  const activeConflict = conflicts.find((c) => c.id === activeConflictId) ?? null
  const visible = filter === 'All' ? conflicts : conflicts.filter((c) => c.status === filter)

  function handleStatusChange(id, status) {
    setConflicts((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)))
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
        <h1 className="text-lg font-semibold text-foreground">All conflicts</h1>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {FILTERS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={filter === option}
            onClick={() => setFilter(option)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              filter === option
                ? 'border-transparent bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:text-foreground'
            )}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
        {visible.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">No conflicts match this filter.</p>
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
                  <p className="truncate text-sm text-foreground/90">{conflict.token}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {conflict.projectName} · {conflict.timestamp}
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-xs font-medium text-foreground/80">
                  <span className={cn('size-1.5 rounded-full', STATUS_DOT_CLASS[conflict.status])} />
                  {conflict.status}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <ConflictModal
        conflict={activeConflict && fromChecklistConflict(activeConflict)}
        onOpenChange={(open) => !open && setActiveConflictId(null)}
        onStatusChange={handleStatusChange}
        onOpenMergeStudio={handleOpenMergeStudio}
      />
    </DashboardLayout>
  )
}

export default ConflictsPage
