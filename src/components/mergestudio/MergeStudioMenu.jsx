import { Sparkles } from 'lucide-react'
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { useWorkspace } from '@/state/WorkspaceProvider'

// The header's "Merge Studio" button is the entry point into a separate
// view (see MergeStudioView) rather than a dockview panel — clicking it
// opens this popover so the user picks how they're entering it before the
// whole workspace body swaps over. Popover.Trigger already toggles on
// repeat clicks and dismisses on an outside click/Escape out of the box
// (base-ui), so no extra open-state or click-outside wiring is needed here.
function MergeStudioMenu() {
  const { openMergeStudio, startMergeFromOpenFiles } = useWorkspace()

  return (
    <Popover>
      <PopoverTrigger render={<Button size="sm" className="gap-1.5" />}>
        <Sparkles className="size-3.5" />
        Merge Studio
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={10} className="w-72 gap-1 rounded-2xl p-2">
        <p className="px-1 pb-1 text-xs font-medium text-slate-400">
          Merge Studio
        </p>
        <PopoverClose
          type="button"
          onClick={openMergeStudio}
          className="flex w-full flex-col items-start gap-0.5 rounded-xl border border-transparent p-2.5 text-left transition-colors hover:border-border hover:bg-muted"
        >
          <span className="text-xs font-medium text-foreground">Open Saved Merge Work</span>
          <span className="text-[11px] text-muted-foreground">Continue from Merge List</span>
        </PopoverClose>
        <PopoverClose
          type="button"
          onClick={startMergeFromOpenFiles}
          className="flex w-full flex-col items-start gap-0.5 rounded-xl border border-transparent p-2.5 text-left transition-colors hover:border-border hover:bg-muted"
        >
          <span className="text-xs font-medium text-foreground">Start New with Current Work</span>
          <span className="text-[11px] text-muted-foreground">Start with currently open files</span>
        </PopoverClose>
      </PopoverContent>
    </Popover>
  )
}

export default MergeStudioMenu
