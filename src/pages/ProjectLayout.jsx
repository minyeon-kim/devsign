import HighReviewNotifications from '@/components/layout/HighReviewNotifications'
import { Navigate, Outlet, useParams } from 'react-router-dom'
import AppShell from '@/components/dashboard/AppShell'
import { WorkspaceProvider } from '@/state/WorkspaceProvider'
import { projects } from '@/data/mockData'

// Shared shell for everything scoped to one project (Workspace, Archive):
// resolves :projectId once, mounts a single WorkspaceProvider so both
// child routes read/write the same live state (needed for the Archive
// history deep-link to actually land on real data), and renders the same
// icon rail + collapsible project-context drawer (AppShell) around
// whichever child route is active. No global top bar here: Workspace
// brings its own floating TopBar pills (project name, file search,
// layout/preview actions) and a second search bar above it would clash.
function ProjectLayout() {
  const { projectId } = useParams()
  const project = projects.find((p) => p.id === projectId)

  if (!project) {
    return <Navigate to="/projects" replace />
  }

  return (
    <WorkspaceProvider key={projectId} projectId={project.id}>
      <HighReviewNotifications />
      <AppShell project={project}>
        <Outlet context={{ project }} />
      </AppShell>
    </WorkspaceProvider>
  )
}

export default ProjectLayout
