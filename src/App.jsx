import LanguageProvider from '@/i18n/LanguageProvider'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import LocalCursor from '@/components/collab/LocalCursor'
import { ConflictStoreProvider } from '@/state/ConflictStore'
import DashboardPage from '@/pages/DashboardPage'
import ActivityPage from '@/pages/ActivityPage'
import TeamPage from '@/pages/TeamPage'
import ProjectLayout from '@/pages/ProjectLayout'
import ProjectOverviewPage from '@/pages/ProjectOverviewPage'
import WorkspacePage from '@/pages/WorkspacePage'
import DocsPage from '@/pages/DocsPage'
import HistoryPage from '@/pages/HistoryPage'
import ImportPage from '@/pages/ImportPage'

// The Archive was split into Docs and History: old /archive links (and
// their `location.state`) land on whichever of the two they pointed at.
function ArchiveRedirect() {
  const { state } = useLocation()
  const toHistory = state?.tab === 'history' || state?.highlightId
  return <Navigate to={toHistory ? '../history' : '../docs'} state={state} replace relative="path" />
}

function App() {
  return (
    <LanguageProvider>
    <TooltipProvider>
      {/* Every project's Conflict Points live here, above the routes, so
          the Dashboard and each project's Workspace share one state. */}
      <ConflictStoreProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          {/* All projects lives on Home now; Conflict Points only in a
              project Workspace's bottom panel. Old links land on Home. */}
          <Route path="/projects" element={<Navigate to="/dashboard" replace />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/projects/:projectId" element={<ProjectLayout />}>
            <Route index element={<ProjectOverviewPage />} />
            <Route path="workspace" element={<WorkspacePage />} />
            <Route path="docs" element={<DocsPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="import" element={<ImportPage />} />
            <Route path="archive" element={<ArchiveRedirect />} />
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
      </ConflictStoreProvider>
      <Toaster position="bottom-right" />
    </TooltipProvider>
    </LanguageProvider>
  )
}

export default App
