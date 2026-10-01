import { Sparkles } from 'lucide-react'
import { cn } from 'cn'
import { FLOATING_PILL } from '@/components/mergestudio/floatingStyles'
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useWorkspace } from '@/state/WorkspaceProvider'

// The header's "Merge Studio" button is the entry point into a separate
// view (see MergeStudioView) rather than a dockview panel — clicking it
// opens this popover so the user picks how they're entering it before the
// whole workspace body swaps over. Popover.Trigger already toggles on
// repeat clicks and dismisses on an outside click/Escape out of the box
// (base-ui), so no extra open-state or click-outside wiring is needed here.
// `standalone` renders the trigger as its own floating pill (the
// Workspace header's separate pieces) instead of a control inside a pill.
function MergeStudioMenu({ standalone = false, borderless = false }) {
  const { openMergeStudio, startMergeFromOpenFiles } = useWorkspace()

  return (
    <Popover>
      {/* Styled as a control inside the Workspace's action pill: a
          borderless 32px pill with the accent carried by the icon only. */}
      <PopoverTrigger
        data-control-tooltip="off"
        className={
          standalone
            ? cn('flex h-10 items-center gap-2 rounded-full px-4 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted data-[popup-open]:bg-muted', FLOATING_PILL, borderless && 'border-0')
            : 'flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-white/10 data-[popup-open]:bg-white/10'
        }
      >
        <Sparkles className={cn('text-emerald-400', standalone ? 'size-4' : 'size-3.5')} />
        Merge Studio
      </PopoverTrigger>
      <PopoverContent data-control-tooltip="off" align="end" sideOffset={10} className="w-72 gap-1 rounded-2xl p-2">
        <p className="px-1 pb-1 text-xs font-medium text-slate-400">
          Merge Studio
        </p>
        <PopoverClose
          type="button"
          onClick={openMergeStudio}
          className="flex w-full flex-col items-start gap-0.5 rounded-xl border border-transparent p-2.5 text-left transition-colors hover:border-border hover:bg-muted"
        >
          <span className="text-xs font-medium text-foreground">Open Saved Merge Work</span>
          <span className="text-[11px] text-muted-foreground">Continue with saved merge work</span>
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
