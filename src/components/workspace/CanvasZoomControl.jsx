import '@/components/dockview/panels/CanvasToolbar.css'
import { Minus, Plus } from 'lucide-react'
import { cn } from 'cn'
import { WORKSPACE_TAB_RADIUS } from '@/components/mergestudio/floatingStyles'

export const MIN_CANVAS_ZOOM = 25
export const MAX_CANVAS_ZOOM = 400
export const CANVAS_ZOOM_STEP = 10

// Shared scale control for the main canvas and its read-only previews —
// same tab-radius pill as the canvas toolbar beside it (.canvas-floating-
// toolbar in CanvasToolbar.css sizes and rounds both the same way).
function CanvasZoomControl({ zoom, onZoomBy }) {
  return (
    <div
      data-canvas-chrome
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      className={cn('canvas-floating-toolbar flex shrink-0 items-center gap-0.5 border bg-card/90 px-1 py-0.5 text-[10px] shadow-lg backdrop-blur-sm', WORKSPACE_TAB_RADIUS)}
    >
      <button
        type="button"
        title="Zoom out"
        aria-label="Zoom out"
        disabled={zoom <= MIN_CANVAS_ZOOM}
        onClick={() => onZoomBy(-CANVAS_ZOOM_STEP)}
        className={cn('flex size-7 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40', WORKSPACE_TAB_RADIUS)}
      >
        <Minus className="size-3.5" />
      </button>
      <span className="w-8 text-center tabular-nums text-foreground">{zoom}%</span>
      <button
        type="button"
        title="Zoom in"
        aria-label="Zoom in"
        disabled={zoom >= MAX_CANVAS_ZOOM}
        onClick={() => onZoomBy(CANVAS_ZOOM_STEP)}
        className={cn('flex size-7 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40', WORKSPACE_TAB_RADIUS)}
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  )
}

export default CanvasZoomControl
