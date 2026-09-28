import { Fragment, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { Activity, Archive, GitBranch, House, LayoutGrid, PanelLeftClose, Settings, Users } from 'lucide-react'
import { cn } from 'cn'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import ConflictsDrawer from '@/components/dashboard/ConflictsDrawer'
import ArchiveDrawer from '@/components/dashboard/ArchiveDrawer'
import ProjectSwitcher from '@/components/dashboard/ProjectSwitcher'
import { projectTone } from '@/lib/projectTone'
import { allConflictRecords, isOpen } from '@/lib/conflicts'
import { useWorkspaceOptional } from '@/state/WorkspaceProvider'

const totalOpenConflicts = allConflictRecords().filter(isOpen).length

// The activity bar's global destinations: Home, Conflict Points, Activity,
// Team. Projects isn't in this list — its button (the project switcher)
// sits above these, at the very top, and is rendered separately. Conflicts is the full list behind the dashboard's "Active
// conflicts" widget, with its open count badged on the icon.
export const navItems = [
  {
    id: 'home',
    label: 'Home',
    icon: House,
    path: '/dashboard',
    match: (pathname) => pathname.startsWith('/dashboard'),
  },
  {
    id: 'conflicts',
    label: 'Conflict Points',
    icon: GitBranch,
    path: '/conflicts',
    match: (pathname) => pathname.startsWith('/conflicts'),
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

// Projects as a section, for the Projects button's active state.
const projectsSection = {
  id: 'projects',
  label: 'Projects',
  path: '/projects',
  match: (pathname) => pathname.startsWith('/projects'),
}

// The section the current route belongs to.
function activeNavItem(pathname) {
  return [...navItems, projectsSection].find((item) => item.match(pathname)) ?? navItems[0]
}

const iconButtonClass =
  'mx-1.5 flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'

// Deliberately restrained: a muted surface + a thin primary-tinted ring,
// not a saturated blue fill — the icon itself stays close to neutral.
const activeClass = 'bg-muted text-foreground ring-1 ring-primary/40'

// An icon-only activity bar button, named by its tooltip.
// An optional `badge` count sits on the icon's top-right corner.
function RailButton({ label, icon: Icon, badge, className, ...triggerProps }) {
  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={badge ? `${label} (${badge})` : label}
        className={cn(iconButtonClass, 'relative', className)}
        {...triggerProps}
      >
        <Icon className="size-[18px]" />
        {!!badge && (
          <span className="absolute top-0.5 right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-destructive px-1 text-[9px] leading-none font-semibold text-white tabular-nums">
            {badge}
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

// The Projects button's face: a grid icon on global pages, or — inside
// a project — that project's own color badge (its initial on its identity
// color, see projectTone), sized to sit at the same visual weight as the
// 18px icons around it and swapping in with a quick scale/fade whenever
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

// Tier 1 — the activity bar. Permanently slim and icon-only on every
// route, top to bottom:
//   1. Projects, at the very top — opens the Slack-style project switcher
//      (every project, plus "All projects"), and wears the current
//      project's badge while you're in one;
//   2. Home — straight to the dashboard;
//   3. inside a project, Archive (which opens its Reference Docs / History
//      sub-navigation in the drawer rather than jumping into content) — promoted right under Home as the
//      project's high-frequency docs/specs/history view (Workspace is the
//      default view and needs no icon) — then a hairline;
//   4. the secondary global items: Conflict Points (which opens the
//      conflict list in the drawer, over any view), Activity and Team —
//      which go straight to their full pages, with no drawer;
// with Settings pinned to the bottom. Nothing contextual ever lands here.
// It always sits on the shared surface tone (`bg-sidebar`, the same as
// every panel and window) one step above the deeper canvas.
function ActivityBar({ project, drawer, onToggleDrawer }) {
  const conflictsOpen = drawer === 'conflicts'
  const { pathname } = useLocation()
  const workspace = useWorkspaceOptional()
  // Inside a project, the live count of its open conflicts (the same list
  // the drawer and the terminal show); elsewhere, every project's.
  const openConflicts = workspace ? workspace.conflicts.filter(isOpen).length : totalOpenConflicts
  const current = activeNavItem(pathname)
  const archivePath = project ? `/projects/${project.id}/archive` : null
  const onArchive = !!archivePath && pathname.startsWith(archivePath)
  // Archive carries its own highlight, so Projects doesn't double up there.
  const inProjects = current.id === 'projects' && !onArchive

  return (
    <div className="flex h-full w-12 shrink-0 flex-col gap-1 bg-sidebar pb-2">
      {/* Project context comes first: the switcher owns the top slot. */}
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
                      aria-current={inProjects ? 'page' : undefined}
                      className={cn(iconButtonClass, 'data-[popup-open]:bg-muted', inProjects && activeClass)}
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
        {navItems.map(({ id, label, icon, path }) => {
          // While the conflict list is up, Conflicts is the highlighted item.
          const isActive = id === 'conflicts' ? conflictsOpen || id === current.id : !conflictsOpen && id === current.id
          return (
            <Fragment key={id}>
              {id === 'conflicts' ? (
                // Opens the conflict list in the drawer rather than taking
                // over the main view (the full page is its "View all").
                <RailButton
                  label={label}
                  icon={icon}
                  badge={openConflicts}
                  onClick={() => onToggleDrawer('conflicts')}
                  aria-expanded={conflictsOpen}
                  className={cn(isActive && activeClass)}
                />
              ) : (
                <RailButton
                  label={label}
                  icon={icon}
                  render={<Link to={path} />}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(isActive && activeClass)}
                />
              )}
              {/* Inside a project, its one alternate view sits right under
                  Home. (Workspace is the project's default view — you land
                  there on entering — so it has no icon of its own.) */}
              {id === 'home' && project && (
                <>
                  <RailButton
                    label="Archive"
                    icon={Archive}
                    onClick={() => onToggleDrawer('archive')}
                    aria-expanded={drawer === 'archive'}
                    className={cn((drawer === 'archive' || (onArchive && !drawer)) && activeClass)}
                  />
                  {/* Separates the high-frequency project group above from
                      the secondary global items (Conflicts, Activity, Team)
                      below. */}
                  <div role="separator" className="mx-3.5 my-1.5 h-px shrink-0 bg-white/[0.08]" />
                </>
              )}
            </Fragment>
          )
        })}
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

const DRAWER_TITLES = { conflicts: 'Conflict Points', archive: 'Archive' }

// The app's navigation: the always-slim ActivityBar with the global
// destinations, and beside it a drawer used by just two icons — Conflict
// Points (the conflict list) and Archive (its sub-navigation). It slides
// open (its width animates from 0; its content keeps a fixed w-68 so
// nothing re-wraps mid-animation) and closes from its own button or the
// same icon again. Every other destination is a plain full page; there is
// no general sidebar toggle.
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
          <div className="mb-1 flex h-14 shrink-0 items-center justify-between gap-2 pr-2 pl-2">
            <p className="min-w-0 flex-1 truncate px-2.5 text-[14px] font-semibold text-foreground">
              {DRAWER_TITLES[panel]}
            </p>
            <CloseButton onClose={onCloseDrawer} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2">
            {panel === 'conflicts' && <ConflictsDrawer onNavigate={onCloseDrawer} />}
            {panel === 'archive' && project && <ArchiveDrawer project={project} />}
          </div>
        </aside>
      </div>
    </div>
  )
}

export default Sidebar
