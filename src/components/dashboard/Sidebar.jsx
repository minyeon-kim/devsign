import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Activity, Bell, FolderKanban, LayoutDashboard, Settings, Users } from 'lucide-react'
import { cn } from 'cn'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import Logo from '@/components/layout/Logo'
import { activities } from '@/data/mockData'

// The four top-level destinations — the rail's only nav items. Shared
// with SidebarSecondary, which picks its contextual sub-menu from the
// same `match` so the icon rail and the labeled drawer never disagree
// about which section is active. Home also owns /conflicts (the full list
// behind the dashboard's "Active conflicts" widget), and Projects owns
// every project's own Workspace/Archive routes.
export const navItems = [
  {
    id: 'home',
    label: 'Home',
    icon: LayoutDashboard,
    path: '/dashboard',
    match: (pathname) => pathname.startsWith('/dashboard') || pathname.startsWith('/conflicts'),
  },
  {
    id: 'projects',
    label: 'Projects',
    icon: FolderKanban,
    path: '/projects',
    match: (pathname) => pathname.startsWith('/projects'),
  },
  {
    id: 'activity',
    label: 'Activity',
    icon: Activity,
    path: '/activity',
    match: (pathname) => pathname.startsWith('/activity'),
  },
  {
    id: 'team',
    label: 'Team',
    icon: Users,
    path: '/team',
    match: (pathname) => pathname.startsWith('/team'),
  },
]

export function activeNavItem(pathname) {
  return navItems.find((item) => item.match(pathname)) ?? navItems[0]
}

const iconButtonClass =
  'flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'

// Deliberately restrained: a muted surface + a thin primary-tinted ring,
// not a saturated blue fill — the icon itself stays close to neutral.
const activeClass = 'bg-muted text-foreground ring-1 ring-primary/40'

const recentNotifications = activities.slice(0, 4)

// Lives in the rail's lower utility group (not the top bar) so it's
// reachable from every route, including a project's Workspace/Archive,
// which have no global top bar.
function NotificationsButton() {
  const navigate = useNavigate()
  const [hasUnread, setHasUnread] = useState(true)

  return (
    <DropdownMenu onOpenChange={(open) => open && setHasUnread(false)}>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={
                <button type="button" aria-label="Notifications" className={cn(iconButtonClass, 'relative')}>
                  <Bell className="size-[18px]" />
                  {hasUnread && <span className="absolute top-2 right-2 size-1.5 rounded-full bg-primary" />}
                </button>
              }
            />
          }
        />
        <TooltipContent side="right">Notifications</TooltipContent>
      </Tooltip>
      <DropdownMenuContent side="right" align="end" sideOffset={8} className="w-72">
        <p className="px-1.5 py-1 text-xs font-medium text-muted-foreground">Notifications</p>
        <DropdownMenuSeparator />
        {recentNotifications.map((activity) => (
          <DropdownMenuItem
            key={activity.id}
            className="flex-col items-start gap-0.5"
            onClick={() => navigate('/activity')}
          >
            <span className="text-xs text-foreground">
              {activity.actorName} {activity.action} {activity.target}
            </span>
            <span className="text-[11px] text-muted-foreground">{activity.timestamp}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Permanently docked and identical on every route (dashboard pages and a
// project's Workspace/Archive alike). Gemini-style, the app logo at the
// top is the sidebar trigger: it folds/unfolds the labeled drawer beside
// the rail (see AppShell), which is the only part that ever collapses.
// The four section icons just navigate; Notifications and Settings sit in
// the lower utility group.
function Sidebar({ drawerOpen = true, onToggleDrawer }) {
  const { pathname } = useLocation()
  const current = activeNavItem(pathname)
  const toggleLabel = `${drawerOpen ? 'Hide' : 'Show'} sidebar · ⌘B`

  return (
    <aside className="z-10 flex h-full w-12 shrink-0 flex-col items-center gap-1 border-r bg-card py-2">
      <Tooltip>
        <TooltipTrigger
          onClick={onToggleDrawer}
          aria-expanded={drawerOpen}
          aria-label={drawerOpen ? 'Hide sidebar' : 'Show sidebar'}
          className={cn(iconButtonClass, 'mb-2 rounded-lg')}
        >
          <Logo iconOnly />
        </TooltipTrigger>
        <TooltipContent side="right">{toggleLabel}</TooltipContent>
      </Tooltip>

      <nav className="flex flex-col items-center gap-1">
        {navItems.map(({ id, label, icon: Icon, path }) => {
          const isActive = id === current.id
          return (
            <Tooltip key={id}>
              <TooltipTrigger
                render={<Link to={path} />}
                aria-current={isActive ? 'page' : undefined}
                className={cn(iconButtonClass, isActive && activeClass)}
              >
                <Icon className="size-[18px]" />
              </TooltipTrigger>
              <TooltipContent side="right">{label}</TooltipContent>
            </Tooltip>
          )
        })}
      </nav>

      <div className="mt-auto flex flex-col items-center gap-1">
        <NotificationsButton />
        <Tooltip>
          <TooltipTrigger
            onClick={() => toast('Settings', { description: 'Workspace settings' })}
            aria-label="Settings"
            className={iconButtonClass}
          >
            <Settings className="size-[18px]" />
          </TooltipTrigger>
          <TooltipContent side="right">Settings</TooltipContent>
        </Tooltip>
      </div>
    </aside>
  )
}

export default Sidebar
