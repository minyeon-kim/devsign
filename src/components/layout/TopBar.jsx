import { ArrowLeft, PanelRight, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { FLOATING_PILL } from '@/components/mergestudio/floatingStyles'
import LayoutMenu from '@/components/layout/LayoutMenu'
import MergeStudioMenu from '@/components/mergestudio/MergeStudioMenu'
import UserPresence from '@/components/layout/UserPresence'
import { useWorkspace } from '@/state/WorkspaceProvider'

// The normal workspace's chrome, in the same floating-pill language as
// Merge Studio's own "← Workspace" pill and top-right presence cluster
// (see MergeListSidebar) — no docked bar spanning the viewport, three
// pills instead (back+name, search, actions) sitting directly over the
// canvas. Merge Studio (see MergeStudioView) has its own floating chrome,
// so this hides itself entirely while activeView is 'mergeStudio' rather
// than trying to host both sets of controls at once.
function TopBar({ project, previewOpen, onTogglePreview, dockApi }) {
  const { activeView } = useWorkspace()
  if (activeView === 'mergeStudio') return null

  return (
    <>
      <div className="absolute top-3 left-4 z-40 flex min-w-0 max-w-[280px] items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          title="Back to projects"
          nativeButton={false}
          render={<Link to="/projects" />}
          className={cn('h-10 w-10 shrink-0 rounded-full', FLOATING_PILL)}
        >
          <ArrowLeft className="size-3.5" />
        </Button>
        <div
          className={cn(
            'flex h-10 min-w-0 items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold text-foreground',
            FLOATING_PILL
          )}
        >
          <Separator orientation="vertical" className="h-4" />
          <span className="min-w-0 truncate">{project?.name}</span>
        </div>
      </div>

      <div className="absolute top-3 left-1/2 z-40 w-72 max-w-[32vw] -translate-x-1/2">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search files, commands..."
          className={cn('h-10 w-full rounded-full border-0 pl-9 text-xs', FLOATING_PILL)}
        />
      </div>

      <div
        className={cn(
          'absolute top-3 right-4 z-40 flex h-10 shrink-0 items-center gap-3 rounded-full px-3',
          FLOATING_PILL
        )}
      >
        <LayoutMenu dockApi={dockApi} />
        <UserPresence />
        <MergeStudioMenu />
        <Button
          variant={previewOpen ? 'default' : 'outline'}
          size="sm"
          onClick={onTogglePreview}
          className="gap-1.5"
        >
          <PanelRight className="size-3.5" />
          Preview
        </Button>
      </div>
    </>
  )
}

export default TopBar
