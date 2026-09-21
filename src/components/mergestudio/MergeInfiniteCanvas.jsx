import { useEffect, useRef, useState } from 'react'
import { Columns2, Frame as FrameIcon, Minus, Plus, Sparkles } from 'lucide-react'
import { cn } from 'cn'
import { canvasPages, codeMergeVariants } from '@/data/mockData'
import { getFileIconMeta } from '@/lib/fileIcons'
import { tokenClassName, tokenizeLine } from '@/lib/syntaxHighlight'
import { useWorkspace } from '@/state/WorkspaceProvider'

const MIN_ZOOM = 50
const MAX_ZOOM = 150
const ZOOM_STEP = 10
const CODE_CARD_WIDTH = 320
// How far right content starts, so it clears the floating Merge List panel
// (w-72 anchored left-4) docked over the same canvas surface instead of
// pushing it in a fixed layout column.
const CONTENT_START_X = 320
const ARTBOARD_PREVIEW_WIDTH = 260
// Option B's own fixed accent — a simple, permanent visual reminder that
// it's a different variant, independent of whatever layer happens to be
// selected right now, unless an AI Block Deck suggestion is actively
// previewing on that exact layer (see `previewOverride`).
const OPTION_B_ACCENT = 'bg-violet-500'

function CodeLine({ lineNumber, text, language, highlighted, accentClass, onClick, lineRef }) {
  const tokens = tokenizeLine(text, language)
  return (
    <div
      ref={lineRef}
      onClick={onClick}
      className={cn(
        'flex cursor-pointer gap-3 border-l-2 border-transparent px-3 hover:bg-muted/40',
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
function CodeDiffColumns({ file, lines, diffs, highlightLine, onSelectLine, highlightRef }) {
  const diffByLine = new Map((diffs ?? []).map((d) => [d.line, d.incoming]))

  return (
    <div className="grid grid-cols-2 divide-x divide-border overflow-auto bg-background font-mono text-[11px] leading-relaxed">
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
function CodeWindowCard({ itemId, files, x, y, highlightFileId, highlightLine, onSelectLine, highlightRef }) {
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
      className="absolute flex flex-col overflow-hidden rounded-2xl border bg-card shadow-lg"
      style={{ left: x, top: y, width: diffMode ? CODE_CARD_WIDTH * 1.8 : CODE_CARD_WIDTH }}
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
        <Icon className={cn('size-3.5 shrink-0', colorClass)} />
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{activeFile.name}</span>
        <button
          type="button"
          onClick={() => setDiffMode((v) => !v)}
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
          />
        ) : (
          <div className="max-h-[300px] overflow-auto bg-background py-2 font-mono text-[11px] leading-relaxed">
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
function StaticLayer({ layer, accentClass, selected, aiPreview, onSelect }) {
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
      onClick={onSelect}
      className={cn(
        'absolute cursor-pointer',
        selected && 'outline outline-2 outline-offset-1 outline-primary'
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
function StaticFrame({ frame, label, accentClass, x, y, selectedLayerId, previewOverride, onSelectLayer }) {
  const scale = ARTBOARD_PREVIEW_WIDTH / frame.width

  return (
    <div className="absolute" style={{ left: x, top: y, width: ARTBOARD_PREVIEW_WIDTH }}>
      <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">{label}</p>
      <div
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

// The shared spatial workspace for a merge item — the unified code window
// and (when present) both design artboards render as independently-
// positioned cards on one pannable, zoomable dot-grid surface, instead of
// being split across fixed side-by-side panes. Panning is native scroll
// (drag the scrollbars or use a trackpad); zoom is the +/- control
// bottom-left, matching the real Canvas panel's own widget. Content starts
// past `CONTENT_START_X` so it clears the floating Merge List panel docked
// over this same canvas's top-left corner.
function MergeInfiniteCanvas({ item, files, syncSelection, appliedPreset, onSelectLayer, onSelectLine }) {
  const [zoom, setZoom] = useState(100)
  const highlightRef = useRef(null)
  const page = item.hasDesign ? canvasPages.find((p) => p.id === item.designPageId) : null
  const frame = page?.frames[0]

  useEffect(() => {
    setZoom(100)
  }, [item?.id])

  useEffect(() => {
    highlightRef.current?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' })
  }, [syncSelection?.fileId, syncSelection?.line])

  const codeColumnWidth = CODE_CARD_WIDTH + 80
  const artboardX = CONTENT_START_X + codeColumnWidth
  const artboardHeight = frame ? frame.height * (ARTBOARD_PREVIEW_WIDTH / frame.width) : 0
  const contentWidth = frame ? artboardX + ARTBOARD_PREVIEW_WIDTH * 2 + 80 : artboardX
  const contentHeight = Math.max(artboardHeight + 80, 420)

  const previewOverride =
    syncSelection?.layerId && appliedPreset
      ? { layerId: syncSelection.layerId, className: appliedPreset.previewClass }
      : undefined

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex h-9 shrink-0 items-center gap-1.5 border-b bg-card px-3 text-xs font-medium text-foreground">
        <FrameIcon className="size-3.5 shrink-0 text-primary" />
        Merge Canvas
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          className="h-full overflow-auto"
          style={{
            backgroundImage:
              'radial-gradient(color-mix(in oklch, var(--foreground) 14%, transparent) 1px, transparent 1px)',
            backgroundSize: '18px 18px',
          }}
        >
          <div
            className="relative"
            style={{
              width: contentWidth,
              height: contentHeight,
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top left',
            }}
          >
            {files.length > 0 && (
              <CodeWindowCard
                itemId={item.id}
                files={files}
                x={CONTENT_START_X}
                y={40}
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
                  x={artboardX}
                  y={40}
                  selectedLayerId={syncSelection?.layerId}
                  onSelectLayer={onSelectLayer}
                />
                <StaticFrame
                  frame={frame}
                  label="Option B · Incoming"
                  accentClass={OPTION_B_ACCENT}
                  x={artboardX + ARTBOARD_PREVIEW_WIDTH + 40}
                  y={40}
                  selectedLayerId={syncSelection?.layerId}
                  previewOverride={previewOverride}
                  onSelectLayer={onSelectLayer}
                />
              </>
            )}
          </div>
        </div>

        {/* A sibling of the scrollable surface (not a child of it), so it
            stays pinned to the same corner of the viewport regardless of
            pan/scroll position — matching the real Canvas panel's own zoom
            widget. */}
        <div className="absolute bottom-3 left-3 z-20 flex items-center gap-1 rounded-full border bg-card/90 px-1.5 py-1 text-xs shadow-lg backdrop-blur-sm">
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

export default MergeInfiniteCanvas
