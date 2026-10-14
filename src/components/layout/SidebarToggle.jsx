import { useWorkspaceOptional } from '@/state/WorkspaceProvider'

// The left area's switch: in the activity rail, right under the project's mark — fixed there, so it's in the
// same place whether the sidebar is open or not (it used to sit at the canvas's top left and move with it).
// It shows whether anything is open at the left — the side panel or a work pane (WorkspaceProvider's
// `leftOpen`, the same state the rail's icons and ⌘B change) — as the sidebar icon with its side filled while
// something is; off, that closes; on, what was last open comes back. (No tooltip: the icon says it.)
// Outside a project (no Workspace) there's nothing to fold: none.
export default function SidebarToggle({ className = '' }) {
  const workspace = useWorkspaceOptional()
  if (!workspace) return null
  const { leftOpen: open, toggleLeft } = workspace
  const label = open ? 'Close sidebar' : 'Open sidebar'
  return (
    <button
      type="button"
      data-sidebar-toggle={open ? 'open' : 'closed'}
      aria-label={label}
      aria-expanded={open}
      aria-controls="work-pane"
      onClick={toggleLeft}
      className={`mx-auto flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 ${className}`}
    >
      <svg aria-hidden viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M9 3v18" />
        {open && <path data-sidebar-filled d="M5 3h4v18H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" fill="currentColor" stroke="none" />}
      </svg>
    </button>
  )
}
