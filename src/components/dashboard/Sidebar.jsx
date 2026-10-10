import SettingsDialog from '@/components/workspace/SettingsDialog'
import { useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Activity, BookOpen, ChevronLeft, ChevronRight, History, House, Import, LayoutDashboard, LayoutGrid, LayoutPanelLeft, PanelLeftClose, TriangleAlert, Users } from 'lucide-react'
import { cn } from 'cn'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import DocsDrawer from '@/components/dashboard/DocsDrawer'
import HistoryDrawer from '@/components/dashboard/HistoryDrawer'
import ImportDrawer from '@/components/dashboard/ImportDrawer'
import ConflictsDrawer from '@/components/dashboard/ConflictsDrawer'
import ProjectSwitcher from '@/components/dashboard/ProjectSwitcher'
import SplitHandle from '@/components/layout/SplitHandle'
import { projectTone } from '@/lib/projectTone'
import { CONFLICT_TONE_BADGE, CONFLICT_TONE_ICON } from '@/lib/conflicts'

// The global destinations, shown only outside a project: Home (the
// project hub), Activity and Team. Inside a project they step aside so
// the rail only carries that project's own views.
const globalItems = [
  { id: 'home', label: 'Home', icon: House, path: '/dashboard' },
  { id: 'activity', label: 'Activity', icon: Activity, path: '/activity' },
  { id: 'team', label: 'Team', icon: Users, path: '/team' },
]

const iconButtonClass =
  'mx-auto flex size-9 min-h-9 min-w-9 shrink-0 items-center justify-center rounded-full p-0 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'

// Deliberately restrained: a muted surface + a thin primary-tinted ring,
// not a saturated blue fill — the icon itself stays close to neutral.
const activeClass = 'bg-white/[0.08] text-foreground'

// An icon-only activity bar button, named by its tooltip.
function RailButton({ label, icon: Icon, className, iconClassName, ...triggerProps }) {
  return (
    <Tooltip>
      <TooltipTrigger aria-label={label} className={cn(iconButtonClass, className)} {...triggerProps}>
        <Icon className={cn('size-[18px]', iconClassName)} />
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
//     Docs and Import (each in the drawer beside the current view: the
//     docs category tree, the import sources) and History (the full
//     History view, which brings its checkpoint list up in the drawer). Activity
//     and Team step aside so the focused workspace isn't cluttered.
//     Conflict Points opens the conflict list in the drawer — the same
//     list as the Workspace's bottom panel, as a second way in.
// Settings is pinned to the bottom.
function ActivityBar({ project, drawer, onToggleDrawer, openConflicts = 0, conflictTone = null }) {
  const { pathname } = useLocation()
  const path = pathname.replace(/\/$/, '')
  const overviewPath = project ? `/projects/${project.id}` : null
  const base = project ? `/projects/${project.id}` : null
  const onDocs = !!base && path.startsWith(`${base}/docs`)
  const onHistory = !!base && path.startsWith(`${base}/history`)

  return (
    <div
      className={cn(
        'flex h-full w-[var(--ds-chrome-size)] shrink-0 flex-col gap-1 pt-2 pb-0 transition-colors duration-300 ease-out',
        // The chrome's color (--ds-bg-base, with the top and bottom bars),
        // drawer open or not — the drawer is a window beside it.
        'bg-background'
      )}
    >
      <div className="group/project relative flex h-9 shrink-0 items-center">
        <ProjectSwitcher currentProjectId={project?.id}>
          <DropdownMenuTrigger
            type="button"
            aria-label={project ? `Projects (current: ${project.name})` : 'Projects'}
            aria-describedby="activity-project-switcher-tooltip"
            title={project ? `${project.name} · Switch project` : 'Projects'}
            className={cn(iconButtonClass, 'data-[popup-open]:bg-muted')}
          >
            <ProjectsMark project={project} />
          </DropdownMenuTrigger>
        </ProjectSwitcher>
        <span
          id="activity-project-switcher-tooltip"
          role="tooltip"
          className="pointer-events-none absolute top-1/2 left-[calc(100%+8px)] z-[100] -translate-y-1/2 whitespace-nowrap rounded-md border border-white/10 bg-popover px-3 py-1.5 text-xs text-popover-foreground opacity-0 shadow-lg transition-opacity duration-75 group-hover/project:opacity-100 group-focus-within/project:opacity-100"
        >
          Projects · Switch project
        </span>
      </div>

      <nav aria-label="Main" className="flex flex-col gap-1">
        {project ? (
          <>
            {/* Home (outside a project) and this button lead to the same
                /dashboard route — give them the same icon so it reads as
                one destination in both places, not two different ones. */}
            <RailButton label="Dashboard" icon={House} render={<Link to="/dashboard" />} />
            <RailButton
              label={`${project.name} home`}
              icon={LayoutDashboard}
              render={<Link to={overviewPath} />}
              aria-current={path === overviewPath ? 'page' : undefined}
              className={cn(path === overviewPath && !drawer && activeClass)}
            />
            {/* The split code-editor/canvas layout, same shape as the icon. */}
            <RailButton label="Workspace" icon={LayoutPanelLeft} render={<Link to={`${base}/workspace`} />} aria-current={path === `${base}/workspace` ? 'page' : undefined} className={cn(path === `${base}/workspace` && !drawer && activeClass)} />
            <RailButton
              label="Docs"
              icon={BookOpen}
              onClick={() => onToggleDrawer('docs')}
              aria-expanded={drawer === 'docs'}
              className={cn((drawer === 'docs' || (onDocs && !drawer)) && activeClass)}
            />
            {/* Open the list first; choosing a checkpoint opens its viewer. */}
            <RailButton
              label="History"
              icon={History}
              onClick={() => onToggleDrawer('history')}
              aria-expanded={drawer === 'history'}
              aria-current={onHistory ? 'page' : undefined}
              className={cn((drawer === 'history' || (onHistory && !drawer)) && activeClass)}
            />
            {/* The conflict list, in the drawer: a second way into what the
                Workspace's bottom panel lists. The icon itself turns amber
                (open conflicts) or red (a High-risk one is open), so that
                there's a conflict right now reads first; the open count
                rides on it, in the same tone, second. */}
            <div className="relative">
              <RailButton
                label={conflictTone ? `Conflict Points · ${openConflicts} open${conflictTone === 'danger' ? ', high risk' : ''}` : 'Conflict Points'}
                icon={TriangleAlert}
                data-conflicts-entry
                data-tone={conflictTone ?? undefined}
                onClick={() => onToggleDrawer('conflicts')}
                aria-expanded={drawer === 'conflicts'}
                className={cn(drawer === 'conflicts' && activeClass)}
                iconClassName={CONFLICT_TONE_ICON[conflictTone]}
              />
              {openConflicts > 0 && (
                <span aria-hidden className={cn('pointer-events-none absolute top-0.5 right-1 flex min-w-3.5 items-center justify-center rounded-full px-1 text-[9px] leading-[14px] font-bold tabular-nums ring-2 ring-background', CONFLICT_TONE_BADGE[conflictTone])}>{openConflicts}</span>
              )}
            </div>
            {/* A drawer beside the current view, like Docs. */}
            <RailButton
              label="Import"
              icon={Import}
              onClick={() => onToggleDrawer('import')}
              aria-expanded={drawer === 'import'}
              className={cn((drawer === 'import' || (path.startsWith(`${base}/import`) && !drawer)) && activeClass)}
            />
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

      {/* Match the 48px bottom tab strip so the icon centers align. */}
      <div className="mt-auto flex h-12 shrink-0 items-center">
        <SettingsDialog triggerClassName={iconButtonClass} />
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
      <Tooltip>
        <TooltipTrigger type="button" aria-label="Back" disabled={!canGoBack} onClick={() => navigate(-1)} className={buttonClass}>
          <ChevronLeft className="size-4" />
        </TooltipTrigger>
        <TooltipContent side="bottom">Back</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger type="button" aria-label="Forward" disabled={!canGoForward} onClick={() => navigate(1)} className={buttonClass}>
          <ChevronRight className="size-4" />
        </TooltipTrigger>
        <TooltipContent side="bottom">Forward</TooltipContent>
      </Tooltip>
    </div>
  )
}

const DRAWER_TITLES = { docs: 'Docs', history: 'History', import: 'Import', conflicts: 'Conflict Points' }
const DRAWER_WIDTH = 272
const DRAWER_MIN = 220
const DRAWER_MAX = 480

// The app's navigation: the always-slim ActivityBar, and beside it a
// drawer used by the Docs and History icons (the docs category tree, the
// checkpoints). It slides open (its width animates from 0; its content
// keeps a fixed w-68 so nothing re-wraps mid-animation) and closes from its
// own button or the same icon again. Every other destination is a plain
// full page.
function Sidebar({ project, drawer, onToggleDrawer, onCloseDrawer, openConflicts, conflictTone }) {
  // Keep showing the last panel while the drawer animates shut.
  const [shown, setShown] = useState(drawer)
  if (drawer && drawer !== shown) setShown(drawer)
  const panel = drawer ?? shown
  // The drawer's width, dragged from its right edge (no animation while
  // dragging, so it tracks the pointer).
  const [width, setWidth] = useState(DRAWER_WIDTH)
  const [resizing, setResizing] = useState(false)
  const dragStart = useRef(DRAWER_WIDTH)
  const resize = (w) => setWidth(Math.max(DRAWER_MIN, Math.min(DRAWER_MAX, w)))

  return (
    <div className="z-10 flex h-full shrink-0">
      <ActivityBar project={project} drawer={drawer} onToggleDrawer={onToggleDrawer} openConflicts={openConflicts} conflictTone={conflictTone} />

      <div
        inert={!drawer}
        aria-hidden={!drawer}
        style={{ width: drawer ? width : 0 }}
        className={cn(
          'h-full shrink-0 overflow-hidden motion-reduce:transition-none',
          !resizing && 'transition-[width] duration-200 ease-out'
        )}
      >
        <aside
          aria-label={DRAWER_TITLES[panel] ?? 'Drawer'}
          style={{ width }}
          className="relative flex h-full flex-col bg-background pb-2"
        >
          <SplitHandle
            label="Resize sidebar"
            className="absolute inset-y-0 -right-1 z-10"
            onResizeStart={() => {
              dragStart.current = width
              setResizing(true)
            }}
            onResize={(dx) => resize(dragStart.current + dx)}
            onResizeEnd={() => setResizing(false)}
            onStep={(d) => resize(width + d)}
          />
          <div className="mb-1 flex h-[var(--ds-chrome-size)] shrink-0 items-center justify-between gap-1 pr-2 pl-2">
            <p className="min-w-0 flex-1 truncate px-2.5 text-[14px] font-semibold text-foreground">
              {DRAWER_TITLES[panel]}
            </p>
            <HistoryNavButtons />
            <CloseButton onClose={onCloseDrawer} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2">
            {panel === 'docs' && project && <DocsDrawer project={project} />}
            {panel === 'history' && project && <HistoryDrawer project={project} />}
            {panel === 'import' && project && <ImportDrawer project={project} />}
            {panel === 'conflicts' && project && <ConflictsDrawer project={project} />}
          </div>
        </aside>
      </div>
    </div>
  )
}

export default Sidebar
