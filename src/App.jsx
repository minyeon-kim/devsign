import { useEffect, useState } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import TopBar from '@/components/layout/TopBar'
import ActivityBar from '@/components/layout/ActivityBar'
import RightFloatingBar from '@/components/layout/RightFloatingBar'
import ChatMorphWidget from '@/components/layout/ChatMorphWidget'
import InspectorSidebar from '@/components/layout/InspectorSidebar'
import FollowMeBanner from '@/components/layout/FollowMeBanner'
import MergeStudioView from '@/components/mergestudio/MergeStudioView'
import DockLayout, { openOrFocusPanel } from '@/components/dockview/DockLayout'
import LocalCursor from '@/components/collab/LocalCursor'
import { WorkspaceProvider, useWorkspace } from '@/state/WorkspaceProvider'
import { panelDefinitions } from '@/data/mockData'

const previewDef = panelDefinitions.find((def) => def.id === 'preview')

// Everything that needs workspace context (dockApi, the active view) lives
// here rather than in App itself, since App is the component that
// instantiates WorkspaceProvider and so sits one level above where
// useWorkspace() can be called.
function WorkspaceShell() {
  const { dockApi, activeView, mergePreviewOpen, setMergePreviewOpen } = useWorkspace()
  const [previewOpen, setPreviewOpen] = useState(false)

  useEffect(() => {
    if (!dockApi) return

    const syncPreviewOpen = () => setPreviewOpen(!!dockApi.getPanel(previewDef.id))
    syncPreviewOpen()

    const disposable = dockApi.onDidLayoutChange(syncPreviewOpen)
    return () => disposable.dispose()
  }, [dockApi])

  function togglePreview() {
    // In Merge Studio the header Preview button opens the responsive preview.
    if (activeView === 'mergeStudio') {
      setMergePreviewOpen((v) => !v)
      return
    }
    if (!dockApi) return
    const panel = dockApi.getPanel(previewDef.id)
    if (panel) {
      panel.api.close()
      return
    }

    openOrFocusPanel(dockApi, previewDef)
  }

  const inMergeStudio = activeView === 'mergeStudio'

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <TopBar previewOpen={inMergeStudio ? mergePreviewOpen : previewOpen} onTogglePreview={togglePreview} dockApi={dockApi} />

      {!inMergeStudio && <FollowMeBanner />}

      {/* ActivityBar, RightFloatingBar, InspectorSidebar and ChatMorphWidget
          are all rendered here, one level above the workspace/Merge Studio
          branch, so every environment gets the exact same instance instead
          of separate copies — "porting" a piece of chrome just means
          widening where it's mounted. RightFloatingBar/InspectorSidebar
          position themselves absolutely against this shared `relative`
          container; ChatMorphWidget is `position: fixed` against the whole
          viewport regardless of where it's mounted, which is exactly the
          "floats above everything" behavior Merge Studio wants too. */}
      <div className="relative flex min-h-0 flex-1 flex-row overflow-hidden">
        <ActivityBar dockApi={dockApi} />

        {inMergeStudio ? (
          <MergeStudioView />
        ) : (
          <div className="min-w-0 flex-1">
            <DockLayout />
          </div>
        )}

        <RightFloatingBar />
        <InspectorSidebar />
        {!inMergeStudio && <ChatMorphWidget />}
      </div>
    </div>
  )
}

function App() {
  return (
    <TooltipProvider>
      <WorkspaceProvider>
        <WorkspaceShell />

        {/* Single global cursor overlay — tracks the whole window and sits
            above everything (modals included; it wins on z-index, not DOM
            order) so the OS cursor, hidden site-wide via index.css, is
            never left with nothing standing in for it. Mounted inside the
            provider so it can read the active Canvas tool from workspace
            context and swap its glyph while hovering the canvas surface. */}
        <LocalCursor />
      </WorkspaceProvider>
    </TooltipProvider>
  )
}

export default App
