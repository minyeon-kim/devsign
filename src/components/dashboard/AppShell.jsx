import { useState } from 'react'
import Sidebar from '@/components/dashboard/Sidebar'

// The common application shell, shared by the dashboard-level pages and
// a project's Workspace/Archive:
//
//   ┌ activity ┬ conflicts ┬─────────────── topBar (floating) ───────────────┐
//   │ bar      │ (drawer,  │──────────────────── content ─────────────────────┤
//   │ (global) │  optional)│                                                  │
//
// The permanently slim, icon-only activity bar runs the full height of
// the window. Its destinations are plain full pages — there's no general
// sidebar toggle — except Conflicts, which slides a drawer open beside
// it listing the conflicts, whose items open the conflict review window
// over the current view instead of navigating away. The drawer's width
// animates, pushing the content column over rather than overlapping it.
function AppShell({ topBar, project, children }) {
  const [conflictsOpen, setConflictsOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar
        project={project}
        conflictsOpen={conflictsOpen}
        onToggleConflicts={() => setConflictsOpen((open) => !open)}
        onCloseConflicts={() => setConflictsOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {topBar}
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </div>
  )
}

export default AppShell
