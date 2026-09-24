import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { cn } from 'cn'
import { navItems } from '@/components/dashboard/Sidebar'
import { projects } from '@/data/mockData'

// h-9 (not padding) so each row's pitch exactly matches the icon rail's
// size-9 buttons + gap-1, keeping every row lined up with its icon.
const rowClass =
  'flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
const activeRowClass = 'bg-muted text-foreground'

// The labeled panel next to the icon-only rail — Slack's pattern of a
// workspace icon strip plus an always-open channel list beside it. The
// icon rail (Sidebar) still carries the real navigation/tooltips; this
// panel repeats those same destinations as text, plus a per-project
// quick-switch list standing in for Slack's channel list.
function SidebarSecondary() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [projectsOpen, setProjectsOpen] = useState(false)

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r bg-card px-3 py-2">
      {/* Matches the icon rail's Logo block (size-9 + mb-1) so "Dashboard"
          here lines up with the Dashboard icon next to it, instead of
          starting flush at the very top of the panel. */}
      <div className="mb-1 h-10 shrink-0" />

      <nav className="flex flex-col gap-1">
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
        <button
          type="button"
          onClick={() => setProjectsOpen((open) => !open)}
          aria-expanded={projectsOpen}
          className="flex w-full items-center gap-1 px-2.5 text-[11px] font-medium tracking-wide text-muted-foreground/70 uppercase transition-colors hover:text-foreground"
        >
          <ChevronRight className={cn('size-3 shrink-0 transition-transform', projectsOpen && 'rotate-90')} />
          Projects
        </button>
        <div
          className={cn(
            'grid transition-[grid-template-rows] duration-200 ease-out',
            projectsOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
          )}
        >
          <div className="overflow-hidden">
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
