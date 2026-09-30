import './CanvasToolbar.css'
import { useContext, useEffect, useRef, useState } from 'react'
import {
  FileImage,
  Check,
  Ellipsis,
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
import { WORKSPACE_TAB_RADIUS } from '@/components/mergestudio/floatingStyles'
import { allPeople, canvasTools, findCanvasTarget, paddingConflict } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { panelById } from '@/components/dockview/DockLayout'
import MultiplayerCursors from '@/components/collab/MultiplayerCursors'
import { StaticLayer } from '@/components/mergestudio/MergeInfiniteCanvas'
import { SYNC_FILL_TYPES, SYNC_RADIUS_TYPES, overrideFromEdit } from '@/lib/prototypeSync'
import { WindowHeaderPortal, WindowTabsContext } from '@/components/workspace/WindowHeaderSlot'
import CanvasZoomControl, { MAX_CANVAS_ZOOM, MIN_CANVAS_ZOOM } from '@/components/workspace/CanvasZoomControl'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const toolIcons = {
  MousePointer2,
  Hand,
  Frame: FrameIcon,
  Type,
  Square,
  MessageSquarePlus,
}

// Opens a frame/layer's inspection tab docked in the same tab strip as the
// code editor's file tabs — "exactly like opening a file" — but leaves the
// code editor in front: selecting on the canvas jumps the editor to that
// layer's line in the page's code file (design ↔ code sync), and the
// inspect tab is one click away beside it.
function openLayerInspectTab(dockApi, node) {
  if (!dockApi || !node) return
  const panelId = `inspect-${node.id}`
  if (dockApi.getPanel(panelId)) return

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
  dockApi.getPanel(panelById.editor.id)?.api.setActive()
}

// Figma-style pill toolbar docked at the top-right of the canvas — a
// real tool *picker*: the active tool both gets a highlight state here and
// changes what clicking the canvas surface does (see CanvasPanel) and what
// the global cursor looks like while hovering it (see LocalCursor).
function CanvasToolbar({ tool, onSelectTool, compact }) {
  const activeTool = canvasTools.find((item) => item.id === tool) ?? canvasTools[0]
  const ActiveIcon = toolIcons[activeTool.iconName]

  return (
    <div
      data-canvas-chrome
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      className={cn('canvas-floating-toolbar pointer-events-auto flex items-center gap-0.5 border bg-card/95 p-0.5 shadow-xl backdrop-blur-sm', WORKSPACE_TAB_RADIUS)}
    >
      {compact ? (
        <>
          <span
            title={`Current tool: ${activeTool.label}`}
            aria-label={`Current tool: ${activeTool.label}`}
            className={cn('canvas-toolbar-tool flex size-7 items-center justify-center bg-primary text-primary-foreground', WORKSPACE_TAB_RADIUS)}
          >
            {ActiveIcon && <ActiveIcon className="size-3.5" />}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger
              type="button"
              title="Choose canvas tool"
              aria-label="Choose canvas tool"
              className={cn('canvas-toolbar-tool flex size-7 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground', WORKSPACE_TAB_RADIUS)}
            >
              <Ellipsis className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              {canvasTools.map((t) => {
                const Icon = toolIcons[t.iconName]
                return (
                  <DropdownMenuItem key={t.id} onClick={() => onSelectTool(t.id)} className="gap-2">
                    {Icon && <Icon className="size-4" />}
                    <span className="flex-1">{t.label}</span>
                    {tool === t.id && <Check className="size-3.5 text-emerald-300" />}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      ) : canvasTools.map((t) => {
        const Icon = toolIcons[t.iconName]
        const active = tool === t.id
        return (
          <button
            key={t.id}
            type="button"
            title={t.label}
            onClick={() => onSelectTool(t.id)}
            className={cn(
              'canvas-toolbar-tool flex size-7 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
              WORKSPACE_TAB_RADIUS,
              active && 'bg-primary text-primary-foreground'
            )}
          >
            {Icon && <Icon className="size-3.5" />}
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
// (The layer tree opens from the window's `+` or the command palette.)
function PageTabs({ activePageId, onSelectPage }) {
  const { projectPages } = useWorkspace()
  // In a docked window the header draws the page tabs itself (PanelTabs).
  if (useContext(WindowTabsContext)) return null
  // On the window's title line (see WindowHeaderSlot), right after "Canvas".
  return (
    <WindowHeaderPortal fallbackClassName="flex h-10 shrink-0 items-center gap-1.5 border-b bg-card px-2">
      <span className="mx-1 h-4 w-px shrink-0 bg-white/10" />
      {projectPages.map((page) => {
        const active = activePageId === page.id
        return (
          <button
            key={page.id}
            type="button"
            onClick={() => onSelectPage(page.id)}
            className={cn(
              'workspace-header-tab flex h-8 shrink-0 items-center gap-1.5 rounded-[16px] px-3 text-xs transition-colors',
              active
                ? 'bg-muted text-foreground ring-1 ring-border'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            )}
          >
            <FileImage className={cn('size-3.5 shrink-0', active ? 'text-emerald-300' : '')} />
            {page.name}
          </button>
        )
      })}
    </WindowHeaderPortal>
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
            'pointer-events-none absolute z-10 size-2 rounded-[2px] border border-lime-400 bg-white shadow-[0_0_6px_rgba(163,230,53,0.8)]',
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
          author?.colorClass ?? 'bg-emerald-500'
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
          className="ds-primary-cta rounded-md px-2.5 py-1 text-[11px] font-medium disabled:opacity-40"
        >
          Comment
        </button>
      </div>
    </div>
  )
}

const FILL_SWATCHES = ['#6366f1', '#8b5cf6', '#10b981', '#f43f5e', '#0f172a']

// A hi-fi artboard: the frame drawn as a real, light product screen with
// Merge Studio's StaticLayer (actual copy, inputs, buttons, charts) rather
// than wireframe bars. Text is edited in place by double-clicking it, and
// every edit — plus fill/radius from the property bar — is synced to the
// page's code file (see lib/prototypeSync).
function CanvasFrame({ frame, selectedId, onSelect, commentMode, edits, onEditText, aiPulseId, genLayerId, genProgress }) {
  const { mergedBaseline } = useWorkspace()
  const merged = Object.values(mergedBaseline).filter((entry) => entry.design?.frame?.id === frame.id).sort((a, b) => b.savedAt - a.savedAt)[0]
  if (merged) frame = { ...merged.design.frame, x: frame.x, y: frame.y }
  const isFrameSelected = selectedId === frame.id

  return (
    <div className="absolute" style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height }}>
      <span className="absolute -top-5 left-0 text-[10px] text-muted-foreground select-none">{frame.name}</span>
      <div
        onClick={(event) => {
          if (commentMode) return
          event.stopPropagation()
          onSelect(frame.id)
        }}
        className={cn(
          'relative h-full w-full cursor-pointer overflow-hidden rounded-xl bg-white shadow-2xl shadow-black/40 ring-1 ring-slate-200/80',
          isFrameSelected && 'outline outline-2 outline-offset-2 outline-emerald-400'
        )}
      >
        {/* In Comment mode clicks fall through to the pin-drop handler. */}
        <div className={cn('absolute inset-0', commentMode && 'pointer-events-none')}>
          {frame.layers.map((layer) => (
            <StaticLayer
              key={layer.id}
              layer={layer}
              override={overrideFromEdit(edits[layer.id])}
              selected={selectedId === layer.id}
              dimmed={Boolean(selectedId) && selectedId !== frame.id}
              onSelect={() => onSelect(layer.id)}
              onEditText={onEditText}
              aiChanged={aiPulseId === layer.id}
              generating={genLayerId === layer.id}
              genProgress={Math.round(genProgress)}
            />
          ))}
        </div>
        {isFrameSelected && <SelectionHandles />}
      </div>
    </div>
  )
}

// Shown for a selected layer that syncs to code: its fill and corner
// radius, edited here and written straight into the page's code file.
function PropertyBar({ layer, edit, onChange }) {
  const canFill = SYNC_FILL_TYPES.has(layer.type)
  const canRadius = SYNC_RADIUS_TYPES.has(layer.type)
  const radius = edit?.radius

  return (
    <div
      onClick={(event) => event.stopPropagation()}
      className="canvas-floating-toolbar pointer-events-auto absolute top-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-card/95 py-1 pr-1.5 pl-3 font-sans text-xs shadow-xl backdrop-blur-sm"
    >
      <span className="max-w-32 truncate font-medium text-foreground">{layer.name}</span>
      {canFill && (
        <>
          <span className="h-4 w-px bg-white/10" />
          <span className="flex items-center gap-1" role="group" aria-label="Fill">
            {FILL_SWATCHES.map((color) => (
              <button
                key={color}
                type="button"
                title={color}
                aria-label={`Fill ${color}`}
                aria-pressed={edit?.fill === color}
                onClick={() => onChange({ fill: color })}
                className={cn('size-5 rounded-full ring-1 ring-white/15 transition-transform hover:scale-110', edit?.fill === color && 'ring-2 ring-white')}
                style={{ background: color }}
              />
            ))}
          </span>
        </>
      )}
      {canRadius && (
        <>
          <span className="h-4 w-px bg-white/10" />
          <span className="flex items-center gap-0.5" role="group" aria-label="Radius">
            <span className="px-1 text-muted-foreground">Radius</span>
            <button
              type="button"
              aria-label="Less radius"
              onClick={() => onChange({ radius: Math.max(0, (radius ?? 8) - 2) })}
              className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground"
            >
              <Minus className="size-3" />
            </button>
            <span className="w-7 text-center text-foreground tabular-nums">{radius ?? '—'}</span>
            <button
              type="button"
              aria-label="More radius"
              onClick={() => onChange({ radius: Math.min(28, (radius ?? 8) + 2) })}
              className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground"
            >
              <Plus className="size-3" />
            </button>
          </span>
        </>
      )}
      <span className="h-4 w-px bg-white/10" />
      <span className="pr-1.5 text-muted-foreground">Double-click text to edit</span>
    </div>
  )
}

function CanvasPanel() {
  // The infinite canvas's viewport: pan offset (px) and zoom (%).
  const [view, setView] = useState({ x: 0, y: 0, zoom: 100 })
  const zoom = view.zoom
  const [panning, setPanning] = useState(false)
  // Set when a press turned into a pan, so the click that ends it doesn't
  // also select / deselect.
  const panMoved = useRef(false)
  const [pendingComment, setPendingComment] = useState(null)
  const [pendingDraft, setPendingDraft] = useState('')
  const [openPinId, setOpenPinId] = useState(null)
  const scrollRef = useRef(null)
  const [canvasWidth, setCanvasWidth] = useState(0)
  const compactToolbar = canvasWidth > 0 && canvasWidth < 380

  useEffect(() => {
    const viewport = scrollRef.current
    if (!viewport) return
    const measure = () => setCanvasWidth(viewport.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])
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
    projectPages,
    dockApi,
    canvasTool,
    setCanvasTool,
    comments,
    addComment,
    getViewersForCanvasPage,
    prototypeEdits,
    editPrototypeLayer,
    aiEditPulse,
    aiGenerating,
  } = useWorkspace()
  // The value a text slot had when in-place editing started, so Escape can
  // put it back after the live preview.
  const editStart = useRef(new Map())

  // An AI chat edit just landed on this layer — pulse it for a couple of
  // seconds (see StaticLayer's `aiChanged`), the same "points at its own
  // work" pattern as the editor's `codeFlash`.
  const [aiPulseId, setAiPulseId] = useState(null)
  useEffect(() => {
    if (!aiEditPulse) return
    setAiPulseId(aiEditPulse.layerId)
    const timer = window.setTimeout(() => setAiPulseId(null), 2100)
    return () => window.clearTimeout(timer)
  }, [aiEditPulse])

  // An AI edit is being "written" to this layer — glow it with a fake but
  // convincing progress tick while it's worked on (see WorkspaceProvider's
  // `aiGenerating`); the pulse above takes over once it actually lands.
  const [genLayerId, setGenLayerId] = useState(null)
  const [genProgress, setGenProgress] = useState(0)
  useEffect(() => {
    if (!aiGenerating?.layerId) {
      setGenLayerId(null)
      return
    }
    setGenLayerId(aiGenerating.layerId)
    setGenProgress(10)
    const interval = window.setInterval(() => {
      setGenProgress((p) => Math.min(94, p + 6 + Math.random() * 10))
    }, 140)
    return () => window.clearInterval(interval)
  }, [aiGenerating])

  function handleEditText(layerId, slot, value, { live } = {}) {
    const key = `${layerId}:${slot}`
    if (!editStart.current.has(key)) editStart.current.set(key, prototypeEdits[layerId]?.copy?.[slot])
    const next = value === null ? editStart.current.get(key) : value
    editPrototypeLayer(layerId, { copy: { [slot]: next } })
    if (!live || value === null) editStart.current.delete(key)
  }
  const activePage = projectPages.find((p) => p.id === activePageId) ?? projectPages[0]
  const commentMode = canvasTool === 'comment'
  // The selected layer, if it's on the page being shown (a selection made
  // on another page shouldn't keep its property bar up here).
  const selectedTarget = findCanvasTarget(selectedLayerId)
  const selectedLayer = selectedTarget?.page.id === activePage?.id ? selectedTarget.layer : null

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

  // Pan: drag the empty grid (Move tool), anywhere with the Hand tool, or
  // with the middle button whatever the tool. Floating controls stop their
  // own presses, so using them never pans.
  function handlePointerDown(event) {
    const onEmpty = event.target === scrollRef.current || event.target === surfaceRef.current
    const middle = event.button === 1
    const handTool = canvasTool === 'hand' && event.button === 0
    if (!middle && !handTool && !(event.button === 0 && onEmpty && !commentMode)) return
    if (middle || handTool) event.preventDefault()
    const start = { px: event.clientX, py: event.clientY, x: view.x, y: view.y }
    panMoved.current = false
    function onMove(m) {
      const dx = m.clientX - start.px
      const dy = m.clientY - start.py
      if (!panMoved.current && Math.hypot(dx, dy) < 3) return
      panMoved.current = true
      setPanning(true)
      setView((v) => ({ ...v, x: start.x + dx, y: start.y + dy }))
    }
    function onUp() {
      setPanning(false)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // Zoom around a point of the viewport (the pointer, or its center).
  function zoomAt(nextZoom, cx, cy) {
    setView((v) => {
      const z = Math.min(MAX_CANVAS_ZOOM, Math.max(MIN_CANVAS_ZOOM, nextZoom(v.zoom)))
      const k = z / v.zoom
      return { zoom: Math.round(z), x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k }
    })
  }

  function zoomBy(step) {
    const rect = scrollRef.current?.getBoundingClientRect()
    zoomAt((z) => z + step, (rect?.width ?? 0) / 2, (rect?.height ?? 0) / 2)
  }

  // The scroll wheel zooms at the pointer (non-passive, to keep the page
  // from scrolling).
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    function onWheel(event) {
      if (event.target.closest?.('[data-canvas-chrome]')) return
      event.preventDefault()
      const rect = el.getBoundingClientRect()
      zoomAt((z) => z * Math.exp(-event.deltaY * 0.0015), event.clientX - rect.left, event.clientY - rect.top)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // A press that panned (or any click with the Hand tool) doesn't select.
  function handleClickCapture(event) {
    if (panMoved.current || canvasTool === 'hand') {
      panMoved.current = false
      event.stopPropagation()
    }
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
    <div className="flex h-full min-w-0 flex-col bg-card">
      <PageTabs
        activePageId={activePage?.id}
        onSelectPage={handleSelectPage}
      />

      <div className="flex min-h-0 flex-1">

        <div
          ref={scrollRef}
          data-cursor-zone="canvas"
          data-cursor-tool={canvasTool}
          onPointerDown={handlePointerDown}
          onClickCapture={handleClickCapture}
          onClick={handleSurfaceClick}
          className={cn('relative min-h-0 min-w-0 flex-1 touch-none overflow-hidden', panning && 'cursor-grabbing')}
          style={{
            backgroundImage:
              'radial-gradient(color-mix(in oklch, var(--foreground) 14%, transparent) 1px, transparent 1px)',
            backgroundSize: `${18 * (zoom / 100)}px ${18 * (zoom / 100)}px`,
            backgroundPosition: `${view.x}px ${view.y}px`,
          }}
        >
          <div
            ref={surfaceRef}
            className="absolute top-0 left-0 min-h-full min-w-full p-16"
            style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${zoom / 100})`, transformOrigin: 'top left' }}
          >
            {activePage?.frames.map((frame) => (
              <CanvasFrame
                key={frame.id}
                frame={frame}
                selectedId={selectedLayerId}
                onSelect={handleSelect}
                commentMode={commentMode}
                edits={prototypeEdits}
                onEditText={commentMode ? undefined : handleEditText}
                aiPulseId={aiPulseId}
                genLayerId={genLayerId}
                genProgress={genProgress}
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

          <MultiplayerCursors members={getViewersForCanvasPage(activePage?.id)} scopeKey={activePage?.id} />
          {selectedLayer && (SYNC_FILL_TYPES.has(selectedLayer.type) || SYNC_RADIUS_TYPES.has(selectedLayer.type)) && (
            <PropertyBar
              layer={selectedLayer}
              edit={prototypeEdits[selectedLayer.id]}
              onChange={(patch) => editPrototypeLayer(selectedLayer.id, patch)}
            />
          )}

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

          <div className="pointer-events-none absolute top-3 right-3 z-20 flex items-center gap-1.5">
            <CanvasToolbar tool={canvasTool} onSelectTool={handleSelectTool} compact={compactToolbar} />
            <div className="pointer-events-auto">
              <CanvasZoomControl zoom={zoom} onZoomBy={zoomBy} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CanvasPanel
