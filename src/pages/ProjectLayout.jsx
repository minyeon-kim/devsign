import HighReviewNotifications from '@/components/layout/HighReviewNotifications'
import { Suspense, useEffect } from 'react'
import { Navigate, Outlet, useParams } from 'react-router-dom'
import PageSkeleton from '@/components/layout/PageSkeleton'
import { markProjectViewed } from '@/lib/recentProjects'
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
  // Opening a project is what "Recently viewed" on the Dashboard sorts by.
  useEffect(() => { if (project) markProjectViewed(project.id) }, [project])

  if (!project) {
    return <Navigate to="/projects" replace />
  }

  return (
    <WorkspaceProvider key={projectId} projectId={project.id}>
      <HighReviewNotifications />
      <AppShell project={project}>
        {/* A page of the project still loading keeps the rail in place. */}
        <Suspense fallback={<PageSkeleton bare />}>
          <Outlet context={{ project }} />
        </Suspense>
      </AppShell>
    </WorkspaceProvider>
  )
}

export default ProjectLayout
