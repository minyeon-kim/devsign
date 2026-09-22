import { ArrowLeft, ChevronsLeft, ChevronsRight, PanelRight, Search, Sparkles } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Logo from '@/components/layout/Logo'
import LayoutMenu from '@/components/layout/LayoutMenu'
import MergeStudioMenu from '@/components/mergestudio/MergeStudioMenu'
import UserPresence from '@/components/layout/UserPresence'
import { useWorkspace } from '@/state/WorkspaceProvider'

function TopBar({ previewOpen, onTogglePreview, dockApi }) {
  const { activeView, exitMergeStudio, mergeListCollapsed, setMergeListCollapsed } = useWorkspace()
  const inMergeStudio = activeView === 'mergeStudio'

  return (
    <header className="relative flex h-11 shrink-0 items-center gap-3 border-b bg-card px-3">
      <div className="flex shrink-0 items-center gap-2">
        {inMergeStudio ? (
          <>
            {/* A prominent, unmissable white icon button — swapped from the
                previous muted text button so "back" reads instantly, not
                just on hover. */}
            <button
              type="button"
              onClick={exitMergeStudio}
              title="Back to Workspace"
              className="flex size-7 items-center justify-center rounded-full bg-white text-slate-900 shadow-sm transition-colors hover:bg-white/90"
            >
              <ArrowLeft className="size-4" strokeWidth={2.5} />
            </button>
            {/* Merge List collapse/expand: relocated here (out of the
                panel's own header, and duplicated from the ActivityBar
                icon) so there's one consistent, always-visible spot for it
                regardless of the panel's own open/closed state. */}
            <button
              type="button"
              onClick={() => setMergeListCollapsed((v) => !v)}
              title={mergeListCollapsed ? 'Show Merge List' : 'Hide Merge List'}
              className={cn(
                'flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                !mergeListCollapsed && 'bg-primary/10 text-primary'
              )}
            >
              {mergeListCollapsed ? <ChevronsRight className="size-3.5" /> : <ChevronsLeft className="size-3.5" />}
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
        {/* The [Merge Changes] CTA moved into the canvas's own drift-nav
            row (right beside the drift pager), so it lives in the review
            context instead of the top header. Outside Merge Studio, this
            slot is still the entry point into it. */}
        {!inMergeStudio && <MergeStudioMenu />}
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
