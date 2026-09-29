import { useState } from 'react'
import { Bell } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from 'cn'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import SearchField from '@/components/layout/SearchField'
import { FLOATING_PILL, PRESENCE_STACK } from '@/components/mergestudio/floatingStyles'
import MergeStudioMenu from '@/components/mergestudio/MergeStudioMenu'
import MergeInboxDrawer from '@/components/mergestudio/MergeInboxDrawer'
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
// The project's title as a floating Linear-style breadcrumb
// ("Project / Workspace"), always shown — there's no project sidebar to
// carry the name instead.
function ProjectTitle({ project }) {
  const { draftChanges } = useWorkspace()
  return (
    <div
      className={cn(
        'absolute top-2 left-2 z-40 flex h-8 max-w-[480px] min-w-0 items-center gap-2 rounded-full px-4 text-[13px]',
        FLOATING_PILL,
        'border-0'
      )}
    >
      <Link
        to={`/projects/${project?.id}`}
        title={`Open ${project?.name}`}
        className="min-w-0 truncate rounded-md px-1 py-1 font-semibold text-foreground transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
      >
        {project?.name}
      </Link>
      <span className="shrink-0 text-muted-foreground/60">/</span>
      <Link
        to={`/projects/${project?.id}/workspace`}
        title="Open workspace"
        className="shrink-0 rounded-md px-1 py-1 text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
      >
        Workspace
      </Link>
      {Object.keys(draftChanges).length > 0 && <span className="truncate text-[11px] text-amber-300">Draft changes · Not merged</span>}
    </div>
  )
}

// The bell: opens the same Inbox panel Merge Studio uses (MergeInboxDrawer
// — All / Unread / Approvals / Comments / Feedback), styled like Merge
// Studio's own bell, with the unread count badged on it.
function InboxButton({ open, onToggle }) {
  const { notifications } = useWorkspace()
  const unreadCount = notifications.filter((n) => n.unread).length

  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        aria-label={unreadCount ? `Inbox (${unreadCount} unread)` : 'Inbox'}
        aria-expanded={open}
        onClick={onToggle}
        className={cn(
          'relative flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground',
          open && 'bg-emerald-400/20 text-emerald-300'
        )}
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex min-w-3.5 items-center justify-center rounded-full bg-emerald-400 px-1 text-[9px] leading-[14px] font-semibold text-slate-950 ring-2 ring-card">
            {unreadCount}
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent>Inbox{unreadCount ? ` · ${unreadCount} unread` : ''}</TooltipContent>
    </Tooltip>
  )
}

function ActionTooltip({ label, children }) {
  return (
    <div className="group/action-tooltip relative flex shrink-0">
      {children}
      <span role="tooltip" className="pointer-events-none absolute top-[calc(100%+8px)] left-1/2 z-[100] -translate-x-1/2 whitespace-nowrap rounded-md border border-[color:var(--ds-border-subtle)] bg-[#121212] px-3 py-1.5 text-xs text-[#FAFAFA] opacity-0 shadow-lg transition-opacity duration-75 group-hover/action-tooltip:opacity-100 group-focus-within/action-tooltip:opacity-100">
        {label}
      </span>
    </div>
  )
}

function TopBar({ project, onOpenPalette }) {
  const { activeView, requestMergeFocus, openMergeStudio, openConflictReview, setBottomPanel } = useWorkspace()
  const [inboxOpen, setInboxOpen] = useState(false)
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
          It opens the command palette (⌘K) rather than taking text itself. */}
      <SearchField
        className="absolute top-[10px] left-1/2 z-40 w-[480px] max-w-[calc(100%-1260px)] -translate-x-1/2 @max-[1480px]:hidden"
        placeholder="Search files, commands..."
        readOnly
        aria-haspopup="dialog"
        onClick={onOpenPalette}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpenPalette?.()}
      >
        <kbd className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded-md bg-white/[0.06] px-1.5 py-0.5 font-sans text-[10.5px] text-muted-foreground">
          ⌘K
        </kbd>
      </SearchField>

      {/* The action cluster, built exactly like Merge Studio's header:
          separate floating pieces rather than one long bar — the people
          pill (Inbox + teammates), Share and Merge Studio. The view tools
          (Files & Layers, views, layout, Inspect) live in the command
          palette (⌘K, the search field) and each window's `+` — the only
          place Preview opens from. */}
      <div className="absolute top-2 right-4 z-40 flex items-center gap-2">
        <div className={cn('flex h-8 items-center gap-2 rounded-full px-2', FLOATING_PILL, 'border-0')}>
          <span className={PRESENCE_STACK}>
            <UserPresence />
          </span>
        </div>

        <ActionTooltip label="Share project">
          <MergeShareButton title={project?.name} link={`https://devsign.app/projects/${project?.id}`} borderless />
        </ActionTooltip>
        <ActionTooltip label="Open Merge Studio">
          <MergeStudioMenu standalone borderless />
        </ActionTooltip>
        <InboxButton open={inboxOpen} onToggle={() => setInboxOpen((open) => !open)} />
      </div>

      {inboxOpen && (
        <MergeInboxDrawer
          // Inbox items point at a Conflict Point (open its review window,
          // with the Conflict Points tab up behind it) or at a Merge Studio
          // target (jump there, focused).
          onJump={(n) => {
            setInboxOpen(false)
            if (n.target.conflictId) {
              setBottomPanel({ tab: 'conflict', open: true })
              openConflictReview(n.target.conflictId)
              return
            }
            requestMergeFocus({ ...n.target, pulse: true })
            openMergeStudio()
          }}
          onClose={() => setInboxOpen(false)}
        />
      )}
    </>
  )
}

export default TopBar
