import { FolderKanban, GitBranch, GitMerge, Users } from 'lucide-react'
import { dashboardTeamMemberCount, projects } from '@/data/mockData'

const totalConflicts = projects.reduce((sum, p) => sum + p.conflicts, 0)
const totalPendingMerges = projects.reduce((sum, p) => sum + p.pendingMerges, 0)

const stats = [
  { id: 'projects', label: 'Total projects', value: projects.length, icon: FolderKanban },
  { id: 'conflicts', label: 'Conflict points', value: totalConflicts, icon: GitBranch },
  { id: 'merges', label: 'Pending merges', value: totalPendingMerges, icon: GitMerge },
  { id: 'members', label: 'Team members', value: dashboardTeamMemberCount, icon: Users },
]

function StatsGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map(({ id, label, value, icon: Icon }) => (
        <div
          key={id}
          className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-lg font-semibold text-foreground">{value}</p>
            <p className="truncate text-[11px] text-muted-foreground">{label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

export default StatsGrid
