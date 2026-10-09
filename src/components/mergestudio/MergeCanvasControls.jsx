import { Redo2, Undo2 } from 'lucide-react'
import { cn } from 'cn'
import { STUDIO_PILL } from '@/components/mergestudio/floatingStyles'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import MergeHelp from '@/components/mergestudio/MergeHelp'

const HEADER_GROUP = 'flex h-9 shrink-0 items-center gap-0.5 rounded-lg bg-white/[0.05] p-0.5 ring-1 ring-white/10'

// `showZoom`: off where the canvas's zoom lives elsewhere (comparing drafts,
// the Result pane's header has it) — one zoom control, not two.
// `inline`: in a header row (comparing drafts, the Result's) rather than
// at the canvas's bottom right — undo / redo and help, the header's style.
export default function MergeCanvasControls({ zoom, onZoomBy, onResetZoom, onFit, onSelection, hasSelection, history, guidesVisible, onToggleGuides, showZoom = true, inline = false }) {
  const actions = [
    ['Zoom in', () => onZoomBy(10)],
    ['Zoom out', () => onZoomBy(-10)],
    ['Zoom to 100%', onResetZoom],
    ['Zoom to Fit', onFit],
    ['Zoom to Selection', onSelection, !hasSelection],
  ]
  return (
    // At the canvas panel's own bottom right corner: the bottom panel sits
    // below the canvas (not over it), so the corner follows it as it opens,
    // closes or is dragged.
    <div className={inline ? 'pointer-events-auto flex shrink-0 items-center gap-2' : 'merge-canvas-controls absolute right-3 bottom-3 z-[560] flex items-center gap-2'}>
      {/* Same studio pill as the header's (see .ds-merge-pill) — one
          surface, height and hairline for every floating control. */}
      <div data-history-controls className={inline ? HEADER_GROUP : cn(STUDIO_PILL, 'flex items-center px-0.5')}>
        <button type="button" aria-label="Undo" title="Undo" disabled={!history?.canUndo} onClick={history?.undo} className={cn('flex items-center justify-center text-slate-200 hover:bg-white/10 disabled:opacity-30', inline ? 'size-8 rounded-md' : 'size-7 rounded-full')}><Undo2 className="size-4" /></button>
        <button type="button" aria-label="Redo" title="Redo" disabled={!history?.canRedo} onClick={history?.redo} className={cn('flex items-center justify-center text-slate-200 hover:bg-white/10 disabled:opacity-30', inline ? 'size-8 rounded-md' : 'size-7 rounded-full')}><Redo2 className="size-4" /></button>
      </div>
      {showZoom && <DropdownMenu>
        <DropdownMenuTrigger aria-label="Zoom" className={cn(STUDIO_PILL, 'min-w-14 px-3 tabular-nums')}>{Math.round(zoom)}%</DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" sideOffset={8} className="w-52 rounded-xl border border-white/10 bg-popover p-1.5">
          {actions.map(([label, action, disabled]) => <DropdownMenuItem key={label} onClick={action} disabled={disabled}>{label}</DropdownMenuItem>)}
          {onToggleGuides && <DropdownMenuItem onClick={onToggleGuides}>{guidesVisible ? 'Hide selection guides' : 'Show selection guides'}</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>}
      <MergeHelp inline compact={inline} />
    </div>
  )
}
