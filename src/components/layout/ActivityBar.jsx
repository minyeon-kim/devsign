import { useEffect, useState } from 'react'
import { Bell, ChevronLeft, ChevronRight, Folder, Layers, Settings } from 'lucide-react'
import { cn } from 'cn'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { FLOATING_PILL } from '@/components/mergestudio/floatingStyles'
import { addSidebarPanel } from '@/components/dockview/DockLayout'
import { panelDefinitions } from '@/data/mockData'

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

function ActivityBar({ dockApi }) {
  // Which sidebar panels currently exist in the layout — this is "is it
  // open", not "is it focused": Explorer and Layers are separate stacked
  // groups that are both visible at once, so the icon's highlighted state
  // tracks open/closed rather than last-focused.
  const [openPanelIds, setOpenPanelIds] = useState(() => new Set())
  // Folds down to just the toggle handle — pinned at the same top-20
  // offset either way, well clear of TopBar's own top-3 pills, so
  // collapsing/expanding never risks the two overlapping.
  const [collapsed, setCollapsed] = useState(false)

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
    <nav
      className={cn(
        'absolute top-20 left-4 z-30 flex w-12 shrink-0 flex-col items-center gap-1.5 rounded-full py-2.5',
        FLOATING_PILL
      )}
    >
      <Tooltip>
        <TooltipTrigger
          onClick={() => setCollapsed((c) => !c)}
          className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {collapsed ? <ChevronRight className="size-[18px]" /> : <ChevronLeft className="size-[18px]" />}
        </TooltipTrigger>
        <TooltipContent side="right">{collapsed ? 'Expand' : 'Collapse'}</TooltipContent>
      </Tooltip>

      {!collapsed && (
        <>
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
        </>
      )}
    </nav>
  )
}

export default ActivityBar
