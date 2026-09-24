import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { cn } from 'cn'
import { navItems } from '@/components/dashboard/Sidebar'
import { currentUser, projects } from '@/data/mockData'

const rowClass =
  'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
const activeRowClass = 'bg-muted text-foreground'

// The labeled panel next to the icon-only rail — Slack's pattern of a
// workspace icon strip plus an always-open channel list beside it. The
// icon rail (Sidebar) still carries the real navigation/tooltips; this
// panel repeats those same destinations as text, plus a per-project
// quick-switch list standing in for Slack's channel list.
function SidebarSecondary() {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r bg-card px-3 py-3">
      <button
        type="button"
        className="flex items-center justify-between rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted"
      >
        <span className="truncate text-sm font-semibold text-foreground">{currentUser.team}</span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
      </button>

      <nav className="mt-2 flex flex-col gap-0.5">
        {navItems.map(({ id, label, path }) => {
          const isActive = path && pathname.startsWith(path)
          return (
            <Link
              key={id}
              to={path ?? '#'}
              aria-disabled={!path}
              className={cn(rowClass, isActive && activeRowClass, !path && 'pointer-events-none opacity-50')}
            >
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="mt-4 border-t pt-3">
        <p className="px-2.5 text-[11px] font-medium tracking-wide text-muted-foreground/70 uppercase">
          Projects
        </p>
        <div className="mt-1 flex flex-col gap-0.5">
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => navigate(`/projects/${project.id}/workspace`)}
              className={cn(rowClass, 'w-full')}
            >
              <span className="truncate">{project.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-auto border-t pt-3">
        <div className={cn(rowClass, 'cursor-default hover:bg-transparent hover:text-muted-foreground')}>
          <span className="truncate text-foreground/80">
            {projects.reduce((sum, p) => sum + p.conflicts, 0)} open conflicts
          </span>
        </div>
      </div>
    </aside>
  )
}

export default SidebarSecondary
