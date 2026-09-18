import { useEffect, useState } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import TopBar from '@/components/layout/TopBar'
import ActivityBar from '@/components/layout/ActivityBar'
import RightFloatingBar from '@/components/layout/RightFloatingBar'
import ChatMorphWidget from '@/components/layout/ChatMorphWidget'
import InspectorSidebar from '@/components/layout/InspectorSidebar'
import FollowMeBanner from '@/components/layout/FollowMeBanner'
import DockLayout from '@/components/dockview/DockLayout'
import { WorkspaceProvider } from '@/state/WorkspaceProvider'
import { panelDefinitions } from '@/data/mockData'

const previewDef = panelDefinitions.find((def) => def.id === 'preview')

function App() {
  const [dockApi, setDockApi] = useState(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  useEffect(() => {
    if (!dockApi) return

    const syncPreviewOpen = () => setPreviewOpen(!!dockApi.getPanel(previewDef.id))
    syncPreviewOpen()

    const disposable = dockApi.onDidLayoutChange(syncPreviewOpen)
    return () => disposable.dispose()
  }, [dockApi])

  function togglePreview() {
    if (!dockApi) return
    const panel = dockApi.getPanel(previewDef.id)
    if (panel) {
      panel.api.close()
      return
    }

    const reference = dockApi.panels[0]
    dockApi.addPanel({
      id: previewDef.id,
      component: previewDef.component,
      title: previewDef.title,
      params: { iconName: previewDef.iconName },
      position: reference
        ? { direction: 'within', referencePanel: reference.id }
        : undefined,
      initialWidth: 380,
    })
  }

  return (
    <TooltipProvider>
      <WorkspaceProvider>
        <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
          <TopBar previewOpen={previewOpen} onTogglePreview={togglePreview} dockApi={dockApi} />
          <FollowMeBanner />

          <div className="relative flex min-h-0 flex-1 flex-row overflow-hidden">
            <ActivityBar dockApi={dockApi} />

            <div className="min-w-0 flex-1">
              <DockLayout onReady={setDockApi} />
            </div>

            <RightFloatingBar />
            <ChatMorphWidget />
            <InspectorSidebar />
          </div>
        </div>
      </WorkspaceProvider>
      <Toaster position="bottom-right" />
    </TooltipProvider>
  )
}

export default App
