import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { cn } from 'cn'

// A compact list row, not a decorative card — name, conflict status,
// pending merges, and last update are the only things a "which project
// needs my attention" scan actually needs; thumbnail/description/avatars
// were dropped as noise relative to that.
function ProjectCard({ project }) {
  const navigate = useNavigate()
  const conflictText =
    project.conflicts > 0
      ? `${project.conflicts} conflict${project.conflicts === 1 ? '' : 's'}`
      : 'No conflicts'

  return (
    <button
      type="button"
      onClick={() => navigate(`/projects/${project.id}/workspace`)}
      className="group flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition-colors hover:bg-muted/40"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{project.name}</p>
        <div className="mt-1 flex items-center gap-1.5 text-xs">
          <span className={cn('font-medium', project.conflicts > 0 ? 'text-destructive' : 'text-emerald-400')}>
            {conflictText}
          </span>
          {project.pendingMerges > 0 && (
            <>
              <span className="text-muted-foreground/50">·</span>
              <span className="text-muted-foreground">
                {project.pendingMerges} pending merge{project.pendingMerges === 1 ? '' : 's'}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <span className="text-[11px] text-muted-foreground">Updated {project.updatedAtLabel}</span>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
          Open workspace
          <ArrowRight className="size-3" />
        </span>
      </div>
    </button>
  )
}

export default ProjectCard
