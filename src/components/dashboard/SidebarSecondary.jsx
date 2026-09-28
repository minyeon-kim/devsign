import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronRight, FolderKanban, LayoutPanelLeft } from 'lucide-react'
import { cn } from 'cn'
import { projects } from '@/data/mockData'

// h-9 (not padding) so each row's pitch exactly matches the icon rail's
// size-9 buttons + gap-1, keeping every row lined up with its icon.
const rowClass =
  'flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
const activeRowClass = 'bg-muted text-foreground'

// The labeled panel next to the icon-only rail — Slack's pattern of a
// workspace icon strip plus an always-open channel list beside it. Its
// content is context-dependent rather than a second copy of the icon
// rail's own destinations: outside a project it's a projects quick-switch
// list plus an open-conflicts summary; inside a project (`project` set)
// it becomes that project's own submenu — back to all projects, a
// project-switch list, and Workspace/Archive (deliberately no per-project
// Settings).
function SidebarSecondary({ project }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [projectsOpen, setProjectsOpen] = useState(!!project)

  if (project) {
    const projectLinks = [
      { id: 'workspace', label: 'Workspace', icon: LayoutPanelLeft, path: `/projects/${project.id}/workspace` },
      { id: 'archive', label: 'Archive', icon: FolderKanban, path: `/projects/${project.id}/archive` },
    ]

    return (
      <aside className="flex h-full w-60 shrink-0 flex-col border-r bg-card px-3 py-2">
        <Link
          to="/projects"
          className="mb-1 flex h-10 shrink-0 items-center gap-2 px-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          All projects
        </Link>

        <nav className="flex flex-col gap-1">
          {projectLinks.map(({ id, label, icon: Icon, path }) => {
            const isActive = pathname.startsWith(path)
            return (
              <Link key={id} to={path} className={cn(rowClass, isActive && activeRowClass)}>
                <Icon className="size-3.5 shrink-0" />
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
            Switch project
          </button>
          <div
            className={cn(
              'grid transition-[grid-template-rows] duration-200 ease-out',
              projectsOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
            )}
          >
            <div className="overflow-hidden">
              <div className="mt-1 flex flex-col gap-0.5">
                {projects.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => navigate(`/projects/${p.id}/workspace`)}
                    className={cn(rowClass, 'w-full', p.id === project.id && activeRowClass)}
                  >
                    <span className="truncate">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </aside>
    )
  }

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r bg-card px-3 py-2">
      {/* Matches the icon rail's Logo block (size-9 + mb-1) so the panel's
          content lines up with the icons next to it, instead of starting
          flush at the very top of the panel. */}
      <div className="mb-1 h-10 shrink-0" />

      <div className="border-t pt-3">
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
              {projects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => navigate(`/projects/${p.id}/workspace`)}
                  className={cn(rowClass, 'w-full')}
                >
                  <span className="truncate">{p.name}</span>
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
