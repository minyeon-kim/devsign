import { useEffect, useRef, useState } from 'react'
import { Columns2, Frame as FrameIcon, Minus, Plus } from 'lucide-react'
import { cn } from 'cn'
import { canvasPages, codeMergeVariants } from '@/data/mockData'
import { getFileIconMeta } from '@/lib/fileIcons'
import { tokenClassName, tokenizeLine } from '@/lib/syntaxHighlight'
import { useWorkspace } from '@/state/WorkspaceProvider'

const MIN_ZOOM = 50
const MAX_ZOOM = 150
const ZOOM_STEP = 10
const CODE_CARD_WIDTH = 320
const CODE_CARD_SLOT_HEIGHT = 360
const ARTBOARD_PREVIEW_WIDTH = 260
// Option B's own fixed accent — a simple, permanent visual reminder that
// it's a different variant, independent of whatever layer happens to be
// selected right now.
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

// A single file, positioned directly on the infinite canvas as its own
// compact "Code Card" — deliberately capped in size (word-wrapped content,
// a bounded max-height with its own internal scroll) rather than a
// full-screen editor block, so several of these plus the design artboards
// can all sit side by side on the same spatial layout. Its own "Diff"
// toggle swaps to the Code A/B comparison above, widening the card to fit.
function CodeCard({ itemId, file, x, y, highlightLine, isHighlightedFile, onSelectLine, highlightRef }) {
  const { getFileLines } = useWorkspace()
  const [diffMode, setDiffMode] = useState(false)
  const lines = getFileLines(file.id)
  const diffs = codeMergeVariants[itemId]?.[file.id]
  const { Icon, colorClass } = getFileIconMeta(file.name)

  return (
    <div
      className="absolute flex flex-col overflow-hidden rounded-2xl border bg-card shadow-lg"
      style={{ left: x, top: y, width: diffMode ? CODE_CARD_WIDTH * 1.8 : CODE_CARD_WIDTH }}
    >
      <div className="flex h-9 shrink-0 items-center gap-1.5 border-b bg-card px-3">
        <Icon className={cn('size-3.5 shrink-0', colorClass)} />
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{file.name}</span>
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
            file={file}
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
                  language={file.language}
                  highlighted={isHighlighted}
                  onClick={() => onSelectLine?.(file.id, lineNumber)}
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
// Compare tab and, for linked layers, the code sync.
function StaticLayer({ layer, accentClass, selected, onSelect }) {
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
    </div>
  )
}

// An artboard "card" — the frame previews at a fixed width regardless of
// its real size (scaled via CSS transform; layer positions stay untouched
// since they're relative to the scaled parent), so Mobile App's 280px-wide
// frame and Marketing Site's 480px-wide one both read at a consistent size
// on the canvas.
function StaticFrame({ frame, label, accentClass, x, y, selectedLayerId, onSelectLayer }) {
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
          {frame.layers.map((layer) => (
            <StaticLayer
              key={layer.id}
              layer={layer}
              accentClass={layer.type === 'button' ? accentClass : undefined}
              selected={selectedLayerId === layer.id}
              onSelect={() => onSelectLayer(layer.id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// The shared spatial workspace for a merge item — every code file and
// (when present) both design artboards render as independently-positioned
// cards on one pannable, zoomable dot-grid surface, instead of being split
// across fixed side-by-side panes. Panning is native scroll (drag the
// scrollbars or use a trackpad); zoom is the +/- control bottom-left,
// matching the real Canvas panel's own widget.
function MergeInfiniteCanvas({ item, files, syncSelection, onSelectLayer, onSelectLine }) {
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
  const artboardX = 40 + codeColumnWidth
  const artboardHeight = frame ? frame.height * (ARTBOARD_PREVIEW_WIDTH / frame.width) : 0
  const contentWidth = frame ? artboardX + ARTBOARD_PREVIEW_WIDTH * 2 + 80 : artboardX
  const contentHeight = Math.max(files.length * CODE_CARD_SLOT_HEIGHT + 40, artboardHeight + 80, 420)

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
            {files.map((file, i) => (
              <CodeCard
                key={file.id}
                itemId={item.id}
                file={file}
                x={40}
                y={40 + i * CODE_CARD_SLOT_HEIGHT}
                highlightLine={syncSelection?.line}
                isHighlightedFile={syncSelection?.fileId === file.id}
                onSelectLine={onSelectLine}
                highlightRef={highlightRef}
              />
            ))}

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
