import { createContext, useContext, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Sidebar from '@/components/dashboard/Sidebar'
import { hasSubmenu } from '@/components/dashboard/SidebarSubmenu'

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

// Every page mounts its own shell, so on global pages the drawer's
// open/closed state is persisted rather than held in component state
// alone — otherwise it would snap back open on each navigation.
//
// A project is different: entering one (or switching to another — the
// project shell remounts per project) always starts with the drawer
// collapsed, to give the canvas and editor the room. The user can still
// open it, and it stays however they leave it while moving between that
// project's Workspace and Archive (same mount); that choice just isn't
// written back, so it never overrides the global pages' preference.
function useSidebarCollapsed({ inProject }) {
  const [collapsed, setCollapsed] = useState(() => (inProject ? true : readCollapsed()))

  useEffect(() => {
    if (inProject) return
    try {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, collapsed ? '1' : '0')
    } catch {
      // Storage unavailable (private mode, blocked site data) — the toggle
      // still works for this page, it just won't be remembered.
    }
  }, [collapsed, inProject])

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
// than overlapping it. The activity bar's logo toggles it, the drawer's
// own close button closes it, and ⌘B / Ctrl+B (VS Code's binding)
// toggles it too.
//
// The drawer shows one of two panels: the current section's sub-menu,
// or — from the activity bar's Conflicts icon, on any page — the
// conflict list, whose items open the conflict detail modal over the
// current view instead of navigating away. Sections with no sub-menu
// (Home, Conflicts) have no drawer except for that conflict list.
function AppShell({ topBar, project, children }) {
  const { pathname } = useLocation()
  const [collapsed, setCollapsed] = useSidebarCollapsed({ inProject: !!project })
  const [conflictsOpen, setConflictsOpen] = useState(false)
  const hasSectionDrawer = hasSubmenu(project, pathname)
  const drawerVisible = !collapsed && (conflictsOpen || hasSectionDrawer)

  function closeDrawer() {
    setCollapsed(true)
    setConflictsOpen(false)
  }

  function showSectionDrawer() {
    setCollapsed(false)
    setConflictsOpen(false)
  }

  const toggleDrawer = () => (drawerVisible ? closeDrawer() : showSectionDrawer())

  // Like VS Code's activity bar: clicking the icon of the panel that's
  // already showing collapses the drawer.
  function toggleConflicts() {
    if (drawerVisible && conflictsOpen) {
      closeDrawer()
    } else {
      setConflictsOpen(true)
      setCollapsed(false)
    }
  }

  useEffect(() => {
    function handleKeyDown(event) {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return
      if (event.key.toLowerCase() !== 'b') return
      event.preventDefault()
      toggleDrawer()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  // Views read `drawerOpen` as "the drawer is showing this view's own
  // navigation" (e.g. the project title pill), which the conflict list
  // isn't — so while it's up, they keep showing where you are.
  const sectionDrawerOpen = drawerVisible && !conflictsOpen

  return (
    <ShellDrawerContext.Provider
      value={{ drawerOpen: sectionDrawerOpen, toggleDrawer: sectionDrawerOpen ? closeDrawer : showSectionDrawer }}
    >
      <div className="flex h-screen overflow-hidden bg-background text-foreground">
        <Sidebar
          project={project}
          canToggleDrawer={hasSectionDrawer || drawerVisible}
          drawerOpen={drawerVisible}
          conflictsOpen={conflictsOpen}
          onToggleDrawer={toggleDrawer}
          onCloseDrawer={closeDrawer}
          onToggleConflicts={toggleConflicts}
        />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {topBar}
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
        </div>
      </div>
    </ShellDrawerContext.Provider>
  )
}

export default AppShell
