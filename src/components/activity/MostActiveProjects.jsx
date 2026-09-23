import { Link } from 'react-router-dom'
import { projects } from '@/data/mockData'

const sortedProjects = [...projects].sort((a, b) => b.activityCount - a.activityCount)
const maxCount = sortedProjects[0]?.activityCount ?? 1

function MostActiveProjects() {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground">Most active projects</h3>

      <div className="mt-3 flex flex-col gap-2.5">
        {sortedProjects.map((project) => (
          <Link
            key={project.id}
            to={`/projects/${project.id}/workspace`}
            className="group flex items-center gap-2.5 rounded-md px-1 py-0.5 -mx-1 transition-colors hover:bg-muted/60"
          >
            <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
            <span className="min-w-0 flex-1 truncate text-xs text-foreground/90 group-hover:text-foreground">
              {project.name}
            </span>
            <div className="h-1 w-12 shrink-0 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-muted-foreground/50"
                style={{ width: `${(project.activityCount / maxCount) * 100}%` }}
              />
            </div>
            <span className="w-4 shrink-0 text-right text-[11px] text-muted-foreground">
              {project.activityCount}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default MostActiveProjects
