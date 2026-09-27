import { ArrowLeft, PanelRight, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import LayoutMenu from '@/components/layout/LayoutMenu'
import MergeStudioMenu from '@/components/mergestudio/MergeStudioMenu'
import UserPresence from '@/components/layout/UserPresence'
import { useWorkspace } from '@/state/WorkspaceProvider'

// The normal workspace's fixed header. Merge Studio (see MergeStudioView)
// is a full-bleed canvas with its own floating chrome, so this bar hides
// itself entirely while activeView is 'mergeStudio' rather than trying to
// host both sets of controls at once.
function TopBar({ project, previewOpen, onTogglePreview, dockApi }) {
  const { activeView } = useWorkspace()
  if (activeView === 'mergeStudio') return null

  return (
    <header className="relative flex h-14 shrink-0 items-center gap-3 border-b bg-card px-4 py-2.5">
      <div className="flex min-w-0 max-w-[280px] shrink-0 items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          title="Back to projects"
          nativeButton={false}
          render={<Link to="/projects" />}
        >
          <ArrowLeft className="size-3.5" />
        </Button>
        <Separator orientation="vertical" className="h-4" />
        <span className="min-w-0 truncate text-[13px] font-medium text-foreground/80">
          {project?.name}
        </span>
      </div>

      <div className="absolute top-1/2 left-1/2 w-72 max-w-[32vw] -translate-x-1/2 -translate-y-1/2">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search files, commands..."
          className="h-8 w-full pl-8 text-xs"
        />
      </div>

      {/* Layout icon lives in the right-hand cluster, next to the
          profile/share controls, per the Follow Me revision brief. */}
      <div className="ml-auto flex shrink-0 items-center gap-3">
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
    </header>
  )
}

export default TopBar
