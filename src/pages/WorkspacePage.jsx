import { useEffect, useState } from 'react'
import { Navigate, useLocation, useParams } from 'react-router-dom'
import TopBar from '@/components/layout/TopBar'
import ActivityBar from '@/components/layout/ActivityBar'
import RightFloatingBar from '@/components/layout/RightFloatingBar'
import ChatMorphWidget from '@/components/layout/ChatMorphWidget'
import InspectorSidebar from '@/components/layout/InspectorSidebar'
import FollowMeBanner from '@/components/layout/FollowMeBanner'
import MergeStudioView from '@/components/mergestudio/MergeStudioView'
import DockLayout, { openOrFocusPanel } from '@/components/dockview/DockLayout'
import { WorkspaceProvider, useWorkspace } from '@/state/WorkspaceProvider'
import { panelDefinitions, projects } from '@/data/mockData'

const previewDef = panelDefinitions.find((def) => def.id === 'preview')

// Everything that needs workspace context (dockApi, the active view) lives
// here rather than in WorkspaceShell itself, since WorkspaceShell is the
// component that instantiates WorkspaceProvider and so sits one level
// above where useWorkspace() can be called.
function WorkspaceContent({ project }) {
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
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Full-height, spanning both the top bar and the content below it
          — a single unbroken border separates it from everything else,
          Slack-sidebar style, instead of the top bar cutting across it.
          Merge Studio is a full-bleed canvas with its own floating chrome
          (Workspace pill, Merge List window with Files/Layers tabs), so
          the activity bar is skipped there only. */}
      {!inMergeStudio && <ActivityBar dockApi={dockApi} />}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar
          project={project}
          previewOpen={inMergeStudio ? mergePreviewOpen : previewOpen}
          onTogglePreview={togglePreview}
          dockApi={dockApi}
        />
        {!inMergeStudio && <FollowMeBanner />}

        <div className="relative flex min-h-0 flex-1 flex-row overflow-hidden">
          {inMergeStudio ? (
            <MergeStudioView />
          ) : (
            <div className="min-w-0 flex-1">
              <DockLayout />
            </div>
          )}

          {/* Merge Studio has its own canvas tools (select / hand) and moves
              comments, share and history into its header and Changes log. */}
          {!inMergeStudio && <RightFloatingBar />}
          <InspectorSidebar />
          {!inMergeStudio && <ChatMorphWidget />}
        </div>
      </div>
    </div>
  )
}

function WorkspaceShell({ project }) {
  return (
    <WorkspaceProvider projectId={project.id}>
      <WorkspaceContent project={project} />
    </WorkspaceProvider>
  )
}

function WorkspacePage() {
  const { projectId } = useParams()
  const project = projects.find((p) => p.id === projectId)

  if (!project) {
    return <Navigate to="/projects" replace />
  }

  // Remounting the whole workspace subtree on project change (rather than
  // just re-rendering) keeps in-memory workspace state (active file,
  // history, chat, conflicts) from one project leaking into another if a
  // user edits the :projectId segment directly in the URL bar.
  return <WorkspaceShell key={projectId} project={project} />
}

export default WorkspacePage
