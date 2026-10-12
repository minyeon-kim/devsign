import { useEffect, useRef, useState } from 'react'
import { Crosshair, Maximize2, Minimize2, Minus, Plus, ScanSearch } from 'lucide-react'
import { cn } from 'cn'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { LocalizedText } from '@/i18n/runtime'
import { StaticLayer } from '@/components/mergestudio/MergeInfiniteCanvas'
import ChangePreview from '@/components/conflicts/ChangePreview'
import { COMPARE_MIN_CELL, codeOverridesOf, codeSidesOf, compareRegionOf, compareScaleOf, compareSidesOf, cropOf, markOf, shortValue, targetOf } from '@/lib/elementPreview'
import CodeRender from '@/components/history/CodeRender'
import { layoutChanged, screensChanged } from '@/lib/codeRender'
import { BREAKPOINT_LABEL, referencePick, screenOf } from '@/lib/devicePresets'
import DevicePicker from '@/components/history/DevicePicker'

// A Conflict Point's element, by itself.
//   · ElementView — the frame drawn at a scale, cut to a region, the element
//     marked where the difference is. Never interactive.
//   · ComponentSample — for a conflict whose component isn't on its design
//     frame: the component drawn alone from the conflict's own values.
//   · ElementPreviewDialog — the thumbnail's larger view: the current code
//     beside the design (or one at a time), the changed element marked, its
//     place in the whole screen, and full screen.

const MARK_TONE = { open: '251 191 36', done: '52 211 153' }

// The mark over an element, in frame coordinates (it scales with the frame;
// `scale` keeps its line the same weight on screen).
function ElementMark({ layer, mark, scale, tone }) {
  const rgb = MARK_TONE[tone]
  const line = 2 / scale
  const style = { left: layer.x, top: layer.y, width: layer.width, height: layer.height }
  if (mark.kind === 'inset') {
    // The padding itself: a band along the inside edge.
    return <span aria-hidden data-element-mark="inset" className="pointer-events-none absolute z-10 rounded-[inherit]" style={{ ...style, borderRadius: 10, boxShadow: `inset 0 0 0 ${mark.band}px rgb(${rgb} / 38%), 0 0 0 ${line}px rgb(${rgb})` }} />
  }
  return <span aria-hidden data-element-mark={mark.kind} className="pointer-events-none absolute z-10" style={{ left: layer.x - 3, top: layer.y - 3, width: layer.width + 6, height: layer.height + 6, borderRadius: 8, boxShadow: `0 0 0 ${line}px rgb(${rgb}), 0 0 0 ${line * 3}px rgb(${rgb} / 22%)` }} />
}

export function ElementView({ frame, region, scale, overrides = {}, markIds = [], mark = { kind: 'outline' }, tone = 'open', className }) {
  return (
    <span data-element-view className={cn('relative block shrink-0 overflow-hidden bg-white', className)} style={{ width: region.width * scale, height: region.height * scale }}>
      <span aria-hidden className="pointer-events-none absolute block origin-top-left" style={{ left: -region.x * scale, top: -region.y * scale, width: frame.width, height: frame.height, transform: `scale(${scale})` }}>
        {frame.layers.map((layer) => <StaticLayer key={layer.id} layer={layer} override={overrides[layer.id]} onSelect={() => {}} />)}
        {frame.layers.filter((layer) => markIds.includes(layer.id)).map((layer) => <ElementMark key={`mark-${layer.id}`} layer={layer} mark={mark} scale={scale} tone={tone} />)}
      </span>
    </span>
  )
}

// A chart's legend under its bars: the items `gap` apart — the space between
// them tinted when marked.
function LegendSample({ gap, marked, zoom = 1 }) {
  const items = [['Revenue', '#6366f1'], ['Orders', '#22c55e'], ['Visitors', '#f59e0b']]
  const space = parseFloat(gap) * zoom
  return (
    <span data-sample="legend" className="flex flex-col items-start rounded-lg bg-white" style={{ padding: 8 * zoom, gap: 6 * zoom }}>
      <span className="flex items-end" style={{ height: 22 * zoom, gap: 3 * zoom }}>
        {[45, 70, 55, 90, 65, 80].map((value, index) => <span key={index} className="rounded-[1px]" style={{ width: 7 * zoom, height: `${value}%`, background: index % 3 === 0 ? '#6366f1' : index % 3 === 1 ? '#22c55e' : '#f59e0b', opacity: 0.85 }} />)}
      </span>
      <span className="flex items-center">
        {items.map(([label, color], index) => (
          <span key={label} className="flex items-center">
            {index > 0 && <span aria-hidden data-element-mark={marked ? 'gap' : undefined} className="self-stretch" style={{ width: space, background: marked ? 'rgb(251 191 36 / 55%)' : undefined, outline: marked ? `${Math.max(1, zoom * 0.5)}px solid rgb(251 191 36)` : undefined }} />}
            <span className="flex items-center font-medium text-slate-700" style={{ gap: 2 * zoom, fontSize: 7 * zoom, lineHeight: `${10 * zoom}px` }}>
              <span className="rounded-full" style={{ width: 5 * zoom, height: 5 * zoom, background: color }} />
              {label}
            </span>
          </span>
        ))}
      </span>
    </span>
  )
}

// Whether a conflict has a component of its own to draw (no element on the
// frame, but a sample or a preview spec).
export const hasSample = (conflict) => Boolean(conflict?.sample === 'legend' || conflict?.preview)

export function ComponentSample({ conflict, side = 'before', marked = false, zoom = 1 }) {
  if (conflict.sample === 'legend') return <LegendSample gap={conflict.preview?.[side]?.gap ?? '8px'} marked={marked} zoom={zoom} />
  return (
    <span data-sample="preview" className="block w-56 origin-center" style={{ transform: `scale(${zoom})` }}>
      <ChangePreview preview={conflict.preview} side={side} showLabels={false} />
    </span>
  )
}

function useBox(dependency) {
  const ref = useRef(null)
  const [box, setBox] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const element = ref.current
    if (!element) return undefined
    const observer = new ResizeObserver(([entry]) => setBox({ width: entry.contentRect.width, height: entry.contentRect.height }))
    observer.observe(element)
    return () => observer.disconnect()
  }, [dependency])
  return [ref, box]
}

// The changed value, said on the element: a small label at its corner (the
// mark around it shows where — an inset band for a padding, an outline else).
function ValueLabel({ layer, region, scale, value, tone }) {
  return (
    <span data-compare-value className={cn('pointer-events-none absolute z-20 rounded px-1.5 py-0.5 text-[11px] leading-4 font-semibold whitespace-nowrap tabular-nums shadow', tone === 'problem' ? 'bg-rose-500 text-white' : 'bg-emerald-400 text-slate-950')} style={{ left: Math.max(4, (layer.x - region.x) * scale + 4), top: Math.max(4, (layer.y - region.y) * scale + 4) }} translate="no">
      {shortValue(value)}
    </span>
  )
}

function CompareCell({ conflict, target, entry, resolved }) {
  const [ref, box] = useBox(entry.key)
  const problem = entry.key === 'built'
  let drawing = null
  if (box.width > 0 && target) {
    const region = compareRegionOf(target.frame, target.mainId)
    const scale = compareScaleOf(box.width, region)
    const layer = target.frame.layers.find((candidate) => candidate.id === target.mainId)
    const mark = markOf(conflict, target.frame, entry.side)
    drawing = (
      <span className="relative block">
        <ElementView
          frame={target.frame}
          region={region}
          scale={scale}
          overrides={entry.side === 'before' ? codeOverridesOf(conflict, target.frame) : {}}
          markIds={[target.mainId]}
          mark={mark}
          tone={problem && !resolved ? 'open' : 'done'}
          className="rounded-lg ring-1 ring-slate-200/80"
        />
        <ValueLabel layer={layer} region={region} scale={scale} value={entry.value} tone={problem ? 'problem' : 'ok'} />
      </span>
    )
  } else if (box.width > 0) {
    // (Not on the design screen: the component drawn alone from its values.)
    drawing = <ComponentSample conflict={conflict} side={entry.side} marked zoom={conflict.sample === 'legend' ? Math.max(1, Math.min(3, (box.width - 24) / 150)) : Math.min(1.4, box.width / 240)} />
  }
  return (
    <figure data-compare-cell={entry.key} className="m-0 flex min-w-0 flex-col">
      <div ref={ref} className="flex min-h-[96px] items-center justify-center overflow-hidden rounded-lg bg-black/20 p-0">{drawing}</div>
      <figcaption className="mt-2 text-center text-[11.5px] leading-4 text-slate-300">
        <span className={cn('font-medium', problem ? 'text-rose-200' : entry.key === 'applied' ? 'text-emerald-200' : 'text-slate-100')}>{entry.label}</span>
        <span translate="no"> · {entry.value}</span>
      </figcaption>
    </figure>
  )
}

// A value change's element, enlarged and compared — the design, the code as
// built and (once it's in) what was applied — with the value said on each.
// Cells are at least 200px wide and stack when there isn't room for them
// side by side (never a sideways scroll). Draws nothing for a change that
// has no element or sample of its own (a layout: that's compared as screens).
export function ElementCompare({ conflict, link, onFullscreen, className }) {
  const target = targetOf(conflict, link)
  const sides = compareSidesOf(conflict)
  if (!sides.length || (!target && !hasSample(conflict))) return null
  const resolved = conflict.resolved || conflict.reviewStage === 'resolved'
  return (
    <div data-element-compare className={cn('min-w-0', className)}>
      <div className="mb-2 flex items-center gap-2">
        <span className="min-w-0 truncate text-[12px] text-slate-400" translate="no">{[link?.frame?.name, link?.layer?.name ?? conflict.impact?.components?.[0]].filter(Boolean).join(' · ')}</span>
        {onFullscreen && (
          <button type="button" data-compare-fullscreen onClick={onFullscreen} className="ds-intrinsic ml-auto inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md bg-white/[0.06] px-2.5 text-[11.5px] font-medium text-slate-300 transition-colors hover:bg-white/[0.1] hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300">
            <Maximize2 className="size-3 shrink-0" />
            전체 화면으로 보기
          </button>
        )}
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${COMPARE_MIN_CELL}px, 1fr))` }}>
        {sides.map((entry) => <CompareCell key={entry.key} conflict={conflict} target={target} entry={entry} resolved={resolved} />)}
      </div>
    </div>
  )
}

// One side, as large as its pane allows.
function Pane({ label, value, conflict, target, link, side, marked, whole, tone, resizeKey, sides, screen, zoom = 1, over = null, bare = false }) {
  const [ref, box] = useBox(resizeKey)
  const frame = target?.frame ?? link?.frame
  let content = null
  if (box.width > 0 && sides && !whole) {
    // A layout the code decides: that side's code on a screen of the width
    // picked, the grid marked where the two sides differ at that width.
    const scale = Math.max(0.05, Math.min(1, (box.width - 8) / screen.width, (box.height - 8) / screen.height)) * zoom
    content = <CodeRender spec={sides[side]} screen={screen} scale={scale} marked={marked && layoutChanged(sides.before, sides.after, screen)} />
  } else if (box.width > 0 && frame && (target || whole)) {
    const region = whole || !target ? { x: 0, y: 0, width: frame.width, height: frame.height } : cropOf(frame, target.ids, 14)
    const scale = Math.max(0.05, Math.min(whole ? 2.5 : 4, (box.width - 8) / region.width, (box.height - 8) / region.height)) * zoom
    content = (
      <ElementView
        frame={frame}
        region={region}
        scale={scale}
        overrides={side === 'before' && target ? codeOverridesOf(conflict, frame) : {}}
        // (Only a spacing rule is about every element it applies to; a
        // color or a weight is the one element's.)
        markIds={!marked || !target ? [] : markOf(conflict, frame, side).kind === 'inset' ? target.ids : [target.mainId]}
        mark={target ? markOf(conflict, frame, side) : undefined}
        tone={tone}
        className="rounded-xl shadow-xl shadow-black/40 ring-1 ring-slate-200/80"
      />
    )
  } else if (box.width > 0) {
    content = <ComponentSample conflict={conflict} side={side} marked={marked} zoom={conflict.sample === 'legend' ? Math.max(1, Math.min(4, (box.width - 24) / 150, (box.height - 24) / 60)) : 1} />
  }
  if (bare) return <span ref={ref} className="flex size-full items-center justify-center bg-[#16181b]">{content}</span>
  return (
    <figure data-element-pane={side} className="m-0 flex min-h-0 min-w-0 flex-1 flex-col gap-2">
      <figcaption className="flex shrink-0 items-baseline gap-2 text-[12px]">
        <span className="font-semibold text-white"><LocalizedText text={label} /></span>
        {value && <span translate="no" className="min-w-0 truncate font-mono text-[11.5px] text-slate-300">{value}</span>}
      </figcaption>
      <div ref={ref} className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl bg-black/25">
        {content}
        {/* (The slider: the other side drawn over this one, cut at the handle.) */}
        {over}
      </div>
    </figure>
  )
}

const CONTROL = 'ds-intrinsic inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11.5px] font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-40'
const OFF = 'bg-white/[0.06] text-slate-300 hover:bg-white/[0.1] hover:text-white'
const ON = 'bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-300/40 ring-inset'

// `startFullscreen`: opened as the detail's full-screen viewer — it fills the
// window from the start, and Esc closes it.
export function ElementPreviewDialog({ conflict, link, open, onOpenChange, onReveal, onOpenReview, startFullscreen = false }) {
  const target = targetOf(conflict, link)
  const codeSides = codeSidesOf(conflict)
  const category = codeSides?.category ?? 'tablet'
  const [devicePick, setDevicePick] = useState(() => referencePick(category))
  const viewport = screenOf(devicePick, category)
  const differsHere = codeSides ? layoutChanged(codeSides.before, codeSides.after, viewport) : false
  const differsAt = codeSides ? screensChanged(codeSides.before, codeSides.after, category) : []
  const [sides, setSides] = useState('both')
  const [marked, setMarked] = useState(true)
  const [whole, setWhole] = useState(false)
  const [fullscreen, setFullscreen] = useState(startFullscreen)
  // Side by side, or one over the other with a handle to drag across.
  const [mode, setMode] = useState('side')
  const [cut, setCut] = useState(50)
  const [zoom, setZoom] = useState(1)
  const applied = compareSidesOf(conflict).find((entry) => entry.key === 'applied') ?? null
  const resolved = conflict.resolved || conflict.reviewStage === 'resolved'
  const field = conflict.comparisonFields?.find((entry) => entry.current !== entry.expected) ?? conflict.comparisonFields?.[0]
  // Whether there's anything to mark: an element on the frame, or a sample
  // that draws its own (the legend's gaps).
  const canMark = codeSides ? differsHere : Boolean(target) || conflict.sample === 'legend'
  // The code side is drawn from the conflict's values; when they can't be
  // put on the element, both sides are the design — said, not hidden.
  const sameDrawing = target ? Object.keys(codeOverridesOf(conflict, target.frame)).length === 0 : false

  // Esc leaves full screen first (the dialog would close on it otherwise).
  useEffect(() => {
    if (!open || !fullscreen || startFullscreen) return undefined
    function onKey(event) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      setFullscreen(false)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, fullscreen, startFullscreen])

  // (All of them: the code, the design and — once it's in — what was applied.)
  const shown = mode === 'slider' ? ['after'] : sides === 'both' ? ['before', 'after', ...(applied ? ['applied'] : [])] : [sides]
  const drawingOf = (side) => (side === 'applied' ? applied.side : side)
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) setFullscreen(false); onOpenChange(next) }}>
      <DialogContent
        data-element-preview
        data-fullscreen={fullscreen ? '' : undefined}
        className={cn(
          'flex flex-col gap-3 p-5',
          fullscreen
            ? 'top-0! left-0! h-dvh! w-screen! max-w-none! translate-x-0! translate-y-0! rounded-none!'
            : 'h-[min(620px,calc(100dvh-2rem))] w-[min(860px,calc(100vw-2rem))] sm:max-w-none'
        )}
      >
        <div className="shrink-0 pr-8">
          <DialogTitle className="text-[15px] font-semibold text-white"><LocalizedText text={conflict.title} /></DialogTitle>
          <DialogDescription className="mt-0.5 text-[12px] text-slate-400">
            {link?.frame && <span translate="no">{link.frame.name}</span>}
            {link?.layer && <span translate="no"> · {link.layer.name}</span>}
            {!link?.layer && <span translate="no">{link?.frame ? ' · ' : ''}{conflict.impact?.components?.[0] ?? conflict.file}</span>}
            {field && <span> · <LocalizedText text={field.label} /></span>}
          </DialogDescription>
        </div>

        <div data-element-controls className="flex shrink-0 flex-wrap items-center gap-2">
          <div role="tablist" aria-label="Sides shown" className="inline-flex h-7 items-center gap-0.5 rounded-md bg-white/[0.05] p-0.5">
            {[['both', 'Code beside design'], ['before', 'Current code'], ['after', 'Design']].map(([id, label]) => (
              <button key={id} type="button" role="tab" data-element-sides={id} aria-selected={sides === id} onClick={() => setSides(id)} className={cn('ds-intrinsic inline-flex h-6 items-center rounded px-2 text-[11.5px] font-medium whitespace-nowrap transition-colors', sides === id ? 'bg-white/[0.12] text-white' : 'text-slate-400 hover:text-slate-200')}>
                <LocalizedText text={label} />
              </button>
            ))}
          </div>
          <div role="tablist" aria-label="Compare mode" className="inline-flex h-7 items-center gap-0.5 rounded-md bg-white/[0.05] p-0.5">
            {[['side', '나란히'], ['slider', '슬라이더']].map(([id, label]) => (
              <button key={id} type="button" role="tab" data-element-mode={id} aria-selected={mode === id} onClick={() => setMode(id)} className={cn('ds-intrinsic inline-flex h-6 items-center rounded px-2 text-[11.5px] font-medium whitespace-nowrap transition-colors', mode === id ? 'bg-white/[0.12] text-white' : 'text-slate-400 hover:text-white')}>{label}</button>
            ))}
          </div>
          {codeSides && <DevicePicker category={category} pick={devicePick} onPick={setDevicePick} screen={viewport} />}
          <div data-element-zoom className="inline-flex h-7 items-center gap-0.5 rounded-md bg-white/[0.05] px-0.5">
            <button type="button" aria-label="축소" disabled={zoom <= 0.5} onClick={() => setZoom((value) => Math.max(0.5, +(value - 0.25).toFixed(2)))} className="ds-intrinsic flex size-6 items-center justify-center rounded text-slate-300 hover:bg-white/[0.1] hover:text-white disabled:opacity-40"><Minus className="size-3" /></button>
            <button type="button" data-element-zoom-reset title="맞춤" onClick={() => setZoom(1)} className="ds-intrinsic h-6 min-w-10 rounded px-1 text-[11px] text-slate-300 tabular-nums hover:bg-white/[0.1] hover:text-white">{Math.round(zoom * 100)}%</button>
            <button type="button" aria-label="확대" disabled={zoom >= 3} onClick={() => setZoom((value) => Math.min(3, +(value + 0.25).toFixed(2)))} className="ds-intrinsic flex size-6 items-center justify-center rounded text-slate-300 hover:bg-white/[0.1] hover:text-white disabled:opacity-40"><Plus className="size-3" /></button>
          </div>
          <button type="button" data-element-marked aria-pressed={marked && canMark} disabled={!canMark} onClick={() => setMarked((current) => !current)} className={cn(CONTROL, marked && canMark ? ON : OFF)}>
            <Crosshair className="size-3 shrink-0" />
            <LocalizedText text="Show changed elements" />
          </button>
          <button type="button" data-element-whole aria-pressed={whole} disabled={!link?.frame} onClick={() => setWhole((current) => !current)} className={cn(CONTROL, whole ? ON : OFF)}>
            <ScanSearch className="size-3 shrink-0" />
            <LocalizedText text="Show where it is on the screen" />
          </button>
          <button type="button" data-element-fullscreen aria-pressed={fullscreen} onClick={() => setFullscreen((current) => !current)} className={cn(CONTROL, OFF, 'ml-auto')}>
            {fullscreen ? <Minimize2 className="size-3 shrink-0" /> : <Maximize2 className="size-3 shrink-0" />}
            <LocalizedText text={fullscreen ? 'Exit full screen' : 'View full screen'} />
            {fullscreen && <kbd className="rounded bg-white/[0.1] px-1 font-sans text-[10px] text-slate-300">Esc</kbd>}
          </button>
        </div>

        <div className="flex min-h-0 flex-1 gap-3">
          {shown.map((side) => {
            const common = { conflict, target, link, marked: marked && canMark, whole: whole && Boolean(link?.frame), tone: resolved ? 'done' : 'open', sides: codeSides, screen: viewport, zoom }
            return (
              <Pane
                key={side}
                side={drawingOf(side)}
                label={mode === 'slider' ? '구현 ↔ 원안' : side === 'before' ? 'Current code' : side === 'applied' ? '반영 결과' : 'Design'}
                value={mode === 'slider' || !field ? null : side === 'before' ? field.current : side === 'applied' ? applied.value : field.expected}
                resizeKey={`${fullscreen}:${sides}:${mode}:${Boolean(applied)}`}
                {...common}
                // The slider: the code as built over the design, shown up to the handle.
                over={mode === 'slider' ? (
                  <span data-element-slider className="absolute inset-0 flex" style={{ clipPath: `inset(0 ${100 - cut}% 0 0)` }}>
                    <Pane side="before" label="" value={null} resizeKey={`over:${fullscreen}:${zoom}`} {...common} bare />
                  </span>
                ) : null}
              />
            )
          })}
        </div>
        {mode === 'slider' && (
          <label className="flex shrink-0 items-center gap-3 text-[11.5px] text-slate-400">
            <span className="shrink-0">구현</span>
            <input type="range" min={0} max={100} value={cut} onChange={(event) => setCut(Number(event.target.value))} aria-label="구현과 원안 사이 비교 위치" data-element-cut className="h-1 min-w-0 flex-1 accent-emerald-300" />
            <span className="shrink-0">원안</span>
          </label>
        )}

        {codeSides && !differsHere && differsAt.length > 0 && !whole && (
          <p data-element-no-effect role="status" className="flex shrink-0 flex-wrap items-center gap-2 rounded-lg bg-amber-400/10 px-3 py-2 text-[11.5px] text-amber-100 ring-1 ring-amber-300/25 ring-inset">
            <span>이 변경은 <span translate="no">{viewport.custom ? '' : viewport.label}</span>({viewport.width}px · <LocalizedText text={BREAKPOINT_LABEL[viewport.breakpoint]} />)에는 영향이 없어요 · 양쪽 렌더링이 같아요</span>
            <button type="button" data-element-go-viewport={differsAt[0].id} onClick={() => setDevicePick({ ...devicePick, deviceId: differsAt[0].id, orientation: 'portrait' })} className="ds-intrinsic inline-flex h-5 items-center rounded bg-amber-300/20 px-1.5 font-medium text-amber-50 transition-colors hover:bg-amber-300/30">
              <span translate="no">{differsAt[0].label}</span>({differsAt[0].width}px)에서 보기
            </button>
          </p>
        )}
        {!codeSides && (sameDrawing || (whole && !target)) && (
          <p data-element-note className="shrink-0 text-[11.5px] text-slate-400">
            <LocalizedText text={whole && !target ? 'This component isn’t placed on the design screen, so nothing is marked on it.' : 'This difference can’t be drawn on the element; both sides show the design. Compare the values above.'} />
          </p>
        )}

        <div className="flex shrink-0 items-center justify-end gap-2">
          {link && onReveal && <button type="button" data-element-reveal onClick={() => { onOpenChange(false); onReveal() }} className={cn(CONTROL, OFF)}><LocalizedText text="Show on canvas" /></button>}
          {onOpenReview && <button type="button" data-element-review onClick={() => { onOpenChange(false); onOpenReview() }} className={cn(CONTROL, 'bg-white text-slate-950 hover:bg-slate-200')}><LocalizedText text="Open change details" /></button>}
        </div>
      </DialogContent>
    </Dialog>
  )
}
