import { useEffect, useState } from 'react'
import { useLocation, useOutletContext } from 'react-router-dom'
import TopBar from '@/components/layout/TopBar'
import InspectorSidebar from '@/components/layout/InspectorSidebar'
import FollowMeBanner from '@/components/layout/FollowMeBanner'
import CommandPalette from '@/components/layout/CommandPalette'
import MergeStudioView from '@/components/mergestudio/MergeStudioView'
import { openOrFocusPanel } from '@/components/dockview/DockLayout'
import WorkspaceSplitLayout from '@/components/workspace/WorkspaceSplitLayout'
import WorkspaceBottomPanel from '@/components/workspace/WorkspaceBottomPanel'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { panelDefinitions } from '@/data/mockData'

const previewDef = panelDefinitions.find((def) => def.id === 'preview')

// Project resolution + WorkspaceProvider now live in ProjectLayout (the
// parent route), shared with ArchivePage — this component just consumes
// that context via useOutletContext/useWorkspace.
function WorkspacePage() {
  const { project } = useOutletContext()
  const location = useLocation()
  const { dockApi, activeView, mergePreviewOpen, setMergePreviewOpen, openMergeStudio } = useWorkspace()
  const [previewOpen, setPreviewOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => {
    if (!dockApi) return

    const syncPreviewOpen = () => setPreviewOpen(!!dockApi.getPanel(previewDef.id))
    syncPreviewOpen()

    const disposable = dockApi.onDidLayoutChange(syncPreviewOpen)
    return () => disposable.dispose()
  }, [dockApi])

  // Arriving here from the dashboard's "Open Merge Studio" (on a specific
  // conflict) carries that intent via router state — jump straight into
  // Merge Studio instead of leaving the user to find it.
  useEffect(() => {
    if (!location.state?.openMergeStudio) return
    openMergeStudio()
  }, [location.state, openMergeStudio])

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
    // A single full-bleed surface: the split-pane frame (Code Editor |
    // Canvas, see WorkspaceSplitLayout) or Merge Studio fills the view and
    // every other piece of chrome —
    // top bar, follow-me banner, inspector, chat — is an absolutely
    // positioned overlay on top of it, instead of a flex row/column that carves the viewport into fixed
    // bands. Nothing here pushes the canvas around anymore.
    // `@container` lets floating chrome (e.g. the TopBar search) size itself
    // against this view's width, which shrinks when the sidebar drawer opens.
    //
    // Below it, outside that overlay area, sits the docked bottom panel
    // (Terminal / Console / Conflict Points), so it never floats over the
    // canvas and the bottom-row chrome (save status, zoom) sits just above it.
    <div className="flex h-full flex-col overflow-hidden bg-background text-foreground">
      <div className="@container relative min-h-0 flex-1 overflow-hidden">
        {inMergeStudio ? (
          // MergeStudioView/MergeStudioWorkspace size themselves with
          // flex-1 + min-h-0, expecting a flex-column ancestor with a
          // definite height to cascade from (the old layout nested it
          // several flex levels deep under h-screen) — this root is
          // `relative`, not `flex`, so it needs its own properly-sized flex
          // wrapper here instead of relying on the root itself.
          <div className="absolute inset-0 flex flex-col">
            <MergeStudioView />
          </div>
        ) : (
          <WorkspaceSplitLayout />
        )}

        <TopBar
          project={project}
          previewOpen={inMergeStudio ? mergePreviewOpen : previewOpen}
          onTogglePreview={togglePreview}
          onOpenPalette={() => setPaletteOpen(true)}
        />
        {!inMergeStudio && <FollowMeBanner />}
        {!inMergeStudio && <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />}

        <InspectorSidebar />
      </div>
      {!inMergeStudio && <WorkspaceBottomPanel />}
    </div>
  )
}

export default WorkspacePage
