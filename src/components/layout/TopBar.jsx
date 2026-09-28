import { PanelRight, Search } from 'lucide-react'
import { cn } from 'cn'
import { Input } from '@/components/ui/input'
import { FLOATING_PILL } from '@/components/mergestudio/floatingStyles'
import LayoutMenu from '@/components/layout/LayoutMenu'
import MergeStudioMenu from '@/components/mergestudio/MergeStudioMenu'
import NotificationsMenu from '@/components/layout/NotificationsMenu'
import UserPresence from '@/components/layout/UserPresence'
import { useShellDrawer } from '@/components/dashboard/AppShell'
import { useWorkspace } from '@/state/WorkspaceProvider'

// Hairline between groups inside the action pill — Merge Studio's own
// divider (see MergeInfiniteCanvas's header cluster).
function PillDivider() {
  return <span className="h-4 w-px shrink-0 bg-white/10" />
}

// The normal workspace's chrome, in the same floating-pill language as
// Merge Studio's own header — no docked bar spanning the viewport, three
// floating pieces instead sitting directly over the canvas: the project
// breadcrumb top-left (only while the sidebar drawer is collapsed — see
// ProjectTitle), the search, and one unified action pill top-right —
// notifications + layout, the teammate presence stack, then Merge Studio
// and Preview — built like Merge Studio's action bar (40px glass pill,
// 32px round controls, hairline dividers between groups). Merge Studio
// (see MergeStudioView) has its own floating chrome, so this hides itself
// entirely while activeView is 'mergeStudio' rather than trying to host
// both sets of controls at once.
// The project's title as a floating Linear-style breadcrumb
// ("Project / Workspace"), shown only while the sidebar drawer is
// collapsed — when it's open, the drawer's own project switcher already
// says where you are, so the canvas stays free of a duplicate title. It
// fades/slides in as the drawer closes (and out as it opens), so the
// context never disappears. Clicking it brings the drawer (and its
// switcher) back.
function ProjectTitle({ project }) {
  const { drawerOpen, toggleDrawer } = useShellDrawer()

  return (
    <button
      type="button"
      onClick={toggleDrawer}
      inert={drawerOpen}
      aria-hidden={drawerOpen}
      title="Show sidebar"
      className={cn(
        'absolute top-3 left-4 z-40 flex h-10 max-w-[320px] min-w-0 items-center gap-2 rounded-full px-4 text-[13px] transition-[opacity,translate,background-color] duration-200 ease-out hover:bg-muted motion-reduce:transition-none',
        FLOATING_PILL,
        drawerOpen ? 'pointer-events-none -translate-x-2 opacity-0' : 'translate-x-0 opacity-100'
      )}
    >
      <span className="min-w-0 truncate font-semibold text-foreground">{project?.name}</span>
      <span className="shrink-0 text-muted-foreground/60">/</span>
      <span className="shrink-0 text-muted-foreground">Workspace</span>
    </button>
  )
}

function TopBar({ project, previewOpen, onTogglePreview, dockApi }) {
  const { activeView } = useWorkspace()
  if (activeView === 'mergeStudio') return null

  return (
    <>
      <ProjectTitle project={project} />

      <div className="absolute top-3 left-1/2 z-40 w-72 max-w-[32vw] -translate-x-1/2">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search files, commands..."
          className={cn('h-10 w-full rounded-full border-0 pl-9 text-xs', FLOATING_PILL)}
        />
      </div>

      <div
        className={cn(
          'absolute top-3 right-4 z-40 flex h-10 shrink-0 items-center gap-1.5 rounded-full px-1.5',
          FLOATING_PILL
        )}
      >
        <NotificationsMenu className="size-8 hover:bg-white/10" iconClassName="size-4" />
        <LayoutMenu dockApi={dockApi} />
        <PillDivider />
        <UserPresence />
        <PillDivider />
        <MergeStudioMenu />
        <button
          type="button"
          onClick={onTogglePreview}
          aria-pressed={previewOpen}
          className={cn(
            'flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors',
            previewOpen
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'text-foreground hover:bg-white/10'
          )}
        >
          <PanelRight className="size-3.5" />
          Preview
        </button>
      </div>
    </>
  )
}

export default TopBar
