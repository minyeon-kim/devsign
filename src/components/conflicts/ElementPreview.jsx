import { useEffect, useRef, useState } from 'react'
import { Crosshair, Maximize2, Minimize2, ScanSearch } from 'lucide-react'
import { cn } from 'cn'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { LocalizedText } from '@/i18n/runtime'
import { StaticLayer } from '@/components/mergestudio/MergeInfiniteCanvas'
import ChangePreview from '@/components/conflicts/ChangePreview'
import { codeOverridesOf, cropOf, markOf, targetOf } from '@/lib/elementPreview'

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

// One side, as large as its pane allows.
function Pane({ label, value, conflict, target, link, side, marked, whole, tone, resizeKey }) {
  const [ref, box] = useBox(resizeKey)
  const frame = target?.frame ?? link?.frame
  let content = null
  if (box.width > 0 && frame && (target || whole)) {
    const region = whole || !target ? { x: 0, y: 0, width: frame.width, height: frame.height } : cropOf(frame, target.ids, 14)
    const scale = Math.max(0.05, Math.min(whole ? 2.5 : 4, (box.width - 8) / region.width, (box.height - 8) / region.height))
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
  return (
    <figure data-element-pane={side} className="m-0 flex min-h-0 min-w-0 flex-1 flex-col gap-2">
      <figcaption className="flex shrink-0 items-baseline gap-2 text-[12px]">
        <span className="font-semibold text-white"><LocalizedText text={label} /></span>
        {value && <span translate="no" className="min-w-0 truncate font-mono text-[11.5px] text-slate-300">{value}</span>}
      </figcaption>
      <div ref={ref} className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl bg-black/25">{content}</div>
    </figure>
  )
}

const CONTROL = 'ds-intrinsic inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11.5px] font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-40'
const OFF = 'bg-white/[0.06] text-slate-300 hover:bg-white/[0.1] hover:text-white'
const ON = 'bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-300/40 ring-inset'

export function ElementPreviewDialog({ conflict, link, open, onOpenChange, onReveal, onOpenReview }) {
  const target = targetOf(conflict, link)
  const [sides, setSides] = useState('both')
  const [marked, setMarked] = useState(true)
  const [whole, setWhole] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const resolved = conflict.resolved || conflict.reviewStage === 'resolved'
  const field = conflict.comparisonFields?.find((entry) => entry.current !== entry.expected) ?? conflict.comparisonFields?.[0]
  // Whether there's anything to mark: an element on the frame, or a sample
  // that draws its own (the legend's gaps).
  const canMark = Boolean(target) || conflict.sample === 'legend'
  // The code side is drawn from the conflict's values; when they can't be
  // put on the element, both sides are the design — said, not hidden.
  const sameDrawing = target ? Object.keys(codeOverridesOf(conflict, target.frame)).length === 0 : false

  // Esc leaves full screen first (the dialog would close on it otherwise).
  useEffect(() => {
    if (!open || !fullscreen) return undefined
    function onKey(event) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      setFullscreen(false)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, fullscreen])

  const shown = sides === 'both' ? ['before', 'after'] : [sides]
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
          {shown.map((side) => (
            <Pane
              key={side}
              side={side}
              label={side === 'before' ? 'Current code' : 'Design'}
              value={field ? (side === 'before' ? field.current : field.expected) : null}
              conflict={conflict}
              target={target}
              link={link}
              marked={marked && canMark}
              whole={whole && Boolean(link?.frame)}
              tone={resolved ? 'done' : 'open'}
              resizeKey={`${fullscreen}:${sides}`}
            />
          ))}
        </div>

        {(sameDrawing || (whole && !target)) && (
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
