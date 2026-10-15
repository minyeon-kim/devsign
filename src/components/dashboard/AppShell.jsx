import { useEffect, useRef, useState } from 'react'
import { isSplit } from '@/lib/workPane'
import { useLocation } from 'react-router-dom'
import Sidebar from '@/components/dashboard/Sidebar'
import { conflictCounts } from '@/lib/conflicts'
import { useWorkspaceOptional } from '@/state/WorkspaceProvider'
import { DesignCompareContext } from '@/components/workspace/DesignCompareContext'

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
// What the address says when a layer is over the Workspace (lib/changeLink, docLink, historyLink).
// (A change's detail isn't one: it's shown in the pane beside the Workspace, which stays in use.)
const LAYER_PARAMS = ['doc', 'docs', 'history']

function AppShell({ topBar, project, children }) {
  // null | 'docs' | 'history' | 'import' | 'conflicts'
  const [drawer, setDrawer] = useState(null)
  const { pathname, search } = useLocation()

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

  // What's open at the left: a narrow list drawer (this state), or a work
  // pane beside the Workspace — the changes to check — which
  // is the address's `?panel` (lib/workPane, WorkspaceProvider's `workPane`).
  // One at a time: a pane opening puts the drawer away, and a drawer
  // opening closes the pane.
  const workPane = workspace?.workPane ?? null
  const shown = drawer ?? workPane
  function toggleDrawer(panel) {
    // (Conflict Points while the Screens board shows: its list floats over the board — ScreensBoard.)
    if (panel === 'conflicts' && workspace) {
      workspace.setBoardConflicts({ open: !workspace.boardConflicts.open, conflictId: null })
      return
    }
    if (isSplit(panel)) {
      setDrawer(null)
      workspace?.setWorkPane(shown === panel ? null : panel)
      return
    }
    if (workPane) workspace?.setWorkPane(null)
    setDrawer(shown === panel ? null : panel)
  }
  // The rail's switch (WorkspaceProvider's `toggleLeft`): the whole sidebar drawer off, and the last one back on —
  // History the first time (the list used most while working; Docs only from its own icon).
  const lastShown = useRef('history')
  if (shown) lastShown.current = shown
  const toggleSidebar = () => {
    if (shown) { setDrawer(null); if (workPane) workspace?.setWorkPane(null); return }
    toggleDrawer(lastShown.current)
  }
  const toggleSidebarNow = useRef(toggleSidebar)
  toggleSidebarNow.current = toggleSidebar
  const setAppSidebar = workspace?.setAppSidebar
  const sidebarOpen = Boolean(shown)
  useEffect(() => {
    setAppSidebar?.({ open: sidebarOpen, toggle: () => toggleSidebarNow.current() })
  }, [setAppSidebar, sidebarOpen])
  function closeDrawer() {
    if (drawer) setDrawer(null)
    else workspace?.setWorkPane(null)
  }
  // A notification about a conflict, a change opened from anywhere, the
  // Screens board's pin: the change list is asked for (WorkspaceProvider's
  // `requestConflictDrawer`) — its pane opens.
  const { conflictDrawerRequest, setWorkPane } = workspace ?? {}
  useEffect(() => {
    if (!conflictDrawerRequest) return
    if (drawer === 'conflicts') setDrawer(null)
    if (workPane === 'conflicts') setWorkPane?.(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conflictDrawerRequest])
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
        drawer={shown}
        onToggleDrawer={toggleDrawer}
        openConflicts={openConflicts}
        onCloseDrawer={closeDrawer}
        context={workspace}
        // (The Workspace's own views sit on the bar while it's the Workspace that's showing — Merge too — not a layer over it.)
        workspace={workspace && pathname.replace(/\/$/, '').endsWith('/workspace') && !LAYER_PARAMS.some((key) => new URLSearchParams(search).has(key)) ? workspace : null}
      />

      {/* (The 8px between the drawer and the work area is the drawer's own — it opens and shuts with it, never at once.) */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {topBar}
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <DesignCompareContext.Provider value={shown === 'compare'}>{children}</DesignCompareContext.Provider>
        </div>
      </div>
    </div>
  )
}

export default AppShell
