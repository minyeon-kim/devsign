import { useState } from 'react'
import { useLocation } from 'react-router-dom'
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
// Docs, History and a change's detail are layers over the Workspace (their
// addresses: lib/docLink, lib/historyLink, lib/changeLink); each asks for its
// drawer when it opens — handled here the same way for all three. A drawer's
// icon only opens and closes the drawer; the layer is closed by its own Close.
function AppShell({ topBar, project, children }) {
  // null | 'docs' | 'history' | 'import' | 'conflicts'
  const [drawer, setDrawer] = useState(null)
  const { pathname } = useLocation()

  // The History drawer is opened the way the Docs and change-list drawers are: asked for
  // (WorkspaceProvider's `requestHistoryDrawer` — by the History layer when it opens, and by
  // Merge Studio's "Version history" link, which opens the list alone). A request is a fresh
  // object each time, so a reference check in render is enough to catch it — no effect.
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
  // The docs layer (WorkspaceProvider's `requestDocsDrawer`) opens the Docs drawer the same way.
  const { docsDrawerRequest } = workspace ?? {}
  const [handledDocsRequest, setHandledDocsRequest] = useState(null)
  if (docsDrawerRequest && docsDrawerRequest !== handledDocsRequest) {
    setHandledDocsRequest(docsDrawerRequest)
    setDrawer('docs')
  }
  const openConflicts = workspace ? conflictCounts(workspace.conflicts).open : 0

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar
        project={project}
        drawer={drawer}
        onToggleDrawer={toggleDrawer}
        openConflicts={openConflicts}
        onCloseDrawer={() => setDrawer(null)}
      />

      <div className={`flex min-w-0 flex-1 flex-col overflow-hidden ${drawer ? 'pl-2' : ''}`}>
        {topBar}
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </div>
  )
}

export default AppShell
