import { cn } from 'cn'
import { activityOverviewStats } from '@/data/mockData'

const maxValue = Math.max(...activityOverviewStats.map((stat) => stat.value))

function ActivityOverview() {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Activity overview</h3>
        <span className="text-[11px] text-muted-foreground">This week</span>
      </div>

      <div className="mt-3 flex flex-col gap-2.5">
        {activityOverviewStats.map((stat) => (
          <div key={stat.id} className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-xs text-muted-foreground">{stat.label}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={cn('h-full rounded-full', stat.tone)}
                style={{ width: `${(stat.value / maxValue) * 100}%` }}
              />
            </div>
            <span className="w-5 shrink-0 text-right text-xs font-medium text-foreground">
              {stat.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ActivityOverview
