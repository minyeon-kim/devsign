import { cn } from 'cn'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { currentUser } from '@/data/mockData'

function ProfileCard() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5">
      <Avatar>
        <AvatarFallback className={cn('text-xs font-medium text-white', currentUser.colorClass)}>
          {currentUser.initials}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{currentUser.name}</p>
        <p className="text-[11px] text-muted-foreground">{currentUser.team}</p>
      </div>
    </div>
  )
}

export default ProfileCard
