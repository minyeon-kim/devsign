import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Folder, Layers, Settings } from 'lucide-react'
import { cn } from 'cn'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { addSidebarPanel } from '@/components/dockview/DockLayout'
import { panelDefinitions, projects } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'

const panelIcons = {
  Folder,
  Layers,
}

// The bar only surfaces quick-access toggles for Explorer/Layers — the
// other panels (canvas/editor/preview/terminal/conflict) are still fully
// functional and still open by default (see DockLayout.buildInitialLayout)
// and are still reachable via their own dockview tabs; they just don't
// get a dedicated icon here. `panelDefinitions` itself is left untouched
// since TopBar's Merge Studio button and the Preview toggle both look up
// entries from it directly.
const ACTIVITY_BAR_PANEL_IDS = ['explorer', 'layers']

// A real open/close toggle (not just focus-or-open): clicking an already
// -open panel's icon closes it entirely; clicking again re-adds it. Closing
// a solo-panel group removes the group itself, so reopening always mints a
// fresh headerless group (via addSidebarPanel, the same helper the initial
// layout uses) positioned back next to whichever sidebar sibling is still
// open — or a brand new sidebar split if both were closed.
function toggleSidebarPanel(dockApi, def) {
  if (!dockApi) return

  const existing = dockApi.getPanel(def.id)
  if (existing) {
    existing.api.close()
    return
  }

  const explorerPanel = dockApi.getPanel('explorer')
  const layersPanel = dockApi.getPanel('layers')
  const editorPanel = dockApi.getPanel('editor') ?? dockApi.panels[0]

  if (def.id === 'explorer' && layersPanel) {
    addSidebarPanel(dockApi, def, { direction: 'above', referenceGroup: layersPanel.api.group })
  } else if (def.id === 'layers' && explorerPanel) {
    addSidebarPanel(dockApi, def, { direction: 'below', referenceGroup: explorerPanel.api.group })
  } else if (editorPanel) {
    addSidebarPanel(dockApi, def, {
      direction: 'left',
      referencePanel: editorPanel.id,
      ...(def.id === 'explorer' ? { initialWidth: 260, initialHeight: 220 } : {}),
    })
  }
}

function initialsFor(name) {
  return name
    .split(' ')
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

// Slack-style workspace switcher, pinned above the panel icons — a
// square (not the pill/circle used everywhere else) so it reads as a
// distinct "which workspace" control rather than another panel shortcut.
// Switching navigates straight into the other project's workspace,
// which remounts WorkspaceProvider (see WorkspacePage's `key={projectId}`)
// and swaps in that project's file set immediately.
function WorkspaceSwitcher({ currentProjectId }) {
  const navigate = useNavigate()
  const currentProject = projects.find((p) => p.id === currentProjectId)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        title={currentProject?.name ?? 'Switch project'}
        className="flex size-9 items-center justify-center rounded-xl bg-primary text-[11px] font-semibold text-primary-foreground shadow-sm transition-[filter] duration-150 hover:brightness-110"
      >
        {currentProject ? initialsFor(currentProject.name) : '?'}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Projects</DropdownMenuLabel>
          {projects.map((project) => {
            const isActive = project.id === currentProjectId
            return (
              <DropdownMenuItem
                key={project.id}
                onClick={() => navigate(`/projects/${project.id}/workspace`)}
              >
                <span
                  className={cn(
                    'mr-2 size-1.5 shrink-0 rounded-full',
                    isActive ? 'bg-primary' : 'border border-muted-foreground/50'
                  )}
                />
                <span className={cn('truncate', isActive && 'font-medium text-foreground')}>
                  {project.name}
                </span>
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ActivityBar({ dockApi }) {
  const { projectId } = useWorkspace()
  // Which sidebar panels currently exist in the layout — this is "is it
  // open", not "is it focused": Explorer and Layers are separate stacked
  // groups that are both visible at once, so the icon's highlighted state
  // tracks open/closed rather than last-focused.
  const [openPanelIds, setOpenPanelIds] = useState(() => new Set())

  useEffect(() => {
    if (!dockApi) return

    const syncOpenPanels = () => {
      setOpenPanelIds(
        new Set(ACTIVITY_BAR_PANEL_IDS.filter((id) => !!dockApi.getPanel(id)))
      )
    }
    syncOpenPanels()

    const disposable = dockApi.onDidLayoutChange(syncOpenPanels)
    return () => disposable.dispose()
  }, [dockApi])

  return (
    <nav className="flex w-12 shrink-0 flex-col items-center gap-1.5 border-r border-border/60 bg-card py-2.5">
      {projects.length > 1 && (
        <>
          <WorkspaceSwitcher currentProjectId={projectId} />
          <Separator className="my-1 bg-border/60" />
        </>
      )}
      <div className="flex flex-col items-center gap-1.5">
        {panelDefinitions
          .filter((def) => ACTIVITY_BAR_PANEL_IDS.includes(def.id))
          .map((def) => {
            const Icon = panelIcons[def.iconName]
            const isOpen = openPanelIds.has(def.id)
            return (
              <Tooltip key={def.id}>
                <TooltipTrigger
                  onClick={() => toggleSidebarPanel(dockApi, def)}
                  aria-pressed={isOpen}
                  className={cn(
                    'flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                    isOpen && 'bg-primary/10 text-primary'
                  )}
                >
                  <Icon className="size-[18px]" />
                </TooltipTrigger>
                <TooltipContent side="right">
                  {def.title} · {isOpen ? 'hide' : 'show'}
                </TooltipContent>
              </Tooltip>
            )
          })}
      </div>
      <div className="mt-auto flex flex-col items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <Settings className="size-[18px]" />
          </TooltipTrigger>
          <TooltipContent side="right">Settings</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <Bell className="size-[18px]" />
          </TooltipTrigger>
          <TooltipContent side="right">Notifications</TooltipContent>
        </Tooltip>
      </div>
    </nav>
  )
}

export default ActivityBar
