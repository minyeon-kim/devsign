import { useCallback, useEffect, useRef, useState } from 'react'
import { Columns2, Frame as FrameIcon, GripHorizontal, Maximize, Minus, Plus, Sparkles } from 'lucide-react'
import { cn } from 'cn'
import { canvasPages, codeMergeVariants, designMergeVariants } from '@/data/mockData'
import { getFileIconMeta } from '@/lib/fileIcons'
import { tokenClassName, tokenizeLine } from '@/lib/syntaxHighlight'
import { useWorkspace } from '@/state/WorkspaceProvider'

const MIN_ZOOM = 25
const MAX_ZOOM = 200
const ZOOM_STEP = 10
const CODE_CARD_WIDTH = 320
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
      className="relative grid max-h-[300px] grid-cols-2 divide-x divide-border overflow-auto bg-background font-mono text-[11px] leading-relaxed"
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
                onClick={() => onSelectLine?.(file.id, lineNumber)}
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
                onClick={() => onSelectLine?.(file.id, lineNumber)}
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

// Every file belonging to the merge item, consolidated into *one* code
// window with its own internal file tabs — instead of one standalone card
// per file scattered down the canvas. Reverse sync (clicking a linked
// design layer) switches the active tab to that layer's file automatically.
// Its "Diff" toggle still swaps the active tab into the Code A/B comparison,
// widening the window to fit both columns.
function CodeWindowCard({ itemId, files, x, y, z, onDragStart, onClickCapture, hoverLine, hoverFileId, onHoverLine, linkedLines, highlightFileId, highlightLine, onSelectLine, highlightRef }) {
  const { getFileLines } = useWorkspace()
  const [activeFileId, setActiveFileId] = useState(files[0]?.id)
  const [diffMode, setDiffMode] = useState(false)

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

  const lines = getFileLines(activeFile.id)
  const diffs = codeMergeVariants[itemId]?.[activeFile.id]
  const { Icon, colorClass } = getFileIconMeta(activeFile.name)
  const isHighlightedFile = highlightFileId === activeFile.id

  return (
    <div
      className="absolute top-0 left-0 flex cursor-grab flex-col overflow-hidden rounded-2xl border bg-card shadow-lg will-change-transform active:cursor-grabbing"
      style={{
        transform: `translate(${x}px, ${y}px)`,
        zIndex: z,
        width: diffMode ? CODE_CARD_WIDTH * 1.8 : CODE_CARD_WIDTH,
      }}
      onPointerDown={onDragStart}
      onClickCapture={onClickCapture}
    >
      {files.length > 1 && (
        <div className="flex shrink-0 items-center gap-0.5 overflow-x-auto border-b bg-muted/30 px-1.5 pt-1.5">
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
                  active
                    ? 'bg-card text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <meta.Icon className={cn('size-3 shrink-0', meta.colorClass)} />
                <span className="max-w-[88px] truncate">{file.name}</span>
              </button>
            )
          })}
        </div>
      )}

      <div className="flex h-9 shrink-0 items-center gap-1.5 border-b bg-card px-3">
        <GripHorizontal className="size-3.5 shrink-0 text-muted-foreground/50" />
        <Icon className={cn('size-3.5 shrink-0', colorClass)} />
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{activeFile.name}</span>
        <button
          type="button"
          onClick={() => setDiffMode((v) => !v)}
          onPointerDown={(e) => e.stopPropagation()}
          title="Compare Code A vs Code B"
          className={cn(
            'flex size-6 shrink-0 items-center justify-center rounded-full transition-colors',
            diffMode
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          <Columns2 className="size-3.5" />
        </button>
      </div>

      <div style={{ maxHeight: 300 }}>
        {diffMode ? (
          <CodeDiffColumns
            file={activeFile}
            lines={lines}
            diffs={diffs}
            highlightLine={isHighlightedFile ? highlightLine : undefined}
            onSelectLine={onSelectLine}
            highlightRef={highlightRef}
            linkedLines={linkedLines}
            hoverLine={hoverLine}
            hoverFileId={hoverFileId}
            onHoverLine={onHoverLine}
          />
        ) : (
          <div
            data-code-scroll
            className="relative max-h-[300px] overflow-auto bg-background py-2 font-mono text-[11px] leading-relaxed"
          >
            {lines.map((line, i) => {
              const lineNumber = i + 1
              const isHighlighted = isHighlightedFile && highlightLine === lineNumber
              return (
                <CodeLine
                  key={i}
                  lineRef={isHighlighted ? highlightRef : undefined}
                  lineNumber={lineNumber}
                  text={line}
                  language={activeFile.language}
                  highlighted={isHighlighted}
                  onClick={() => onSelectLine?.(activeFile.id, lineNumber)}
                  linked={linkedLines?.has(`${activeFile.id}:${lineNumber}`)}
                  hovered={hoverFileId === activeFile.id && hoverLine === lineNumber}
                  onHover={(n) => onHoverLine?.(activeFile.id, n)}
                />
              )
            })}
          </div>
        )}
      </div>
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
function StaticLayer({ layer, accentClass, selected, aiPreview, onSelect, linked, hovered, onHover }) {
  const style = { left: layer.x, top: layer.y, width: layer.width, height: layer.height }

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
    content = <div className="h-full w-full rounded-lg border border-border bg-muted/40" />
  } else if (layer.type === 'avatar') {
    content = <div className="h-full w-full rounded-full bg-muted-foreground/30" />
  } else if (layer.type === 'button') {
    content = (
      <div
        className={cn(
          'flex h-full w-full items-center justify-center rounded-md text-xs font-medium text-primary-foreground',
          accentClass ?? 'bg-primary'
        )}
      >
        {layer.label ?? 'Button'}
      </div>
    )
  } else {
    content = <div className="h-full w-full rounded-sm bg-muted-foreground/25" />
  }

  return (
    <div
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
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
      {aiPreview && (
        <span
          title="AI-suggested live preview"
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
function StaticFrame({ frame, label, accentClass, x, y, z, onDragStart, onClickCapture, linkedLayerIds, hoverLayerId, onHoverLayer, selectedLayerId, previewOverride, onSelectLayer, onSelectFrame }) {
  const scale = ARTBOARD_PREVIEW_WIDTH / frame.width

  return (
    <div
      className="absolute top-0 left-0 cursor-grab will-change-transform active:cursor-grabbing"
      style={{ transform: `translate(${x}px, ${y}px)`, zIndex: z, width: ARTBOARD_PREVIEW_WIDTH }}
      onPointerDown={onDragStart}
      onClickCapture={onClickCapture}
    >
      <p
        className="mb-1.5 flex items-center gap-1 rounded-full bg-card/90 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground active:cursor-grabbing"
      >
        <GripHorizontal className="size-3 shrink-0 text-muted-foreground/50" />
        {label}
      </p>
      <div
        onClick={onSelectFrame}
        className="overflow-hidden rounded-md border border-border bg-card shadow-lg"
        style={{ width: ARTBOARD_PREVIEW_WIDTH, height: frame.height * scale }}
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
            const isAiPreview = layer.type === 'button' && previewOverride?.layerId === layer.id
            return (
              <StaticLayer
                key={layer.id}
                layer={layer}
                accentClass={
                  layer.type === 'button'
                    ? isAiPreview
                      ? previewOverride.className
                      : accentClass
                    : undefined
                }
                selected={selectedLayerId === layer.id}
                linked={linkedLayerIds?.has(layer.id)}
                hovered={hoverLayerId === layer.id}
                onHover={onHoverLayer}
                aiPreview={isAiPreview}
                onSelect={() => onSelectLayer(layer.id)}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

// World-space default positions. The code window is at most
// CODE_CARD_WIDTH * 1.8 wide (diff mode), so artboards start past that and
// nothing overlaps out of the box; after that every card is freely
// draggable.
const CODE_DIFF_WIDTH = CODE_CARD_WIDTH * 1.8
const DEFAULT_LAYOUT = {
  code: { x: 0, y: 0 },
  a: { x: CODE_DIFF_WIDTH + 60, y: 0 },
  b: { x: CODE_DIFF_WIDTH + 60 + ARTBOARD_PREVIEW_WIDTH + 40, y: 0 },
}
const DEFAULT_VIEW = { x: CONTENT_START_X, y: 40, zoom: 100 }

function clampZoom(z) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))
}

// The shared spatial workspace for a merge item — a true infinite canvas.
// Content lives in "world" coordinates under one transform (`view`): drag
// the empty dot-grid to pan, scroll/trackpad to pan, pinch or Ctrl/Cmd +
// scroll to zoom toward the cursor. The unified code window and both
// artboards are independently draggable by their header/label grips, so
// users can lay them out anywhere. Clicking any card content reports up so
// the workspace can open the floating Block Deck.
function MergeInfiniteCanvas({
  item,
  files,
  syncSelection,
  appliedPreset,
  onSelectLayer,
  onSelectLine,
  onSelectFrame,
}) {
  const [view, setView] = useState(DEFAULT_VIEW)
  const [layout, setLayout] = useState(DEFAULT_LAYOUT)
  const [panning, setPanning] = useState(false)
  const [hover, setHover] = useState(null) // { layerId, fileId, line }
  const [order, setOrder] = useState({ code: 1, a: 2, b: 3 })
  const suppressClick = useRef(false)
  const viewportRef = useRef(null)
  const viewRef = useRef(view)
  useEffect(() => {
    viewRef.current = view
  }, [view])
  const highlightRef = useRef(null)
  const page = item.hasDesign ? canvasPages.find((p) => p.id === item.designPageId) : null
  const frame = page?.frames[0]

  useEffect(() => {
    setView(DEFAULT_VIEW)
    setLayout(DEFAULT_LAYOUT)
    setHover(null)
  }, [item?.id])

  // Bidirectional link data: which layers / code lines have a partner, so
  // both sides can be marked and lit up together on hover or selection.
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

  // Reverse sync: scroll the code window's own scroller (not the canvas —
  // scrollIntoView would try to scroll the transformed viewport too).
  useEffect(() => {
    const el = highlightRef.current
    const scroller = el?.closest('[data-code-scroll]')
    if (!el || !scroller) return
    scroller.scrollTo({ top: el.offsetTop - scroller.clientHeight / 2, behavior: 'smooth' })
  }, [syncSelection?.fileId, syncSelection?.line])

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
    const start = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }
    setPanning(true)
    function onMove(m) {
      setView((v) => ({ ...v, x: start.vx + m.clientX - start.x, y: start.vy + m.clientY - start.y }))
    }
    function onUp() {
      setPanning(false)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // Cards drag from anywhere on their surface (header or body). A 4px
  // threshold separates a drag from a click, so buttons, code lines and
  // layers still click normally; the click that ends a real drag is
  // swallowed. Position is a transform, and the dragged card is raised.
  function startCardDrag(key) {
    return (e) => {
      if (e.button !== 0) return
      if (e.target.closest('button, input, [data-code-scroll]')) return
      e.stopPropagation()
      const start = { x: e.clientX, y: e.clientY, ...layout[key] }
      let moved = false
      setOrder((o) => ({ ...o, [key]: Math.max(...Object.values(o)) + 1 }))
      function onMove(m) {
        const dx = m.clientX - start.x
        const dy = m.clientY - start.y
        if (!moved && Math.hypot(dx, dy) < 4) return
        moved = true
        const scale = viewRef.current.zoom / 100
        setLayout((l) => ({ ...l, [key]: { x: start.x + dx / scale, y: start.y + dy / scale } }))
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

  const previewOverride =
    syncSelection?.layerId && appliedPreset
      ? { layerId: syncSelection.layerId, className: appliedPreset.previewClass }
      : undefined

  const scale = view.zoom / 100
  const gridSize = 18 * scale

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-card">
      <div className="flex h-9 shrink-0 items-center gap-1.5 border-b bg-card px-3 pl-[19rem] text-xs font-medium text-foreground">
        <FrameIcon className="size-3.5 shrink-0 text-primary" />
        Merge Canvas
      </div>

      <div className="relative min-h-0 flex-1">
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
                  z={order.code}
                  onDragStart={startCardDrag('code')}
                  onClickCapture={swallowDragClick}
                  linkedLines={linkedLines}
                  hoverLine={hover?.line}
                  hoverFileId={hover?.fileId}
                  onHoverLine={hoverLine}
                  highlightFileId={syncSelection?.fileId}
                  highlightLine={syncSelection?.line}
                  onSelectLine={onSelectLine}
                  highlightRef={highlightRef}
                />
              )}

              {frame && (
                <>
                  <StaticFrame
                    frame={frame}
                    label="Option A · Current"
                    x={layout.a.x}
                    y={layout.a.y}
                    z={order.a}
                    onDragStart={startCardDrag('a')}
                    onClickCapture={swallowDragClick}
                    linkedLayerIds={linkedLayerIds}
                    hoverLayerId={hover?.layerId}
                    onHoverLayer={hoverLayer}
                    selectedLayerId={syncSelection?.layerId}
                    onSelectLayer={onSelectLayer}
                    onSelectFrame={onSelectFrame}
                  />
                  <StaticFrame
                    frame={frame}
                    label="Option B · Incoming"
                    accentClass={OPTION_B_ACCENT}
                    x={layout.b.x}
                    y={layout.b.y}
                    z={order.b}
                    onDragStart={startCardDrag('b')}
                    onClickCapture={swallowDragClick}
                    linkedLayerIds={linkedLayerIds}
                    hoverLayerId={hover?.layerId}
                    onHoverLayer={hoverLayer}
                    selectedLayerId={syncSelection?.layerId}
                    previewOverride={previewOverride}
                    onSelectLayer={onSelectLayer}
                    onSelectFrame={onSelectFrame}
                  />
                </>
              )}
            </div>
          </div>
        </div>

        <div className="absolute bottom-3 left-[19rem] z-20 flex items-center gap-1 rounded-full border bg-card/90 px-1.5 py-1 text-xs shadow-lg backdrop-blur-sm">
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
