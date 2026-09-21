import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowUp, Frame as FrameIcon, GripHorizontal, Maximize, Minus, Plus, Sparkles, X } from 'lucide-react'
import { cn } from 'cn'
import { canvasPages, codeMergeVariants, designMergeVariants } from '@/data/mockData'
import { getFileIconMeta } from '@/lib/fileIcons'
import { tokenClassName, tokenizeLine } from '@/lib/syntaxHighlight'
import { useWorkspace } from '@/state/WorkspaceProvider'

const MIN_ZOOM = 25
const MAX_ZOOM = 200
const ZOOM_STEP = 10
const CODE_DIFF_WIDTH = 576
// How far right content starts, so it clears the floating Merge List panel
// (w-72 anchored left-4) docked over the same canvas surface instead of
// pushing it in a fixed layout column.
const CONTENT_START_X = 304
const ARTBOARD_PREVIEW_WIDTH = 260
// Option B's own fixed accent — a simple, permanent visual reminder that
// it's a different variant, independent of whatever layer happens to be
// selected right now, unless an AI Block Deck suggestion is actively
// previewing on that exact layer (see `previewOverride`).
const OPTION_B_ACCENT = 'bg-violet-500'

function CodeLine({ lineNumber, text, language, highlighted, accentClass, onClick, lineRef, linked, hovered, onHover }) {
  const tokens = tokenizeLine(text, language)
  return (
    <div
      ref={lineRef}
      onClick={onClick}
      onPointerEnter={linked ? () => onHover?.(lineNumber) : undefined}
      onPointerLeave={linked ? () => onHover?.(null) : undefined}
      className={cn(
        'flex cursor-pointer gap-3 border-l-2 border-transparent px-3 hover:bg-muted/40',
        linked && 'border-violet-500/50',
        hovered && !highlighted && 'bg-violet-500/15',
        highlighted && 'border-primary bg-primary/10',
        !highlighted && accentClass
      )}
    >
      <span className="w-5 shrink-0 text-right text-muted-foreground/40 select-none">{lineNumber}</span>
      {/* min-w-0 lets this span actually shrink below its content's
          intrinsic width so pre-wrap can kick in, instead of the row
          growing past the card and needing horizontal scroll. */}
      <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">
        {text.length === 0 ? (
          ' '
        ) : (
          tokens.map((token, j) => (
            <span key={j} className={tokenClassName(token.type)}>
              {token.text}
            </span>
          ))
        )}
      </span>
    </div>
  )
}

// A file's two-column diff — "Code A · Current" next to "Code B ·
// Incoming" — mirroring the design artboards' Option A/Option B, but for
// code. Lines with a mock diff entry (`codeMergeVariants`) get
// removed/added-style tinting on each side; everything else renders
// identically on both, same as a design layer with no mock property diff.
function CodeDiffColumns({ file, lines, diffs, highlightLine, onSelectLine, highlightRef, linkedLines, hoverLine, hoverFileId, onHoverLine }) {
  const diffByLine = new Map((diffs ?? []).map((d) => [d.line, d.incoming]))

  return (
    <div
      data-code-scroll
      className="relative grid min-h-0 flex-1 grid-cols-2 content-start divide-x divide-border overflow-auto bg-background font-mono text-[11px] leading-relaxed"
    >
      <div>
        <p className="sticky top-0 z-10 border-b bg-card px-3 py-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
          Code A
        </p>
        <div className="py-2">
          {lines.map((line, i) => {
            const lineNumber = i + 1
            return (
              <CodeLine
                key={i}
                lineRef={highlightLine === lineNumber ? highlightRef : undefined}
                lineNumber={lineNumber}
                text={line}
                language={file.language}
                highlighted={highlightLine === lineNumber}
                accentClass={diffByLine.has(lineNumber) ? 'border-destructive/60 bg-destructive/5' : undefined}
                onClick={(e) => onSelectLine?.(file.id, lineNumber, e.currentTarget)}
                linked={linkedLines?.has(`${file.id}:${lineNumber}`)}
                hovered={hoverFileId === file.id && hoverLine === lineNumber}
                onHover={(n) => onHoverLine?.(file.id, n)}
              />
            )
          })}
        </div>
      </div>
      <div>
        <p className="sticky top-0 z-10 border-b bg-card px-3 py-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
          Code B
        </p>
        <div className="py-2">
          {lines.map((line, i) => {
            const lineNumber = i + 1
            const incoming = diffByLine.get(lineNumber)
            const text = incoming ?? line
            return (
              <CodeLine
                key={i}
                lineNumber={lineNumber}
                text={text}
                language={file.language}
                highlighted={highlightLine === lineNumber}
                accentClass={incoming !== undefined ? 'border-emerald-500/60 bg-emerald-500/5' : undefined}
                onClick={(e) => onSelectLine?.(file.id, lineNumber, e.currentTarget)}
                linked={linkedLines?.has(`${file.id}:${lineNumber}`)}
                hovered={hoverFileId === file.id && hoverLine === lineNumber}
                onHover={(n) => onHoverLine?.(file.id, n)}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

// Edge + corner resize handles for a card. Rendered inside the card so
// overflow-hidden doesn't clip them; each stops propagation so grabbing a
// handle never starts a card drag.
function ResizeHandles({ onResizeStart }) {
  return (
    <>
      <div
        onPointerDown={onResizeStart('e')}
        className="absolute top-0 right-0 z-10 h-full w-1.5 cursor-ew-resize"
      />
      <div
        onPointerDown={onResizeStart('s')}
        className="absolute bottom-0 left-0 z-10 h-1.5 w-full cursor-ns-resize"
      />
      <div
        onPointerDown={onResizeStart('se')}
        title="Resize"
        className="absolute right-0 bottom-0 z-20 flex size-4 cursor-nwse-resize items-end justify-end p-0.5"
      >
        <span className="size-2 rounded-br-sm border-r-2 border-b-2 border-violet-500/70" />
      </div>
    </>
  )
}

// One code window for the whole merge item, always showing Code A ·
// Current beside Code B · Incoming. A single tab row (with a drag grip)
// switches files — there is no second title bar. Reverse sync (clicking a
// linked design layer) switches the active tab to that layer's file.
function CodeWindowCard({ itemId, files, x, y, w, h, z, onDragStart, onResizeStart, onClickCapture, hoverLine, hoverFileId, onHoverLine, linkedLines, highlightFileId, highlightLine, onSelectLine, highlightRef }) {
  const { getFileLines } = useWorkspace()
  const [activeFileId, setActiveFileId] = useState(files[0]?.id)

  useEffect(() => {
    if (files.length && !files.some((f) => f.id === activeFileId)) {
      setActiveFileId(files[0]?.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files])

  useEffect(() => {
    if (highlightFileId) setActiveFileId(highlightFileId)
  }, [highlightFileId, highlightLine])

  const activeFile = files.find((f) => f.id === activeFileId) ?? files[0]
  if (!activeFile) return null

  return (
    <div
      data-card="code"
      className="absolute top-0 left-0 flex cursor-grab flex-col overflow-hidden rounded-2xl border bg-card shadow-lg will-change-transform active:cursor-grabbing"
      style={{ transform: `translate(${x}px, ${y}px)`, zIndex: z, width: w, height: h }}
      onPointerDown={onDragStart}
      onClickCapture={onClickCapture}
    >
      <div className="flex shrink-0 items-center gap-0.5 overflow-x-auto border-b bg-muted/30 px-1.5 pt-1.5">
        <GripHorizontal className="mr-1 size-3.5 shrink-0 text-muted-foreground/50" />
        {files.map((file) => {
          const meta = getFileIconMeta(file.name)
          const active = file.id === activeFile.id
          return (
            <button
              key={file.id}
              type="button"
              onClick={() => setActiveFileId(file.id)}
              className={cn(
                'flex shrink-0 items-center gap-1 rounded-t-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors',
                active ? 'bg-card text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <meta.Icon className={cn('size-3 shrink-0', meta.colorClass)} />
              <span className="max-w-[120px] truncate">{file.name}</span>
            </button>
          )
        })}
      </div>

      <CodeDiffColumns
        file={activeFile}
        lines={getFileLines(activeFile.id)}
        diffs={codeMergeVariants[itemId]?.[activeFile.id]}
        highlightLine={highlightFileId === activeFile.id ? highlightLine : undefined}
        onSelectLine={onSelectLine}
        highlightRef={highlightRef}
        linkedLines={linkedLines}
        hoverLine={hoverLine}
        hoverFileId={hoverFileId}
        onHoverLine={onHoverLine}
      />
      <ResizeHandles onResizeStart={onResizeStart} />
    </div>
  )
}

// A read-only re-rendering of a frame's layers — separate from CanvasPanel's
// interactive CanvasFrame/CanvasLayer (no zoom/tools of its own, since it
// lives inside the shared infinite canvas which already has those) since
// this is a comparison artboard, not an editable canvas. Both Option A and
// Option B are clickable — clicking either drives Block Deck's Variant
// Compare tab and, for linked layers, the code sync. `aiPreview` marks a
// button layer as currently showing a live-previewed AI Block Deck
// suggestion, rendering a small badge so the change reads as suggested
// rather than a permanent edit.
function StaticLayer({ layer, override, selected, onSelect, linked, hovered, onHover }) {
  const style = {
    left: layer.x,
    top: layer.y,
    width: layer.width + (override?.dw ?? 0),
    height: layer.height + (override?.dh ?? 0),
  }
  const fill = override?.className
  const radiusStyle = override?.radius !== undefined ? { borderRadius: override.radius } : undefined

  let content = null
  if (layer.type === 'bar') {
    content = (
      <div
        style={radiusStyle}
        className={cn('flex h-full w-full items-center justify-between rounded-sm px-2', fill ?? 'bg-muted')}
      >
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
        style={radiusStyle}
        className={cn('h-full w-full rounded-lg', fill ?? 'border border-border bg-muted/40')}
      />
    )
  } else if (layer.type === 'avatar') {
    content = <div className={cn('h-full w-full rounded-full', fill ?? 'bg-muted-foreground/30')} />
  } else if (layer.type === 'button') {
    content = (
      <div
        style={radiusStyle}
        className={cn(
          'flex h-full w-full items-center justify-center rounded-md text-xs font-medium text-primary-foreground',
          fill ?? 'bg-primary'
        )}
      >
        {layer.label ?? 'Button'}
      </div>
    )
  } else {
    content = (
      <div style={radiusStyle} className={cn('h-full w-full rounded-sm', fill ?? 'bg-muted-foreground/25')} />
    )
  }

  return (
    <div
      data-layer-id={layer.id}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(e.currentTarget)
      }}
      onPointerEnter={linked ? () => onHover?.(layer.id) : undefined}
      onPointerLeave={linked ? () => onHover?.(null) : undefined}
      className={cn(
        'absolute cursor-pointer',
        linked && 'outline outline-1 outline-dashed outline-offset-2 outline-violet-500/60',
        hovered && 'outline-2 outline-violet-500',
        selected && 'outline outline-2 outline-solid outline-offset-1 outline-primary'
      )}
      style={style}
    >
      {content}
      {override && !override.static && (
        <span
          title="Live preview"
          className="absolute -top-1.5 -right-1.5 flex size-3.5 items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 shadow"
        >
          <Sparkles className="size-2 text-white" />
        </span>
      )}
    </div>
  )
}

// An artboard "card" — the frame previews at a fixed width regardless of
// its real size (scaled via CSS transform; layer positions stay untouched
// since they're relative to the scaled parent), so Mobile App's 280px-wide
// frame and Marketing Site's 480px-wide one both read at a consistent size
// on the canvas.
function StaticFrame({ frameKey, frame, label, accentClass, x, y, w, h, z, onDragStart, onResizeStart, onClickCapture, linkedLayerIds, hoverLayerId, onHoverLayer, selectedLayerId, previewOverride, onSelectLayer, onSelectFrame }) {
  // The box is freely resizable; its content scales uniformly to fit.
  const boxW = w ?? ARTBOARD_PREVIEW_WIDTH
  const boxH = h ?? (frame.height * boxW) / frame.width
  const scale = Math.min(boxW / frame.width, boxH / frame.height)

  return (
    <div
      data-frame-key={frameKey}
      className="absolute top-0 left-0 cursor-grab will-change-transform active:cursor-grabbing"
      style={{ transform: `translate(${x}px, ${y}px)`, zIndex: z, width: boxW }}
      onPointerDown={onDragStart}
      onClickCapture={onClickCapture}
    >
      <p className="mb-1.5 flex items-center gap-1 rounded-full bg-card/90 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
        <GripHorizontal className="size-3 shrink-0 text-muted-foreground/50" />
        {label}
      </p>
      <div
        onClick={(e) => onSelectFrame(frameKey, e.currentTarget)}
        className="relative overflow-hidden rounded-md border border-border bg-card shadow-lg"
        style={{ width: boxW, height: boxH }}
      >
        <div
          className="relative"
          style={{
            width: frame.width,
            height: frame.height,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          {frame.layers.map((layer) => {
            const override =
              previewOverride?.layerId === layer.id
                ? previewOverride
                : layer.type === 'button' && accentClass
                  ? { className: accentClass, static: true }
                  : undefined
            return (
              <StaticLayer
                key={layer.id}
                layer={layer}
                override={override}
                selected={selectedLayerId === layer.id}
                linked={linkedLayerIds?.has(layer.id)}
                hovered={hoverLayerId === layer.id}
                onHover={onHoverLayer}
                onSelect={(el) => onSelectLayer(layer.id, el)}
              />
            )
          })}
        </div>
        <ResizeHandles onResizeStart={onResizeStart} />
      </div>
    </div>
  )
}

// Sizes are in world units. Artboards leave w/h null until first resized
// (they then derive their height from the frame's aspect ratio).
const DEFAULT_LAYOUT = {
  code: { x: 0, y: 0, w: CODE_DIFF_WIDTH, h: 380 },
  a: { x: CODE_DIFF_WIDTH + 90, y: 0, w: null, h: null },
  b: { x: CODE_DIFF_WIDTH + 90 + ARTBOARD_PREVIEW_WIDTH + 40, y: 0, w: null, h: null },
}
const DEFAULT_VIEW = { x: CONTENT_START_X, y: 40, zoom: 100 }

function clampZoom(z) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))
}

// Cubic connector between two screen-space anchors, leaving/entering
// horizontally so it reads as a clean link between side-by-side cards.
function connectorPath(from, to) {
  const dx = Math.max(40, Math.abs(to.x - from.x) / 2) * Math.sign(to.x - from.x || 1)
  return `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`
}

// Inline, Cursor-style command bar anchored to whatever was just clicked
// (a design layer, an artboard, or a code line). Enter sends the prompt
// — prefixed with the selection as context — through the shared chat.
function InlineAiEdit({ anchor, label, onSubmit, onClose }) {
  const [text, setText] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [label])

  function submit(e) {
    e.preventDefault()
    if (!text.trim()) return
    onSubmit(text.trim())
    setText('')
  }

  return (
    <form
      onSubmit={submit}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      style={{ left: anchor.left, top: anchor.top }}
      className="absolute z-30 flex w-72 items-center gap-2 rounded-full border border-indigo-500/50 bg-card/95 py-1 pr-1 pl-3 shadow-2xl shadow-indigo-500/20 backdrop-blur-md focus-within:border-violet-500"
    >
      <Sparkles className="size-3.5 shrink-0 text-violet-500" />
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`Edit ${label} with AI…`}
        className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
      />
      <button
        type="submit"
        disabled={!text.trim()}
        title="Apply"
        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white disabled:opacity-40"
      >
        <ArrowUp className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={onClose}
        title="Dismiss"
        className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </form>
  )
}

// Step one of the two-step AI edit: a small sparkle badge floating at the
// top-right of the clicked element. Clicking it opens the prompt bar.
function AiEditBadge({ left, top, onClick }) {
  return (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClick}
      title="Edit with AI"
      style={{ left, top }}
      className="absolute z-30 flex size-6 items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/40 ring-2 ring-card transition-transform hover:scale-110"
    >
      <Sparkles className="size-3.5" />
    </button>
  )
}

// The shared spatial workspace for a merge item — a true infinite canvas.
// Content lives in "world" coordinates under one transform (`view`): drag
// the empty dot-grid to pan, scroll/trackpad to pan, pinch or Ctrl/Cmd +
// scroll to zoom toward the cursor. Cards drag from anywhere on their
// surface. Selecting a layer, frame, or code line draws a connector
// between the code window and the related design element(s) and opens an
// inline AI edit bar on the clicked element.
function MergeInfiniteCanvas({
  item,
  files,
  syncSelection,
  appliedPreset,
  variantPreview,
  onSelectLayer,
  onSelectLine,
  onSelectFrame,
}) {
  const { sendChatMessage } = useWorkspace()
  const [view, setView] = useState(DEFAULT_VIEW)
  const [layout, setLayout] = useState(DEFAULT_LAYOUT)
  const [panning, setPanning] = useState(false)
  const [hover, setHover] = useState(null) // { layerId, fileId, line }
  const [order, setOrder] = useState({ code: 1, a: 2, b: 3 })
  const [frameSel, setFrameSel] = useState(null) // 'a' | 'b'
  const [aiStage, setAiStage] = useState(null) // null | 'badge' | 'prompt'
  const [links, setLinks] = useState({ paths: [], anchor: null })
  const viewportRef = useRef(null)
  const containerRef = useRef(null)
  const viewRef = useRef(view)
  const highlightRef = useRef(null)
  const anchorElRef = useRef(null)
  const suppressClick = useRef(false)
  const page = item.hasDesign ? canvasPages.find((p) => p.id === item.designPageId) : null
  const frame = page?.frames[0]

  useEffect(() => {
    viewRef.current = view
  }, [view])

  useEffect(() => {
    setView(DEFAULT_VIEW)
    setLayout(DEFAULT_LAYOUT)
    setHover(null)
    setFrameSel(null)
    setAiStage(null)
  }, [item?.id])

  const layerCodeMap = designMergeVariants[item.id]?.layerCodeMap ?? {}
  const linkedLayerIds = new Set(Object.keys(layerCodeMap))
  const linkedLines = new Set(Object.values(layerCodeMap).map((t) => `${t.fileId}:${t.line}`))
  function hoverLayer(layerId) {
    const t = layerId ? layerCodeMap[layerId] : null
    setHover(layerId ? { layerId, fileId: t?.fileId, line: t?.line } : null)
  }
  function hoverLine(fileId, line) {
    const layerId = line
      ? Object.keys(layerCodeMap).find((id) => layerCodeMap[id].fileId === fileId && layerCodeMap[id].line === line)
      : null
    setHover(line ? { layerId, fileId, line } : null)
  }

  // Selection wrappers: remember the clicked element (inline-AI anchor) and
  // open the inline bar.
  function pickLayer(layerId, el) {
    anchorElRef.current = el
    setFrameSel(null)
    setAiStage('badge')
    onSelectLayer(layerId)
  }
  function pickLine(fileId, line, el) {
    anchorElRef.current = el
    setFrameSel(null)
    setAiStage('badge')
    onSelectLine(fileId, line)
  }
  function pickFrame(key, el) {
    anchorElRef.current = el
    setFrameSel(key)
    setAiStage('badge')
    onSelectFrame()
  }

  const selectionKey = `${syncSelection?.layerId}|${syncSelection?.fileId}|${syncSelection?.line}|${frameSel}`
  const hasSelection = Boolean(syncSelection?.layerId || syncSelection?.line || frameSel)
  const selectionLabel = frameSel
    ? frameSel === 'a'
      ? 'Option A'
      : 'Option B'
    : (frame?.layers.find((l) => l.id === syncSelection?.layerId)?.name ??
      (syncSelection?.line ? `line ${syncSelection.line}` : 'selection'))

  // Reverse sync: scroll the code window's own scroller (not the canvas).
  useEffect(() => {
    const el = highlightRef.current
    const scroller = el?.closest('[data-code-scroll]')
    if (!el || !scroller) return
    scroller.scrollTo({ top: el.offsetTop - scroller.clientHeight / 2, behavior: 'smooth' })
  }, [syncSelection?.fileId, syncSelection?.line])

  // Connector + inline-bar anchor are measured from the live DOM every
  // frame while something is selected, so they track panning, zooming,
  // card dragging and the code scroller without any bookkeeping. State
  // only updates when the result actually changes.
  useEffect(() => {
    if (!hasSelection) {
      setLinks((prev) => (prev.paths.length || prev.anchor ? { paths: [], anchor: null } : prev))
      return
    }
    let raf
    function measure() {
      const container = containerRef.current
      const base = container?.getBoundingClientRect()
      if (base) {
        const rel = (r) => ({ left: r.left - base.left, right: r.right - base.left, top: r.top - base.top, bottom: r.bottom - base.top })
        const codeEl = container.querySelector('[data-card="code"]')
        const paths = []
        if (codeEl) {
          const code = rel(codeEl.getBoundingClientRect())
          const lineEl = highlightRef.current
          const lineRect = lineEl?.isConnected ? rel(lineEl.getBoundingClientRect()) : null
          const targets = syncSelection?.layerId
            ? [...container.querySelectorAll(`[data-layer-id="${syncSelection.layerId}"]`)]
            : frameSel
              ? [...container.querySelectorAll(`[data-frame-key="${frameSel}"]`)]
              : []
          for (const el of targets) {
            const t = rel(el.getBoundingClientRect())
            const toRight = t.left >= code.right - 1
            const fromX = toRight ? code.right : code.left
            const rawY = lineRect ? (lineRect.top + lineRect.bottom) / 2 : (code.top + code.bottom) / 2
            const fromY = Math.min(Math.max(rawY, code.top + 10), code.bottom - 10)
            paths.push(connectorPath({ x: fromX, y: fromY }, { x: toRight ? t.left : t.right, y: (t.top + t.bottom) / 2 }))
          }
        }
        let anchor = null
        const a = anchorElRef.current
        if (a?.isConnected) {
          const r = rel(a.getBoundingClientRect())
          anchor = {
            l: Math.round(r.left),
            r: Math.round(r.right),
            t: Math.round(r.top),
            b: Math.round(r.bottom),
            w: Math.round(base.width),
            h: Math.round(base.height),
          }
        }
        setLinks((prev) => {
          const same =
            prev.paths.join('|') === paths.join('|') &&
            JSON.stringify(prev.anchor) === JSON.stringify(anchor)
          return same ? prev : { paths, anchor }
        })
      }
      raf = requestAnimationFrame(measure)
    }
    raf = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(raf)
  }, [hasSelection, selectionKey, syncSelection?.layerId, frameSel])

  const zoomAt = useCallback((nextZoom, cx, cy) => {
    setView((v) => {
      const zoom = clampZoom(nextZoom)
      const k = zoom / v.zoom
      return { zoom, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k }
    })
  }, [])

  // Wheel needs a non-passive listener so Ctrl/Cmd/pinch zoom can
  // preventDefault the browser's page zoom.
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    function onWheel(e) {
      if (e.target.closest?.('[data-code-scroll]') && !e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      if (e.ctrlKey || e.metaKey) {
        zoomAt(viewRef.current.zoom * Math.exp(-e.deltaY * 0.01), e.clientX - rect.left, e.clientY - rect.top)
      } else {
        setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }))
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  function zoomFromCenter(delta) {
    const rect = viewportRef.current.getBoundingClientRect()
    zoomAt(viewRef.current.zoom + delta, rect.width / 2, rect.height / 2)
  }

  function startPan(e) {
    if (e.target !== e.currentTarget || e.button !== 0) return
    const start = { px: e.clientX, py: e.clientY, vx: view.x, vy: view.y }
    setPanning(true)
    setAiStage(null)
    function onMove(m) {
      setView((v) => ({ ...v, x: start.vx + m.clientX - start.px, y: start.vy + m.clientY - start.py }))
    }
    function onUp() {
      setPanning(false)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // Cards drag from anywhere on their surface. Pointer origin (px/py) and
  // card origin (cx/cy) are kept separate so the card tracks the cursor
  // 1:1 at any zoom. A 4px threshold separates a drag from a click.
  function startCardDrag(key) {
    return (e) => {
      if (e.button !== 0) return
      if (e.target.closest('button, input, [data-code-scroll]')) return
      e.stopPropagation()
      const start = { px: e.clientX, py: e.clientY, cx: layout[key].x, cy: layout[key].y }
      let moved = false
      setOrder((o) => ({ ...o, [key]: Math.max(...Object.values(o)) + 1 }))
      function onMove(m) {
        const dx = m.clientX - start.px
        const dy = m.clientY - start.py
        if (!moved && Math.hypot(dx, dy) < 4) return
        moved = true
        const scale = viewRef.current.zoom / 100
        setLayout((l) => ({ ...l, [key]: { x: start.cx + dx / scale, y: start.cy + dy / scale } }))
      }
      function onUp() {
        if (moved) {
          suppressClick.current = true
          setTimeout(() => (suppressClick.current = false), 0)
        }
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    }
  }

  function swallowDragClick(e) {
    if (suppressClick.current) {
      e.stopPropagation()
      e.preventDefault()
    }
  }

  // Resize from an edge/corner handle. The sized element is the handle's
  // parent (code card root / artboard box); its current size is measured
  // and converted from screen to world units so it tracks the cursor 1:1.
  function startResize(key) {
    const min = key === 'code' ? { w: 320, h: 180 } : { w: 120, h: 120 }
    return (dir) => (e) => {
      if (e.button !== 0) return
      e.stopPropagation()
      e.preventDefault()
      const rect = e.currentTarget.parentElement.getBoundingClientRect()
      const k = viewRef.current.zoom / 100
      const start = { px: e.clientX, py: e.clientY, w: rect.width / k, h: rect.height / k }
      function onMove(m) {
        const scale = viewRef.current.zoom / 100
        const w = dir.includes('e') ? Math.max(min.w, start.w + (m.clientX - start.px) / scale) : start.w
        const h = dir.includes('s') ? Math.max(min.h, start.h + (m.clientY - start.py) / scale) : start.h
        setLayout((l) => ({ ...l, [key]: { ...l[key], w, h } }))
      }
      function onUp() {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    }
  }

  // Option B's live preview for the selected layer: Variant Compare
  // choices/hover, with an applied AI preset's fill taking precedence.
  const previewOverride =
    syncSelection?.layerId && (variantPreview || appliedPreset)
      ? {
          ...variantPreview,
          layerId: syncSelection.layerId,
          className: appliedPreset?.previewClass ?? variantPreview?.className,
        }
      : undefined

  const scale = view.zoom / 100
  const gridSize = 18 * scale

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-card">
      <div className="flex h-9 shrink-0 items-center gap-1.5 border-b bg-card px-3 pl-[19rem] text-xs font-medium text-foreground">
        <FrameIcon className="size-3.5 shrink-0 text-primary" />
        Merge Canvas
      </div>

      <div ref={containerRef} className="relative min-h-0 flex-1">
        <div
          ref={viewportRef}
          onPointerDown={startPan}
          className={cn('absolute inset-0 overflow-hidden', panning ? 'cursor-grabbing' : 'cursor-grab')}
          style={{
            touchAction: 'none',
            backgroundImage:
              'radial-gradient(color-mix(in oklch, var(--foreground) 14%, transparent) 1px, transparent 1px)',
            backgroundSize: `${gridSize}px ${gridSize}px`,
            backgroundPosition: `${view.x}px ${view.y}px`,
          }}
        >
          <div
            className="pointer-events-none absolute top-0 left-0"
            style={{
              transform: `translate(${view.x}px, ${view.y}px) scale(${scale})`,
              transformOrigin: '0 0',
            }}
          >
            <div className="pointer-events-auto">
              {files.length > 0 && (
                <CodeWindowCard
                  itemId={item.id}
                  files={files}
                  x={layout.code.x}
                  y={layout.code.y}
                  w={layout.code.w}
                  h={layout.code.h}
                  onResizeStart={startResize('code')}
                  z={order.code}
                  onDragStart={startCardDrag('code')}
                  onClickCapture={swallowDragClick}
                  linkedLines={linkedLines}
                  hoverLine={hover?.line}
                  hoverFileId={hover?.fileId}
                  onHoverLine={hoverLine}
                  highlightFileId={syncSelection?.fileId}
                  highlightLine={syncSelection?.line}
                  onSelectLine={pickLine}
                  highlightRef={highlightRef}
                />
              )}

              {frame && (
                <>
                  <StaticFrame
                    frameKey="a"
                    frame={frame}
                    label="Option A · Current"
                    x={layout.a.x}
                    y={layout.a.y}
                    w={layout.a.w}
                    h={layout.a.h}
                    onResizeStart={startResize('a')}
                    z={order.a}
                    onDragStart={startCardDrag('a')}
                    onClickCapture={swallowDragClick}
                    linkedLayerIds={linkedLayerIds}
                    hoverLayerId={hover?.layerId}
                    onHoverLayer={hoverLayer}
                    selectedLayerId={syncSelection?.layerId}
                    onSelectLayer={pickLayer}
                    onSelectFrame={pickFrame}
                  />
                  <StaticFrame
                    frameKey="b"
                    frame={frame}
                    label="Option B · Incoming"
                    accentClass={OPTION_B_ACCENT}
                    x={layout.b.x}
                    y={layout.b.y}
                    w={layout.b.w}
                    h={layout.b.h}
                    onResizeStart={startResize('b')}
                    z={order.b}
                    onDragStart={startCardDrag('b')}
                    onClickCapture={swallowDragClick}
                    linkedLayerIds={linkedLayerIds}
                    hoverLayerId={hover?.layerId}
                    onHoverLayer={hoverLayer}
                    selectedLayerId={syncSelection?.layerId}
                    previewOverride={previewOverride}
                    onSelectLayer={pickLayer}
                    onSelectFrame={pickFrame}
                  />
                </>
              )}
            </div>
          </div>
        </div>

        <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible">
          {links.paths.map((d, i) => (
            <g key={i}>
              <path d={d} fill="none" stroke="#a3e635" strokeWidth={6} strokeOpacity={0.18} />
              <path d={d} fill="none" stroke="#a3e635" strokeWidth={2} strokeDasharray="6 4" style={{ filter: 'drop-shadow(0 0 4px #a3e635)' }} />
            </g>
          ))}
        </svg>

        {hasSelection && links.anchor && aiStage === 'badge' && (
          <AiEditBadge
            left={Math.min(Math.max(4, links.anchor.r - 12), links.anchor.w - 30)}
            top={Math.min(Math.max(4, links.anchor.t - 14), links.anchor.h - 30)}
            onClick={() => setAiStage('prompt')}
          />
        )}

        {hasSelection && links.anchor && aiStage === 'prompt' && (
          <InlineAiEdit
            anchor={{
              left: Math.min(Math.max(8, links.anchor.l), Math.max(8, links.anchor.w - 296)),
              top: Math.min(Math.max(8, links.anchor.b + 8), Math.max(8, links.anchor.h - 130)),
            }}
            label={selectionLabel}
            onClose={() => setAiStage('badge')}
            onSubmit={(text) => {
              sendChatMessage(`Regarding "${selectionLabel}" in ${item.title}: ${text}`)
              setAiStage(null)
            }}
          />
        )}

        {/* Zoom sits centered just above the AI bar (fixed bottom-5, ~46px
            tall), so the two never overlap. */}
        <div className="absolute bottom-[4.75rem] left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border bg-card/90 px-1.5 py-1 text-xs shadow-lg backdrop-blur-sm">
          <button
            type="button"
            onClick={() => zoomFromCenter(-ZOOM_STEP)}
            className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Minus className="size-3.5" />
          </button>
          <span className="w-10 text-center tabular-nums text-foreground">{Math.round(view.zoom)}%</span>
          <button
            type="button"
            onClick={() => zoomFromCenter(ZOOM_STEP)}
            className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Plus className="size-3.5" />
          </button>
          <button
            type="button"
            title="Reset view and layout"
            onClick={() => {
              setView(DEFAULT_VIEW)
              setLayout(DEFAULT_LAYOUT)
            }}
            className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Maximize className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default MergeInfiniteCanvas
