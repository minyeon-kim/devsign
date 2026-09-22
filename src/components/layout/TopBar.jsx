import { PanelRight, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Logo from '@/components/layout/Logo'
import LayoutMenu from '@/components/layout/LayoutMenu'
import MergeStudioMenu from '@/components/mergestudio/MergeStudioMenu'
import UserPresence from '@/components/layout/UserPresence'
import { useWorkspace } from '@/state/WorkspaceProvider'

// The normal workspace's fixed header — Merge Studio no longer has one at
// all. Its back-to-workspace / sidebar-toggle cluster, workflow stepper,
// drift nav, Merge Changes button and Preview toggle are now floating
// glassmorphic widgets anchored over the canvas itself (see
// MergeInfiniteCanvas.jsx's top-left/top-right clusters), so the canvas
// gets the full viewport height instead of losing 44px to a bar it doesn't
// otherwise need.
function TopBar({ previewOpen, onTogglePreview, dockApi }) {
  const { activeView } = useWorkspace()
  if (activeView === 'mergeStudio') return null

  return (
    <header className="relative flex h-11 shrink-0 items-center gap-3 border-b bg-card px-3">
      <div className="flex shrink-0 items-center gap-2">
        <Logo />
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
