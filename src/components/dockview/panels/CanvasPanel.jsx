import { useRef, useState } from 'react'
import {
  Frame as FrameIcon,
  Hand,
  MessageSquarePlus,
  Minus,
  MousePointer2,
  Plus,
  Square,
  Type,
} from 'lucide-react'
import { cn } from 'cn'
import { canvasFrames, canvasTools, paddingConflict } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'
import MultiplayerCursors from '@/components/collab/MultiplayerCursors'
import LocalCursor from '@/components/collab/LocalCursor'

const MIN_ZOOM = 50
const MAX_ZOOM = 200
const ZOOM_STEP = 10

const toolIcons = {
  MousePointer2,
  Hand,
  Frame: FrameIcon,
  Type,
  Square,
  MessageSquarePlus,
}

// Figma-style pill toolbar docked at the bottom-center of the canvas —
// purely a tool *picker* (visual state only, matching this app's mocked
// canvas interactions elsewhere).
function CanvasToolbar({ tool, onSelectTool }) {
  return (
    <div
      onClick={(event) => event.stopPropagation()}
      className="pointer-events-auto absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-0.5 rounded-full border bg-card/95 p-1 shadow-xl backdrop-blur-sm"
    >
      {canvasTools.map((t) => {
        const Icon = toolIcons[t.iconName]
        const active = tool === t.id
        return (
          <button
            key={t.id}
            type="button"
            title={t.label}
            onClick={() => onSelectTool(t.id)}
            className={cn(
              'flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
              active && 'bg-primary text-primary-foreground hover:bg-primary/90'
            )}
          >
            {Icon && <Icon className="size-4" />}
          </button>
        )
      })}
    </div>
  )
}

function SelectionHandles() {
  const positions = [
    'top-0 left-0 -translate-x-1/2 -translate-y-1/2',
    'top-0 right-0 translate-x-1/2 -translate-y-1/2',
    'bottom-0 left-0 -translate-x-1/2 translate-y-1/2',
    'bottom-0 right-0 translate-x-1/2 translate-y-1/2',
  ]
  return (
    <>
      {positions.map((pos) => (
        <span
          key={pos}
          className={cn(
            'pointer-events-none absolute z-10 size-2 rounded-[2px] border border-blue-500 bg-white',
            pos
          )}
        />
      ))}
    </>
  )
}

function CanvasLayer({ layer, isSelected, onSelect }) {
  function handleClick(event) {
    event.stopPropagation()
    onSelect(layer.id)
  }

  const base = 'absolute cursor-pointer'
  const style = {
    left: layer.x,
    top: layer.y,
    width: layer.width,
    height: layer.height,
  }

  let content = null
  if (layer.type === 'bar') {
    content = (
      <div className="flex h-full w-full items-center justify-between rounded-sm bg-muted px-2">
        <span className="text-[9px] text-muted-foreground">9:41</span>
        <div className="flex items-center gap-0.5">
          <span className="size-1 rounded-full bg-muted-foreground/60" />
          <span className="size-1 rounded-full bg-muted-foreground/60" />
          <span className="size-1 rounded-full bg-muted-foreground/60" />
        </div>
      </div>
    )
  } else if (layer.type === 'card') {
    content = (
      <div
        className="h-full w-full rounded-lg border border-border bg-muted/40"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, color-mix(in oklch, var(--foreground) 6%, transparent) 0 6px, transparent 6px 12px)',
        }}
      />
    )
  } else if (layer.type === 'avatar') {
    content = <div className="h-full w-full rounded-full bg-muted-foreground/30" />
  } else if (layer.type === 'button') {
    content = (
      <div className="flex h-full w-full items-center justify-center rounded-md bg-primary text-xs font-medium text-primary-foreground">
        {layer.label ?? 'Button'}
      </div>
    )
  } else {
    // 'text' and any other type fall back to a redacted text-line bar.
    content = <div className="h-full w-full rounded-sm bg-muted-foreground/25" />
  }

  return (
    <div
      onClick={handleClick}
      className={cn(base, isSelected && 'outline outline-2 outline-offset-1 outline-blue-500')}
      style={style}
    >
      {content}
      {isSelected && <SelectionHandles />}
    </div>
  )
}

function CanvasFrame({ frame, selectedId, onSelect }) {
  const isFrameSelected = selectedId === frame.id

  return (
    <div
      className="absolute"
      style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height }}
    >
      <span className="absolute -top-5 left-0 text-[10px] text-muted-foreground select-none">
        {frame.name}
      </span>
      <div
        onClick={(event) => {
          event.stopPropagation()
          onSelect(frame.id)
        }}
        className={cn(
          'relative h-full w-full cursor-pointer rounded-md border border-border bg-card shadow-lg',
          isFrameSelected && 'outline outline-2 outline-offset-1 outline-blue-500'
        )}
      >
        {frame.layers.map((layer) => (
          <CanvasLayer
            key={layer.id}
            layer={layer}
            isSelected={selectedId === layer.id}
            onSelect={onSelect}
          />
        ))}
        {isFrameSelected && <SelectionHandles />}
      </div>
    </div>
  )
}

function CanvasPanel() {
  const [zoom, setZoom] = useState(100)
  const [tool, setTool] = useState('move')
  const canvasRef = useRef(null)
  // selectedLayerId lives in workspace context (not local state) so a
  // followed teammate's viewport can drive the same canvas highlight.
  const { selectedLayerId, selectCanvasLayer } = useWorkspace()

  function handleSelect(id) {
    selectCanvasLayer(id, {
      conflict: id === 'primary-button' ? paddingConflict : undefined,
    })
  }

  return (
    <div
      ref={canvasRef}
      onClick={() => selectCanvasLayer(null)}
      className="force-cursor-none relative h-full w-full overflow-auto bg-background"
      style={{
        backgroundImage:
          'radial-gradient(color-mix(in oklch, var(--foreground) 14%, transparent) 1px, transparent 1px)',
        backgroundSize: '18px 18px',
      }}
    >
      <div
        className="relative min-h-full min-w-full p-16"
        style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}
      >
        {canvasFrames.map((frame) => (
          <CanvasFrame
            key={frame.id}
            frame={frame}
            selectedId={selectedLayerId}
            onSelect={handleSelect}
          />
        ))}
      </div>

      <MultiplayerCursors />
      <LocalCursor containerRef={canvasRef} />
      <CanvasToolbar tool={tool} onSelectTool={setTool} />

      <div
        onClick={(event) => event.stopPropagation()}
        className="absolute bottom-3 left-3 flex items-center gap-1 rounded-full border bg-card/90 px-1.5 py-1 text-xs shadow-lg backdrop-blur-sm"
      >
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))}
          className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Minus className="size-3.5" />
        </button>
        <span className="w-10 text-center tabular-nums text-foreground">{zoom}%</span>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))}
          className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

export default CanvasPanel
