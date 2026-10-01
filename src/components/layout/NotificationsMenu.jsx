import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { cn } from 'cn'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { activities } from '@/data/mockData'
import { LocalizedText } from '@/i18n/runtime'

const recentNotifications = activities.slice(0, 4)

// The bell + recent-activity dropdown, shared by the dashboard top bar and
// the Workspace's floating action pill so both read and behave the same.
// Each host sizes the trigger to its own bar via `className`; the unread
// dot clears the first time the menu opens.
function NotificationsMenu({ className, iconClassName = 'size-[18px]' }) {
  const navigate = useNavigate()
  const [hasUnread, setHasUnread] = useState(true)

  return (
    <DropdownMenu onOpenChange={(open) => open && setHasUnread(false)}>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Notifications"
            title="Notifications"
            className={cn(
              'relative flex items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground',
              className
            )}
          >
            <Bell className={iconClassName} />
            {hasUnread && <span className="absolute top-1.5 right-1.5 ds-status-dot rounded-full bg-primary" />}
          </button>
        }
      />
      <DropdownMenuContent align="end" sideOffset={10} positionerClassName="z-[700]" className="w-72">
        <p className="px-1.5 py-1 text-xs font-medium text-muted-foreground">Notifications</p>
        <DropdownMenuSeparator />
        {recentNotifications.map((activity) => (
          <DropdownMenuItem
            key={activity.id}
            className="flex-col items-start gap-0.5"
            onClick={() => navigate('/activity')}
          >
            <span className="text-xs text-foreground">
              <LocalizedText text={activity.actorName} /> <LocalizedText text={activity.action} /> <LocalizedText text={activity.target} />
            </span>
            <span className="text-[11px] text-muted-foreground"><LocalizedText text={activity.timestamp} /></span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default NotificationsMenu
