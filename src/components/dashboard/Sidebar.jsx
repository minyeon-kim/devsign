import { Link, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { Activity, FolderKanban, LayoutDashboard, Menu, Settings, Users } from 'lucide-react'
import { cn } from 'cn'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

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

// Permanently docked and identical on every route (dashboard pages and a
// project's Workspace/Archive alike). The drawer beside it (see
// AppShell) is the only part that ever collapses; its hamburger trigger
// normally sits in the top bar's top-left corner, right above this rail,
// so it only appears here on routes that have no top bar. The four
// section icons just navigate; Settings sits in the lower utility group.
function Sidebar({ showDrawerToggle = false, drawerOpen = true, onToggleDrawer }) {
  const { pathname } = useLocation()
  const current = activeNavItem(pathname)

  return (
    <aside className="z-10 flex h-full w-12 shrink-0 flex-col items-center gap-1 border-r bg-card py-2">
      {showDrawerToggle && (
        <Tooltip>
          <TooltipTrigger
            onClick={onToggleDrawer}
            aria-expanded={drawerOpen}
            aria-label={drawerOpen ? 'Hide sidebar' : 'Show sidebar'}
            className={cn(iconButtonClass, 'mb-2')}
          >
            <Menu className="size-[18px]" />
          </TooltipTrigger>
          <TooltipContent side="right">{`${drawerOpen ? 'Hide' : 'Show'} sidebar · ⌘B`}</TooltipContent>
        </Tooltip>
      )}

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
