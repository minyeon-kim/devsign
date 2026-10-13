import ControlTooltips from '@/components/layout/ControlTooltips'
import LanguageProvider from '@/i18n/LanguageProvider'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { legacyDocsHref } from '@/lib/docLink'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { useResetUndoToast } from '@/components/workspace/DemoTools'
import LocalCursor from '@/components/collab/LocalCursor'
import ConditionalScrollFade from '@/components/layout/ConditionalScrollFade'
import { ConflictStoreProvider } from '@/state/ConflictStore'
import { lazy, Suspense } from 'react'
import PageSkeleton from '@/components/layout/PageSkeleton'
// A project's pages load on demand (and ahead of the click, from a project
// card's hover) — see lib/projectPages.
import { ImportPage, ProjectLayout, ProjectOverviewPage, WorkspacePage } from '@/lib/projectPages'
import { legacyHistoryHref } from '@/lib/historyLink'

const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const ActivityPage = lazy(() => import('@/pages/ActivityPage'))
const TeamPage = lazy(() => import('@/pages/TeamPage'))

// Docs are a layer over the Workspace now (lib/docLink): an old /docs link —
// its view in `location.state` ({ docId }, { tab: 'dsUpdates' }) — lands on
// the address that means the same.
function DocsRedirect() {
  const { projectId } = useParams()
  const { state } = useLocation()
  return <Navigate to={legacyDocsHref(projectId, state)} replace />
}

// History is a layer over the Workspace too (lib/historyLink): an old
// /history link — its checkpoint in `?v=` or in `location.state`
// ({ highlightId }) — lands on the address that means the same; the one-off
// `flashCheckpoint` (light it in the list) goes along.
function HistoryRedirect() {
  const { projectId } = useParams()
  const { search, state } = useLocation()
  return <Navigate to={legacyHistoryHref(projectId, search, state)} state={state?.flashCheckpoint ? { flashCheckpoint: state.flashCheckpoint } : null} replace />
}

// The Archive was split into Docs and History: old /archive links (and
// their `location.state`) land on whichever of the two they pointed at.
function ArchiveRedirect() {
  const { projectId } = useParams()
  const { state } = useLocation()
  const toHistory = state?.tab === 'history' || state?.highlightId
  return toHistory
    ? <Navigate to={legacyHistoryHref(projectId, '', state)} state={state?.flashCheckpoint ? { flashCheckpoint: state.flashCheckpoint } : null} replace />
    : <Navigate to={legacyDocsHref(projectId, state)} replace />
}

function App() {
  useResetUndoToast()
  return (
    <LanguageProvider>
    <TooltipProvider>
      {/* Every project's Conflict Points live here, above the routes, so
          the Dashboard and each project's Workspace share one state. */}
      <ConflictStoreProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <ConditionalScrollFade />
        <ControlTooltips />
        {/* While a page loads: its skeleton, never an empty screen. */}
        <Suspense fallback={<PageSkeleton />}>
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
            <Route path="docs" element={<DocsRedirect />} />
            <Route path="history" element={<HistoryRedirect />} />
            <Route path="import" element={<ImportPage />} />
            <Route path="archive" element={<ArchiveRedirect />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        </Suspense>

        {/* Single global cursor overlay — mounted here (not inside the
            workspace) so it stands in for the OS cursor, hidden site-wide
            via index.css, on every page (dashboard/projects/team/...), not
            just inside a project's workspace. Needs to be inside
            BrowserRouter (not just anywhere in the tree) since it reads
            the current route via useLocation(). */}
        <LocalCursor />
      </BrowserRouter>
      </ConflictStoreProvider>
      {/* Under the Inbox bell, top-right — where the app's other notices
          (the Inbox, the entry prompt) appear. The bottom-right corner is
          taken by real work: the bottom panel's comment box and actions. */}
      <Toaster position="bottom-right" offset={{ bottom: 24, right: 24 }} mobileOffset={{ bottom: 16, right: 16, left: 16 }} expand visibleToasts={4} gap={8} />
    </TooltipProvider>
    </LanguageProvider>
  )
}

export default App
