import { cn } from 'cn'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { activities } from '@/data/mockData'

function RecentActivity() {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground">Recent activity</h3>

      <ul className="mt-3 flex flex-col gap-3">
        {activities.map((activity) => (
          <li key={activity.id} className="flex items-start gap-2.5">
            <Avatar size="sm" className="mt-0.5">
              <AvatarFallback
                className={cn('text-[10px] font-medium text-white', activity.actorColorClass)}
              >
                {activity.actorInitials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-xs text-foreground/90">
                <span className="font-medium">{activity.actorName}</span> {activity.action}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {activity.target} · {activity.timestamp}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default RecentActivity
