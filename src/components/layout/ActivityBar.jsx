import { useEffect, useRef, useState } from 'react'
import {
  AppWindow,
  Bell,
  Component,
  FileCode,
  Folder,
  Layers,
  Monitor,
  PanelLeft,
  ScrollText,
  Settings,
  SquareTerminal,
  TriangleAlert,
} from 'lucide-react'
import { cn } from 'cn'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { panelDefinitions } from '@/data/mockData'
import { openOrFocusPanel } from '@/components/dockview/DockLayout'
import { useWorkspace } from '@/state/WorkspaceProvider'

const panelIcons = {
  Folder,
  Layers,
  Component,
  AppWindow,
  FileCode,
  Monitor,
  ScrollText,
  SquareTerminal,
  TriangleAlert,
}

// This is the app's persistent left-nav "spine" — rendered once, one level
// above the workspace/Merge Studio branch (see App.jsx), so it's always in
// the same place regardless of which is active. `dockApi` is null while in
// Merge Studio (its dockview isn't mounted there), so an icon click there
// can't open a panel directly; instead it exits back to the normal
// workspace and remembers what was requested, then opens/focuses it as soon
// as dockview comes back online (the effect below watching `dockApi`).
function ActivityBar({ dockApi }) {
  const {
    exitMergeStudio,
    activeView,
    notifications,
    mergeDrawer,
    setMergeDrawer,
    mergeListCollapsed,
    setMergeListCollapsed,
  } = useWorkspace()
  const inMergeStudio = activeView === 'mergeStudio'
  const unreadCount = notifications.filter((n) => n.unread).length
  const [activePanelId, setActivePanelId] = useState(null)
  const pendingPanelRef = useRef(null)

  useEffect(() => {
    if (!dockApi) return
    const disposable = dockApi.onDidActivePanelChange((event) => {
      setActivePanelId(event?.panel?.id ?? null)
    })
    setActivePanelId(dockApi.activePanel?.id ?? null)
    return () => disposable.dispose()
  }, [dockApi])

  useEffect(() => {
    if (!dockApi || !pendingPanelRef.current) return
    const def = pendingPanelRef.current
    pendingPanelRef.current = null
    openOrFocusPanel(dockApi, def)
  }, [dockApi])

  function handleIconClick(def) {
    if (!dockApi) {
      pendingPanelRef.current = def
      exitMergeStudio()
      return
    }
    openOrFocusPanel(dockApi, def)
  }

  return (
    <nav className="flex w-12 shrink-0 flex-col items-center gap-1 border-r bg-card py-2">
      <div className="flex flex-col items-center gap-1">
        {inMergeStudio && (
          <Tooltip>
            <TooltipTrigger
              onClick={() => setMergeListCollapsed((v) => !v)}
              className={cn(
                'flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                mergeListCollapsed && 'bg-primary/10 text-primary'
              )}
            >
              <PanelLeft className="size-[18px]" />
            </TooltipTrigger>
            <TooltipContent side="right">{mergeListCollapsed ? 'Show Merge List' : 'Hide Merge List'}</TooltipContent>
          </Tooltip>
        )}
        {panelDefinitions.map((def) => {
          const Icon = panelIcons[def.iconName]
          return (
            <Tooltip key={def.id}>
              <TooltipTrigger
                onClick={() => handleIconClick(def)}
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
          <TooltipTrigger
            onClick={() => {
              if (activeView === 'mergeStudio') setMergeDrawer(mergeDrawer === 'inbox' ? null : 'inbox')
            }}
            className={cn(
              'relative flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
              activeView === 'mergeStudio' && mergeDrawer === 'inbox' && 'bg-primary/10 text-primary'
            )}
          >
            <Bell className="size-[18px]" />
            {activeView === 'mergeStudio' && unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex min-w-3.5 items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-1 text-[9px] leading-[14px] font-semibold text-white">
                {unreadCount}
              </span>
            )}
          </TooltipTrigger>
          <TooltipContent side="right">Notifications</TooltipContent>
        </Tooltip>
      </div>
    </nav>
  )
}

export default ActivityBar
