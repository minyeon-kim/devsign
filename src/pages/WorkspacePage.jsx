import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import TopBar from '@/components/layout/TopBar'
import ActivityBar from '@/components/layout/ActivityBar'
import RightFloatingBar from '@/components/layout/RightFloatingBar'
import ChatMorphWidget from '@/components/layout/ChatMorphWidget'
import InspectorSidebar from '@/components/layout/InspectorSidebar'
import FollowMeBanner from '@/components/layout/FollowMeBanner'
import DockLayout from '@/components/dockview/DockLayout'
import { WorkspaceProvider } from '@/state/WorkspaceProvider'
import { panelDefinitions, projects } from '@/data/mockData'

const previewDef = panelDefinitions.find((def) => def.id === 'preview')

function WorkspaceShell({ project }) {
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
    <WorkspaceProvider projectId={project.id}>
      <div className="flex h-screen overflow-hidden bg-background text-foreground">
        {/* Full-height, spanning both the top bar and the content below it
            — a single unbroken border separates it from everything else,
            Slack-sidebar style, instead of the top bar cutting across it. */}
        <ActivityBar dockApi={dockApi} />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <TopBar
            project={project}
            previewOpen={previewOpen}
            onTogglePreview={togglePreview}
            dockApi={dockApi}
          />
          <FollowMeBanner />

          <div className="relative flex min-h-0 flex-1 flex-row overflow-hidden">
            <div className="min-w-0 flex-1">
              <DockLayout onReady={setDockApi} />
            </div>

            <RightFloatingBar />
            <ChatMorphWidget />
            <InspectorSidebar />
          </div>
        </div>
      </div>
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
