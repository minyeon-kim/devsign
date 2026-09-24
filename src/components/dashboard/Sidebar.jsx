import { Link, useLocation } from 'react-router-dom'
import { Activity, FolderKanban, LayoutDashboard, Search, Settings, Users } from 'lucide-react'
import { cn } from 'cn'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import Logo from '@/components/layout/Logo'
import { allPeople, currentUser } from '@/data/mockData'

// `path: null` items (Team) have no page yet, so they're inert (per the
// dashboard brief: "navigation links do not need backend functionality").
const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { id: 'projects', label: 'Projects', icon: FolderKanban, path: '/projects' },
  { id: 'activity', label: 'Activity', icon: Activity, path: '/activity' },
  { id: 'team', label: 'Team', icon: Users, path: null },
]

const rowClass =
  'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
const activeRowClass = 'bg-muted text-foreground'

// A wide, labeled sidebar (not the workspace's icon-only ActivityBar) —
// shared by every dashboard-level page (Dashboard, Projects, Activity)
// via DashboardLayout, so it stays put instead of resizing/reflowing
// content as you navigate between them.
function Sidebar() {
  const { pathname } = useLocation()

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r bg-card px-3 py-3">
      <div className="flex items-center px-1.5 py-1.5">
        <Logo />
      </div>

      <div className="relative mt-3">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search" className="h-8 pl-8 text-xs" />
      </div>

      <nav className="mt-3 flex flex-col gap-0.5">
        {navItems.map(({ id, label, icon: Icon, path }) => {
          const isActive = path && pathname.startsWith(path)
          return (
            <Link
              key={id}
              to={path ?? '#'}
              aria-disabled={!path}
              className={cn(rowClass, isActive && activeRowClass, !path && 'pointer-events-none opacity-50')}
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="mt-4 border-t pt-3">
        <p className="px-2.5 text-[11px] font-medium tracking-wide text-muted-foreground/70 uppercase">
          {currentUser.team}
        </p>
        <div className={cn(rowClass, 'mt-1 cursor-default hover:bg-transparent hover:text-muted-foreground')}>
          <Avatar size="sm" className="shrink-0">
            <AvatarFallback className={cn('text-[10px] font-medium text-white', currentUser.colorClass)}>
              {currentUser.initials}
            </AvatarFallback>
          </Avatar>
          <span className="truncate text-foreground/80">{currentUser.team}</span>
          <span className="ml-auto shrink-0 text-[11px] text-muted-foreground/70">
            {allPeople.length} members
          </span>
        </div>
      </div>

      <div className="mt-auto border-t pt-3">
        <button type="button" className={cn(rowClass, 'w-full')}>
          <Settings className="size-4 shrink-0" />
          Settings
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
