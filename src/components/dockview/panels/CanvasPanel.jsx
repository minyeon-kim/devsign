import { useRef, useState } from 'react'
import {
  FileImage,
  Frame as FrameIcon,
  Hand,
  MessageCircle,
  MessageSquarePlus,
  Minus,
  MousePointer2,
  Plus,
  Square,
  Type,
} from 'lucide-react'
import { cn } from 'cn'
import { allPeople, canvasPages, canvasTools, findCanvasTarget, paddingConflict } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { panelById } from '@/components/dockview/DockLayout'
import MultiplayerCursors from '@/components/collab/MultiplayerCursors'

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

// Opens a frame/layer's inspection tab docked in the same tab strip as the
// code editor's file tabs — "exactly like opening a file". Re-focuses the
// existing tab instead of duplicating it if that node is already open.
function openLayerInspectTab(dockApi, node) {
  if (!dockApi || !node) return
  const panelId = `inspect-${node.id}`
  const existing = dockApi.getPanel(panelId)
  if (existing) {
    existing.api.setActive()
    return
  }

  const anchor =
    dockApi.getPanel(panelById.editor.id) ??
    dockApi.panels.find((p) => panelById[p.id]?.group === 'main')

  dockApi.addPanel({
    id: panelId,
    component: 'layerInspect',
    title: node.name,
    params: { iconName: 'ScanEye', targetId: node.id },
    position: anchor ? { direction: 'within', referencePanel: anchor.id } : undefined,
  })
}

// Figma-style pill toolbar docked at the bottom-center of the canvas — a
// real tool *picker*: the active tool both gets a highlight state here and
// changes what clicking the canvas surface does (see CanvasPanel) and what
// the global cursor looks like while hovering it (see LocalCursor).
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

// Chrome/editor-style file tabs for switching between design pages — same
// pill styling and single-row layout as the code editor's file tabs, so a
// user can pop between "design files" the same way they pop between code
// files.
function PageTabs({ activePageId, onSelectPage }) {
  return (
    <div className="flex h-10 shrink-0 items-center gap-1.5 border-b bg-card px-2 font-sans">
      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
        {canvasPages.map((page) => {
          const active = activePageId === page.id
          return (
            <button
              key={page.id}
              type="button"
              onClick={() => onSelectPage(page.id)}
              className={cn(
                'flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs transition-colors',
                active
                  ? 'bg-muted text-foreground ring-1 ring-border'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              )}
            >
              <FileImage className={cn('size-3.5 shrink-0', active ? 'text-primary' : '')} />
              {page.name}
            </button>
          )
        })}
      </div>
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

// A dropped pinpoint comment — its permanent marker lives inside the scaled
// canvas surface (so it tracks the design at any zoom level, like a real
// annotation pinned to the artwork), and its own detail popover is a plain
// child so it doesn't get stretched/shrunk by that scale.
function CommentPin({ comment, open, onToggle }) {
  const author = allPeople.find((p) => p.id === comment.authorId)

  return (
    <div
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
      className="absolute z-20 -translate-x-1/2 -translate-y-full cursor-pointer"
      style={{ left: comment.target.x, top: comment.target.y }}
    >
      <span
        className={cn(
          'flex size-6 items-center justify-center rounded-full rounded-bl-sm text-white shadow-lg ring-2 ring-background',
          author?.colorClass ?? 'bg-primary'
        )}
      >
        <MessageCircle className="size-3.5" />
      </span>
      {open && (
        <div
          onClick={(event) => event.stopPropagation()}
          className="absolute top-full left-1/2 z-30 w-56 -translate-x-1/2 translate-y-1.5 rounded-xl border bg-card p-2.5 text-left shadow-xl"
        >
          <div className="flex items-center gap-1.5 text-[11px]">
            <span
              className={cn(
                'flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-medium text-white',
                author?.colorClass
              )}
            >
              {author?.initials}
            </span>
            <span className="font-medium text-foreground">{author?.name}</span>
            <span className="ml-auto shrink-0 text-muted-foreground">{comment.timeLabel}</span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-foreground/85">{comment.text}</p>
        </div>
      )}
    </div>
  )
}

// The not-yet-saved composer that appears right where the user clicked with
// the Comment tool active — screen-space positioned (a sibling of the
// scaled canvas surface, not a child of it) so it stays a fixed, readable
// size regardless of zoom.
function PinComposer({ pending, value, onChange, onSubmit, onCancel }) {
  return (
    <div
      onClick={(event) => event.stopPropagation()}
      className="absolute z-30 w-64 rounded-2xl border bg-card p-2.5 shadow-xl"
      style={{ left: pending.screenLeft, top: pending.screenTop }}
    >
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <MessageSquarePlus className="size-3.5 text-primary" />
        New comment
      </div>
      <textarea
        autoFocus
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            onSubmit()
          }
        }}
        placeholder="Leave a comment..."
        rows={2}
        className="w-full resize-none rounded-lg border bg-background px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
      />
      <div className="mt-1.5 flex justify-end gap-1.5">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!value.trim()}
          className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground disabled:opacity-40"
        >
          Comment
        </button>
      </div>
    </div>
  )
}

function CanvasLayer({ layer, isSelected, onSelect, commentMode }) {
  function handleClick(event) {
    // In Comment mode, clicks fall through to the canvas surface's
    // pin-drop handler instead of selecting the layer underneath.
    if (commentMode) return
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

function CanvasFrame({ frame, selectedId, onSelect, commentMode }) {
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
          if (commentMode) return
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
            commentMode={commentMode}
          />
        ))}
        {isFrameSelected && <SelectionHandles />}
      </div>
    </div>
  )
}

function CanvasPanel() {
  const [zoom, setZoom] = useState(100)
  const [pendingComment, setPendingComment] = useState(null)
  const [pendingDraft, setPendingDraft] = useState('')
  const [openPinId, setOpenPinId] = useState(null)
  const scrollRef = useRef(null)
  const surfaceRef = useRef(null)
  // selectedLayerId and activePageId both live in workspace context (not
  // local state) so a followed teammate's viewport can drive the same
  // canvas highlight, and so the Layers panel's tree stays in sync with
  // whichever design page/file is open here. canvasTool lives there too so
  // the global cursor overlay can read it.
  const {
    selectedLayerId,
    selectCanvasLayer,
    activePageId,
    setActivePageId,
    dockApi,
    canvasTool,
    setCanvasTool,
    comments,
    addComment,
    getViewersForCanvasPage,
  } = useWorkspace()
  const activePage = canvasPages.find((p) => p.id === activePageId) ?? canvasPages[0]
  const commentMode = canvasTool === 'comment'

  function handleSelect(id) {
    selectCanvasLayer(id, {
      conflict: id === 'primary-button' ? paddingConflict : undefined,
    })
    setPendingComment(null)
    const target = findCanvasTarget(id)
    if (target) openLayerInspectTab(dockApi, target.layer ?? target.frame)
  }

  function handleSelectTool(id) {
    setCanvasTool(id)
    if (id !== 'comment') setPendingComment(null)
  }

  function handleSelectPage(id) {
    setActivePageId(id)
    setPendingComment(null)
    setOpenPinId(null)
  }

  function handleSurfaceClick(event) {
    if (commentMode) {
      const surfaceRect = surfaceRef.current?.getBoundingClientRect()
      const scrollRect = scrollRef.current?.getBoundingClientRect()
      if (!surfaceRect || !scrollRect) return
      setOpenPinId(null)
      setPendingDraft('')
      setPendingComment({
        x: (event.clientX - surfaceRect.left) / (zoom / 100),
        y: (event.clientY - surfaceRect.top) / (zoom / 100),
        screenLeft: event.clientX - scrollRect.left,
        screenTop: event.clientY - scrollRect.top,
      })
      return
    }
    selectCanvasLayer(null)
    setOpenPinId(null)
  }

  function submitPendingComment() {
    if (!pendingComment || !pendingDraft.trim()) return
    addComment(pendingDraft, {
      type: 'canvas',
      pageId: activePage.id,
      x: pendingComment.x,
      y: pendingComment.y,
    })
    setPendingComment(null)
    setPendingDraft('')
    setCanvasTool('move')
  }

  const pinsForPage = comments.filter(
    (c) => c.target?.type === 'canvas' && c.target.pageId === activePage?.id
  )

  return (
    <div className="flex h-full min-w-0 flex-col bg-background">
      <PageTabs activePageId={activePage?.id} onSelectPage={handleSelectPage} />

      <div
        ref={scrollRef}
        data-cursor-zone="canvas"
        data-cursor-tool={canvasTool}
        onClick={handleSurfaceClick}
        className="relative min-h-0 flex-1 overflow-auto"
        style={{
          backgroundImage:
            'radial-gradient(color-mix(in oklch, var(--foreground) 14%, transparent) 1px, transparent 1px)',
          backgroundSize: '18px 18px',
        }}
      >
        <div
          ref={surfaceRef}
          className="relative min-h-full min-w-full p-16"
          style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}
        >
          {activePage?.frames.map((frame) => (
            <CanvasFrame
              key={frame.id}
              frame={frame}
              selectedId={selectedLayerId}
              onSelect={handleSelect}
              commentMode={commentMode}
            />
          ))}

          {pinsForPage.map((comment) => (
            <CommentPin
              key={comment.id}
              comment={comment}
              open={openPinId === comment.id}
              onToggle={() => setOpenPinId((cur) => (cur === comment.id ? null : comment.id))}
            />
          ))}
        </div>

        <MultiplayerCursors members={getViewersForCanvasPage(activePage?.id)} />
        <CanvasToolbar tool={canvasTool} onSelectTool={handleSelectTool} />

        {pendingComment && (
          <PinComposer
            pending={pendingComment}
            value={pendingDraft}
            onChange={setPendingDraft}
            onSubmit={submitPendingComment}
            onCancel={() => {
              setPendingComment(null)
              setPendingDraft('')
            }}
          />
        )}

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
    </div>
  )
}

export default CanvasPanel
