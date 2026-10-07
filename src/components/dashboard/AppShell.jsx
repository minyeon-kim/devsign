import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Sidebar from '@/components/dashboard/Sidebar'
import { conflictCounts } from '@/lib/conflicts'
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
  // null | 'docs' | 'history' | 'import' | 'conflicts'
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
  const workspace = useWorkspaceOptional()
  const { historyDrawerRequest } = workspace ?? {}
  const [handledHistoryRequest, setHandledHistoryRequest] = useState(null)
  if (historyDrawerRequest && historyDrawerRequest !== handledHistoryRequest) {
    setHandledHistoryRequest(historyDrawerRequest)
    setDrawer('history')
  }

  // The conflict list has two ways in — this drawer and the Workspace's
  // bottom panel — and only one shows it at a time, so the work area is
  // never squeezed from the left and from below by the same list:
  //   · opening the drawer folds the bottom panel's list (toggleDrawer);
  //   · opening the bottom panel's list closes the drawer (below — the
  //     same render-phase sync as above, on the moment it opens).
  // The full-screen viewer either one opens is the workspace's own state,
  // so it's the same viewer whichever list it came from.
  const panelList = workspace?.bottomPanel
  const panelListOpen = Boolean(panelList?.open && panelList.tab === 'conflict') && pathname.replace(/\/$/, '').endsWith('/workspace')
  const [wasPanelListOpen, setWasPanelListOpen] = useState(panelListOpen)
  if (panelListOpen !== wasPanelListOpen) {
    setWasPanelListOpen(panelListOpen)
    if (panelListOpen && drawer === 'conflicts') setDrawer(null)
  }
  function toggleDrawer(panel) {
    if (leavingHistory(panel)) { exitHistory(); return }
    const opening = drawer !== panel
    setDrawer(opening ? panel : null)
    if (opening && panel === 'conflicts' && panelListOpen) {
      // (Counted as already folded, so folding it doesn't read as the
      // panel's list having just been opened.)
      setWasPanelListOpen(false)
      workspace.setBottomPanel({ open: false })
    }
  }
  // A notification about a conflict opens this drawer (WorkspaceProvider's
  // `openConflictFromNotification`) — the bottom panel's list folds, as when
  // the drawer is opened by hand.
  const { conflictDrawerRequest } = workspace ?? {}
  const [handledConflictRequest, setHandledConflictRequest] = useState(null)
  if (conflictDrawerRequest && conflictDrawerRequest !== handledConflictRequest) {
    setHandledConflictRequest(conflictDrawerRequest)
    setDrawer('conflicts')
    if (panelListOpen) {
      setWasPanelListOpen(false)
      workspace.setBottomPanel({ open: false })
    }
  }
  const openConflicts = workspace ? conflictCounts(workspace.conflicts).open : 0

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar
        project={project}
        drawer={drawer}
        onToggleDrawer={toggleDrawer}
        openConflicts={openConflicts}
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
