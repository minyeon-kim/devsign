import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import ProjectsPage from '@/pages/ProjectsPage'
import ActivityPage from '@/pages/ActivityPage'
import WorkspacePage from '@/pages/WorkspacePage'

function App() {
  return (
    <TooltipProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/projects" replace />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/projects/:projectId/workspace" element={<WorkspacePage />} />
          <Route path="*" element={<Navigate to="/projects" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="bottom-right" />
    </TooltipProvider>
  )
}

export default App
