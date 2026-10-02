import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Sidebar from '@/components/dashboard/Sidebar'
import { useWorkspaceOptional } from '@/state/WorkspaceProvider'

// The common application shell, shared by the dashboard-level pages and
// a project's Workspace/Archive:
//
//   ┌ activity ┬ drawer     ┬─────────────── topBar (floating) ──────────────┐
//   │ bar      │ (optional) │─────────────────── content ─────────────────────┤
//   │ (global) │            │                                                 │
//
// The permanently slim, icon-only activity bar runs the full height of
// the window. Its destinations are plain full pages — there's no general
// sidebar toggle — except, inside a project, Docs and History, which slide
// a drawer open beside it (the docs category tree, the checkpoints). The drawer's width
// animates, pushing the content column over rather than overlapping it.
// History is the one two-column view: its page opens the History drawer
// (the checkpoint list) with it — however you got there — and leaving the
// page closes it again. Toggling History off (its icon, or closing its
// drawer) leaves the whole view — list and viewer — for the Workspace.
function AppShell({ topBar, project, children }) {
  // null | 'docs' | 'history' | 'import'
  const [drawer, setDrawer] = useState(null)
  const navigate = useNavigate()
  const { pathname, state } = useLocation()
  const onHistoryPage = !!project && pathname.replace(/\/$/, '') === `/projects/${project.id}/history`
  const [wasOnHistory, setWasOnHistory] = useState(false)
  if (onHistoryPage !== wasOnHistory) {
    setWasOnHistory(onHistoryPage)
    if (onHistoryPage) setDrawer('history')
    else if (drawer === 'history' && state?.keepDrawer !== 'history') setDrawer(null)
  }

  const leavingHistory = (panel) => onHistoryPage && panel === 'history' && drawer === 'history'
  const exitHistory = () => navigate(`/projects/${project.id}/workspace`)

  // Merge Studio's "Version history" link opens this same drawer instead of
  // a separate panel of its own — see WorkspaceProvider's
  // `requestHistoryDrawer`/`historyDrawerRequest`. Same render-phase sync
  // as `wasOnHistory` above, not an effect: `historyDrawerRequest` is a
  // fresh object each time, so a reference check is enough to catch it.
  const { historyDrawerRequest } = useWorkspaceOptional() ?? {}
  const [handledHistoryRequest, setHandledHistoryRequest] = useState(null)
  if (historyDrawerRequest && historyDrawerRequest !== handledHistoryRequest) {
    setHandledHistoryRequest(historyDrawerRequest)
    setDrawer('history')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar
        project={project}
        drawer={drawer}
        onToggleDrawer={(panel) => (leavingHistory(panel) ? exitHistory() : setDrawer((open) => (open === panel ? null : panel)))}
        onCloseDrawer={() => (leavingHistory(drawer) ? exitHistory() : setDrawer(null))}
      />

      <div className={`flex min-w-0 flex-1 flex-col overflow-hidden ${drawer ? 'pl-2' : ''}`}>
        {topBar}
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </div>
  )
}

export default AppShell
