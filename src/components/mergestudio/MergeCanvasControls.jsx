import { Redo2, Undo2 } from 'lucide-react'
import { cn } from 'cn'
import { STUDIO_PILL } from '@/components/mergestudio/floatingStyles'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import MergeHelp from '@/components/mergestudio/MergeHelp'
import { useWorkspace } from '@/state/WorkspaceProvider'

export default function MergeCanvasControls({ zoom, onZoomBy, onResetZoom, onFit, onSelection, hasSelection, history, guidesVisible, onToggleGuides }) {
  const { bottomPanel } = useWorkspace()
  const actions = [
    ['Zoom in', () => onZoomBy(10)],
    ['Zoom out', () => onZoomBy(-10)],
    ['Zoom to 100%', onResetZoom],
    ['Zoom to Fit', onFit],
    ['Zoom to Selection', onSelection, !hasSelection],
  ]
  return (
    <div className="merge-canvas-controls absolute right-4 z-[560] flex items-center gap-2" style={{ bottom: (bottomPanel.open ? bottomPanel.height : 48) + 20 }}>
      {/* Same studio pill as the header's (see .ds-merge-pill) — one
          surface, height and hairline for every floating control. */}
      <div className={cn(STUDIO_PILL, 'flex items-center px-1')}>
        <button type="button" aria-label="Undo" title="Undo" disabled={!history?.canUndo} onClick={history?.undo} className="flex size-8 items-center justify-center rounded-full text-slate-200 hover:bg-white/10 disabled:opacity-30"><Undo2 className="size-4" /></button>
        <button type="button" aria-label="Redo" title="Redo" disabled={!history?.canRedo} onClick={history?.redo} className="flex size-8 items-center justify-center rounded-full text-slate-200 hover:bg-white/10 disabled:opacity-30"><Redo2 className="size-4" /></button>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger aria-label="Zoom" className={cn(STUDIO_PILL, 'min-w-16 px-4 tabular-nums')}>{Math.round(zoom)}%</DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" sideOffset={8} className="w-52 rounded-xl border border-white/10 bg-popover p-1.5">
          {actions.map(([label, action, disabled]) => <DropdownMenuItem key={label} onClick={action} disabled={disabled}>{label}</DropdownMenuItem>)}
          {onToggleGuides && <DropdownMenuItem onClick={onToggleGuides}>{guidesVisible ? 'Hide selection guides' : 'Show selection guides'}</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>
      <MergeHelp inline />
    </div>
  )
}
