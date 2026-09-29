import '@/components/dockview/panels/CanvasToolbar.css'
import { Minus, Plus } from 'lucide-react'

export const MIN_CANVAS_ZOOM = 25
export const MAX_CANVAS_ZOOM = 400
export const CANVAS_ZOOM_STEP = 10

// Shared scale control for the main canvas and its read-only previews.
function CanvasZoomControl({ zoom, onZoomBy }) {
  return (
    <div
      data-canvas-chrome
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      className="canvas-floating-toolbar flex shrink-0 items-center gap-0.5 rounded-full border bg-card/90 px-1 py-0.5 text-[10px] shadow-lg backdrop-blur-sm"
    >
      <button
        type="button"
        title="Zoom out"
        aria-label="Zoom out"
        disabled={zoom <= MIN_CANVAS_ZOOM}
        onClick={() => onZoomBy(-CANVAS_ZOOM_STEP)}
        className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
      >
        <Minus className="size-3" />
      </button>
      <span className="w-8 text-center tabular-nums text-foreground">{zoom}%</span>
      <button
        type="button"
        title="Zoom in"
        aria-label="Zoom in"
        disabled={zoom >= MAX_CANVAS_ZOOM}
        onClick={() => onZoomBy(CANVAS_ZOOM_STEP)}
        className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
      >
        <Plus className="size-3" />
      </button>
    </div>
  )
}

export default CanvasZoomControl
