import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { cn } from 'cn'
import ConflictModal from '@/components/modals/ConflictModal'
import { STAGE_DOT_CLASS, STAGE_LABEL, allConflictRecords, isOpen, sortOpenFirst } from '@/lib/conflicts'
import { projectTone } from '@/lib/projectTone'
import { useWorkspaceOptional } from '@/state/WorkspaceProvider'

// Groups conflicts by project, keeping the order projects first appear in.
function groupByProject(conflicts) {
  const groups = new Map()
  for (const c of conflicts) {
    if (!groups.has(c.projectId)) groups.set(c.projectId, { id: c.projectId, name: c.projectName, items: [] })
    groups.get(c.projectId).items.push(c)
  }
  return [...groups.values()]
}

// A conflict row: status dot + title, and the file it lives in underneath.
function ConflictRow({ conflict, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-haspopup="dialog"
      title={`${conflict.title} · ${STAGE_LABEL[conflict.reviewStage]}`}
      className={cn(
        'flex w-full flex-col gap-0.5 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-muted',
        active && 'bg-muted',
        !isOpen(conflict) && 'opacity-60'
      )}
    >
      <span className="flex w-full items-center gap-2.5 text-[13px] text-foreground/90">
        <span className={cn('size-1.5 shrink-0 rounded-full', STAGE_DOT_CLASS[conflict.reviewStage])} />
        <span className="min-w-0 flex-1 truncate">{conflict.title}</span>
        <span className="shrink-0 text-[11px] text-muted-foreground/60">{conflict.detectedAt}</span>
      </span>
      <span className="truncate pl-4 font-mono text-[11px] text-muted-foreground/70">{conflict.file}</span>
    </button>
  )
}

// The drawer panel behind the activity bar's Conflicts icon, available
// over any view — picking a conflict opens the shared ConflictModal over
// whatever you're looking at instead of taking over the main area.
//
// Inside a project it lists that project's conflicts straight from the
// workspace — the very list the terminal's Conflict Point tab shows, so
// the two always match and a review done in either shows up in both. On
// the global pages (no workspace) it lists every project's conflicts,
// grouped, from its own local copy (mock data, like the dashboard widget
// and /conflicts page).
function ConflictsDrawer({ onNavigate }) {
  const navigate = useNavigate()
  const workspace = useWorkspaceOptional()
  const [localConflicts, setLocalConflicts] = useState(allConflictRecords)
  const [localReviewId, setLocalReviewId] = useState(null)

  // Inside a project the review window is the workspace's single
  // ConflictReviewHost (shared with the terminal); elsewhere, this
  // drawer's own ConflictModal below.
  const conflicts = workspace ? workspace.conflicts : localConflicts
  const activeConflictId = workspace ? workspace.reviewConflictId : localReviewId
  const openReview = workspace ? workspace.openConflictReview : setLocalReviewId
  const localActiveConflict = workspace ? null : (conflicts.find((c) => c.id === localReviewId) ?? null)

  function handleLocalUpdate(id, patch) {
    setLocalConflicts((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  function handleOpenMergeStudio(conflict) {
    setLocalReviewId(null)
    onNavigate?.()
    navigate(`/projects/${conflict.projectId}/workspace`, { state: { openMergeStudio: true } })
  }

  return (
    <>
      <nav aria-label="Conflicts" className="flex flex-col gap-3">
        {conflicts.length === 0 && (
          <p className="px-2.5 py-1.5 text-[12px] text-muted-foreground/70">No conflicts in this project.</p>
        )}
        {groupByProject(sortOpenFirst(conflicts)).map((group) => (
          <div key={group.id}>
            {/* Inside a project, one project needs no heading. */}
            {!workspace && (
              <p className="flex h-7 items-center gap-2 px-2.5 text-[11px] font-medium tracking-wide text-muted-foreground/70 uppercase">
                <span className={cn('size-1.5 shrink-0 rounded-full', projectTone(group.id))} />
                <span className="min-w-0 truncate">{group.name}</span>
              </p>
            )}
            <div className="flex flex-col gap-0.5">
              {group.items.map((conflict) => (
                <ConflictRow
                  key={conflict.id}
                  conflict={conflict}
                  active={activeConflictId === conflict.id}
                  onSelect={() => openReview(conflict.id)}
                />
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

      {!workspace && (
        <ConflictModal
          conflict={localActiveConflict}
          onOpenChange={(open) => !open && setLocalReviewId(null)}
          onUpdate={handleLocalUpdate}
          onOpenMergeStudio={handleOpenMergeStudio}
        />
      )}
    </>
  )
}

export default ConflictsDrawer
