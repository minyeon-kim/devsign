import { useState } from 'react'
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
// sidebar toggle — except two that slide a drawer open beside it instead:
// Conflict Points (the conflict list, whose items open the review window
// over the current view) and, inside a project, Archive (its Reference
// Docs / History sub-navigation). The drawer's width animates, pushing the
// content column over rather than overlapping it.
function AppShell({ topBar, project, children }) {
  // null | 'conflicts' | 'archive'
  const [drawer, setDrawer] = useState(null)

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
