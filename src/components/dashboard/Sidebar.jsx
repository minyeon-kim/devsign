import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Activity, BookOpen, ChevronLeft, ChevronRight, History, House, Import, LayoutGrid, PanelLeftClose, Settings, Users } from 'lucide-react'
import { cn } from 'cn'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import DocsDrawer from '@/components/dashboard/DocsDrawer'
import ProjectSwitcher from '@/components/dashboard/ProjectSwitcher'
import { projectTone } from '@/lib/projectTone'

// The global destinations, shown only outside a project: Home (the
// project hub), Activity and Team. Inside a project they step aside so
// the rail only carries that project's own views.
const globalItems = [
  { id: 'home', label: 'Home', icon: House, path: '/dashboard' },
  { id: 'activity', label: 'Activity', icon: Activity, path: '/activity' },
  { id: 'team', label: 'Team', icon: Users, path: '/team' },
]

const iconButtonClass =
  'mx-1.5 flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'

// Deliberately restrained: a muted surface + a thin primary-tinted ring,
// not a saturated blue fill — the icon itself stays close to neutral.
const activeClass = 'bg-muted text-foreground ring-1 ring-primary/40'

// An icon-only activity bar button, named by its tooltip.
function RailButton({ label, icon: Icon, className, ...triggerProps }) {
  return (
    <Tooltip>
      <TooltipTrigger aria-label={label} className={cn(iconButtonClass, className)} {...triggerProps}>
        <Icon className="size-[18px]" />
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

// The Projects button's face: a grid icon on global pages, or — inside
// a project — that project's own color badge (its initial on its identity
// color, see projectTone), swapping in with a quick scale/fade whenever
// the project changes.
function ProjectsMark({ project }) {
  if (!project) return <LayoutGrid className="size-[18px]" />
  return (
    <span
      key={project.id}
      className={cn(
        'flex size-[22px] items-center justify-center rounded-md text-[11px] font-semibold text-white ring-1 ring-white/10 animate-in fade-in zoom-in-90 duration-200 motion-reduce:animate-none',
        projectTone(project.id)
      )}
    >
      {project.name.charAt(0)}
    </span>
  )
}

// The activity bar, permanently slim and icon-only, and contextual:
//   · at the top, always: Projects — the Slack-style project switcher,
//     wearing the current project's badge while you're in one;
//   · outside a project: Home (the project hub), Activity and Team;
//   · inside a project: just that project's views — Home (its overview),
//     Docs (which opens the docs category tree in the drawer), History (its
//     checkpoints) and Import (the import screen). Activity
//     and Team step aside so the focused workspace isn't cluttered, and
//     Conflict Points live only in the Workspace's bottom panel.
// Settings is pinned to the bottom.
function ActivityBar({ project, drawer, onToggleDrawer }) {
  const { pathname } = useLocation()
  const path = pathname.replace(/\/$/, '')
  const overviewPath = project ? `/projects/${project.id}` : null
  const base = project ? `/projects/${project.id}` : null
  const onDocs = !!base && path.startsWith(`${base}/docs`)

  return (
    <div className="flex h-full w-12 shrink-0 flex-col gap-1 bg-sidebar pb-2">
      <div className="mb-1 flex h-14 shrink-0 items-center">
        <ProjectSwitcher currentProjectId={project?.id}>
          <Tooltip>
            <TooltipTrigger
              render={
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      aria-label={project ? `Projects (current: ${project.name})` : 'Projects'}
                      className={cn(iconButtonClass, 'data-[popup-open]:bg-muted')}
                    />
                  }
                />
              }
            >
              <ProjectsMark project={project} />
            </TooltipTrigger>
            <TooltipContent side="right">{project ? `${project.name} · Switch project` : 'Projects'}</TooltipContent>
          </Tooltip>
        </ProjectSwitcher>
      </div>

      <nav aria-label="Main" className="flex flex-col gap-1">
        {project ? (
          <>
            <RailButton
              label={`${project.name} home`}
              icon={House}
              render={<Link to={overviewPath} />}
              aria-current={path === overviewPath ? 'page' : undefined}
              className={cn(path === overviewPath && !drawer && activeClass)}
            />
            <RailButton
              label="Docs"
              icon={BookOpen}
              onClick={() => onToggleDrawer('docs')}
              aria-expanded={drawer === 'docs'}
              className={cn((drawer === 'docs' || (onDocs && !drawer)) && activeClass)}
            />
            {[
              ['history', 'History', History],
              ['import', 'Import', Import],
            ].map(([seg, label, icon]) => {
              const to = `${base}/${seg}`
              const active = path.startsWith(to)
              return (
                <RailButton
                  key={seg}
                  label={label}
                  icon={icon}
                  render={<Link to={to} />}
                  aria-current={active ? 'page' : undefined}
                  className={cn(active && !drawer && activeClass)}
                />
              )
            })}
          </>
        ) : (
          globalItems.map(({ id, label, icon, path: to }) => {
            const active = path.startsWith(to)
            return (
              <RailButton
                key={id}
                label={label}
                icon={icon}
                render={<Link to={to} />}
                aria-current={active ? 'page' : undefined}
                className={cn(active && activeClass)}
              />
            )
          })
        )}
      </nav>

      <div className="mt-auto flex flex-col gap-1">
        <RailButton
          label="Settings"
          icon={Settings}
          onClick={() => toast('Settings', { description: 'Workspace settings' })}
        />
      </div>
    </div>
  )
}

function CloseButton({ onClose }) {
  return (
    <Tooltip>
      <TooltipTrigger
        onClick={onClose}
        aria-label="Close drawer"
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <PanelLeftClose className="size-[18px]" />
      </TooltipTrigger>
      <TooltipContent side="bottom">Close</TooltipContent>
    </Tooltip>
  )
}

// Claude-style back / forward icons in the drawer header — through the
// browser history, so ‹ from anywhere in Docs returns to where you
// came from (e.g. the Workspace), and › goes forward again.
function HistoryNavButtons() {
  const navigate = useNavigate()
  useLocation() // re-render on every navigation so the enabled states stay current
  // Only enabled when there's somewhere to go inside the app — never back
  // out of it: Back uses react-router's own history index (0 = the first
  // page of this visit); Forward asks the Navigation API where supported.
  const canGoBack = (window.history.state?.idx ?? 0) > 0
  const canGoForward = window.navigation?.canGoForward ?? true

  const buttonClass =
    'flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-35'
  return (
    <div className="flex shrink-0 items-center">
      <button type="button" title="Back" aria-label="Back" disabled={!canGoBack} onClick={() => navigate(-1)} className={buttonClass}>
        <ChevronLeft className="size-4" />
      </button>
      <button type="button" title="Forward" aria-label="Forward" disabled={!canGoForward} onClick={() => navigate(1)} className={buttonClass}>
        <ChevronRight className="size-4" />
      </button>
    </div>
  )
}

const DRAWER_TITLES = { docs: 'Docs' }

// The app's navigation: the always-slim ActivityBar, and beside it a
// drawer used by the Docs icon for the docs category tree. It slides open
// (its width animates from 0; its content keeps a fixed w-68 so nothing
// re-wraps mid-animation) and closes from its own button or the Docs icon
// again. Every other destination is a plain full page.
function Sidebar({ project, drawer, onToggleDrawer, onCloseDrawer }) {
  // Keep showing the last panel while the drawer animates shut.
  const [shown, setShown] = useState(drawer)
  if (drawer && drawer !== shown) setShown(drawer)
  const panel = drawer ?? shown

  return (
    <div className="z-10 flex h-full shrink-0">
      <ActivityBar project={project} drawer={drawer} onToggleDrawer={onToggleDrawer} />

      <div
        inert={!drawer}
        aria-hidden={!drawer}
        className={cn(
          'h-full shrink-0 overflow-hidden transition-[width] duration-200 ease-out motion-reduce:transition-none',
          drawer ? 'w-68' : 'w-0'
        )}
      >
        <aside
          aria-label={DRAWER_TITLES[panel] ?? 'Drawer'}
          className="flex h-full w-68 flex-col border-x border-white/[0.06] bg-sidebar pb-2"
        >
          <div className="mb-1 flex h-14 shrink-0 items-center justify-between gap-1 pr-2 pl-2">
            <p className="min-w-0 flex-1 truncate px-2.5 text-[14px] font-semibold text-foreground">
              {DRAWER_TITLES[panel]}
            </p>
            <HistoryNavButtons />
            <CloseButton onClose={onCloseDrawer} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2">
            {panel === 'docs' && project && <DocsDrawer project={project} />}
          </div>
        </aside>
      </div>
    </div>
  )
}

export default Sidebar
