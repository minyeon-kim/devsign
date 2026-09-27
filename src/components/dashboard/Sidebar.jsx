import { Link, useLocation } from 'react-router-dom'
import { Activity, FolderKanban, LayoutDashboard, Settings, Users } from 'lucide-react'
import { cn } from 'cn'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import Logo from '@/components/layout/Logo'

// Mirrors the workspace's ActivityBar (narrow icon rail, Tooltip-labeled,
// size-9/rounded-full, Settings pinned to the bottom) so the dashboard and
// workspace chrome read as one product. Shared with SidebarSecondary so
// the icon rail and the labeled panel next to it never drift apart.
export const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { id: 'projects', label: 'Projects', icon: FolderKanban, path: '/projects' },
  { id: 'activity', label: 'Activity', icon: Activity, path: '/activity' },
  { id: 'team', label: 'Team', icon: Users, path: '/team' },
]

const iconButtonClass =
  'flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'

// Deliberately restrained: a muted surface + a thin primary-tinted ring,
// not a saturated blue fill — the icon itself stays close to neutral.
const activeClass = 'bg-muted text-foreground ring-1 ring-primary/40'

function Sidebar() {
  const { pathname } = useLocation()

  return (
    <aside className="flex h-full w-12 shrink-0 flex-col items-center gap-1 border-r bg-card py-2">
      <div className="mb-1 flex size-9 items-center justify-center">
        <Logo iconOnly />
      </div>

      <nav className="flex flex-col items-center gap-1">
        {navItems.map(({ id, label, icon: Icon, path }) => {
          const isActive = path && pathname.startsWith(path)
          return (
            <Tooltip key={id}>
              <TooltipTrigger
                render={path ? <Link to={path} /> : undefined}
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
          <TooltipTrigger className={iconButtonClass}>
            <Settings className="size-[18px]" />
          </TooltipTrigger>
          <TooltipContent side="right">Settings</TooltipContent>
        </Tooltip>
      </div>
    </aside>
  )
}

export default Sidebar
