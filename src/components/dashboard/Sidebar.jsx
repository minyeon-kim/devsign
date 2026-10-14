import SettingsDialog from '@/components/workspace/SettingsDialog'
import { readHistoryParams } from '@/lib/historyLink'
import { readDocParams } from '@/lib/docLink'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { PANELS, SPLIT, defaultRatio, isSplit, paneWidth, ratioFor, ratioOf, readSplit, writeSplit } from '@/lib/workPane'
import WorkspaceDesignCompare from '@/components/workspace/WorkspaceDesignCompare'
import { AI_CHAT, clampWidth } from '@/lib/panelPrefs'
import { railSplit } from '@/lib/panelPrefs'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Activity, BookOpen, ChevronLeft, ChevronRight, Ellipsis, Maximize2, Minimize2, History, House, Import, Layers3, LayoutGrid, LayoutPanelLeft, PanelLeftClose, Users } from 'lucide-react'
import { cn } from 'cn'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import SwitchUserItems from '@/components/dashboard/SwitchUserItems'
import { LocalizedText } from '@/i18n/runtime'
import { currentUser, currentUserFor } from '@/data/mockData'
import DocsDrawer from '@/components/dashboard/DocsDrawer'
import HistoryDrawer, { HistoryCount } from '@/components/dashboard/HistoryDrawer'
import ImportDrawer from '@/components/dashboard/ImportDrawer'
import ConflictsDrawer, { ConflictCount } from '@/components/dashboard/ConflictsDrawer'
import ProjectSwitcher from '@/components/dashboard/ProjectSwitcher'
import SplitHandle from '@/components/layout/SplitHandle'
import { PANE_MOTION, useAfterPaint } from '@/lib/useAfterPaint'
import { projectTone } from '@/lib/projectTone'

// The global destinations, shown only outside a project: Home (the
// project hub), Activity and Team. Inside a project they step aside so
// the rail only carries that project's own views.
const globalItems = [
  { id: 'home', label: 'Home', icon: House, path: '/dashboard' },
  { id: 'activity', label: 'Activity', icon: Activity, path: '/activity' },
  { id: 'team', label: 'Team', icon: Users, path: '/team' },
]

// What the bar's fixed parts take of its height: the top padding and the
// project switcher (48), the six project views (240), the two hairlines
// (26) and the foot — the viewer's badge and Settings (96).
const RAIL_TAKEN = 48 + 240 + 26 + 96

const iconButtonClass =
  'mx-auto flex size-9 min-h-9 min-w-9 shrink-0 items-center justify-center rounded-full p-0 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'

// Deliberately restrained: a muted surface + a thin primary-tinted ring,
// not a saturated blue fill — the icon itself stays close to neutral.
const activeClass = 'bg-white/[0.08] text-foreground'
// (Shared with the workspace's right rail: one look for every rail button.)
export const RAIL_ACTIVE = activeClass
export const RAIL_WIDTH = 'w-[var(--ds-chrome-size)]'

// An icon-only activity bar button, named by its tooltip.
// (`side`: where the tooltip goes — away from the edge the rail is on.)
// (`hint`: its shortcut, said after the name.)
export function RailButton({ label, icon: Icon, className, iconClassName, side = 'right', hint = null, ...triggerProps }) {
  return (
    <Tooltip>
      <TooltipTrigger aria-label={label} className={cn(iconButtonClass, className)} {...triggerProps}>
        <Icon className={cn('size-[18px]', iconClassName)} />
      </TooltipTrigger>
      <TooltipContent side={side}>{label}{hint && <span className="ml-1.5 opacity-60">{hint}</span>}</TooltipContent>
    </Tooltip>
  )
}

// The Workspace's own views, on the activity bar under the project's, past a
// hairline: Design Compare (a work pane beside the canvas: it needs the
// width). (Terminal and Console aren't on the bar.)
// A side panel icon opens the panel on its view, swaps the view, or — the
// one that's showing — folds it. What doesn't fit the bar's height goes to
// "More" at the end, so the bar itself never scrolls.
const SIDE_SHORTCUT = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform) ? '⌘B' : 'Ctrl+B'
// (Files · Layers · Assets · Inspect aren't here: they're icons in the main window, under its tabs,
// opening over the canvas — CanvasSideViews.)
const WORKSPACE_VIEWS = [
  { id: 'design-compare', label: 'Design Compare', icon: Layers3 },
]
function WorkspaceViews({ workspace, slots, drawer, onToggleDrawer }) {
  const { sidePanel, filesWindow, toggleSideView, mergeItems } = workspace
  // (Design Compare floats over the canvas's left — CanvasComparePanel; the pane is still there for a link.)
  const comparing = drawer === 'compare' || Boolean(workspace.compareOpen)
  const designSets = mergeItems.filter((item) => item.hasDesign).length
  // Every icon is a switch: on, it shows its view; pressed again, it puts it away. (A side panel
  // view folds the panel; Design Compare is a work pane beside the Workspace — lib/workPane.)
  const showing = (view) => (view.side ? sidePanel.open && (filesWindow.tab === view.id || (view.id === 'inspect' && filesWindow.tab === 'blockDeck')) : comparing)
  const press = (view) => (view.side ? toggleSideView(view.id) : onToggleDrawer('compare'))
  const { shown, more } = railSplit(WORKSPACE_VIEWS, slots)
  return (
    <div data-workspace-views role="group" aria-label="Workspace views" className="flex flex-col gap-1">
      <span aria-hidden className="mx-auto my-1 h-px w-5 shrink-0 bg-white/10" />
      {shown.map((view) => (
        <div key={view.id} className="relative flex flex-col gap-1">
          {view.rule && <span aria-hidden className="mx-auto my-1 h-px w-5 shrink-0 bg-white/10" />}
          <div className="relative">
            <RailButton
              label={view.label}
              icon={view.icon}
              hint={view.side ? SIDE_SHORTCUT : null}
              data-side-view={view.side ? view.id : undefined}
              data-workspace-view={view.id}
              aria-expanded={showing(view)}
              aria-controls={view.side ? 'workspace-side-panel' : 'work-pane'}
              onClick={() => press(view)}
              className={cn(showing(view) && activeClass)}
            />
            {view.id === 'design-compare' && designSets > 0 && (
              <span data-view-badge title={`${designSets} design sets`} className="pointer-events-none absolute top-0.5 right-1 inline-flex size-3.5 items-center justify-center rounded-full bg-[#5CE0AE] text-[9px] leading-none font-bold text-[#050505] tabular-nums ring-2 ring-background">
                {designSets}
              </span>
            )}
          </div>
        </div>
      ))}
      {more.length > 0 && (
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger render={<DropdownMenuTrigger data-views-more aria-label="More" className={cn(iconButtonClass, more.some(showing) && activeClass, 'data-[popup-open]:bg-muted')}><Ellipsis className="size-[18px]" /></DropdownMenuTrigger>} />
            <TooltipContent side="right">More</TooltipContent>
          </Tooltip>
          <DropdownMenuContent side="right" align="end" className="min-w-44">
            {more.map((view) => (
              <DropdownMenuItem key={view.id} data-workspace-view={view.id} onClick={() => press(view)} className="gap-2 text-xs">
                <view.icon className="size-3.5" />
                <LocalizedText text={view.label} />
                {view.id === 'design-compare' && designSets > 0 && <span className="ml-auto tabular-nums text-muted-foreground">{designSets}</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

// Up / Down move along the bar's buttons (Tab still walks them one by one).
function railArrowKeys(event) {
  if ((event.key !== 'ArrowDown' && event.key !== 'ArrowUp') || event.altKey || event.metaKey || event.ctrlKey) return
  const items = [...event.currentTarget.querySelectorAll('button:not([disabled]), a[href]')]
  const at = items.indexOf(document.activeElement)
  if (at === -1) return
  const next = items[at + (event.key === 'ArrowDown' ? 1 : -1)]
  if (!next) return
  event.preventDefault()
  next.focus()
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
function ActivityBar({ project, drawer, onToggleDrawer, workspace = null }) {
  // How many of the Workspace's icons fit under the main ones (each a 36px
  // button and a 4px gap; the rest of the bar's height is spoken for).
  const barRef = useRef(null)
  const [slots, setSlots] = useState(WORKSPACE_VIEWS.length)
  useLayoutEffect(() => {
    const bar = barRef.current
    if (!bar || !workspace) return undefined
    const measure = () => setSlots(Math.max(0, Math.floor((bar.clientHeight - RAIL_TAKEN) / 40)))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(bar)
    return () => observer.disconnect()
  }, [Boolean(workspace)])
  const { pathname, search } = useLocation()
  const path = pathname.replace(/\/$/, '')
  const base = project ? `/projects/${project.id}` : null
  // (Docs are a layer over the Workspace: on, when the address names a document or a docs view — lib/docLink.)
  const docLayer = readDocParams(search)
  const onDocs = !!base && path === `${base}/workspace` && Boolean(docLayer.doc || docLayer.docs)
  // (History too: on, when the address names it — lib/historyLink.)
  const onHistory = !!base && path === `${base}/workspace` && !docLayer.doc && !docLayer.docs && !new URLSearchParams(search).has('change') && readHistoryParams(search).open

  return (
    <div
      ref={barRef}
      data-activity-bar
      onKeyDown={railArrowKeys}
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
                /dashboard route — the same name and the same icon, so it reads
                as one destination in both places, not two different ones. */}
            <RailButton label="Home" icon={House} render={<Link to="/dashboard" />} />
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
            {/* (No Conflict Points here: the changes are on the canvas — the Screens board's list and counts,
                the canvas's pins — and a notice or a link still opens their pane.) */}
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

      {workspace && <WorkspaceViews workspace={workspace} slots={slots} drawer={drawer} onToggleDrawer={onToggleDrawer} />}

      {/* (48px tall, as the top bar is.) */}
      <div className="mt-auto flex shrink-0 flex-col items-center gap-1">
        <UserBadge projectId={project?.id} />
        <div className="flex h-12 items-center">
          <SettingsDialog triggerClassName={iconButtonClass} />
        </div>
      </div>
    </div>
  )
}

// The button that folds a side panel away (and brings it back): the sidebar
// icon — mirrored for a panel on the right — named by its tooltip. The left
// list's Close and the canvas's right-panel toggle are this one button.
//   label: what it does, for the tooltip and the screen reader;  hint: its shortcut, said after it
//   expanded: whether the panel it folds is showing (omit for a plain close)
export function PanelToggleButton({ label, tip = label, hint = null, onClick, mirrored = false, expanded, side = 'bottom', className, ...rest }) {
  return (
    <Tooltip>
      <TooltipTrigger
        onClick={onClick}
        aria-label={label}
        aria-expanded={expanded}
        className={cn('flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground', className)}
        {...rest}
      >
        <PanelLeftClose className={cn('size-[18px]', mirrored && '-scale-x-100')} />
      </TooltipTrigger>
      <TooltipContent side={side}>{tip}{hint && <span className="ml-1.5 opacity-60">{hint}</span>}</TooltipContent>
    </Tooltip>
  )
}

function CloseButton({ onClose }) {
  return <PanelToggleButton label="Close drawer" tip="Close" onClick={onClose} />
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

const DRAWER_TITLES = Object.fromEntries(Object.entries(PANELS).map(([id, panel]) => [id, panel.label]))
const RAIL_PX = 48
const DRAWER_WIDTH = 272
const DRAWER_MIN = 220
const DRAWER_MAX = 480

// The app's navigation: the always-slim ActivityBar, and beside it a
// drawer used by the Docs and History icons (the docs category tree, the
// checkpoints). It slides open (its width animates from 0; its content
// keeps a fixed w-68 so nothing re-wraps mid-animation) and closes from its
// own button or the same icon again. Every other destination is a plain
// full page.
// Who the app is being viewed as — initials, a role badge (D / Dev), the full
// name and role on hover; opens the user switcher.
const ROLE_BADGE = {
  Designer: { text: 'D', className: 'bg-violet-500' },
  Developer: { text: 'Dev', className: 'bg-sky-500' },
}
function UserBadge({ projectId }) {
  const user = projectId ? currentUserFor(projectId) : { ...currentUser, jobRole: currentUser.role }
  const role = user.jobRole ?? user.role
  const badge = ROLE_BADGE[role]
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              data-user-badge
              aria-label={`${user.name} · ${role}`}
              className="relative mx-auto flex size-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted"
            >
              <Avatar size="sm">
                <AvatarFallback className={cn('text-[10px] font-medium text-white', user.colorClass)}>{user.initials}</AvatarFallback>
              </Avatar>
              {badge && (
                <span aria-hidden className={cn('absolute right-0 bottom-0.5 rounded-full px-1 text-[8px] leading-[14px] font-semibold text-white ring-2 ring-background', badge.className)}>
                  {badge.text}
                </span>
              )}
            </DropdownMenuTrigger>
          }
        />
        <TooltipContent side="right">{user.name} · <LocalizedText text={role} /></TooltipContent>
      </Tooltip>
      <DropdownMenuContent side="right" align="end" className="min-w-60">
        <SwitchUserItems />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// `workspace`: the Workspace, while its own views belong on the bar; `context`: the project's workspace state whatever is showing (the pane's contents read it).
function Sidebar({ project, drawer, onToggleDrawer, onCloseDrawer, openConflicts, workspace = null, context = null }) {
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

  // A work pane (lib/workPane: the changes to check, Design Compare) is as
  // wide as its share of the room — its own default (a third for the changes,
  // half for Design Compare), until its edge is dragged; each pane's share is kept. The room is the window less the bar and an open AI Chat,
  // so the pane and the Workspace split what's left. With too little to
  // split, or maximized, the pane has it all.
  const split = isSplit(panel)
  const [ratios, setRatios] = useState(() => readSplit().ratios)
  const ratio = ratioFor(panel, ratios)
  const [maximized, setMaximized] = useState(false)
  const [windowWidth, setWindowWidth] = useState(() => (typeof window === 'undefined' ? 1440 : window.innerWidth))
  useEffect(() => {
    // (Once a frame at most, however fast the window reports.)
    let frame = 0
    const onResize = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; setWindowWidth(window.innerWidth) }) }
    window.addEventListener('resize', onResize)
    return () => { window.removeEventListener('resize', onResize); cancelAnimationFrame(frame) }
  }, [])
  const chat = workspace && context?.aiChat?.open ? clampWidth(AI_CHAT, context.aiChat.width, windowWidth) + 8 : 0
  const room = Math.max(0, windowWidth - RAIL_PX - chat)
  const pane = paneWidth(room, ratio, { maximized })
  const shownWidth = split ? pane.width : width
  const keepShare = (next) => { const saved = readSplit(); writeSplit({ ...saved, ratios: { ...saved.ratios, [panel]: next } }) }
  const setShare = (next, keep = false) => { setRatios((prev) => ({ ...prev, [panel]: next })); if (keep) keepShare(next) }
  // (Maximizing is for the pane that's open: it doesn't outlast it.)
  if (!drawer && maximized) setMaximized(false)
  // Opened: the focus goes into it; closed with the focus inside: back to its icon.
  const asideRef = useRef(null)
  const wasOpen = useRef(null)
  useEffect(() => {
    const before = wasOpen.current
    wasOpen.current = drawer
    if (isSplit(drawer) && before !== drawer) requestAnimationFrame(() => asideRef.current?.querySelector('input, button:not([data-pane-chrome]), [tabindex="0"]')?.focus({ preventScroll: true }))
    else if (!drawer && isSplit(before) && (!document.activeElement || document.activeElement === document.body)) document.querySelector(before === 'compare' ? '[data-workspace-view="design-compare"]' : '[data-sidebar-toggle]')?.focus()
  }, [drawer])
  const setHost = context?.setWorkPaneHost
  const targetWidth = drawer ? shownWidth + 8 : 0
  const easedWidth = useAfterPaint(targetWidth)
  // (Dragged by its edge: it follows the pointer at once.)
  const openWidth = resizing ? targetWidth : easedWidth

  return (
    <div className="z-10 flex h-full shrink-0">
      <ActivityBar project={project} drawer={drawer} onToggleDrawer={onToggleDrawer} openConflicts={openConflicts} workspace={workspace} />

      <div
        inert={!drawer}
        aria-hidden={!drawer}
        // (As wide as the drawer and the 8px after it — eased together, a painted frame after it's asked
        // for, so what it shows is drawn first and the motion starts from where it is: lib/useAfterPaint.)
        style={{ width: openWidth }}
        className={cn(
          'h-full shrink-0 overflow-hidden motion-reduce:transition-none',
          !resizing && cn('transition-[width]', PANE_MOTION)
        )}
      >
        <aside
          ref={asideRef}
          id="work-pane"
          role={split ? 'region' : undefined}
          data-work-pane={split ? panel : undefined}
          data-pane-full={split && pane.full ? '' : undefined}
          aria-label={DRAWER_TITLES[panel] ?? 'Drawer'}
          style={{ width: shownWidth }}
          className="relative flex h-full flex-col bg-background pb-2"
        >
          {split ? (
            !pane.full && (
              <SplitHandle
                label="Resize pane"
                value={Math.round((pane.width / Math.max(1, room)) * 100)}
                className="absolute inset-y-0 -right-1 z-10"
                onResizeStart={() => { dragStart.current = pane.width; setResizing(true) }}
                onResize={(dx) => setShare(ratioOf(room, dragStart.current + dx))}
                onResizeEnd={() => { setResizing(false); keepShare(ratio) }}
                onStep={(d) => setShare(ratioOf(room, pane.width + d), true)}
                onReset={() => setShare(defaultRatio(panel), true)}
              />
            )
          ) : (
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
          )}
          <div className="mb-1 flex h-[var(--ds-chrome-size)] shrink-0 items-center justify-between gap-1 pr-2 pl-2">
            <p className="min-w-0 flex-1 truncate px-2.5 text-[14px] font-semibold text-foreground">
              {DRAWER_TITLES[panel]}
              {panel === 'history' && project && <HistoryCount />}
              {panel === 'conflicts' && project && <ConflictCount />}
            </p>
            {split ? (
              <>
                {/* With no room to split, the pane has the window: the way back to the Workspace is said. */}
                {pane.full && !maximized && (
                  <button type="button" data-pane-chrome data-pane-workspace onClick={onCloseDrawer} className="ds-intrinsic flex h-7 shrink-0 items-center rounded-full px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                    <LocalizedText text="Show Workspace" />
                  </button>
                )}
                {room >= SPLIT.narrow && (
                  <Tooltip>
                    <TooltipTrigger data-pane-chrome data-pane-maximize aria-pressed={maximized} aria-label={maximized ? 'Restore' : 'Maximize'} onClick={() => setMaximized((on) => !on)} className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                      {maximized ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
                    </TooltipTrigger>
                    <TooltipContent side="bottom">{maximized ? 'Restore' : 'Maximize'}</TooltipContent>
                  </Tooltip>
                )}
              </>
            ) : <HistoryNavButtons />}
            <CloseButton onClose={onCloseDrawer} />
          </div>
          {/* (The list drawers keep their top — search, filters — and scroll their list themselves.) */}
          <div className={cn('min-h-0 flex-1 px-2', panel === 'history' || panel === 'conflicts' || panel === 'compare' ? 'flex flex-col overflow-hidden' : 'overflow-y-auto')}>
            {panel === 'docs' && project && <DocsDrawer project={project} />}
            {panel === 'history' && project && <HistoryDrawer project={project} />}
            {panel === 'import' && project && <ImportDrawer project={project} />}
            {panel === 'conflicts' && project && <ConflictsDrawer project={project} />}
            {panel === 'compare' && project && context && <WorkspaceDesignCompare />}
          </div>
          {/* A change's detail opens here, over the list it was picked from (ConflictReviewOverlay). */}
          {panel === 'conflicts' && <div ref={setHost} data-work-pane-layer className="pointer-events-none absolute inset-0 z-20 [&>*]:pointer-events-auto" />}
        </aside>
      </div>
    </div>
  )
}

export default Sidebar
