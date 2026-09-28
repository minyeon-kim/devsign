import { useEffect, useState } from 'react'
import { cn } from 'cn'
import Sidebar from '@/components/dashboard/Sidebar'
import SidebarSecondary from '@/components/dashboard/SidebarSecondary'

const COLLAPSED_STORAGE_KEY = 'devsign:sidebar-collapsed'

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

// Every page mounts its own shell, so the drawer's open/closed state is
// persisted rather than held in component state alone — otherwise it
// would snap back open on each navigation.
function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(readCollapsed)

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, collapsed ? '1' : '0')
    } catch {
      // Storage unavailable (private mode, blocked site data) — the toggle
      // still works for this page, it just won't be remembered.
    }
  }, [collapsed])

  return [collapsed, setCollapsed]
}

// The common application shell (VS Code / Linear pattern), shared by the
// dashboard-level pages and a project's Workspace/Archive:
//
//   ┌──────────────────────── topBar (full width) ────────────────────────┐
//   ├─ rail ─┬─ drawer ─┬──────────────────── content ────────────────────┤
//
// `topBar` is the outermost layer, spanning the whole viewport instead of
// being squeezed between the sidebars. The icon rail stays docked on the
// far left permanently; only the labeled drawer beside it collapses. The
// drawer animates its own width (its inner panel keeps a fixed w-60, so
// labels are clipped rather than re-wrapped mid-animation), which pushes
// the content column over instead of overlapping it. `inert` keeps the
// hidden drawer's links out of the tab order while it's collapsed.
function AppShell({ topBar, project, children }) {
  const [collapsed, setCollapsed] = useSidebarCollapsed()

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {topBar}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar
          showLogo={!topBar}
          drawerOpen={!collapsed}
          onToggleDrawer={() => setCollapsed((c) => !c)}
        />

        <div
          inert={collapsed}
          aria-hidden={collapsed}
          className={cn(
            'h-full shrink-0 overflow-hidden transition-[width] duration-200 ease-out motion-reduce:transition-none',
            collapsed ? 'w-0' : 'w-60'
          )}
        >
          <SidebarSecondary project={project} />
        </div>

        <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </div>
  )
}

export default AppShell
