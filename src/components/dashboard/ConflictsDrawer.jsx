import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { cn } from 'cn'
import ConflictModal, { STATUS_DOT_CLASS, fromChecklistConflict } from '@/components/modals/ConflictModal'
import { conflictChecklist } from '@/data/mockData'
import { projectTone } from '@/lib/projectTone'

function toConflictState(c) {
  return { ...c, status: c.resolved ? 'Resolved' : 'Pending' }
}

// Groups conflicts by project, keeping the order projects first appear in.
function groupByProject(conflicts) {
  const groups = new Map()
  for (const c of conflicts) {
    if (!groups.has(c.projectId)) groups.set(c.projectId, { id: c.projectId, name: c.projectName, items: [] })
    groups.get(c.projectId).items.push(c)
  }
  return [...groups.values()]
}

// The drawer panel behind the activity bar's Conflicts icon: every
// conflict as a compact list grouped by project, available over any view
// — picking one opens the shared ConflictModal (the same one every
// conflict entry point uses) over whatever you're looking at, rather than
// taking over the main area. Like those views it holds its own local
// copy of conflictChecklist (mock data, no shared store).
//
// Inside a project it lists only that project's conflicts; on the global
// pages (no project in context) it lists every project's, grouped.
function ConflictsDrawer({ project, onNavigate }) {
  const navigate = useNavigate()
  const [conflicts, setConflicts] = useState(() =>
    conflictChecklist.filter((c) => !project || c.projectId === project.id).map(toConflictState)
  )
  const [activeConflictId, setActiveConflictId] = useState(null)
  const activeConflict = conflicts.find((c) => c.id === activeConflictId) ?? null

  function handleStatusChange(id, status) {
    setConflicts((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)))
  }

  function handleOpenMergeStudio(conflict) {
    setActiveConflictId(null)
    onNavigate?.()
    navigate(`/projects/${conflict.projectId}/workspace`, { state: { openMergeStudio: true } })
  }

  return (
    <>
      <nav aria-label="Conflicts" className="flex flex-col gap-3">
        {conflicts.length === 0 && (
          <p className="px-2.5 py-1.5 text-[12px] text-muted-foreground/70">No conflicts in this project.</p>
        )}
        {groupByProject(conflicts).map((group) => (
          <div key={group.id}>
            {/* One project needs no project heading. */}
            {!project && (
              <p className="flex h-7 items-center gap-2 px-2.5 text-[11px] font-medium tracking-wide text-muted-foreground/70 uppercase">
                <span className={cn('size-1.5 shrink-0 rounded-full', projectTone(group.id))} />
                <span className="min-w-0 truncate">{group.name}</span>
              </p>
            )}
            <div className="flex flex-col gap-0.5">
              {group.items.map((conflict) => (
                <button
                  key={conflict.id}
                  type="button"
                  onClick={() => setActiveConflictId(conflict.id)}
                  aria-haspopup="dialog"
                  title={`${conflict.token} · ${conflict.status}`}
                  className={cn(
                    'flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                    activeConflictId === conflict.id && 'bg-muted text-foreground',
                    conflict.status === 'Resolved' && 'text-muted-foreground/60'
                  )}
                >
                  <span className={cn('size-1.5 shrink-0 rounded-full', STATUS_DOT_CLASS[conflict.status])} />
                  <span className="min-w-0 flex-1 truncate">{conflict.token}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground/60">{conflict.timestamp}</span>
                </button>
              ))}
            </div>
          </div>
        ))}

        <Link
          to="/conflicts"
          onClick={onNavigate}
          className="flex h-8 items-center px-2.5 text-[12px] text-muted-foreground/70 transition-colors hover:text-foreground"
        >
          View all conflicts
        </Link>
      </nav>

      <ConflictModal
        conflict={activeConflict && fromChecklistConflict(activeConflict)}
        onOpenChange={(open) => !open && setActiveConflictId(null)}
        onStatusChange={handleStatusChange}
        onOpenMergeStudio={handleOpenMergeStudio}
      />
    </>
  )
}

export default ConflictsDrawer
