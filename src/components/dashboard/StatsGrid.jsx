import { GitBranch, GitMerge, Sparkles } from 'lucide-react'
import { cn } from 'cn'
import { dashboardActiveConflicts, projects } from '@/data/mockData'

const totalConflicts = projects.reduce((sum, p) => sum + p.conflicts, 0)
const totalPendingMerges = projects.reduce((sum, p) => sum + p.pendingMerges, 0)
const driftDetectedCount = dashboardActiveConflicts.length

const stats = [
  {
    id: 'conflicts',
    label: 'Conflict points',
    value: totalConflicts,
    hint: totalConflicts > 0 ? 'Needs review' : 'All clear',
    icon: GitBranch,
    tone:
      totalConflicts > 0 ? 'bg-destructive/10 text-destructive' : 'bg-emerald-500/10 text-emerald-400',
  },
  {
    id: 'drift',
    label: 'Drift detected',
    value: driftDetectedCount,
    hint: driftDetectedCount > 0 ? 'Design vs. code mismatch' : 'In sync',
    icon: Sparkles,
    tone:
      driftDetectedCount > 0 ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400',
  },
  {
    id: 'merges',
    label: 'Pending merges',
    value: totalPendingMerges,
    hint: totalPendingMerges > 0 ? 'Ready to merge' : 'Nothing pending',
    icon: GitMerge,
    tone:
      totalPendingMerges > 0 ? 'bg-primary/10 text-primary' : 'bg-emerald-500/10 text-emerald-400',
  },
]

function StatsGrid() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {stats.map(({ id, label, value, hint, icon: Icon, tone }) => (
        <div key={id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
          <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-md', tone)}>
            <Icon className="size-4" />
          </span>
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <p className="text-lg font-semibold text-foreground">{value}</p>
              <p className="text-[11px] text-muted-foreground">{label}</p>
            </div>
            <p className="truncate text-[11px] text-muted-foreground/70">{hint}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

export default StatsGrid
