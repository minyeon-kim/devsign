import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import DashboardPage from '@/pages/DashboardPage'
import ProjectsListPage from '@/pages/ProjectsListPage'
import ActivityPage from '@/pages/ActivityPage'
import TeamPage from '@/pages/TeamPage'
import ConflictsPage from '@/pages/ConflictsPage'
import WorkspacePage from '@/pages/WorkspacePage'

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
          <Route path="/projects/:projectId/workspace" element={<WorkspacePage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="bottom-right" />
    </TooltipProvider>
  )
}

export default App
