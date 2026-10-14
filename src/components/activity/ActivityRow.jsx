import { Sparkles } from 'lucide-react'
import { cn } from 'cn'
import { LocalizedText } from '@/i18n/runtime'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ACTIVITY_TYPE_META } from './activityTypeMeta'

// One activity, as a row of the Workspace's lists: who (their avatar), what they did and to what, the kind
// as a quiet word (amber for 변경확인), and when — one row in the day's card. (No picture: a thumbnail per
// row made the feed a wall of phones.)
function ActivityRow({ activity }) {
  const meta = ACTIVITY_TYPE_META[activity.type]
  const isAi = activity.actorName === 'Devsign'

  return (
    <div className="flex min-w-0 items-center gap-3 rounded-[18px] px-3 py-2.5 transition-colors hover:bg-white/[0.04]">
      <Avatar size="sm">
        <AvatarFallback className={cn('text-[10px] font-medium text-white', activity.actorColorClass)} aria-label={isAi ? 'AI' : activity.actorName}>
          {isAi ? <Sparkles className="size-3.5" aria-hidden="true" /> : <LocalizedText text={activity.actorInitials} />}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] text-slate-100">
          <span className="font-medium"><LocalizedText text={activity.actorName} /></span> <LocalizedText text={activity.action} />
        </p>
        <p className="truncate text-xs text-slate-500"><LocalizedText text={activity.target} /></p>
      </div>

      <span className={cn('shrink-0 text-[12px] font-medium', meta.tone)}>{meta.label}</span>
      <span className="w-20 shrink-0 text-right text-[12px] text-slate-500 tabular-nums"><LocalizedText text={activity.timestamp} /></span>
    </div>
  )
}

export default ActivityRow
