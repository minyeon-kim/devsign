import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowUp, Check, GitMerge, GripHorizontal, Maximize, Minus, Pencil, Plus, Sparkles, Trash2, X } from 'lucide-react'
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

function CodeLine({ lineNumber, lineKey, text, language, highlighted, accentClass, onClick, lineRef, linked, hovered, onHover }) {
  const tokens = tokenizeLine(text, language)
  return (
    <div
      ref={lineRef}
      data-code-line={lineKey}
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
function CodeDiffColumns({ incomingEdits, file, lines, diffs, highlightLine, onSelectLine, highlightRef, linkedLines, hoverLine, hoverFileId, onHoverLine }) {
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
                lineKey={`${file.id}:${lineNumber}`}
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
            const incoming = incomingEdits?.[`${file.id}:${lineNumber}`] ?? diffByLine.get(lineNumber)
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
function CodeWindowCard({ incomingEdits, itemId, files, x, y, w, h, z, onDragStart, onResizeStart, onClickCapture, hoverLine, hoverFileId, onHoverLine, linkedLines, highlightFileId, highlightLine, onSelectLine, highlightRef }) {
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
        incomingEdits={incomingEdits}
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
function StaticFrame({ frameKey, frame, label, accentClass, x, y, w, h, z, onDragStart, onResizeStart, onClickCapture, linkedLayerIds, hoverLayerId, onHoverLayer, selectedLayerId, overrides, onSelectLayer, onSelectFrame }) {
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
        data-frame-box
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
            const o = overrides?.[layer.id]
            const override = o
              ? { ...o, className: o.className ?? (layer.type === 'button' ? accentClass : undefined) }
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

// Gap between cards — wide enough that a connector's label pill fits
// entirely in the empty space between two card edges.
const CARD_GAP = 140

// Sizes are in world units. Artboards leave w/h null until first resized
// (they then derive their height from the frame's aspect ratio).
const DEFAULT_LAYOUT = {
  code: { x: 0, y: 0, w: CODE_DIFF_WIDTH, h: 380 },
  a: { x: CODE_DIFF_WIDTH + CARD_GAP, y: 0, w: null, h: null },
  b: { x: CODE_DIFF_WIDTH + CARD_GAP + ARTBOARD_PREVIEW_WIDTH + CARD_GAP, y: 0, w: null, h: null },
}
const DEFAULT_VIEW = { x: CONTENT_START_X, y: 40, zoom: 100 }

function clampZoom(z) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))
}

// Organic mind-map style link between two screen-space anchors: a smooth
// cubic that leaves/enters horizontally, optionally arched by `lift` so
// neighbouring nodes still get a visible curve. Also returns the curve's
// midpoint (t = 0.5) where the branch label sits.
function linkGeometry(from, to, lift = 0) {
  const dir = Math.sign(to.x - from.x) || 1
  const dx = Math.max(48, Math.abs(to.x - from.x) / 2) * dir
  const c1 = { x: from.x + dx, y: from.y - lift }
  const c2 = { x: to.x - dx, y: to.y - lift }
  return {
    d: `M ${from.x} ${from.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${to.x} ${to.y}`,
    mid: { x: (from.x + 3 * c1.x + 3 * c2.x + to.x) / 8, y: (from.y + 3 * c1.y + 3 * c2.y + to.y) / 8 },
    from,
    to,
  }
}

const GLOW_CLASS = 'shadow-[0_0_16px_4px_color-mix(in_oklch,var(--primary)_65%,transparent)]'

// Mock "AI": turns an annotation note into a restyle. Recognises a few
// color / shape / size words (English + Korean); anything else falls back
// to the indigo → violet gradient so a note always produces a visible,
// reviewable change.
function interpretAnnotation(text) {
  const t = text.toLowerCase()
  const effect = {}
  const notes = []
  const colors = [
    [/violet|purple|보라/, 'bg-violet-500', 'violet fill'],
    [/indigo|인디고/, 'bg-indigo-500', 'indigo fill'],
    [/green|emerald|초록/, 'bg-emerald-500', 'green fill'],
    [/red|rose|빨강/, 'bg-rose-500', 'rose fill'],
    [/amber|yellow|orange|노랑|주황/, 'bg-amber-500', 'amber fill'],
    [/gradient|그라데이션/, 'bg-gradient-to-r from-indigo-500 to-violet-500', 'indigo → violet gradient'],
  ]
  const color = colors.find(([re]) => re.test(t))
  if (color) {
    effect.className = color[1]
    notes.push(color[2])
  }
  if (/glow|neon|글로우/.test(t)) {
    effect.className = `${effect.className ?? 'bg-primary'} ${GLOW_CLASS}`
    notes.push('glow')
  }
  if (/round|pill|radius|둥근|둥글/.test(t)) {
    effect.radius = 999
    notes.push('pill radius')
  }
  if (/bigger|larger|increase|padding|spacing|크게|여백|간격/.test(t)) {
    effect.dw = 24
    effect.dh = 12
    notes.push('more room')
  } else if (/smaller|shrink|compact|작게/.test(t)) {
    effect.dw = -16
    effect.dh = -8
    notes.push('tighter size')
  }
  if (!notes.length) {
    effect.className = 'bg-gradient-to-r from-indigo-500 to-violet-500'
    notes.push('refreshed accent')
  }
  return { effect, summary: `Applied ${notes.join(', ')}` }
}

// One element, two states: a small sparkle circle *below* the clicked
// element that widens (width + radius transition) into the "AI Edit"
// prompt pill when clicked. Enter submits the prompt as an annotation.
function AiEditMorph({ left, top, expanded, label, onExpand, onSubmit, onClose }) {
  const [text, setText] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (!expanded) return
    const id = setTimeout(() => inputRef.current?.focus(), 180)
    return () => clearTimeout(id)
  }, [expanded])

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
      style={{ left, top, width: expanded ? 320 : 36 }}
      className={cn(
        'absolute z-30 flex h-9 items-center overflow-hidden rounded-full border p-[3px] shadow-2xl backdrop-blur-md transition-[width,border-color,background-color] duration-300 ease-out',
        expanded
          ? 'border-indigo-500/50 bg-card/95 shadow-indigo-500/20 focus-within:border-violet-500'
          : 'border-transparent bg-transparent shadow-indigo-500/40'
      )}
    >
      <button
        type={expanded ? 'button' : 'submit'}
        onClick={(e) => {
          if (!expanded) {
            e.preventDefault()
            onExpand()
          }
        }}
        title={expanded ? undefined : 'Edit with AI'}
        className="flex size-[28px] shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white transition-transform hover:scale-105"
      >
        <Sparkles className="size-3.5" />
      </button>
      <span
        className={cn(
          'shrink-0 pl-2 text-[11px] font-semibold whitespace-nowrap text-foreground transition-opacity duration-200',
          expanded ? 'opacity-100 delay-100' : 'pointer-events-none opacity-0'
        )}
      >
        AI Edit
      </span>
      <input
        ref={inputRef}
        tabIndex={expanded ? 0 : -1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`Describe a change to ${label}…`}
        className={cn(
          'min-w-0 flex-1 bg-transparent px-2 text-xs text-foreground outline-none placeholder:text-muted-foreground transition-opacity duration-200',
          expanded ? 'opacity-100 delay-100' : 'pointer-events-none opacity-0'
        )}
      />
      <button
        type="submit"
        disabled={!text.trim()}
        title="Apply"
        className={cn(
          'flex size-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white transition-opacity disabled:opacity-40',
          !expanded && 'pointer-events-none opacity-0'
        )}
      >
        <ArrowUp className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={onClose}
        title="Close"
        className={cn(
          'ml-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground',
          !expanded && 'pointer-events-none opacity-0'
        )}
      >
        <X className="size-3.5" />
      </button>
    </form>
  )
}

// Editable note popover. The input is the note itself: edit and press
// Enter / Save to re-run the AI on the new text; the trash button removes
// the annotation (and reverts what the AI changed for it). Keyed by the
// saved text so the draft resets whenever the annotation updates.
function NotePopover({ annotation, onSave, onDelete, onClose }) {
  const [draft, setDraft] = useState(annotation.text)
  const thinking = annotation.status === 'thinking'
  const pending = annotation.status === 'pending'
  const dirty = draft.trim() !== '' && draft.trim() !== annotation.text

  function submit(e) {
    e.preventDefault()
    if (dirty) onSave(draft.trim())
  }

  return (
    <form
      onSubmit={submit}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      className="w-60 rounded-2xl border border-indigo-500/40 bg-card/95 p-2.5 text-[11px] shadow-2xl backdrop-blur-md"
    >
      <div className="flex items-center gap-1.5">
        <Pencil className="size-3 shrink-0 text-muted-foreground" />
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="min-w-0 flex-1 rounded-full bg-muted/60 px-2.5 py-1 text-foreground outline-none focus:ring-1 focus:ring-violet-500"
        />
        <button
          type="button"
          onClick={onDelete}
          title="Delete annotation"
          className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={onClose}
          title="Close"
          className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        <p
          className={cn(
            'flex min-w-0 flex-1 items-center gap-1 rounded-full bg-muted px-2 py-1 text-[10px] font-medium',
            thinking || pending ? 'text-muted-foreground' : 'text-violet-500'
          )}
        >
          <Sparkles className={cn('size-3 shrink-0', thinking && 'animate-pulse')} />
          <span className="truncate">
            {thinking ? 'AI is updating design & code…' : pending ? 'Waiting — use Apply with AI' : annotation.summary}
          </span>
        </p>
        <button
          type="submit"
          disabled={!dirty}
          className="shrink-0 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-2.5 py-1 text-[10px] font-semibold text-white transition-opacity disabled:opacity-40"
        >
          Save
        </button>
      </div>
    </form>
  )
}

// A numbered annotation pin pinned to an element; clicking it toggles the
// editable note popover.
function AnnotationPin({ pin, annotation, open, onToggle, onSave, onDelete }) {
  return (
    <>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onToggle}
        style={{ left: pin.x - 10, top: pin.y - 10 }}
        className={cn(
          'absolute z-30 flex size-5 items-center justify-center rounded-full rounded-bl-none text-[10px] font-bold text-white shadow-lg ring-2 ring-card',
          annotation.status === 'pending'
            ? 'bg-slate-700 ring-violet-500'
            : 'bg-gradient-to-r from-indigo-500 to-violet-500'
        )}
      >
        {pin.n}
      </button>
      {open && (
        <div style={{ left: pin.x + 14, top: pin.y - 6 }} className="absolute z-30">
          <NotePopover
            key={`${annotation.id}:${annotation.text}`}
            annotation={annotation}
            onSave={onSave}
            onDelete={onDelete}
            onClose={onToggle}
          />
        </div>
      )}
    </>
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
  reserve,
  resolutionCount,
  merged,
  onMerge,
  onSelectLayer,
  onSelectLine,
  onSelectFrame,
}) {
  const { getFileLines } = useWorkspace()
  const [view, setView] = useState(DEFAULT_VIEW)
  const [layout, setLayout] = useState(DEFAULT_LAYOUT)
  const [panning, setPanning] = useState(false)
  const [hover, setHover] = useState(null) // { layerId, fileId, line }
  const [order, setOrder] = useState({ code: 1, a: 2, b: 3 })
  const [frameSel, setFrameSel] = useState(null) // 'a' | 'b'
  const [aiStage, setAiStage] = useState(null) // null | 'badge' | 'prompt'
  const [annotations, setAnnotations] = useState([])
  const [openNote, setOpenNote] = useState(null)
  const [links, setLinks] = useState({ paths: [], anchor: null, pins: [] })
  const anchorMetaRef = useRef({})
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

  // Zoom/pan so the whole card row sits inside the visible canvas (right of
  // the Merge List, left of any docked Block Deck) with breathing room.
  function fitView(lay) {
    const c = containerRef.current
    if (!c) return DEFAULT_VIEW
    const rect = c.getBoundingClientRect()
    const artW = (k) => lay[k].w ?? ARTBOARD_PREVIEW_WIDTH
    const right = frame ? Math.max(lay.code.x + lay.code.w, lay.a.x + artW('a'), lay.b.x + artW('b')) : lay.code.x + lay.code.w
    const worldW = right - lay.code.x
    const artH = frame ? 30 + (frame.height * ARTBOARD_PREVIEW_WIDTH) / frame.width : 0
    const worldH = Math.max(lay.code.h, artH)
    const availW = rect.width - CONTENT_START_X - 32 - reserve
    const availH = rect.height - 150
    const zoom = clampZoom(Math.floor(Math.min(1, availW / worldW, availH / worldH) * 100))
    const k = zoom / 100
    return { zoom, x: CONTENT_START_X + Math.max(0, (availW - worldW * k) / 2) - lay.code.x * k, y: 32 }
  }

  useEffect(() => {
    setView(fitView(DEFAULT_LAYOUT))
    setLayout(DEFAULT_LAYOUT)
    setHover(null)
    setFrameSel(null)
    setAiStage(null)
    setAnnotations([])
    setOpenNote(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id])

  // When the (overlay) Block Deck opens over its default spot, refit if it
  // would cover the rightmost artboard; otherwise leave the user's pan alone.
  useEffect(() => {
    const c = containerRef.current
    if (!c) return
    const width = c.getBoundingClientRect().width
    const bw = layout.b.w ?? ARTBOARD_PREVIEW_WIDTH
    const right = viewRef.current.x + (layout.b.x + bw) * (viewRef.current.zoom / 100)
    if (frame && right > width - reserve - 24) setView(fitView(layout))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reserve])

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
    anchorMetaRef.current = { kind: 'layer', frameKey: el.closest('[data-frame-key]')?.dataset.frameKey }
    setFrameSel(null)
    setAiStage('badge')
    onSelectLayer(layerId)
  }
  function pickLine(fileId, line, el) {
    anchorElRef.current = el
    anchorMetaRef.current = { kind: 'line' }
    setFrameSel(null)
    setAiStage('badge')
    onSelectLine(fileId, line)
  }
  function pickFrame(key, el) {
    anchorElRef.current = el
    anchorMetaRef.current = { kind: 'frame', frameKey: key }
    setFrameSel(key)
    setAiStage('badge')
    onSelectFrame()
  }

  // Click-to-annotate: the note becomes a pin on the element; the (mock)
  // AI interprets it after a short "thinking" beat and stores its result on
  // the annotation. Option B restyles and Code B rewrites are *derived*
  // from the annotation list (see `edits` / `codeEdits` below), so editing
  // a note re-derives them and deleting one cleanly reverts its changes.
  function runAi(id, text, delay = 800) {
    setTimeout(() => {
      const { effect, summary } = interpretAnnotation(text)
      setAnnotations((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'done', effect, summary } : a)))
    }, delay)
  }

  // "Apply with AI": processes every not-yet-applied note in one go
  // (staggered slightly so the changes visibly land one after another).
  const pendingCount = annotations.filter((a) => a.status === 'pending').length
  function applyAll() {
    const pending = annotations.filter((a) => a.status === 'pending')
    if (!pending.length) return
    setAnnotations((prev) => prev.map((a) => (a.status === 'pending' ? { ...a, status: 'thinking' } : a)))
    pending.forEach((a, i) => runAi(a.id, a.text, 700 + i * 350))
  }

  function submitAnnotation(text) {
    const meta = anchorMetaRef.current
    const layerId = syncSelection?.layerId
    const id = `ann-${Date.now()}`
    const targets = layerId
      ? [layerId]
      : meta.kind === 'frame'
        ? (frame?.layers.filter((l) => l.type === 'button').map((l) => l.id) ?? [])
        : []
    const codeTarget =
      layerId && layerCodeMap[layerId]
        ? layerCodeMap[layerId]
        : syncSelection?.fileId && syncSelection?.line
          ? { fileId: syncSelection.fileId, line: syncSelection.line }
          : null

    setAnnotations((prev) => [
      ...prev,
      { id, text, status: 'pending', summary: '', effect: null, kind: meta.kind, frameKey: meta.frameKey, layerId, targets, ...codeTarget },
    ])
    setOpenNote(id)
    setAiStage(null)
  }

  function saveAnnotation(id, text) {
    setAnnotations((prev) => prev.map((a) => (a.id === id ? { ...a, text, status: 'pending' } : a)))
  }

  function deleteAnnotation(id) {
    setAnnotations((prev) => prev.filter((a) => a.id !== id))
    setOpenNote(null)
  }

  const edits = {}
  const codeEdits = {}
  for (const a of annotations) {
    if (!a.effect) continue
    for (const t of a.targets ?? []) {
      const prev = edits[t]
      edits[t] = {
        ...prev,
        ...(a.effect.className && { className: a.effect.className }),
        ...(a.effect.radius !== undefined && { radius: a.effect.radius }),
        dw: (prev?.dw ?? 0) + (a.effect.dw ?? 0),
        dh: (prev?.dh ?? 0) + (a.effect.dh ?? 0),
      }
    }
    if (a.fileId && a.line) {
      const original = getFileLines(a.fileId)[a.line - 1] ?? ''
      const incoming = codeMergeVariants[item.id]?.[a.fileId]?.find((d) => d.line === a.line)?.incoming ?? original
      codeEdits[`${a.fileId}:${a.line}`] = `${incoming.replace(/\s*\/\/ AI:.*$/, '')}  // AI: ${a.summary}`
    }
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

  // Connectors, the AI-edit anchor, and annotation pins are measured from
  // the live DOM every frame while any of them exist, so they track
  // panning, zooming, card dragging/resizing and the code scroller without
  // bookkeeping. State only updates when the result actually changes.
  useEffect(() => {
    if (!hasSelection && annotations.length === 0) {
      setLinks((prev) => (prev.paths.length || prev.anchor || prev.pins.length ? { paths: [], anchor: null, pins: [] } : prev))
      return
    }
    let raf
    function measure() {
      const container = containerRef.current
      const base = container?.getBoundingClientRect()
      if (base) {
        const rel = (r) => ({ left: r.left - base.left, right: r.right - base.left, top: r.top - base.top, bottom: r.bottom - base.top })
        const find = (sel) => container.querySelector(sel)
        const paths = []
        const codeEl = find('[data-card="code"]')

        if (hasSelection) {
          // Links attach to the *card edges* (never inside a card), at the
          // height of the selected element clamped to the card's body, so
          // curves run through the empty gap between cards only.
          const layerId = syncSelection?.layerId
          const boxOf = (fk) => find(`[data-frame-key="${fk}"] [data-frame-box]`)
          const markOf = (fk) => (layerId ? find(`[data-frame-key="${fk}"] [data-layer-id="${layerId}"]`) : null)
          const clampY = (y, r) => Math.min(Math.max(y, r.top + 14), r.bottom - 14)
          const yFor = (fk, r) => {
            const m = markOf(fk)
            if (!m) return (r.top + r.bottom) / 2
            const mr = rel(m.getBoundingClientRect())
            return clampY((mr.top + mr.bottom) / 2, r)
          }
          const boxA = boxOf('a')
          const boxB = boxOf('b')
          const rA = boxA && rel(boxA.getBoundingClientRect())
          const rB = boxB && rel(boxB.getBoundingClientRect())

          // Code -> Option A ("Code changes"): leaves the code card at the
          // highlighted line's height.
          if (codeEl && rA) {
            const code = rel(codeEl.getBoundingClientRect())
            const toRight = rA.left >= code.right
            const toLeft = rA.right <= code.left
            if (toRight || toLeft) {
              const lineEl = highlightRef.current
              const lineRect = lineEl?.isConnected ? rel(lineEl.getBoundingClientRect()) : null
              const lineY = lineRect ? (lineRect.top + lineRect.bottom) / 2 : (code.top + code.bottom) / 2
              const from = { x: toRight ? code.right : code.left, y: clampY(lineY, code) }
              const to = { x: toRight ? rA.left : rA.right, y: yFor('a', rA) }
              paths.push({
                ...linkGeometry(from, to, Math.abs(from.y - to.y) < 20 ? 24 : 0),
                label: 'Code changes',
                gap: toRight ? rA.left - code.right : code.left - rA.right,
              })
            }
          }
          // Option A -> Option B ("Design changes").
          if (rA && rB) {
            const forward = rB.left >= rA.right
            const backward = rB.right <= rA.left
            if (forward || backward) {
              const from = { x: forward ? rA.right : rA.left, y: yFor('a', rA) }
              const to = { x: forward ? rB.left : rB.right, y: yFor('b', rB) }
              paths.push({
                ...linkGeometry(from, to, Math.abs(from.y - to.y) < 20 ? 24 : 0),
                label: 'Design changes',
                gap: forward ? rB.left - rA.right : rA.left - rB.right,
              })
            }
          }
        }

        let anchor = null
        const el = anchorElRef.current
        if (hasSelection && el?.isConnected) {
          const r = rel(el.getBoundingClientRect())
          anchor = { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom), w: Math.round(base.width), h: Math.round(base.height) }
        }

        const pins = []
        annotations.forEach((a, i) => {
          const sel =
            a.kind === 'layer' && a.layerId
              ? `[data-frame-key="${a.frameKey}"] [data-layer-id="${a.layerId}"]`
              : a.kind === 'frame'
                ? `[data-frame-key="${a.frameKey}"]`
                : a.fileId
                  ? `[data-code-line="${a.fileId}:${a.line}"]`
                  : null
          const target = sel && find(sel)
          if (!target) return
          const r = rel(target.getBoundingClientRect())
          pins.push({ id: a.id, n: i + 1, x: Math.round(r.left), y: Math.round(r.top) })
        })

        const next = { paths, anchor, pins }
        setLinks((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
      }
      raf = requestAnimationFrame(measure)
    }
    raf = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(raf)
  }, [hasSelection, selectionKey, syncSelection?.layerId, frameSel, annotations])

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
    setOpenNote(null)
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

  // Option B's per-layer overrides: committed AI annotation edits, with the
  // selected layer's Variant Compare choice/hover and any applied AI preset
  // layered on top (preset fill > variant fill > annotation fill).
  const overrides = { ...edits }
  const selId = syncSelection?.layerId
  if (selId && (variantPreview || appliedPreset)) {
    const base = edits[selId]
    overrides[selId] = {
      ...base,
      radius: variantPreview?.radius ?? base?.radius,
      dw: (base?.dw ?? 0) + (variantPreview?.dw ?? 0),
      dh: (base?.dh ?? 0) + (variantPreview?.dh ?? 0),
      className: appliedPreset?.previewClass ?? variantPreview?.className ?? base?.className,
    }
  }

  const scale = view.zoom / 100
  const gridSize = 18 * scale

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-card">
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
                  incomingEdits={codeEdits}
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
                    overrides={overrides}
                    onSelectLayer={pickLayer}
                    onSelectFrame={pickFrame}
                  />
                </>
              )}
            </div>
          </div>
        </div>

        <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible">
          <defs>
            <linearGradient id="neon-link" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#bef264" />
              <stop offset="100%" stopColor="#4ade80" />
            </linearGradient>
            <filter id="neon-glow" x="-20%" y="-50%" width="140%" height="200%">
              <feGaussianBlur stdDeviation="4" />
            </filter>
          </defs>
          {links.paths.map((p, i) => (
            <g key={i}>
              <path d={p.d} fill="none" stroke="#a3e635" strokeWidth={7} strokeOpacity={0.55} strokeLinecap="round" filter="url(#neon-glow)" />
              <path d={p.d} fill="none" stroke="url(#neon-link)" strokeWidth={2.5} strokeLinecap="round" />
              {[p.from, p.to].map((pt, j) => (
                <g key={j}>
                  <circle cx={pt.x} cy={pt.y} r={9} fill="#a3e635" fillOpacity={0.22} filter="url(#neon-glow)" />
                  <circle cx={pt.x} cy={pt.y} r={4} fill="#d9f99d" stroke="#a3e635" strokeWidth={1.5} />
                </g>
              ))}
            </g>
          ))}
        </svg>

        {links.paths.map((p, i) => {
          // Shrink the pill with the gap it sits in; hide it when the gap
          // is too tight to hold it without touching a card border.
          const fit = Math.min(1, (p.gap - 16) / 108)
          if (fit < 0.55) return null
          return (
          <span
            key={i}
            style={{ left: p.mid.x, top: p.mid.y, transform: `translate(-50%, -50%) scale(${fit})` }}
            className="pointer-events-none absolute z-10 rounded-full border border-lime-400/60 bg-card/95 px-2.5 py-0.5 text-[10px] font-medium whitespace-nowrap text-lime-300 shadow-[0_0_12px_rgba(163,230,53,0.35)]"
          >
            {p.label}
          </span>
          )
        })}

        {links.pins.map((pin) => (
          <AnnotationPin
            key={pin.id}
            pin={pin}
            annotation={annotations.find((a) => a.id === pin.id)}
            open={openNote === pin.id}
            onToggle={() => setOpenNote((cur) => (cur === pin.id ? null : pin.id))}
            onSave={(text) => saveAnnotation(pin.id, text)}
            onDelete={() => deleteAnnotation(pin.id)}
          />
        ))}

        {hasSelection && links.anchor && aiStage && (
          <AiEditMorph
            left={Math.min(Math.max(8, (links.anchor.l + links.anchor.r) / 2 - 18), Math.max(8, links.anchor.w - 336))}
            top={Math.min(links.anchor.b + 10, Math.max(8, links.anchor.h - 56))}
            expanded={aiStage === 'prompt'}
            label={selectionLabel}
            onExpand={() => setAiStage('prompt')}
            onClose={() => setAiStage('badge')}
            onSubmit={submitAnnotation}
          />
        )}

        {/* Canvas actions: batch-apply pending notes with AI, then merge. */}
        <div className="absolute top-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2">
          {annotations.length > 0 && (
            <button
              type="button"
              onClick={applyAll}
              disabled={pendingCount === 0}
              className="flex items-center gap-1.5 rounded-full border border-indigo-500/50 bg-card/90 px-3.5 py-1.5 text-xs font-semibold text-foreground shadow-lg backdrop-blur-md transition-colors hover:bg-indigo-500/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Sparkles className="size-3.5 text-violet-500" />
              Apply with AI
              {pendingCount > 0 && (
                <span className="rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-1.5 text-[10px] text-white">
                  {pendingCount}
                </span>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => onMerge(annotations)}
            disabled={merged}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold shadow-lg transition-all',
              merged
                ? 'cursor-default border border-emerald-500/40 bg-emerald-500/15 text-emerald-400'
                : 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-indigo-500/30 hover:brightness-110'
            )}
          >
            {merged ? <Check className="size-3.5" /> : <GitMerge className="size-3.5" />}
            {merged ? 'Merged' : 'Merge Changes'}
            {!merged && resolutionCount + annotations.filter((a) => a.status === 'done').length > 0 && (
              <span className="rounded-full bg-white/20 px-1.5 text-[10px]">
                {resolutionCount + annotations.filter((a) => a.status === 'done').length}
              </span>
            )}
          </button>
        </div>

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
              setView(fitView(DEFAULT_LAYOUT))
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
