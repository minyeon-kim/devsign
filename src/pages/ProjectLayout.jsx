import { Navigate, Outlet, useParams } from 'react-router-dom'
import Sidebar from '@/components/dashboard/Sidebar'
import SidebarSecondary from '@/components/dashboard/SidebarSecondary'
import { WorkspaceProvider } from '@/state/WorkspaceProvider'
import { projects } from '@/data/mockData'

// Shared shell for everything scoped to one project (Workspace, Archive):
// resolves :projectId once, mounts a single WorkspaceProvider so both
// child routes read/write the same live state (needed for the Archive
// history deep-link to actually land on real data), and renders the same
// icon rail + project-context secondary sidebar around whichever child
// route is active.
function ProjectLayout() {
  const { projectId } = useParams()
  const project = projects.find((p) => p.id === projectId)

  if (!project) {
    return <Navigate to="/projects" replace />
  }

  return (
    <WorkspaceProvider key={projectId} projectId={project.id}>
      <div className="flex h-screen overflow-hidden bg-background text-foreground">
        <Sidebar />
        <SidebarSecondary project={project} />
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <Outlet context={{ project }} />
        </div>
      </div>
    </WorkspaceProvider>
  )
}

export default ProjectLayout
