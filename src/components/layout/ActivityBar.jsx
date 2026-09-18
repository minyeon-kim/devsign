import { useEffect, useState } from 'react'
import {
  AppWindow,
  Bell,
  FileCode,
  Folder,
  Layers,
  Monitor,
  Settings,
  SquareTerminal,
  TriangleAlert,
} from 'lucide-react'
import { cn } from 'cn'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { panelDefinitions } from '@/data/mockData'

const panelIcons = {
  Folder,
  Layers,
  AppWindow,
  FileCode,
  Monitor,
  SquareTerminal,
  TriangleAlert,
}

function openOrFocusPanel(dockApi, def) {
  if (!dockApi) return
  const existing = dockApi.getPanel(def.id)
  if (existing) {
    existing.api.setActive()
    return
  }

  const reference = dockApi.panels[0]
  dockApi.addPanel({
    id: def.id,
    component: def.component,
    title: def.title,
    params: { iconName: def.iconName },
    position: reference ? { direction: 'within', referencePanel: reference.id } : undefined,
  })
}

function ActivityBar({ dockApi }) {
  const [activePanelId, setActivePanelId] = useState(null)

  useEffect(() => {
    if (!dockApi) return
    const disposable = dockApi.onDidActivePanelChange((event) => {
      setActivePanelId(event?.panel?.id ?? null)
    })
    setActivePanelId(dockApi.activePanel?.id ?? null)
    return () => disposable.dispose()
  }, [dockApi])

  return (
    <nav className="flex w-12 shrink-0 flex-col items-center gap-1 border-r bg-card py-2">
      <div className="flex flex-col items-center gap-1">
        {panelDefinitions.map((def) => {
          const Icon = panelIcons[def.iconName]
          return (
            <Tooltip key={def.id}>
              <TooltipTrigger
                onClick={() => openOrFocusPanel(dockApi, def)}
                className={cn(
                  'flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                  activePanelId === def.id && 'bg-primary/10 text-primary'
                )}
              >
                <Icon className="size-[18px]" />
              </TooltipTrigger>
              <TooltipContent side="right">{def.title}</TooltipContent>
            </Tooltip>
          )
        })}
      </div>
      <div className="mt-auto flex flex-col items-center gap-1">
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
