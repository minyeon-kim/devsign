import { notificationDestination } from '@/lib/inboxNotifications'
import '@/components/dockview/panels/CanvasToolbar.css'
import { cn } from 'cn'
import { HeaderCommandSearch } from '@/components/layout/CommandPalette'
import { PRESENCE_STACK } from '@/components/mergestudio/floatingStyles'
import MergeInboxDrawer, { InboxButton } from '@/components/mergestudio/MergeInboxDrawer'
import MergeShareButton from '@/components/mergestudio/MergeSharePanel'
import UserPresence from '@/components/layout/UserPresence'
import AppTopBar from '@/components/layout/AppTopBar'
import { projectCrumbs } from '@/components/layout/Breadcrumb'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { Sparkles } from 'lucide-react'

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
// (The sidebar's switch is in the activity rail now: SidebarToggle.)
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
  const { historyOpen, closeHistory, requestHistoryDrawer, docParam, docsParam, openDocs, closeDocs, requestDocsDrawer, reviewConflictId, reviewView, openConflictReview, requestConflictDrawer, workPane, workPaneHost } = useWorkspace()
  const { conflicts, mergeItems, exitMergeStudio, activeView, requestMergeFocus, openMergeStudio, openConflictFromNotification, mergeDrawer, setMergeDrawer, aiChat, setAiChat, chatUnread, chatAwaitingApproval } = useWorkspace()
  const inboxOpen = mergeDrawer === 'inbox'
  // A layer open in the canvas window's place (History, Docs, a change's detail) is the path's last step:
  // … › 워크스페이스 › 히스토리 — 워크스페이스 closes it, the last brings its list up in the sidebar.
  const changeOpen = Boolean(reviewConflictId) && reviewView === 'overlay' && !(workPane === 'conflicts' && workPaneHost)
  const layer = historyOpen ? { label: 'History', close: closeHistory, list: requestHistoryDrawer }
    // (문서: back to the list — the drawer up, the index if a document or the updates are showing.)
    : docParam || docsParam ? { label: 'Docs', close: closeDocs, list: () => { requestDocsDrawer(); if (docParam || docsParam !== 'index') openDocs({ docs: 'index' }) }, then: docsParam === 'updates' ? 'Document updates' : null }
      : changeOpen ? { label: 'Conflicts', close: () => openConflictReview(null), list: () => requestConflictDrawer(reviewConflictId) }
        : null
  const crumbs = layer
    ? [...projectCrumbs(project), { label: 'Workspace', onClick: layer.close }, { label: layer.label, onClick: layer.list }, ...(layer.then ? [{ label: layer.then }] : [])]
    : [...projectCrumbs(project), { label: 'Workspace' }]

  return (
    <>
      {/* The same top bar as Home and a project's home (AppTopBar): the path, the search (the command palette —
          typing filters commands, ⌘K focuses it), then who else is here, Share, the Inbox and AI Chat. */}
      <AppTopBar
        className="absolute inset-x-0 top-0 z-40"
        crumbs={crumbs}
        search={<HeaderCommandSearch className="w-full" />}
        actions={<div className="workspace-canvas-toolbar flex items-center gap-2">
        <div className="ds-header-pill flex h-8 items-center gap-2 rounded-full px-2">
          <span className={PRESENCE_STACK}>
            <UserPresence />
          </span>
        </div>

        <ActionTooltip label="Share project">
          <MergeShareButton title={project?.name} link={`https://devsign.app/projects/${project?.id}`} borderless />
        </ActionTooltip>
        <InboxButton open={inboxOpen} onToggle={() => setMergeDrawer(inboxOpen ? null : 'inbox')} />
        <button type="button" data-chat-toggle aria-expanded={aiChat.open} aria-controls="workspace-ai-chat"
          aria-label={aiChat.open ? 'Collapse AI Chat' : 'Expand AI Chat'}
          onClick={() => setAiChat({ open: !aiChat.open })}
          className={cn('ds-header-pill flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-slate-200 transition-colors hover:bg-white/[0.1] hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300', aiChat.open && 'bg-white/[0.08]')}>
          <Sparkles aria-hidden className="size-3.5 shrink-0" />
          AI Chat
          {chatAwaitingApproval ? <span data-chat-awaiting className="text-[10px] text-amber-300">Awaiting approval</span>
            : chatUnread && <span data-chat-unread aria-label="New reply" className="size-2 shrink-0 rounded-full bg-emerald-400" />}
        </button>
        </div>}
      />

      {inboxOpen && (
        <MergeInboxDrawer
          // Same edges as the docked windows (WorkspaceSplitLayout): below
          // the chrome row, and 8px in from the right and the bottom, as they are.
          inset="top-[var(--ds-chrome-size)] right-2 bottom-2"
          // Inbox items point at a Conflict Point (open its review window,
          // with the Conflict Points tab up behind it) or at a Merge Studio
          // target (jump there, focused).
          onJump={(n) => {
            const destination = notificationDestination(n.target, conflicts, mergeItems)
            if (!destination) return
            setMergeDrawer(null)
            if (destination.conflictId) {
              exitMergeStudio()
              openConflictFromNotification(destination.conflictId)
              return
            }
            requestMergeFocus(destination.mergeTarget)
            openMergeStudio(destination.mergeTarget?.itemId)
          }}
          onClose={() => setMergeDrawer(null)}
        />
      )}
    </>
  )
}

export default TopBar
