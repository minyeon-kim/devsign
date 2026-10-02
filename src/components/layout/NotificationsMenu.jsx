import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, ChevronRight, MessageSquare } from 'lucide-react'
import { cn } from 'cn'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { activities, projects } from '@/data/mockData'
import { LocalizedText } from '@/i18n/runtime'

const recentNotifications = activities.slice(0, 6)

// The bell + recent-activity dropdown, shared by the dashboard top bar and
// a project's own overview page. Same card look and unread-count badge as
// the Workspace/Merge Studio Inbox (see MergeInboxDrawer's NotificationSummary
// and InboxButton) — this is the cross-project equivalent of it (every
// project's activity, not one project's own notification store, which
// isn't reachable without that project's own workspace loaded), not a
// separate, simpler notifications widget. Clicking an item jumps straight
// into its project's Conflict Point review, the same nav-state contract
// the Workspace's own Inbox items use (see WorkspacePage's `openConflictId`
// handling) — not just a link to the Activity feed.
function NotificationsMenu({ className, iconClassName = 'size-[18px]' }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [hasUnread, setHasUnread] = useState(true)
  const unreadCount = hasUnread ? recentNotifications.length : 0

  function openItem(activity) {
    setOpen(false)
    if (activity.conflictId && activity.projectId) {
      navigate(`/projects/${activity.projectId}/workspace`, { state: { openConflictId: activity.conflictId } })
      return
    }
    navigate('/activity')
  }

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setHasUnread(false)
      }}
    >
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={unreadCount ? `Notifications (${unreadCount} unread)` : 'Notifications'}
            title="Notifications"
            className={cn(
              'relative flex items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground',
              className
            )}
          >
            <Bell className={iconClassName} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex min-w-3 items-center justify-center rounded-full bg-emerald-400 px-0.5 text-[8px] leading-[12px] font-semibold text-slate-950 ring-2 ring-background">
                {unreadCount}
              </span>
            )}
          </button>
        }
      />
      <DropdownMenuContent align="end" sideOffset={10} positionerClassName="z-[700]" className="w-80 gap-0 p-0">
        <p className="px-4 py-3 text-xs font-medium text-muted-foreground">Notifications</p>
        <div className="max-h-96 space-y-1 overflow-y-auto px-2 pb-2">
          {recentNotifications.map((activity) => {
            const project = projects.find((p) => p.id === activity.projectId)
            return (
              <button
                key={activity.id}
                type="button"
                onClick={() => openItem(activity)}
                className="flex w-full items-start gap-2.5 rounded-xl bg-white/[0.025] px-3 py-2.5 text-left ring-1 ring-white/[0.05] transition-colors hover:bg-white/[0.05]"
              >
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-300">
                  {activity.type === 'comment' ? <MessageSquare className="size-3.5" /> : <Bell className="size-3.5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-baseline gap-1.5">
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-white">
                      <LocalizedText text={activity.actorName} /> <LocalizedText text={activity.action} />
                    </span>
                    <span className="shrink-0 text-[11px] text-slate-500"><LocalizedText text={activity.timestamp} /></span>
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-slate-400"><LocalizedText text={activity.target} /></span>
                  {project && <span className="mt-0.5 block truncate text-[10.5px] text-slate-500"><LocalizedText text={project.name} /></span>}
                </span>
                <ChevronRight className="mt-1 size-3.5 shrink-0 text-slate-600" />
              </button>
            )
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default NotificationsMenu
