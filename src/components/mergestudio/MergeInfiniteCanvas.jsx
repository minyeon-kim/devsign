import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowRight, ArrowUp, BatteryFull, Bell, Blocks, ChartColumn, Check, ChevronDown, ChevronLeft, ChevronRight, GitMerge, House, ListChecks, Mail, Undo2, Maximize, Menu, Minus, PanelRight, Pencil, Plus, Search, ShieldCheck, Signal, Sparkles, Trash2, TrendingUp, User, Wifi, X, Zap } from 'lucide-react'
import { cn } from 'cn'
import { canvasPages, codeMergeVariants, designMergeVariants } from '@/data/mockData'
import { assemblyToOverride, frameWithLayers, mergeOverride } from '@/components/mergestudio/mergeEffects'
import { buildDrifts, buildSummary } from '@/components/mergestudio/mergeSummary'
import { codeOverrides } from '@/components/mergestudio/codeSync'
import { LAYER_MOCKUP, isSecondaryLayer } from '@/components/mergestudio/mockupContent'
import { COPY_FILE_ID, copyEntries, parseCopyLine } from '@/components/mergestudio/copyFile'
import { getFileIconMeta } from '@/lib/fileIcons'
import { tokenClassName, tokenizeLine } from '@/lib/syntaxHighlight'
import { useWorkspace } from '@/state/WorkspaceProvider'
import UserPresence from '@/components/layout/UserPresence'
import { FLOATING_PILL } from '@/components/mergestudio/floatingStyles'

const MIN_ZOOM = 25
const MAX_ZOOM = 200
const ZOOM_STEP = 10
const CODE_DIFF_WIDTH = 820
// How far right content starts, so it clears the floating Merge List window
// (w-72 at left-4, plus breathing room) over the same canvas surface.
const CONTENT_START_X = 320
const ARTBOARD_PREVIEW_WIDTH = 600
// Option B's own fixed accent — a simple, permanent visual reminder that
// it's a different variant, independent of whatever layer happens to be
// selected right now, unless an AI Block Deck suggestion is actively
// previewing on that exact layer (see `previewOverride`).
const OPTION_B_ACCENT = 'bg-violet-500'

function CodeLine({ lineNumber, lineKey, text, language, highlighted, accentClass, diffMark, onClick, lineRef, linked, hovered, onHover, onEdit, onLive, edited, dimmed }) {
  const tokens = tokenizeLine(text, language)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(text)
  const doneRef = useRef(false)

  function startEdit(e) {
    e.stopPropagation()
    doneRef.current = false
    setDraft(text)
    setEditing(true)
  }
  function finish(save) {
    if (doneRef.current) return
    doneRef.current = true
    setEditing(false)
    onLive?.(null)
    if (save && draft !== text) onEdit(draft)
  }

  return (
    <div
      ref={lineRef}
      data-code-line={lineKey}
      data-changed={accentClass ? 'true' : undefined}
      data-selected={highlighted ? 'true' : undefined}
      onClick={editing ? undefined : onClick}
      onDoubleClick={onEdit && !editing ? startEdit : undefined}
      onPointerEnter={linked ? () => onHover?.(lineNumber) : undefined}
      onPointerLeave={linked ? () => onHover?.(null) : undefined}
      className={cn(
        'group/line flex cursor-pointer gap-2 border-l border-transparent px-3 transition-opacity duration-200 hover:bg-muted/40',
        // The diff tint (red/green background) stays on regardless of
        // selection — only the left border changes to show the emerald
        // selection state on top of it. Dropping `accentClass` here used to
        // wash the row back to plain/untinted the moment it was selected,
        // hiding exactly the red/green diff it was selected to review.
        accentClass,
        // Spotlight: while a block is selected every other row recedes, so
        // the selection reads at full strength without any glow; hovering
        // brings a row back.
        dimmed && !hovered && 'opacity-45 hover:opacity-100',
        hovered && !highlighted && 'border-emerald-400/60',
        highlighted && 'border-emerald-400'
      )}
    >
      <span className="w-5 shrink-0 text-right text-muted-foreground/40 select-none">{lineNumber}</span>
      {/* The unified diff's own gutter mark — a bare `-`/`+` (no line
          renumbering, git-diff style) — separate from the line number
          above, which stays the file's real line for every row. */}
      <span
        className={cn(
          'w-3 shrink-0 text-center font-bold select-none',
          diffMark === '-' && 'text-destructive',
          diffMark === '+' && 'text-emerald-400'
        )}
      >
        {diffMark}
      </span>
      {/* min-w-0 lets this span actually shrink below its content's
          intrinsic width so pre-wrap can kick in, instead of the row
          growing past the card and needing horizontal scroll. */}
      {editing ? (
        <input
          autoFocus
          value={draft}
          spellCheck={false}
          onChange={(e) => {
            setDraft(e.target.value)
            // Streams every keystroke to the canvas for live preview; only
            // Enter / blur commits it as a manual edit.
            onLive?.(e.target.value)
          }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter') finish(true)
            else if (e.key === 'Escape') finish(false)
          }}
          onBlur={() => finish(true)}
          className="min-w-0 flex-1 rounded-sm bg-slate-950 px-1 font-mono text-[11px] text-foreground outline-none ring-1 ring-violet-500"
        />
      ) : (
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
      )}
      {edited && !editing && (
        <span title="Edited by hand" className="mt-0.5 flex h-4 shrink-0 items-center gap-0.5 self-start rounded-full bg-violet-500/20 px-1.5 text-[9px] font-semibold text-violet-300 select-none">
          <Pencil className="size-2" /> edited
        </span>
      )}
      {onEdit && !editing && (
        <button
          type="button"
          title="Edit this line"
          onClick={startEdit}
          className="mt-0.5 flex size-4 shrink-0 items-center justify-center self-start rounded-full text-muted-foreground opacity-0 transition-opacity group-hover/line:opacity-100 hover:bg-violet-500/20 hover:text-violet-300"
        >
          <Pencil className="size-2.5" />
        </button>
      )}
    </div>
  )
}

// A single vertical, git-style unified diff — no more Code A / Code B
// columns (or file tabs' worth of split panes) to compare side by side.
// An unchanged line renders once, plain. A changed line renders as a
// removed row (`-`, red) directly above the added row (`+`, green) it was
// replaced by, so the whole file reads top-to-bottom in one pass.
// Every line is editable in place (double-click, or the pencil on hover):
// editing a `+` row rewrites what gets merged; editing an unchanged row
// turns it into a new `-`/`+` pair. Typing a line back to what it would be
// anyway drops the manual edit.
function UnifiedDiffView({ incomingEdits, manualCode, onEditLine, onLiveLine, file, lines, diffs, highlightLine, highlightEnd, onSelectLine, highlightRef, linkedLines, hoverLine, hoverEnd, hoverFileId, onHoverLine }) {
  const inRange = (n, start, end) => start != null && n >= start && n <= (end ?? start)
  const diffByLine = new Map((diffs ?? []).map((d) => [d.line, d.incoming]))
  function edit(lineNumber, original, text) {
    const key = `${file.id}:${lineNumber}`
    const fallback = incomingEdits?.[key] ?? diffByLine.get(lineNumber) ?? original
    onEditLine?.(file.id, lineNumber, text === fallback ? null : text)
  }

  return (
    <div
      data-code-scroll
      className="relative min-h-0 flex-1 overflow-auto bg-slate-900 font-mono text-[11px] leading-relaxed"
    >
      <div className="py-2">
        {lines.map((line, i) => {
          const lineNumber = i + 1
          const key = `${file.id}:${lineNumber}`
          const edited = manualCode?.[key] !== undefined
          const incoming = manualCode?.[key] ?? incomingEdits?.[key] ?? diffByLine.get(lineNumber)
          const changed = incoming !== undefined
          const onEdit = onEditLine ? (text) => edit(lineNumber, line, text) : undefined
          const onLive = onLiveLine ? (text) => onLiveLine(file.id, lineNumber, text) : undefined
          const isHighlighted = inRange(lineNumber, highlightLine, highlightEnd)
          const dimmed = highlightLine != null && !isHighlighted
          const isHovered = hoverFileId === file.id && inRange(lineNumber, hoverLine, hoverEnd)
          const linked = linkedLines?.has(`${file.id}:${lineNumber}`)
          const onHover = (n) => onHoverLine?.(file.id, n)
          const onClick = (e) => onSelectLine?.(file.id, lineNumber, e.currentTarget)

          if (!changed) {
            return (
              <CodeLine
                key={i}
                lineRef={isHighlighted ? highlightRef : undefined}
                lineKey={`${file.id}:${lineNumber}`}
                lineNumber={lineNumber}
                text={line}
                language={file.language}
                highlighted={isHighlighted}
                onClick={onClick}
                linked={linked}
                hovered={isHovered}
                onHover={onHover}
                onEdit={onEdit}
                onLive={onLive}
                dimmed={dimmed}
              />
            )
          }
          return (
            <div key={i} data-diff-pair={changed ? 'true' : undefined}>
              <CodeLine
                lineRef={isHighlighted ? highlightRef : undefined}
                lineKey={`${file.id}:${lineNumber}`}
                lineNumber={lineNumber}
                text={line}
                language={file.language}
                highlighted={isHighlighted}
                accentClass="border-destructive/60 bg-destructive/10"
                diffMark="-"
                onClick={onClick}
                linked={linked}
                hovered={isHovered}
                onHover={onHover}
                dimmed={dimmed}
              />
              <CodeLine
                lineNumber={lineNumber}
                text={incoming}
                lineKey={`${file.id}:${lineNumber}:incoming`}
                language={file.language}
                highlighted={isHighlighted}
                accentClass={edited ? 'border-violet-500/60 bg-violet-500/10' : 'border-emerald-500/60 bg-emerald-500/10'}
                diffMark="+"
                onClick={onClick}
                linked={linked}
                hovered={isHovered}
                onHover={onHover}
                onEdit={onEdit}
                onLive={onLive}
                edited={edited}
                dimmed={dimmed}
              />
            </div>
          )
        })}
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
function CodeWindowCard({ incomingEdits, manualCode, onEditLine, onLiveLine, reveal, itemId, files, x, y, w, h, z, onDragStart, onResizeStart, onClickCapture, hoverLine, hoverFileId, onHoverLine, linkedLines, highlightFileId, highlightLine, highlightEnd, hoverEnd, onSelectLine, highlightRef }) {
  const { getFileLines } = useWorkspace()
  // Merge Studio's virtual copy.json carries its own lines.
  const linesOf = (file) => file.lines ?? getFileLines(file.id)
  const rootRef = useRef(null)
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

  // A design-side text edit reveals the copy.json line it's writing to, so
  // the code updating in step with the canvas is actually visible.
  useEffect(() => {
    if (!reveal) return
    setActiveFileId(reveal.fileId)
    const raf = requestAnimationFrame(() => {
      const el = rootRef.current?.querySelector(`[data-code-line="${reveal.fileId}:${reveal.line}"]`)
      const scroller = el?.closest('[data-code-scroll]')
      if (el && scroller) scroller.scrollTo({ top: Math.max(0, el.offsetTop - scroller.clientHeight / 3), behavior: 'smooth' })
    })
    return () => cancelAnimationFrame(raf)
  }, [reveal])

  // Bring the selected block into view once the right file tab has actually
  // rendered (scrolling from the canvas ran before the tab switched).
  useEffect(() => {
    if (!activeFile || highlightFileId !== activeFile.id || !highlightLine) return
    const raf = requestAnimationFrame(() => {
      const el = rootRef.current?.querySelector('[data-selected]')
      const scroller = el?.closest('[data-code-scroll]')
      if (!el || !scroller) return
      scroller.scrollTo({ top: Math.max(0, el.offsetTop - scroller.clientHeight / 3), behavior: 'smooth' })
    })
    return () => cancelAnimationFrame(raf)
  }, [activeFile?.id, highlightFileId, highlightLine, highlightEnd])

  if (!activeFile) return null

  return (
    <div
      ref={rootRef}
      data-card="code"
      className="absolute top-0 left-0 flex cursor-grab flex-col overflow-hidden rounded-2xl border border-white/5 bg-slate-900 shadow-lg will-change-transform active:cursor-grabbing"
      style={{ transform: `translate(${x}px, ${y}px)`, zIndex: z, width: w, height: h }}
      onPointerDown={onDragStart}
      onClickCapture={onClickCapture}
    >
      <div className="flex shrink-0 items-center gap-0.5 overflow-x-auto border-b bg-slate-950 px-1.5 pt-1.5">
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
                active ? 'bg-slate-900 text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <meta.Icon className={cn('size-3 shrink-0', meta.colorClass)} />
              <span className="max-w-[120px] truncate">{file.name}</span>
            </button>
          )
        })}
        <span title="Double-click a line to edit it" className="ml-auto flex shrink-0 items-center px-2 pb-1 text-muted-foreground/60">
          <Pencil className="size-3" />
        </span>
      </div>

      <UnifiedDiffView
        incomingEdits={incomingEdits}
        manualCode={manualCode}
        onEditLine={onEditLine}
        onLiveLine={onLiveLine}
        file={activeFile}
        lines={linesOf(activeFile)}
        diffs={codeMergeVariants[itemId]?.[activeFile.id]}
        highlightLine={highlightFileId === activeFile.id ? highlightLine : undefined}
        highlightEnd={highlightEnd}
        hoverEnd={hoverEnd}
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

// Text slots each layer type exposes for editing; the first is what a
// double-click anywhere else on the layer edits.
const TEXT_SLOTS = { text: ['text'], button: ['label'], chip: ['label'], input: ['label'], card: ['title', 'body'] }

// In-place text editor for one slot: inherits the surrounding typography so
// editing looks like typing into the design itself. Streams every keystroke
// (`onLive`), commits on Enter / blur, cancels on Escape.
function SlotEditor({ value, onLive, onCommit, onCancel, className, style }) {
  const [draft, setDraft] = useState(value)
  const doneRef = useRef(false)
  function finish(save) {
    if (doneRef.current) return
    doneRef.current = true
    if (save) onCommit(draft)
    else onCancel()
  }
  return (
    <input
      autoFocus
      value={draft}
      spellCheck={false}
      onChange={(e) => {
        setDraft(e.target.value)
        onLive(e.target.value)
      }}
      onFocus={(e) => e.target.select()}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') finish(true)
        else if (e.key === 'Escape') finish(false)
      }}
      onBlur={() => finish(true)}
      style={{ font: 'inherit', letterSpacing: 'inherit', textAlign: 'inherit', ...style }}
      className={cn('w-full min-w-0 rounded-sm bg-white px-0.5 text-inherit outline-none ring-2 ring-emerald-500', className)}
    />
  )
}

// Fill / border classes from drift data and Block Assemble can use the app's
// theme tokens, which resolve dark in the studio; inside the light product
// mockup they map to their light-palette equivalents.
const LIGHT_TOKEN_CLASSES = {
  'bg-card': 'bg-slate-50',
  'bg-muted': 'bg-slate-100',
  'bg-primary': 'bg-indigo-500',
  'bg-background': 'bg-white',
  'border-border': 'border-slate-200',
  'text-foreground': 'text-slate-900',
  'text-muted-foreground': 'text-slate-500',
  'border-white/30': 'border-slate-300',
  'border-white/60': 'border-slate-400',
}
function lightClasses(cls) {
  return cls?.split(/\s+/).map((c) => LIGHT_TOKEN_CLASSES[c] ?? c).join(' ')
}

// Mockup-only product widgets for the dashboard band (see
// MOCKUP_EXTENSIONS): a 30-day cash-flow area chart and a transaction
// history table, drawn at artboard scale in the light product palette.
const CASH_FLOW = [42, 48, 45, 53, 51, 58, 55, 62, 60, 67, 64, 71, 76, 73, 81]
function CashFlowChart({ style, className }) {
  const w = 100
  const hgt = 44
  const max = 90
  const pts = CASH_FLOW.map((v, i) => [(i / (CASH_FLOW.length - 1)) * w, hgt - (v / max) * hgt])
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const [lx, ly] = pts[pts.length - 1]
  return (
    <div style={style} className={cn('flex h-full w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm', className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[8px] font-semibold text-slate-900">Cash flow</p>
          <p className="text-[6px] text-slate-400">Last 30 days · All accounts</p>
        </div>
        <div className="flex rounded-full bg-slate-100 p-[1.5px] text-[5.5px] font-semibold text-slate-500">
          {['1W', '1M', '3M', '1Y'].map((t) => (
            <span key={t} className={cn('rounded-full px-1 py-[1px]', t === '1M' && 'bg-white text-slate-900 shadow-sm')}>{t}</span>
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="text-[13px] font-bold tracking-tight text-slate-900 tabular-nums">$248,930.12</span>
        <span className="rounded-full bg-emerald-50 px-1 text-[6px] font-semibold text-emerald-600">+12.4%</span>
      </div>
      <div className="relative mt-1 min-h-0 flex-1">
        <svg viewBox={`0 0 ${w} ${hgt}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
          <defs>
            <linearGradient id="ms-cashflow-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1="0" x2={w} y1={hgt * f} y2={hgt * f} stroke="#e2e8f0" strokeWidth="0.6" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
          ))}
          <path d={`${line} L${w} ${hgt} L0 ${hgt} Z`} fill="url(#ms-cashflow-fill)" />
          <path d={line} fill="none" stroke="#6366f1" strokeWidth="1.6" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <circle cx={lx} cy={ly} r="1.6" fill="#fff" stroke="#6366f1" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="mt-1 flex justify-between text-[5.5px] text-slate-400 tabular-nums">
        {['Jun 1', 'Jun 8', 'Jun 15', 'Jun 22', 'Jun 30'].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
    </div>
  )
}

const TRANSACTIONS = [
  { name: 'Stripe payout', meta: 'Jun 30 · Revenue', amount: '+$12,400.00', status: 'Settled', tone: 'emerald', mark: 'S', markClass: 'bg-indigo-500' },
  { name: 'Amazon Web Services', meta: 'Jun 29 · Infrastructure', amount: '−$2,318.40', status: 'Pending', tone: 'amber', mark: 'A', markClass: 'bg-amber-500' },
  { name: 'Figma', meta: 'Jun 28 · Software', amount: '−$144.00', status: 'Settled', tone: 'emerald', mark: 'F', markClass: 'bg-rose-500' },
  { name: 'Gusto payroll', meta: 'Jun 27 · Payroll', amount: '−$48,210.00', status: 'Scheduled', tone: 'slate', mark: 'G', markClass: 'bg-emerald-500' },
]
const STATUS_TONE = {
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  slate: 'bg-slate-100 text-slate-600 ring-slate-200',
}
function TransactionsTable({ style, className }) {
  return (
    <div style={style} className={cn('flex h-full w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm', className)}>
      <div className="flex items-center justify-between px-2.5 pt-2.5 pb-1.5">
        <p className="text-[8px] font-semibold text-slate-900">Recent transactions</p>
        <span className="text-[6.5px] font-semibold text-indigo-600">View all</span>
      </div>
      <div className="flex justify-between border-y border-slate-100 bg-slate-50 px-2.5 py-[3px] text-[5.5px] font-semibold tracking-wide text-slate-400 uppercase">
        <span>Merchant</span>
        <span>Amount</span>
      </div>
      <div className="flex-1 divide-y divide-slate-100">
        {TRANSACTIONS.map((t) => (
          <div key={t.name} className="flex items-center gap-1.5 px-2.5 py-[5px]">
            <span className={cn('flex size-4 shrink-0 items-center justify-center rounded-md text-[6.5px] font-bold text-white', t.markClass)}>{t.mark}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[7px] font-semibold text-slate-900">{t.name}</span>
              <span className="block truncate text-[5.5px] text-slate-400">{t.meta}</span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-[2px]">
              <span className={cn('text-[7px] font-semibold tabular-nums', t.amount.startsWith('+') ? 'text-emerald-600' : 'text-slate-900')}>{t.amount}</span>
              <span className={cn('rounded-full px-1 text-[5px] font-semibold ring-1', STATUS_TONE[t.tone])}>{t.status}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// A re-rendering of a frame's layers — separate from CanvasPanel's
// interactive CanvasFrame/CanvasLayer (no zoom/tools of its own, since it
// lives inside the shared infinite canvas which already has those) since
// this is a comparison artboard, not a full editing canvas. Both Original
// Design and Current Implementation are clickable — clicking either drives
// Block Deck's Variant Compare tab and, for linked layers, the code sync.
// With `onEditText`, every piece of text (copy, labels, placeholders, card
// titles/bodies) can be edited in place by double-clicking it. A non-static
// override renders a small badge so the change reads as a live preview
// rather than a permanent edit.
export function StaticLayer({ layer, override, selected, onSelect, linked, hovered, onHover, onEditText, drift, dimmed }) {
  const [editingSlot, setEditingSlot] = useState(null)
  const style = {
    left: layer.x + (override?.dx ?? 0),
    top: layer.y + (override?.dy ?? 0),
    width: layer.width + (override?.dw ?? 0),
    height: layer.height + (override?.dh ?? 0),
  }
  const fill = lightClasses(override?.className)
  const type = override?.asType ?? layer.type
  const copy = override?.copy
  const label = copy?.label ?? override?.asLabel ?? layer.label
  const radiusStyle =
    override?.radius !== undefined || override?.fillStyle
      ? { ...(override.radius !== undefined && { borderRadius: override.radius }), ...override.fillStyle }
      : undefined
  // Auto-layout values from the Assemble inspector: direction, gap, padding
  // and the 3×3 alignment (horizontal/vertical mapped onto the main/cross
  // axis for the chosen direction), plus exact stroke and opacity.
  const FLEX = { start: 'flex-start', center: 'center', end: 'flex-end' }
  const column = override?.direction === 'column'
  const hAlign = FLEX[override?.align]
  const vAlign = FLEX[override?.valign]
  const layoutStyle = {
    ...(override?.direction && { flexDirection: override.direction }),
    ...((column ? vAlign : hAlign) && { justifyContent: column ? vAlign : hAlign }),
    ...((column ? hAlign : vAlign) && { alignItems: column ? hAlign : vAlign }),
    ...(override?.gap !== undefined && { gap: override.gap }),
    ...(override?.padding?.x !== undefined && { paddingLeft: override.padding.x, paddingRight: override.padding.x }),
    ...(override?.padding?.y !== undefined && { paddingTop: override.padding.y, paddingBottom: override.padding.y }),
    ...override?.strokeStyle,
    ...(override?.opacity !== undefined && { opacity: override.opacity / 100 }),
  }
  const contentStyle = Object.keys(layoutStyle).length ? { ...radiusStyle, ...layoutStyle } : radiusStyle
  const extra = lightClasses(override?.extraClass)
  const iconEl = override?.icon ? <Sparkles className="size-3 shrink-0" /> : null

  // Realistic product content for this layer (see mockupContent.js); a
  // layer swapped to another component type falls back to type defaults.
  const mock = override?.asType ? {} : (LAYER_MOCKUP[layer.id] ?? {})
  const slots = override?.asType || (layer.type === 'card' && !mock.title) ? [] : (TEXT_SLOTS[layer.type] ?? [])
  const canEdit = Boolean(onEditText) && slots.length > 0
  // A text slot's content: plain text, or the in-place editor while that
  // slot is being edited.
  const slotText = (slot, value, props = {}) =>
    editingSlot === slot ? (
      <SlotEditor
        value={value ?? ''}
        onLive={(v) => onEditText(layer.id, slot, v, { live: true })}
        onCommit={(v) => {
          setEditingSlot(null)
          onEditText(layer.id, slot, v)
        }}
        onCancel={() => {
          setEditingSlot(null)
          onEditText(layer.id, slot, null, { live: true })
        }}
        style={props.style}
      />
    ) : (
      <span data-slot={canEdit ? slot : undefined} className={props.className} style={props.style}>
        {props.children ?? value}
      </span>
    )
  const h = style.height
  const trailing = override?.icon === 'right' ? iconEl : mock.trailingArrow ? <ArrowRight className="size-3.5 shrink-0" /> : null

  // Light-mode product UI: the artboards render as a real, light SaaS screen
  // inside the dark studio, so every class here is an explicit light-palette
  // value rather than an app theme token (those resolve dark in the studio).
  let content = null
  if (type === 'bar' && mock.role === 'status') {
    content = (
      <div style={contentStyle} className={cn('flex h-full w-full items-center justify-between px-4 text-[10px] font-semibold text-slate-900', fill, extra)}>
        <span>9:41</span>
        <span className="flex items-center gap-1">
          <Signal className="size-2.5" />
          <Wifi className="size-2.5" />
          <BatteryFull className="size-3" />
        </span>
      </div>
    )
  } else if (type === 'bar') {
    content = (
      <div
        style={contentStyle}
        className={cn('flex h-full w-full items-center justify-center gap-4 border-b border-slate-200 text-[9px] font-medium text-slate-500', fill ?? 'bg-white/95', extra)}
      >
        {(mock.links ?? ['Overview', 'Activity', 'Settings']).map((l, i) => (
          <span key={l} className={i === 0 ? 'text-slate-900' : undefined}>{l}</span>
        ))}
      </div>
    )
  } else if (type === 'card' && mock.role === 'container') {
    content = (
      <div style={contentStyle} className={cn('h-full w-full rounded-xl border border-slate-200 shadow-sm', fill ?? 'bg-white', extra)} />
    )
  } else if (type === 'card') {
    const Icon = { zap: Zap, shield: ShieldCheck, chart: ChartColumn }[mock.icon] ?? Blocks
    content = (
      <div
        style={contentStyle}
        className={cn('flex h-full w-full flex-col gap-1 overflow-hidden rounded-xl border border-slate-200 p-2.5 shadow-sm', fill ?? 'bg-white', extra)}
      >
        <span className="mb-0.5 flex size-5 items-center justify-center rounded-md bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
          <Icon className="size-3" />
        </span>
        {slotText('title', copy?.title ?? mock.title ?? layer.name, { className: 'truncate font-semibold text-slate-900', style: { fontSize: 9, fontWeight: 600 } })}
        {slotText('body', copy?.body ?? mock.body ?? 'Component description', { className: 'line-clamp-2 leading-snug text-slate-500', style: { fontSize: 7.5 } })}
      </div>
    )
  } else if (type === 'chart') {
    content = <CashFlowChart style={contentStyle} className={cn(fill, extra)} />
  } else if (type === 'table') {
    content = <TransactionsTable style={contentStyle} className={cn(fill, extra)} />
  } else if (type === 'avatar') {
    content = (
      <div
        style={contentStyle}
        className={cn(
          'flex h-full w-full items-center justify-center rounded-full font-semibold text-white ring-2 ring-white',
          fill ?? cn('bg-gradient-to-br', mock.gradient ?? 'from-slate-400 to-slate-600'),
          extra
        )}
      >
        {!mock.stacked && <span style={{ fontSize: Math.max(7, h * 0.36) }}>{mock.initials ?? layer.name.slice(0, 1)}</span>}
      </div>
    )
  } else if (type === 'input') {
    const Icon = mock.icon === 'search' ? Search : mock.icon === 'mail' ? Mail : null
    content = (
      <div
        style={contentStyle}
        className={cn('flex h-full w-full items-center gap-2 rounded-lg border border-slate-300 px-3 text-slate-400 shadow-sm', fill ?? 'bg-white', extra)}
      >
        {Icon && <Icon className="size-3.5 shrink-0 text-slate-400" />}
        {slotText('label', copy?.label ?? override?.asLabel ?? mock.placeholder ?? layer.label ?? 'Input', {
          className: 'truncate',
          style: { fontSize: Math.min(11, Math.max(8, h * 0.3)) },
        })}
      </div>
    )
  } else if (type === 'chip' && mock.role === 'logo') {
    content = (
      <div style={contentStyle} className={cn('flex h-full w-full items-center gap-1.5 text-[10px] font-bold tracking-tight text-slate-900', fill, extra)}>
        <span className="size-3.5 shrink-0 rounded-[4px] bg-gradient-to-br from-indigo-500 to-violet-600" />
        {slotText('label', label ?? 'Logo')}
      </div>
    )
  } else if (type === 'chip' && mock.role === 'ghost') {
    content = (
      <div
        style={contentStyle}
        className={cn('flex h-full w-full items-center justify-center gap-1 rounded-full border border-slate-300 font-semibold text-slate-700 shadow-sm', fill ?? 'bg-white', extra)}
      >
        {slotText('label', label ?? 'Chip', { style: { fontSize: Math.max(8, h * 0.4) } })}
      </div>
    )
  } else if (type === 'chip') {
    content = (
      <div
        style={contentStyle}
        className={cn('flex h-full w-full items-center justify-center gap-1 rounded-full font-semibold text-white', fill ?? 'bg-indigo-500', extra)}
      >
        {override?.icon === 'left' && iconEl}
        {slotText('label', label ?? 'Chip', { style: { fontSize: Math.max(8, h * 0.42) } })}
        {override?.icon === 'right' && iconEl}
      </div>
    )
  } else if (type === 'toggle') {
    content = (
      <div style={contentStyle} className={cn('flex h-full w-full items-center justify-end rounded-full p-[3px]', fill ?? 'bg-indigo-500', extra)}>
        <span className="aspect-square h-full rounded-full bg-white shadow-md" />
      </div>
    )
  } else if (type === 'image' && mock.role === 'dashboard') {
    content = (
      <div
        style={contentStyle}
        className={cn('flex h-full w-full flex-col justify-between overflow-hidden rounded-xl border border-slate-200 p-2 shadow-md', fill ?? 'bg-white', extra)}
      >
        <div>
          <p className="text-[6.5px] font-semibold tracking-wide text-slate-400 uppercase">Total balance</p>
          <p className="text-[12px] font-bold text-slate-900 tabular-nums">$12,480.00</p>
          <p className="mt-0.5 inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1 text-[6.5px] font-semibold text-emerald-600">
            <TrendingUp className="size-2" /> 8.2%
          </p>
        </div>
        <div className="flex h-7 items-end gap-[3px]">
          {[40, 65, 50, 80, 60, 95, 75].map((v, i) => (
            <span key={i} className={cn('flex-1 rounded-sm', i === 5 ? 'bg-indigo-500' : 'bg-indigo-100')} style={{ height: `${v}%` }} />
          ))}
        </div>
      </div>
    )
  } else if (type === 'image') {
    content = (
      <div
        style={contentStyle}
        className={cn('relative h-full w-full overflow-hidden rounded-lg border border-slate-200', fill ?? 'bg-gradient-to-b from-indigo-50 to-white', extra)}
      >
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          {[10, 20, 30].map((y) => (
            <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="#e2e8f0" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
          ))}
          <path d="M0 32 L14 26 L28 29 L42 18 L56 21 L70 11 L84 14 L100 5 L100 40 L0 40 Z" fill="rgba(99,102,241,0.14)" />
          <path d="M0 32 L14 26 L28 29 L42 18 L56 21 L70 11 L84 14 L100 5" fill="none" stroke="#6366f1" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="absolute top-1.5 left-2 text-[8px] font-bold text-slate-900 tabular-nums">$84.2k</span>
        <span className="absolute top-1.5 right-2 rounded-full bg-emerald-50 px-1 text-[7px] font-semibold text-emerald-600">+12%</span>
      </div>
    )
  } else if (type === 'iconbtn') {
    content = (
      <div
        style={contentStyle}
        className={cn('flex h-full w-full items-center justify-center rounded-full border border-slate-200 text-slate-700 shadow-sm', fill ?? 'bg-white', extra)}
      >
        {mock.icon === 'menu' ? <Menu className="size-3.5" /> : <span className="text-sm">{label ?? '•'}</span>}
      </div>
    )
  } else if (type === 'tabs') {
    const icons = { home: House, search: Search, user: User }
    content = (
      <div style={contentStyle} className={cn('flex h-full w-full items-center justify-around border-t border-slate-200 px-2 text-[8px]', fill ?? 'bg-white', extra)}>
        {(mock.tabs ?? [['home', 'Home'], ['search', 'Search'], ['user', 'Profile']]).map(([icon, t], i) => {
          const Icon = icons[icon] ?? House
          return (
            <span key={t} className={cn('flex flex-col items-center gap-0.5', i === 0 ? 'font-semibold text-indigo-600' : 'text-slate-400')}>
              <Icon className="size-3" />
              {t}
            </span>
          )
        })}
      </div>
    )
  } else if (type === 'button' && mock.role === 'secondary') {
    content = (
      <div
        style={contentStyle}
        className={cn('flex h-full w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 font-semibold text-slate-800 shadow-sm', fill ?? 'bg-white', extra)}
      >
        {override?.icon === 'left' && iconEl}
        {slotText('label', label ?? 'Button', { style: { fontSize: Math.min(13, Math.max(9, h * 0.32)) } })}
        {trailing}
      </div>
    )
  } else if (type === 'button') {
    content = (
      <div
        style={contentStyle}
        className={cn('flex h-full w-full items-center justify-center gap-1.5 rounded-lg font-semibold text-white shadow-sm shadow-indigo-500/30', fill ?? 'bg-indigo-500', extra)}
      >
        {override?.icon === 'left' && iconEl}
        {slotText('label', label ?? 'Button', { style: { fontSize: Math.min(13, Math.max(9, h * 0.32)) } })}
        {trailing}
      </div>
    )
  } else if (type === 'text') {
    // Real copy, sized from the layer's (possibly drifted) height so a
    // font-size or weight change reads as an actual typographic change.
    const tone = { strong: 'text-slate-900', muted: 'text-slate-500', subtle: 'text-slate-400' }[mock.tone ?? 'muted']
    const text = copy?.text ?? mock.text ?? layer.name
    content = (
      <div
        style={{ ...contentStyle, fontSize: Math.max(6, h * 0.85), lineHeight: `${h}px`, fontWeight: override?.fontWeight ?? mock.weight ?? 400 }}
        // Strong copy (headings) may outgrow its box when a drift enlarges
        // it — let it spill rather than truncate so the change reads fully.
        className={cn(
          'h-full w-full whitespace-nowrap',
          mock.tone === 'strong' ? 'overflow-visible tracking-tight' : 'truncate',
          tone,
          fill && cn(fill, 'rounded-sm px-1 text-white'),
          extra
        )}
      >
        {slotText('text', text, {
          children:
            mock.strongPrefix && text.includes(mock.strongPrefix) ? (
              <>
                {text.slice(0, text.indexOf(mock.strongPrefix))}
                <span className="font-semibold text-slate-900">{mock.strongPrefix}</span>
                {text.slice(text.indexOf(mock.strongPrefix) + mock.strongPrefix.length)}
              </>
            ) : undefined,
        })}
      </div>
    )
  } else {
    content = (
      <div style={contentStyle} className={cn('h-full w-full rounded-sm', fill ?? 'bg-slate-200', extra)} />
    )
  }

  return (
    <div
      data-layer-id={layer.id}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(e.currentTarget)
      }}
      onDoubleClick={
        canEdit
          ? (e) => {
              e.stopPropagation()
              setEditingSlot(e.target.closest('[data-slot]')?.dataset.slot ?? slots[0])
            }
          : undefined
      }
      title={canEdit ? 'Double-click to edit text' : undefined}
      onPointerEnter={linked ? () => onHover?.(layer.id) : undefined}
      onPointerLeave={linked ? () => onHover?.(null) : undefined}
      className={cn(
        'absolute cursor-pointer',
        'transition-opacity duration-200',
        // Spotlight: the selection stays at full strength inside a thin
        // border (drawn by the canvas overlay) while every other element
        // dims until hovered; drifted elements keep a faint outline so they
        // stay findable.
        drift && !selected && !hovered && 'rounded-sm outline outline-1 outline-offset-2 outline-solid outline-violet-400/40',
        dimmed && !selected && !hovered && 'opacity-45',
        hovered && 'outline outline-1 outline-offset-2 outline-solid outline-emerald-400/80'
      )}
      style={style}
    >
      {content}
      {selected && override && !override.static && (
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
function StaticFrame({ frameKey, frame, label, accentClass, editable, onEditText, driftLayerIds, x, y, w, h, z, onDragStart, onResizeStart, onClickCapture, linkedLayerIds, hoverLayerId, onHoverLayer, selectedLayerId, overrides, onSelectLayer, onSelectFrame }) {
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
      <p
        title={editable ? 'Double-click any text on this artboard to edit it — synced to copy.json' : undefined}
        className={cn(
          'mb-1.5 flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold',
          editable ? 'bg-violet-500/20 text-violet-200' : 'bg-card/90 text-muted-foreground'
        )}
      >
        {label}
        {editable && <Pencil className="size-2.5 text-violet-300/80" />}
      </p>
      <div
        onClick={(e) => onSelectFrame(frameKey, e.currentTarget)}
        data-frame-box
        // Pristine light product surface inside the dark studio.
        className="relative overflow-hidden rounded-lg bg-white shadow-2xl shadow-black/40 ring-1 ring-slate-200/80"
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
            const primary = layer.type === 'button' && !isSecondaryLayer(layer.id)
            const override = o
              ? { ...o, className: o.className ?? (primary ? accentClass : undefined) }
              : primary && accentClass
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
                drift={driftLayerIds?.has(layer.id)}
                dimmed={Boolean(selectedLayerId)}
                onHover={onHoverLayer}
                onSelect={(el) => onSelectLayer(layer.id, el)}
                onEditText={onEditText}
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
const CARD_GAP = 96

// Sizes are in world units. Artboards leave h null until first resized
// (they then derive their height from the frame's aspect ratio).
// Design-first layout: Original Design and Current Implementation side by
// side across the top, with a compact, full-width code window underneath
// acting as the inspector. Artboards are as wide as ARTBOARD_PREVIEW_WIDTH
// allows while staying under ARTBOARD_MAX_H tall, so a tall mobile frame
// doesn't push the code window off screen.
const ARTBOARD_MAX_H = 760
const RIGHT_TOOLBAR_CLEARANCE = 64
const ARTBOARD_LABEL_H = 30
const CODE_H = 210
const CODE_ONLY_H = 440
const CODE_GAP_Y = 36
function defaultLayout(frame) {
  if (!frame) {
    const off = { x: 0, y: 0, w: ARTBOARD_PREVIEW_WIDTH, h: null }
    return { code: { x: 0, y: 0, w: CODE_DIFF_WIDTH, h: CODE_ONLY_H }, a: off, b: off }
  }
  const artW = Math.round(Math.min(ARTBOARD_PREVIEW_WIDTH, (ARTBOARD_MAX_H * frame.width) / frame.height))
  const artH = (frame.height * artW) / frame.width
  const rowW = artW * 2 + CARD_GAP
  const codeW = Math.max(rowW, CODE_DIFF_WIDTH)
  const artX = (codeW - rowW) / 2
  return {
    a: { x: artX, y: 0, w: artW, h: null },
    b: { x: artX + artW + CARD_GAP, y: 0, w: artW, h: null },
    code: { x: 0, y: ARTBOARD_LABEL_H + artH + CODE_GAP_Y, w: codeW, h: CODE_H },
  }
}
// Vertical room reserved above the cards for the two-tier floating top
// controls (Compare > Check stepper at `top-3`, drift pager / Merge CTA row
// at `top-14`, ~100px to its bottom edge) plus breathing room, so a freshly
// opened merge target never lands underneath them.
const TOP_CONTROLS_CLEARANCE = 124
// Room kept free below the cards for the bottom AI bar (~135px tall at
// `bottom-5`), zoom controls and Changes Log, so fitted artboards never sit
// underneath them.
const BOTTOM_CONTROLS_CLEARANCE = 150
// Fitting may zoom past 100% so the comparison fills the available canvas
// on large screens instead of sitting small in the middle of it.
const MAX_FIT_ZOOM = 1.8
const DEFAULT_VIEW = { x: CONTENT_START_X, y: TOP_CONTROLS_CLEARANCE, zoom: 100 }

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

// Same idea for stacked cards: leaves/enters vertically.
function linkGeometryV(from, to) {
  const dy = Math.max(24, Math.abs(to.y - from.y) / 2) * (Math.sign(to.y - from.y) || 1)
  const c1 = { x: from.x, y: from.y + dy }
  const c2 = { x: to.x, y: to.y - dy }
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
        // A clean, minimalist white icon — no filled circle behind it —
        // marking the element as AI-editable; a drop shadow keeps it
        // legible over whatever's underneath instead of needing a solid
        // background chip.
        className={cn(
          'flex size-[28px] shrink-0 items-center justify-center text-white transition-opacity',
          !expanded && 'drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)] hover:opacity-80'
        )}
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
          'flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-700 text-white transition-colors hover:bg-slate-600 disabled:opacity-40',
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
          className="shrink-0 rounded-full bg-slate-700 px-2.5 py-1 text-[10px] font-semibold text-white transition-colors hover:bg-slate-600 disabled:opacity-40"
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
            : 'bg-slate-600 ring-indigo-500'
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

// Compare-stage "Changes log": every modification so far — variant
// selections, Block Assemble / Design System edits, presets, AI notes — as
// rows you can Undo individually, or click to pan the canvas to the element
// (or code line) they touch.
function ChangesLog({ entries, codeRows, open, onToggle, onJump, onUndo }) {
  const total = entries.length
  return (
    // `relative`, sized to just the button — the expanded panel is
    // `absolute` (popped up above it via `bottom-full`), so opening it
    // never changes this wrapper's own layout box. It used to grow to
    // `w-80` in normal flow instead, which pushed whatever sits to its
    // left (the zoom pill) further out the moment it opened.
    <div className="relative">
      {open && (
        <div className="absolute right-0 bottom-full mb-2 max-h-80 w-80 max-w-[calc(100vw-1.5rem)] space-y-1.5 overflow-y-auto rounded-2xl border bg-card/95 p-2.5 text-[11px] shadow-2xl backdrop-blur-md">
          {total === 0 && codeRows.length === 0 && (
            <p className="py-3 text-center text-muted-foreground">No changes yet — pick or edit values, edit code, assemble blocks, or annotate.</p>
          )}
          {entries.map((e) => {
            const canJump = Boolean(e.layerId || e.fileId)
            return (
              <div key={e.id} className="flex items-center gap-2 rounded-xl bg-slate-800/70 px-3 py-2">
                <button
                  type="button"
                  disabled={!canJump}
                  onClick={() => onJump(e)}
                  title={canJump ? 'Jump to element' : undefined}
                  className="min-w-0 flex-1 text-left leading-snug disabled:cursor-default"
                >
                  <span className="block truncate text-foreground">{e.title}</span>
                  <span className={cn('block truncate', e.kind === 'annotation' || e.kind === 'code' ? 'text-violet-400' : 'text-muted-foreground')}>{e.detail}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onUndo(e)}
                  title="Undo this change"
                  className="flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
                >
                  <Undo2 className="size-3.5" />
                  Undo
                </button>
              </div>
            )
          })}
          {codeRows.length > 0 && (
            <div className="border-t border-border/60 pt-1.5">
              <p className="mb-1.5 px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Code</p>
              {codeRows.map((f) => (
                <p key={f.id} className="px-1 py-1 text-sm text-muted-foreground">
                  <span className="text-foreground">{f.name}</span> · {f.changed} incoming line{f.changed === 1 ? '' : 's'}
                  {f.aiLines > 0 && ` · ${f.aiLines} AI edit${f.aiLines === 1 ? '' : 's'}`}
                  {f.manualLines > 0 && ` · ${f.manualLines} manual edit${f.manualLines === 1 ? '' : 's'}`}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={onToggle}
        // `h-11` explicitly, matching the adjacent zoom pill's own height —
        // relying on padding alone to happen to match was fragile (it
        // didn't: this button used to render visibly shorter).
        className={cn('ml-auto flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted', FLOATING_PILL)}
      >
        <ListChecks className="size-4 text-indigo-500" />
        Changes log
        <span className="rounded-full bg-indigo-500/20 px-2 text-xs text-indigo-300">{total}</span>
        <ChevronDown className={cn('size-3.5 text-muted-foreground transition-transform', !open && 'rotate-180')} />
      </button>
    </div>
  )
}

const MACRO_STEPS = [
  { id: 'compare', label: 'Compare' },
  { id: 'check', label: 'Check' },
  { id: 'preview', label: 'Preview' },
  { id: 'review', label: 'Review' },
  { id: 'deploy', label: 'Deploy' },
]

// Macro workflow stepper: Compare ➔ Check ➔ Preview ➔ Review ➔ Deploy. The
// current stage is filled with the accent gradient (Compare while working
// on the canvas; the wizard's step while Merge Changes is open). Clicking a
// later step opens the merge wizard at that step.
function MacroStepper({ stage, disabled, onOpenStep }) {
  const current = Math.max(0, MACRO_STEPS.findIndex((s) => s.id === stage))
  return (
    <ol className={cn('flex items-center gap-1 rounded-full px-1.5 py-1', FLOATING_PILL)}>
      {MACRO_STEPS.map((s, i) => {
        const active = i === current
        const done = i < current
        return (
          <li key={s.id} className="flex items-center gap-1">
            <button
              type="button"
              // Strict progression: revisiting an already-passed step is
              // fine, but you can only ever advance one step at a time —
              // no jumping straight to e.g. Deploy from Compare/Check.
              disabled={i === 0 || disabled || i > current + 1}
              onClick={() => onOpenStep(i - 1)}
              className={cn(
                'flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors',
                active && 'bg-slate-700 text-white',
                done && 'text-emerald-400',
                !active && !done && 'text-muted-foreground enabled:hover:bg-muted enabled:hover:text-foreground'
              )}
            >
              {done && <Check className="size-3" />}
              {s.label}
            </button>
            {i < MACRO_STEPS.length - 1 && <ArrowRight className="size-3 text-muted-foreground/50" />}
          </li>
        )
      })}
    </ol>
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
  variantPreviews,
  reserve,
  listCollapsed,
  focus,
  resolutionCount,
  merged,
  assemblies,
  resolutions,
  extraLayers,
  manualCode,
  syncedCode,
  codeWindowCode,
  onEditCode,
  onLiveEditCode,
  onEditText,
  codeReveal,
  onUndoChange,
  onAnnotationsChange,
  stage = 'compare',
  onMerge,
  onSelectLayer,
  onSelectLine,
  onSelectFrame,
  onFocusSource,
}) {
  const { getFileLines, requestMergeFocus, mergePreviewOpen, setMergePreviewOpen, notifications, mergeDrawer, setMergeDrawer } = useWorkspace()
  const unreadCount = notifications.filter((n) => n.unread).length
  const [driftIdx, setDriftIdx] = useState(-1)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [view, setView] = useState(DEFAULT_VIEW)
  const [layout, setLayout] = useState(() =>
    defaultLayout(item.hasDesign ? frameWithLayers(canvasPages.find((p) => p.id === item.designPageId)?.frames[0], extraLayers) : null)
  )
  const [panning, setPanning] = useState(false)
  const [hover, setHover] = useState(null) // { layerId, fileId, line }
  const [order, setOrder] = useState({ code: 1, a: 2, b: 3 })
  const [frameSel, setFrameSel] = useState(null) // 'a' | 'b'
  const [aiStage, setAiStage] = useState(null) // null | 'badge' | 'prompt'
  const [annotations, setAnnotations] = useState([])
  const [openNote, setOpenNote] = useState(null)
  const [links, setLinks] = useState({ paths: [], anchor: null, pins: [], boxes: [] })
  const [zoomRowRight, setZoomRowRight] = useState(12)
  const anchorMetaRef = useRef({})
  const viewportRef = useRef(null)
  const containerRef = useRef(null)
  const zoomRowRef = useRef(null)
  const viewRef = useRef(view)
  const highlightRef = useRef(null)
  const anchorElRef = useRef(null)
  const suppressClick = useRef(false)
  const page = item.hasDesign ? canvasPages.find((p) => p.id === item.designPageId) : null
  const frame = frameWithLayers(page?.frames[0], extraLayers)

  useEffect(() => {
    viewRef.current = view
  }, [view])

  // Left edge of the unobstructed canvas *right now*: the Merge List is an
  // overlay drawer, so content only needs to clear it while it's open. Only
  // read when a view is (re)computed — opening a target, Reset view, an
  // inbox jump — never on the drawer toggle itself, so toggling it never
  // moves the canvas.
  function contentStartX() {
    return listCollapsed ? 16 : CONTENT_START_X
  }

  // Zoom/pan so the whole card row sits inside the visible canvas (right of
  // the Merge List, left of any docked Block Deck) with breathing room.
  function fitView(lay) {
    const c = containerRef.current
    if (!c) return DEFAULT_VIEW
    const rect = c.getBoundingClientRect()
    const artW = (k) => lay[k].w ?? ARTBOARD_PREVIEW_WIDTH
    const cards = ['code', ...(frame ? ['a', 'b'] : [])]
    const box = (k) =>
      k === 'code'
        ? { l: lay.code.x, t: lay.code.y, r: lay.code.x + lay.code.w, b: lay.code.y + lay.code.h }
        : { l: lay[k].x, t: lay[k].y, r: lay[k].x + artW(k), b: lay[k].y + ARTBOARD_LABEL_H + (lay[k].h ?? (frame.height * artW(k)) / frame.width) }
    const minX = Math.min(...cards.map((k) => box(k).l))
    const minY = Math.min(...cards.map((k) => box(k).t))
    const worldW = Math.max(...cards.map((k) => box(k).r)) - minX
    const worldH = Math.max(...cards.map((k) => box(k).b)) - minY
    const startX = contentStartX()
    // Clear of the right-edge floating toolbar (comments/history/share).
    const visRight = rect.width - RIGHT_TOOLBAR_CLEARANCE - reserve
    const availW = visRight - startX
    const availH = rect.height - TOP_CONTROLS_CLEARANCE - BOTTOM_CONTROLS_CLEARANCE
    const zoom = clampZoom(Math.floor(Math.min(MAX_FIT_ZOOM, availW / worldW, availH / worldH) * 100))
    const k = zoom / 100
    const contentW = worldW * k
    // Horizontal axis to center on: the bottom AI chat bar's own center
    // (it's centered on the whole viewport, not on this canvas's visible
    // strip, so centering on the strip's midpoint left the cards visibly
    // shifted off the bar's axis). Falls back to the visible strip's
    // midpoint if the bar isn't mounted. The result is then clamped so the
    // content never slides under the Merge List drawer or a right-docked
    // panel — it only drifts off the bar's axis when there isn't room on
    // one side to stay centered on it.
    const aiBar = document.querySelector('[data-ai-bar]')
    const aiRect = aiBar?.getBoundingClientRect()
    const axis = aiRect?.width ? aiRect.left + aiRect.width / 2 - rect.left : (startX + visRight) / 2
    const left =
      contentW >= availW
        ? startX
        : Math.min(Math.max(axis - contentW / 2, startX), visRight - contentW)
    return {
      zoom,
      x: left - minX * k,
      // Below the top controls, vertically centered in what's left when the
      // content is shorter than the available height.
      y: TOP_CONTROLS_CLEARANCE + Math.max(0, (availH - worldH * k) / 2) - minY * k,
    }
  }

  useEffect(() => {
    const lay = defaultLayout(frame)
    setView(fitView(lay))
    setLayout(lay)
    setHover(null)
    setFrameSel(null)
    setAiStage(null)
    setAnnotations([])
    setOpenNote(null)
    setDriftIdx(-1)
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

  // Inbox jump: after the target is selected (and the code tab has had a
  // moment to switch), ease the view so the element sits at the center of
  // the visible canvas, zooming in to at least 100% for small targets.
  useEffect(() => {
    if (!focus || focus.target.itemId !== item.id || focus.target.noPan) return
    let raf
    const timer = setTimeout(() => {
      const c = containerRef.current
      if (!c) return
      const { layerId, fileId, line, card } = focus.target
      const el =
        (layerId && c.querySelector(`[data-frame-key="a"] [data-layer-id="${layerId}"]`)) ||
        (fileId && line && c.querySelector(`[data-code-line="${fileId}:${line}"]`)) ||
        (card === 'code' || fileId ? c.querySelector('[data-card="code"]') : null) ||
        (card ? c.querySelector(`[data-frame-key="${card}"]`) : null)
      if (!el) return
      const base = c.getBoundingClientRect()
      const r = el.getBoundingClientRect()
      const from = viewRef.current
      const k0 = from.zoom / 100
      // element center in world coordinates
      const wx = (r.left + r.width / 2 - base.left - from.x) / k0
      const wy = (r.top + r.height / 2 - base.top - from.y) / k0
      const zoom = clampZoom(Math.max(from.zoom, layerId || line ? 110 : 80))
      const k1 = zoom / 100
      // Center within the *visible* area, not the full container — when a
      // right-docked panel (Block Deck, or the Merge Changes wizard)
      // reserves space via `reserve`, the target would otherwise land
      // centered behind it.
      const to = {
        zoom,
        x: (contentStartX() + (base.width - reserve)) / 2 - wx * k1,
        y: base.height / 2 - 40 - wy * k1,
      }
      const t0 = performance.now()
      const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
      function tick(now) {
        const t = Math.min(1, (now - t0) / 450)
        const e = ease(t)
        setView({
          zoom: from.zoom + (to.zoom - from.zoom) * e,
          x: from.x + (to.x - from.x) * e,
          y: from.y + (to.y - from.y) * e,
        })
        if (t < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }, 260)
    return () => {
      clearTimeout(timer)
      cancelAnimationFrame(raf)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce, item.id])

  // Drifts: every place Option A and Option B differ — design layers with
  // variant diffs, then incoming code lines (`buildDrifts`, shared with the
  // merge wizard's own step-review pager). The < > pager steps through
  // them: each jump selects the drift (neon outline) and pans to it.
  const drifts = buildDrifts(item, frame)
  const matchedDrift = drifts.findIndex((d) =>
    d.kind === 'design'
      ? syncSelection?.layerId === d.layerId
      : syncSelection?.fileId === d.fileId &&
        syncSelection?.line != null &&
        d.line >= syncSelection.line &&
        d.line <= (syncSelection.endLine ?? syncSelection.line)
  )
  const currentDrift = matchedDrift >= 0 ? matchedDrift : driftIdx

  function goDrift(dir) {
    const n = drifts.length
    if (!n) return
    const next = currentDrift < 0 ? (dir > 0 ? 0 : n - 1) : (currentDrift + dir + n) % n
    const d = drifts[next]
    setDriftIdx(next)
    // `openDeck: true`, not `keepDeck` — the canvas's own floating drift
    // popover is gone (its detail now lives inline in the Block Deck's
    // Compare tab), so the pager needs the deck actually forced open to
    // show anything for the drift it just jumped to; `keepDeck` alone
    // would only avoid closing an already-open deck, not open a closed
    // one. `noPan` stays: quickly paging through drifts still shouldn't
    // yank the camera around, only select/highlight.
    requestMergeFocus({
      itemId: item.id,
      openDeck: true,
      noPan: true,
      label: d.label,
      ...(d.kind === 'design' ? { layerId: d.layerId } : { fileId: d.fileId, line: d.line }),
    })
  }

  const driftLayerIds = new Set(Object.keys(designMergeVariants[item.id]?.layerDiffs ?? {}))
  const layerCodeMap = designMergeVariants[item.id]?.layerCodeMap ?? {}
  const linkedLayerIds = new Set(Object.keys(layerCodeMap))
  const spanEnd = (t) => t.line + (t.span ?? 1) - 1
  const linkedLines = new Set(
    Object.values(layerCodeMap).flatMap((t) =>
      Array.from({ length: t.span ?? 1 }, (_, i) => `${t.fileId}:${t.line + i}`)
    )
  )
  function hoverLayer(layerId) {
    const t = layerId ? layerCodeMap[layerId] : null
    setHover(layerId ? { layerId, fileId: t?.fileId, line: t?.line, endLine: t && spanEnd(t) } : null)
  }
  function hoverLine(fileId, line) {
    const layerId = line
      ? Object.keys(layerCodeMap).find(
          (id) => layerCodeMap[id].fileId === fileId && line >= layerCodeMap[id].line && line <= spanEnd(layerCodeMap[id])
        )
      : null
    const t = layerId ? layerCodeMap[layerId] : null
    setHover(line ? { layerId, fileId, line: t ? t.line : line, endLine: t ? spanEnd(t) : line } : null)
  }

  // Selection wrappers: remember the clicked element (inline-AI anchor) and
  // open the inline bar.
  function pickLayer(layerId, el) {
    anchorElRef.current = el
    anchorMetaRef.current = { kind: 'layer', frameKey: el.closest('[data-frame-key]')?.dataset.frameKey }
    setFrameSel(null)
    setAiStage('badge')
    onSelectLayer(layerId)
    onFocusSource?.('design')
  }
  function pickLine(fileId, line, el) {
    anchorElRef.current = el
    anchorMetaRef.current = { kind: 'line' }
    setFrameSel(null)
    setAiStage('badge')
    onSelectLine(fileId, line)
    onFocusSource?.('code')
  }
  function pickFrame(key, el) {
    anchorElRef.current = el
    anchorMetaRef.current = { kind: 'frame', frameKey: key }
    setFrameSel(key)
    setAiStage('badge')
    onSelectFrame()
    onFocusSource?.('design')
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
      const original = (files.find((f) => f.id === a.fileId)?.lines ?? getFileLines(a.fileId))[a.line - 1] ?? ''
      const incoming = codeMergeVariants[item.id]?.[a.fileId]?.find((d) => d.line === a.line)?.incoming ?? original
      codeEdits[`${a.fileId}:${a.line}`] = `${incoming.replace(/\s*\/\/ AI:.*$/, '')}  // AI: ${a.summary}`
    }
  }

  // Share the annotation list upward so the Block Deck's merge button can
  // bundle it into the wizard.
  useEffect(() => {
    onAnnotationsChange?.(annotations)
  }, [annotations, onAnnotationsChange])

  const selectionKey = `${syncSelection?.layerId}|${syncSelection?.fileId}|${syncSelection?.line}|${frameSel}`
  const hasSelection = Boolean(syncSelection?.layerId || syncSelection?.line || frameSel)
  const selectionLabel = frameSel
    ? frameSel === 'a'
      ? 'Original Design'
      : 'Current Implementation'
    : (frame?.layers.find((l) => l.id === syncSelection?.layerId)?.name ??
      (syncSelection?.line ? `line ${syncSelection.line}` : 'selection'))


  // Connectors, the AI-edit anchor, and annotation pins are measured from
  // the live DOM every frame while any of them exist, so they track
  // panning, zooming, card dragging/resizing and the code scroller without
  // bookkeeping. State only updates when the result actually changes.
  useEffect(() => {
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
            } else if (code.top >= rA.bottom) {
              // Design-first layout: from the top of the code card up to the
              // bottom of the Original Design artboard.
              const x = Math.min(Math.max((rA.left + rA.right) / 2, code.left + 12), code.right - 12)
              const from = { x, y: code.top }
              const to = { x, y: rA.bottom }
              paths.push({ ...linkGeometryV(from, to), label: 'Code changes', axis: 'v', gap: from.y - to.y })
            } else if (rA.top >= code.bottom) {
              // Stacked layout: from the bottom of the code card down to the
              // Option A artboard's label.
              const wrapA = find('[data-frame-key="a"]')
              const wr = wrapA ? rel(wrapA.getBoundingClientRect()) : rA
              const x = Math.min(Math.max(wr.left + 40, code.left + 12), code.right - 12)
              const from = { x, y: code.bottom }
              const to = { x, y: wr.top }
              paths.push({ ...linkGeometryV(from, to), label: 'Code changes', axis: 'v', gap: to.y - from.y })
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

        // Selection regions, drawn only on demand: the selected design layer on
        // both artboards, the selected code block in both diff columns
        // (clipped to what is visible in the card / artboard), or a whole
        // selected artboard.
        const boxes = []
        const clip = (r, c) => {
          const left = Math.max(r.left, c.left)
          const right = Math.min(r.right, c.right)
          const top = Math.max(r.top, c.top)
          const bottom = Math.min(r.bottom, c.bottom)
          return right - left > 2 && bottom - top > 2 ? { left, right, top, bottom } : null
        }
        // `size` (optional): the element's real design size — its unscaled
        // layout box, unaffected by canvas zoom or artboard scaling.
        const push = (r, strong, key, size) =>
          boxes.push({ key, x: Math.round(r.left - 3), y: Math.round(r.top - 3), w: Math.round(r.right - r.left + 6), h: Math.round(r.bottom - r.top + 6), strong, size })

        for (const fk of ['a', 'b']) {
          const frameBox = find(`[data-frame-key="${fk}"] [data-frame-box]`)
          if (!frameBox) continue
          const fr = rel(frameBox.getBoundingClientRect())
          if (frameSel === fk) push(fr, true, `frame-${fk}`)
          const layerEls = container.querySelectorAll(`[data-frame-key="${fk}"] [data-layer-id]`)
          layerEls.forEach((el) => {
            const id = el.getAttribute('data-layer-id')
            // On-demand only: just the clicked / selected element.
            const strong = id === syncSelection?.layerId
            if (!strong) return
            const r = clip(rel(el.getBoundingClientRect()), fr)
            if (r) push(r, strong, `layer-${fk}-${id}`, { w: el.offsetWidth, h: el.offsetHeight })
          })
        }

        if (codeEl) {
          const scroller = codeEl.querySelector('[data-code-scroll]')
          const sr = scroller ? rel(scroller.getBoundingClientRect()) : null
          const rows = []
          codeEl.querySelectorAll('[data-selected]').forEach((el) => {
            const r = sr && clip(rel(el.getBoundingClientRect()), sr)
            if (r) rows.push({ ...r, strong: el.hasAttribute('data-selected') })
          })
          // merge vertically adjacent rows of the same column into one region
          rows.sort((a, b) => Math.round(a.left) - Math.round(b.left) || a.top - b.top)
          const merged = []
          for (const r of rows) {
            const last = merged[merged.length - 1]
            if (last && Math.abs(last.left - r.left) < 2 && r.top - last.bottom < 3) {
              last.bottom = Math.max(last.bottom, r.bottom)
              last.strong = last.strong || r.strong
            } else merged.push({ ...r })
          }
          merged.forEach((r, i) => push(r, r.strong, `code-${i}`))
        }

        const next = { paths, anchor, pins, boxes }
        setLinks((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
      }
      raf = requestAnimationFrame(measure)
    }
    raf = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(raf)
  }, [hasSelection, selectionKey, syncSelection?.layerId, frameSel, annotations, item.id])

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
  for (const [layerId, assembly] of Object.entries(assemblies ?? {})) {
    const layer = frame?.layers.find((l) => l.id === layerId)
    const o = layer && assemblyToOverride(assembly, layer)
    if (o) overrides[layerId] = mergeOverride(overrides[layerId], o)
  }
  // Code -> canvas sync: hand-edited (and in-progress) code lines restyle
  // their linked layers on the Current Implementation artboard.
  for (const [layerId, o] of Object.entries(codeOverrides(item.id, frame, syncedCode ?? manualCode, getFileLines))) {
    overrides[layerId] = mergeOverride(overrides[layerId], o)
  }
  // Variant drifts: every drifted layer renders its Current Implementation
  // value (or the chosen / hovered one) underneath the edits above.
  // Exact values set in the Assemble inspector (radius, W/H) win over the
  // drift's default, so what's typed is exactly what renders.
  for (const [layerId, e] of Object.entries(variantPreviews ?? {})) {
    const base = overrides[layerId]
    const exact = assemblies?.[layerId] ?? {}
    overrides[layerId] = {
      ...base,
      radius: exact.radius !== undefined || exact.shape ? base?.radius : (e.radius ?? base?.radius),
      fontWeight: e.fontWeight ?? base?.fontWeight,
      dw: (base?.dw ?? 0) + (exact.width !== undefined ? 0 : (e.dw ?? 0)),
      dh: (base?.dh ?? 0) + (exact.height !== undefined ? 0 : (e.dh ?? 0)),
      className: base?.className ?? e.className,
    }
  }
  const selId = syncSelection?.layerId
  if (selId && appliedPreset) overrides[selId] = { ...overrides[selId], className: appliedPreset.previewClass }

  const scale = view.zoom / 100
  const gridSize = 18 * scale
  // Left inset of the floating header/toolbar rows. Fixed regardless of the
  // Merge List drawer: it overlays the canvas rather than pushing it, so
  // the rows (and the stepper centered within them) keep one stable center
  // axis instead of jumping sideways each time the drawer toggles.
  const leftInset = 16

  // Zoom pill + Changes Log placement: right-anchored at `right-3` by
  // default, but the AI chat bar is independently centered on the *whole*
  // viewport — at narrower windows its right edge can reach past where
  // that default would put this row. Measuring the AI bar's actual rect
  // and pushing `right` out just enough to clear it (recomputed on resize
  // and whenever the row's own width changes, e.g. the Changes Log panel
  // opening) keeps the two from ever overlapping, at any window size,
  // instead of relying on a fixed offset that only happens to work at
  // some widths.
  useLayoutEffect(() => {
    function recompute() {
      const row = zoomRowRef.current
      const aiBar = document.querySelector('[data-ai-bar]')
      if (!row || !aiBar) return
      const aiRight = aiBar.getBoundingClientRect().right
      const rowWidth = row.getBoundingClientRect().width
      const minLeft = aiRight + 12
      const desiredLeft = window.innerWidth - 12 - rowWidth
      setZoomRowRight(desiredLeft < minLeft ? Math.max(12, window.innerWidth - minLeft - rowWidth) : 12)
    }
    recompute()
    const ro = new ResizeObserver(recompute)
    if (zoomRowRef.current) ro.observe(zoomRowRef.current)
    window.addEventListener('resize', recompute)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', recompute)
    }
  }, [summaryOpen])

  return (
    // `bg-slate-800`, not the shared `bg-card` token — a dedicated, slightly
    // brighter/airier tone for just the canvas surface (vs. the darker
    // `bg-card`/`bg-slate-900` still used by panels and the code window),
    // so the whole app's other dark surfaces are untouched.
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-800">
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
                  hoverEnd={hover?.endLine}
                  hoverFileId={hover?.fileId}
                  onHoverLine={hoverLine}
                  highlightFileId={syncSelection?.fileId}
                  highlightLine={syncSelection?.line}
                  highlightEnd={syncSelection?.endLine}
                  onSelectLine={pickLine}
                  incomingEdits={codeEdits}
                  manualCode={codeWindowCode ?? manualCode}
                  reveal={codeReveal}
                  onEditLine={onEditCode}
                  onLiveLine={onLiveEditCode}
                  highlightRef={highlightRef}
                />
              )}

              {frame && (
                <>
                  <StaticFrame
                    frameKey="a"
                    frame={frame}
                    label="Original Design"
                    x={layout.a.x}
                    y={layout.a.y}
                    w={layout.a.w}
                    h={layout.a.h}
                    onResizeStart={startResize('a')}
                    z={order.a}
                    onDragStart={startCardDrag('a')}
                    onClickCapture={swallowDragClick}
                    linkedLayerIds={linkedLayerIds}
                    driftLayerIds={driftLayerIds}
                    hoverLayerId={hover?.layerId}
                    onHoverLayer={hoverLayer}
                    selectedLayerId={syncSelection?.layerId}
                    onSelectLayer={pickLayer}
                    onSelectFrame={pickFrame}
                  />
                  <StaticFrame
                    frameKey="b"
                    frame={frame}
                    label="Current Implementation"
                    editable
                    onEditText={onEditText}
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
                    driftLayerIds={driftLayerIds}
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
            <linearGradient id="accent-link" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#6ee7b7" />
            </linearGradient>
          </defs>
          {links.boxes.map((b) => (
            <g key={b.key}>
              <rect
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
                rx={5}
                fill="none"
                stroke="#34d399"
                strokeWidth={b.strong ? 1.5 : 1}
                strokeOpacity={b.strong ? 1 : 0.5}
              />
            </g>
          ))}
          {links.paths.map((p, i) => (
            <g key={i}>
              <path d={p.d} fill="none" stroke="url(#accent-link)" strokeWidth={1.5} strokeOpacity={0.85} strokeLinecap="round" />
              {[p.from, p.to].map((pt, j) => (
                <circle key={j} cx={pt.x} cy={pt.y} r={3} fill="#d1fae5" stroke="#34d399" strokeWidth={1} />
              ))}
            </g>
          ))}
        </svg>

        {/* Dimension overlay: a width × height readout for each "strong"
            (actually-selected, not just linked) box — divided back out of
            the current zoom so it reads the element's real design size,
            not however many screen pixels it happens to take up at the
            moment. `b.w - 6` / `b.h - 6` undoes the 3px outline padding
            `push()` adds around the measured element. Guarded against a
            zero/invalid zoom (would otherwise divide by zero and print
            "NaN × NaN"), and right-aligned to the box's own bottom-right
            corner (`-translate-x-full`) rather than extending past it —
            sitting just below it, within its own footprint, instead of
            spilling sideways into whatever neighboring element happens to
            sit directly to the right (a Subscribe button next to a form
            field, say), which centering *or* a rightward offset both did. */}
        {links.boxes
          // Design boxes only — code-line selections (`code-*`) already
          // read clearly from their own row highlight, and a size readout
          // on them was just clutter.
          .filter((b) => b.strong && !b.key.startsWith('code-'))
          .map((b) => {
            const zoomFactor = view.zoom > 0 ? view.zoom / 100 : 1
            const w = b.size ? b.size.w : Math.round((b.w - 6) / zoomFactor)
            const h = b.size ? b.size.h : Math.round((b.h - 6) / zoomFactor)
            if (!Number.isFinite(w) || !Number.isFinite(h)) return null
            return (
              <span
                key={`dim-${b.key}`}
                style={{ left: b.x + b.w, top: b.y + b.h + 6 }}
                className="pointer-events-none absolute z-10 -translate-x-full rounded-full bg-emerald-400 px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap text-slate-950 shadow-md shadow-emerald-400/30"
              >
                {Math.max(0, w)} × {Math.max(0, h)}
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

        {/* Header row: macro stepper centered, Apply with AI on the right
            (the [Merge Changes] CTA itself now lives in the drift-nav row
            below, next to the drift pager). Kept clear of the docked Block
            Deck via `reserve`. The stepper is centered with its own
            `absolute left-1/2` inside this box (not a `1fr auto 1fr` grid)
            so its position never depends on how wide the right-side
            "Apply with AI" button happens to be — a 1fr/auto/1fr grid only
            centers the middle column when both flanking columns have equal
            content width, and the empty left column vs. a real button on
            the right broke that. This way it's always dead-center of the
            [leftInset, right: 12+reserve] box, matching the workspace
            canvas regardless of sidebar/deck state. */}
        {/* Top-center stepper: centered on the whole studio canvas
            (absolute left-1/2), independent of the right-docked Block Deck
            / wizard reserve, so opening or closing them never moves it. */}
        <div className="pointer-events-auto absolute top-3 left-1/2 z-20 flex h-9 -translate-x-1/2 items-center">
          <MacroStepper stage={stage} disabled={merged} onOpenStep={(step) => onMerge(annotations, step)} />
        </div>

        {/* Right-hand header cluster (notifications + avatars, Preview,
            Apply with AI): this one does step aside for the docked deck. */}
        <div
          className="pointer-events-none absolute top-3 z-20 flex h-9 items-center"
          style={{ left: leftInset, right: 12 + reserve }}
        >
          {/* The back-to-workspace / sidebar-toggle / "Merge Studio" label
              cluster that used to live here moved up to
              MergeStudioWorkspace.jsx instead — it needs to stay on screen
              even before an item is selected (this whole canvas doesn't
              mount until one is), so it can't live inside this
              per-item component. `pointer-events-none` on this outer box
              (only the two clusters below opt back in) — otherwise this
              row's own empty space, right where the floating back button
              sits at this same `left: leftInset` starting edge, silently
              swallows clicks meant for it, since a transparent box still
              hit-tests above whatever's underneath it. */}
          <div className="pointer-events-auto ml-auto flex items-center gap-2">
          {/* Same presence cluster as the main Workspace TopBar (teammate
              avatars that follow-on-click + your own profile menu) — that
              bar is hidden in Merge Studio, so it lives here instead, in a
              glass pill matched to the Preview button's 30px height. */}
          <div className={cn('flex h-[30px] items-center gap-1 rounded-full pr-1.5 pl-1', FLOATING_PILL)}>
            {/* Notifications (the merge inbox) live with the people who
                send them: right beside the avatars. */}
            <button
              type="button"
              title="Notifications"
              onClick={() => setMergeDrawer(mergeDrawer === 'inbox' ? null : 'inbox')}
              className={cn(
                'relative flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground',
                mergeDrawer === 'inbox' && 'bg-indigo-500/20 text-indigo-300'
              )}
            >
              <Bell className="size-3.5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex min-w-3.5 items-center justify-center rounded-full bg-indigo-500 px-1 text-[9px] leading-[14px] font-semibold text-white ring-2 ring-card">
                  {unreadCount}
                </span>
              )}
            </button>
            <span className="h-4 w-px bg-white/10" />
            <UserPresence />
          </div>
          <button
            type="button"
            onClick={() => setMergePreviewOpen((v) => !v)}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors',
              FLOATING_PILL,
              mergePreviewOpen ? 'border-primary bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'
            )}
          >
            <PanelRight className="size-3.5" />
            Preview
          </button>
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
                <span className="rounded-full bg-indigo-500/20 px-1.5 text-[10px] text-indigo-300">
                  {pendingCount}
                </span>
              )}
            </button>
          )}
          </div>
        </div>

        {/* Contextual sub-toolbar directly under the header: the drift
            navigator (when there's more than one) sits right next to the
            main [Merge Changes] CTA, so review and merge live in the same
            row instead of the CTA being off in the top header. Hidden
            entirely once the wizard modal takes over (`stage` stops being
            'compare') — its own header already covers the same ground
            (step progress instead of the pager, since drift detail now
            lives in the Block Deck), so leaving this up too would just be
            redundant, clashing UI. */}
        {stage === 'compare' && (
        <div className="pointer-events-none absolute top-14 left-1/2 z-20 flex -translate-x-1/2 justify-center">
          <div className="pointer-events-auto flex items-center gap-2">
            {drifts.length > 1 && (
              <div className={cn('relative flex items-center gap-1 rounded-full p-1.5 text-sm', FLOATING_PILL)}>
                <button
                  type="button"
                  onClick={() => goDrift(-1)}
                  title="Previous drift"
                  className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <ChevronLeft className="size-4.5" />
                </button>
                {/* Plain label, not a button — drift detail now lives inline
                    in the Block Deck's Compare tab (no more floating
                    popover here for this to show/hide). */}
                <span className="min-w-20 rounded-full px-1.5 text-center font-medium text-foreground tabular-nums">
                  Drift {currentDrift >= 0 ? currentDrift + 1 : '–'}/{drifts.length}
                </span>
                <button
                  type="button"
                  onClick={() => goDrift(1)}
                  title="Next drift"
                  className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <ChevronRight className="size-4.5" />
                </button>
              </div>
            )}

            <button
              type="button"
              disabled={merged}
              onClick={() => onMerge(annotations)}
              className={cn(
                'flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold shadow-lg transition-all disabled:cursor-default',
                merged
                  ? 'border border-emerald-500/40 bg-emerald-500/15 text-emerald-400'
                  : 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-indigo-500/30 hover:brightness-110 disabled:opacity-50'
              )}
            >
              {merged ? <Check className="size-4" /> : <GitMerge className="size-4" />}
              {merged ? 'Merged' : 'Merge Changes'}
              {!merged && resolutionCount + annotations.filter((a) => a.status === 'done').length > 0 && (
                <span className="rounded-full bg-white/20 px-1.5 text-xs">
                  {resolutionCount + annotations.filter((a) => a.status === 'done').length}
                </span>
              )}
            </button>
          </div>
        </div>
        )}
      </div>

      {/* Bottom-right row: zoom pill sits directly beside the Changes Log
          toggle (both `items-end`-aligned so the zoom pill's bottom edge
          always lines up with the log's own button, whether or not its
          panel is open), pushed clear of the centered AI chat bar's
          measured right edge (`zoomRowRight`, see the layout effect above)
          instead of a fixed `right-3` that could overlap it at narrower
          window widths. `bottom-5` — not `bottom-3` — to sit on the exact
          same baseline as the AI chat bar (`fixed bottom-5` in
          MergeAiBar.jsx), instead of 8px higher. */}
      <div ref={zoomRowRef} className="absolute bottom-5 z-20 flex items-end gap-3" style={{ right: zoomRowRight }}>
        <div className={cn('flex h-11 items-center gap-1.5 rounded-full px-2 text-sm', FLOATING_PILL)}>
          <button
            type="button"
            onClick={() => zoomFromCenter(-ZOOM_STEP)}
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Minus className="size-4" />
          </button>
          <span className="w-12 text-center text-sm tabular-nums text-foreground">{Math.round(view.zoom)}%</span>
          <button
            type="button"
            onClick={() => zoomFromCenter(ZOOM_STEP)}
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Plus className="size-4" />
          </button>
          <button
            type="button"
            title="Reset view and layout"
            onClick={() => {
              const lay = defaultLayout(frame)
              setView(fitView(lay))
              setLayout(lay)
            }}
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Maximize className="size-4" />
          </button>
        </div>

        {stage === 'compare' && (() => {
          const presetObj =
            appliedPreset && syncSelection?.layerId
              ? { layerId: syncSelection.layerId, label: appliedPreset.label, previewClass: appliedPreset.previewClass }
              : null
          const summary = buildSummary(item, resolutions ?? {}, annotations, presetObj, assemblies ?? {}, extraLayers ?? [], manualCode ?? {}, files.filter((f) => f.id === COPY_FILE_ID))
          const entries = [
            ...summary.design.map((d) => {
              let kind = 'variant'
              let layerId = d.key.slice(0, d.key.indexOf(':'))
              if (d.key.startsWith('assembly-')) [kind, layerId] = ['assembly', d.key.slice(9)]
              else if (d.key.startsWith('added-')) [kind, layerId] = ['component', d.key.slice(6)]
              else if (d.key === 'preset') [kind, layerId] = ['preset', presetObj?.layerId]
              return { id: d.key, key: d.key, kind, layerId, title: d.text, detail: d.choice }
            }),
            ...Object.entries(manualCode ?? {}).map(([key, text]) => {
              const split = key.lastIndexOf(':')
              const fileId = key.slice(0, split)
              const line = Number(key.slice(split + 1))
              const name = files.find((f) => f.id === fileId)?.name ?? fileId
              // copy.json lines read as the text they changed, not raw JSON.
              const entry = fileId === COPY_FILE_ID ? copyEntries(frame)[line - 2] : null
              const parsed = entry ? parseCopyLine(text) : null
              if (entry && parsed) return { id: `code-${key}`, kind: 'code', layerId: entry.layerId, fileId, line, title: `${entry.name} · text`, detail: `“${parsed.value}”` }
              return { id: `code-${key}`, kind: 'code', fileId, line, title: `${name} · line ${line}`, detail: `Edited: ${text.trim() || '(empty line)'}` }
            }),
            ...annotations.map((a) => ({
              id: a.id,
              kind: 'annotation',
              layerId: a.layerId,
              fileId: a.fileId,
              line: a.line,
              title: `“${a.text}”`,
              detail: a.status === 'done' ? a.summary : a.status === 'thinking' ? 'AI is updating…' : 'Not applied yet',
            })),
          ]
          return (
            <ChangesLog
              entries={entries}
              codeRows={summary.files.filter((f) => f.changed > 0 || f.aiLines > 0 || f.manualLines > 0)}
              open={summaryOpen}
              onToggle={() => setSummaryOpen((v) => !v)}
              onJump={(e) =>
                requestMergeFocus({
                  itemId: item.id,
                  keepDeck: true,
                  label: e.title,
                  ...(e.layerId ? { layerId: e.layerId } : { fileId: e.fileId, line: e.line }),
                })
              }
              onUndo={(e) => (e.kind === 'annotation' ? deleteAnnotation(e.id) : onUndoChange?.(e))}
            />
          )
        })()}
      </div>
    </div>
  )
}

export default MergeInfiniteCanvas
