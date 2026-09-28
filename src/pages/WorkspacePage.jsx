import { useEffect, useState } from 'react'
import { useLocation, useOutletContext } from 'react-router-dom'
import TopBar from '@/components/layout/TopBar'
import RightFloatingBar from '@/components/layout/RightFloatingBar'
import ChatMorphWidget from '@/components/layout/ChatMorphWidget'
import InspectorSidebar from '@/components/layout/InspectorSidebar'
import FollowMeBanner from '@/components/layout/FollowMeBanner'
import SaveStatusIndicator from '@/components/layout/SaveStatusIndicator'
import MergeStudioView from '@/components/mergestudio/MergeStudioView'
import { openOrFocusPanel } from '@/components/dockview/DockLayout'
import WorkspaceFloatingCanvas from '@/components/workspace/WorkspaceFloatingCanvas'
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
    // A single full-bleed surface, Merge-Studio style: the canvas (or
    // Merge Studio itself) fills the whole viewport and every other piece
    // of chrome — top bar, follow-me banner, right floating
    // bar, inspector, chat — is an absolutely positioned overlay on top of
    // it, instead of a flex row/column that carves the viewport into fixed
    // bands. Nothing here pushes the canvas around anymore.
    <div className="relative h-full overflow-hidden bg-background text-foreground">
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
        <WorkspaceFloatingCanvas />
      )}

      <TopBar
        project={project}
        previewOpen={inMergeStudio ? mergePreviewOpen : previewOpen}
        onTogglePreview={togglePreview}
        dockApi={dockApi}
      />
      {!inMergeStudio && <FollowMeBanner />}

      {/* Merge Studio has its own canvas tools (select / hand) and moves
          comments, share and history into its header and Changes log. */}
      {!inMergeStudio && <RightFloatingBar />}
      {!inMergeStudio && <SaveStatusIndicator projectId={project.id} />}
      <InspectorSidebar />
      {!inMergeStudio && <ChatMorphWidget />}
    </div>
  )
}

export default WorkspacePage
