import { ArrowLeft, PanelRight, Search, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Logo from '@/components/layout/Logo'
import LayoutMenu from '@/components/layout/LayoutMenu'
import MergeStudioMenu from '@/components/mergestudio/MergeStudioMenu'
import UserPresence from '@/components/layout/UserPresence'
import { useWorkspace } from '@/state/WorkspaceProvider'

function TopBar({ previewOpen, onTogglePreview, dockApi }) {
  const { activeView, exitMergeStudio } = useWorkspace()
  const inMergeStudio = activeView === 'mergeStudio'

  return (
    <header className="relative flex h-11 shrink-0 items-center gap-3 border-b bg-card px-3">
      <div className="flex shrink-0 items-center gap-2">
        {inMergeStudio ? (
          <>
            <button
              type="button"
              onClick={exitMergeStudio}
              className="flex items-center gap-1.5 rounded-full py-1.5 pr-3 pl-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              Back to Workspace
            </button>
            <span className="h-4 w-px bg-border" />
            <span className="flex items-center gap-1.5 text-[13px] font-semibold tracking-tight text-foreground/90">
              <Sparkles className="size-4 text-primary" />
              Merge Studio
            </span>
          </>
        ) : (
          <Logo />
        )}
      </div>

      <div className="absolute top-1/2 left-1/2 w-72 max-w-[32vw] -translate-x-1/2 -translate-y-1/2">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search files, commands..."
          className="h-7 w-full pl-8 text-xs"
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
