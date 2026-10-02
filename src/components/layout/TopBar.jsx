import '@/components/dockview/panels/CanvasToolbar.css'
import { Link } from 'react-router-dom'
import { cn } from 'cn'
import { HeaderCommandSearch } from '@/components/layout/CommandPalette'
import { PRESENCE_STACK } from '@/components/mergestudio/floatingStyles'
import MergeStudioMenu from '@/components/mergestudio/MergeStudioMenu'
import MergeInboxDrawer, { InboxButton } from '@/components/mergestudio/MergeInboxDrawer'
import MergeShareButton from '@/components/mergestudio/MergeSharePanel'
import UserPresence from '@/components/layout/UserPresence'
import { useWorkspace } from '@/state/WorkspaceProvider'

// The normal workspace's chrome, in the same floating-pill language as
// Merge Studio's own header — no docked bar spanning the viewport, three
// floating pieces instead sitting directly over the canvas: the project
// breadcrumb top-left, the search, and one unified action pill top-right —
// notifications + layout, the teammate presence stack, then Merge Studio
// and Preview — built like Merge Studio's action bar (40px glass pill,
// 32px round controls, hairline dividers between groups). Merge Studio
// (see MergeStudioView) has its own floating chrome, so this hides itself
// entirely while activeView is 'mergeStudio' rather than trying to host
// both sets of controls at once.
// The project's name as a floating title, always shown — there's no
// project sidebar to carry it instead. Just the name, not a full
// "Dashboard / Project / Workspace" breadcrumb: the activity rail (see
// Sidebar.jsx) is the app's actual navigation — it already has its own
// Dashboard button and a Workspace button that highlights while you're
// here — so repeating both of those a few pixels away added nothing
// (the old "Workspace" segment even linked to the page already open).
// This keeps just what the rail can't show: which project you're in.
function ProjectTitle({ project }) {
  return (
    <div className="workspace-canvas-toolbar absolute top-2 left-2 z-40 flex h-8 max-w-[480px] min-w-0 items-center text-[13px]">
      <Link
        to={`/projects/${project?.id}`}
        title={`Open ${project?.name}`}
        className="ds-header-pill flex h-8 min-w-0 items-center truncate rounded-full px-3 font-semibold text-foreground transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
      >
        {project?.name}
      </Link>
    </div>
  )
}

function ActionTooltip({ label, children }) {
  return (
    <div className="group/action-tooltip relative flex shrink-0">
      {children}
      <span role="tooltip" className="pointer-events-none absolute top-[calc(100%+8px)] left-1/2 z-[100] -translate-x-1/2 whitespace-nowrap rounded-md border border-[color:var(--ds-border-subtle)] bg-popover px-3 py-1.5 text-xs text-[#FAFAFA] opacity-0 shadow-lg transition-opacity duration-75 group-hover/action-tooltip:opacity-100 group-focus-within/action-tooltip:opacity-100">
        {label}
      </span>
    </div>
  )
}

function TopBar({ project }) {
  const { activeView, requestMergeFocus, openMergeStudio, openConflictReview, bottomPanel, setBottomPanel, mergeDrawer, setMergeDrawer } = useWorkspace()
  const inboxOpen = mergeDrawer === 'inbox'
  if (activeView === 'mergeStudio') return null

  return (
    <>
      <ProjectTitle project={project} />

      {/* The same SearchField as the Home dashboard's top bar — same
          capsule, fill, hairline and type — at up to the same 480px.
          Sized against the Workspace view itself (a container query on
          WorkspacePage's root), not the browser window: the view narrows
          when the sidebar drawer opens. It keeps 630px clear on each side
          of center (the ~600px action cluster + its 16px inset + a 12px gap)
          and steps aside entirely when the view is too narrow to fit a
          usable field between the pills, so it never collides with them.
          It is the command palette: typing filters commands, and the
          results drop down under it (⌘K focuses it). */}
      <HeaderCommandSearch className="absolute top-2 left-1/2 z-40 w-[480px] max-w-[calc(100%-1260px)] -translate-x-1/2 @max-[1480px]:hidden" />

      {/* The action cluster, built exactly like Merge Studio's header:
          separate floating pieces rather than one long bar — the people
          pill (Inbox + teammates), Share and Merge Studio. The view tools
          (Files & Layers, views, layout, Inspect) live in the command
          palette (⌘K, the search field) and each window's `+` — the only
          place Preview opens from. */}
      <div className="workspace-canvas-toolbar absolute top-2 right-4 z-40 flex items-center gap-2">
        <div className="ds-header-pill flex h-8 items-center gap-2 rounded-full px-2">
          <span className={PRESENCE_STACK}>
            <UserPresence />
          </span>
        </div>

        <ActionTooltip label="Share project">
          <MergeShareButton title={project?.name} link={`https://devsign.app/projects/${project?.id}`} borderless />
        </ActionTooltip>
        <MergeStudioMenu standalone borderless />
        <InboxButton open={inboxOpen} onToggle={() => setMergeDrawer(inboxOpen ? null : 'inbox')} />
      </div>

      {inboxOpen && (
        <MergeInboxDrawer
          // Same edges as the docked windows (WorkspaceSplitLayout): below
          // the chrome row, the 8px right gutter, and 8px above the bottom
          // panel when it's open — flush otherwise.
          inset={cn('top-[var(--ds-chrome-size)] right-2', bottomPanel.open ? 'bottom-2' : 'bottom-0')}
          // Inbox items point at a Conflict Point (open its review window,
          // with the Conflict Points tab up behind it) or at a Merge Studio
          // target (jump there, focused).
          onJump={(n) => {
            setMergeDrawer(null)
            if (n.target.conflictId) {
              setBottomPanel({ tab: 'conflict', open: true })
              openConflictReview(n.target.conflictId)
              return
            }
            requestMergeFocus({ ...n.target, pulse: true })
            openMergeStudio()
          }}
          onClose={() => setMergeDrawer(null)}
        />
      )}
    </>
  )
}

export default TopBar
