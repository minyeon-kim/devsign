import { MoreHorizontal } from 'lucide-react'
import { cn } from 'cn'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import ActivityPreview from './ActivityPreview'
import { ACTIVITY_TYPE_META } from './activityTypeMeta'

function ActivityRow({ activity }) {
  const meta = ACTIVITY_TYPE_META[activity.type]
  const Icon = meta.icon

  return (
    <div className="group grid grid-cols-[48px_28px_28px_minmax(0,1fr)_auto] sm:grid-cols-[56px_28px_28px_minmax(0,1fr)_auto_auto_28px] items-center gap-3 rounded-lg border border-transparent px-2 py-2.5 transition-colors duration-150 hover:border-border hover:bg-muted/40">
      <span className="text-[11px] text-muted-foreground">{activity.timestamp}</span>

      <span className={cn('flex size-7 items-center justify-center rounded-full', meta.tone)}>
        <Icon className="size-3.5" />
      </span>

      <Avatar size="sm">
        <AvatarFallback className="bg-muted text-[10px] font-medium text-muted-foreground ring-1 ring-border/60">
          {activity.actorInitials}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0">
        <p className="truncate text-sm text-foreground">
          <span className="font-medium">{activity.actorName}</span> {activity.action}
        </p>
        <p className="truncate text-xs text-muted-foreground">{activity.target}</p>
      </div>

      <span
        className={cn(
          'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
          meta.tone
        )}
      >
        {meta.label}
      </span>

      <div className="col-start-4 sm:col-auto"><ActivityPreview activity={activity} /></div>

      <button
        type="button"
        title="More"
        className="hidden sm:flex size-7 items-center justify-center justify-self-end rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
      >
        <MoreHorizontal className="size-3.5" />
      </button>
    </div>
  )
}

export default ActivityRow
