import { createContext, useContext, useEffect, useState } from 'react'
import Sidebar from '@/components/dashboard/Sidebar'

// Lets views inside the shell react to the drawer — e.g. a project's
// Workspace/Archive show the project title themselves only while the
// drawer (which otherwise carries it in its switcher) is collapsed.
// Outside a shell it reads as open, so nothing extra appears.
const ShellDrawerContext = createContext({ drawerOpen: true, toggleDrawer: () => {} })

export function useShellDrawer() {
  return useContext(ShellDrawerContext)
}

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

// The common application shell, shared by the dashboard-level pages and
// a project's Workspace/Archive:
//
//   ┌ activity ┬ drawer ─┬──────────────── topBar (floating) ───────────────┐
//   │ bar      │ (context│───────────────────── content ──────────────────────┤
//   │ (global) │  , opt.)│                                                    │
//
// Two navigation tiers run the full height of the window (see Sidebar):
// the permanently slim, icon-only activity bar with the global
// destinations, and the contextual drawer beside it, which slides open to
// show the current view's sub-menu — a project's switcher and
// Workspace/Archive, or the active section's links. The drawer's width
// animates, pushing the content column — top bar included — over rather
// than overlapping it. The logo opens it (and, once open, links Home);
// the drawer's own close button closes it; ⌘B / Ctrl+B (VS Code's
// binding) toggles it.
function AppShell({ topBar, project, children }) {
  const [collapsed, setCollapsed] = useSidebarCollapsed()

  useEffect(() => {
    function handleKeyDown(event) {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return
      if (event.key.toLowerCase() !== 'b') return
      event.preventDefault()
      setCollapsed((c) => !c)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setCollapsed])

  const toggleDrawer = () => setCollapsed((c) => !c)

  return (
    <ShellDrawerContext.Provider value={{ drawerOpen: !collapsed, toggleDrawer }}>
      <div className="flex h-screen overflow-hidden bg-background text-foreground">
        <Sidebar project={project} drawerOpen={!collapsed} onToggleDrawer={toggleDrawer} />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {topBar}
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
        </div>
      </div>
    </ShellDrawerContext.Provider>
  )
}

export default AppShell
