import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import LocalCursor from '@/components/collab/LocalCursor'
import DashboardPage from '@/pages/DashboardPage'
import ProjectsListPage from '@/pages/ProjectsListPage'
import ActivityPage from '@/pages/ActivityPage'
import TeamPage from '@/pages/TeamPage'
import ConflictsPage from '@/pages/ConflictsPage'
import ProjectLayout from '@/pages/ProjectLayout'
import ProjectOverviewPage from '@/pages/ProjectOverviewPage'
import WorkspacePage from '@/pages/WorkspacePage'
import ArchivePage from '@/pages/ArchivePage'

function App() {
  return (
    <TooltipProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/projects" element={<ProjectsListPage />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/conflicts" element={<ConflictsPage />} />
          <Route path="/projects/:projectId" element={<ProjectLayout />}>
            <Route index element={<ProjectOverviewPage />} />
            <Route path="workspace" element={<WorkspacePage />} />
            <Route path="archive" element={<ArchivePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>

        {/* Single global cursor overlay — mounted here (not inside the
            workspace) so it stands in for the OS cursor, hidden site-wide
            via index.css, on every page (dashboard/projects/team/...), not
            just inside a project's workspace. Needs to be inside
            BrowserRouter (not just anywhere in the tree) since it reads
            the current route via useLocation(). */}
        <LocalCursor />
      </BrowserRouter>
      <Toaster position="bottom-right" />
    </TooltipProvider>
  )
}

export default App
