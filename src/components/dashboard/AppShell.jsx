import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import Sidebar from '@/components/dashboard/Sidebar'

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
// page closes it again.
function AppShell({ topBar, project, children }) {
  // null | 'docs' | 'history'
  const [drawer, setDrawer] = useState(null)
  const { pathname } = useLocation()
  const onHistoryPage = !!project && pathname.replace(/\/$/, '') === `/projects/${project.id}/history`
  const [wasOnHistory, setWasOnHistory] = useState(false)
  if (onHistoryPage !== wasOnHistory) {
    setWasOnHistory(onHistoryPage)
    if (onHistoryPage) setDrawer('history')
    else if (drawer === 'history') setDrawer(null)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar
        project={project}
        drawer={drawer}
        onToggleDrawer={(panel) => setDrawer((open) => (open === panel ? null : panel))}
        onCloseDrawer={() => setDrawer(null)}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {topBar}
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </div>
  )
}

export default AppShell
