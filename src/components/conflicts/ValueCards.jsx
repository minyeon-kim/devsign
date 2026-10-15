import { useLayoutEffect, useRef, useState } from 'react'
import { cn } from 'cn'
import { StaticLayer } from '@/components/mergestudio/MergeInfiniteCanvas'
import { ComponentSample } from '@/components/conflicts/ElementPreview'
import { overridesFor, previewTargetsOf } from '@/lib/canvasPreview'

// The resolution's two cards — what's built now, and the result picked — for a value change: the element
// the change is about, cut out of its screen with 16px round it (the screen's own drawing, StaticLayer,
// with each side's values put over it), enlarged to fill its card. A change the screen can't show (a
// letter-spacing, a divider) is its component drawn alone instead (ComponentSample), enlarged the same way.
//
//   · Fitted: scale = min(inner width / crop width, inner height / crop height), 12px in from the card's
//     edge, never past 8× — and the two cards always at the same scale (the smaller of the two), so what
//     differs is the value, never the size it's drawn at. Scaled with a transform about the middle, so
//     lines stay sharp.
//   · The card's shape follows the crop's: 1:1 for a near-square one (an icon), 4:3 for a wide one; a long
//     one (a full-width button, a line — over 2:1) keeps its own shape, up to 4:1, and the two cards stack,
//     each the column's width — side by side it would be drawn at half size in a box of white.
//     The drawing sits on the product's light grey; its label under it (the values are the table's).

export const CROP_PAD = 16
export const CARD_PAD = 12
export const MAX_SCALE = 8

// The element's box on its screen, 16px round it — and the screen. Null when it isn't on one.
// (A neighbour right above or below that the 16px would cut through — a label over a button — is taken in
// whole, then 16px round that: a crop never shows half a line of text. The screen's own backdrops, over half
// its size, aren't.)
export function cropOf(conflict, pages) {
  for (const page of pages) {
    for (const frame of page.frames ?? []) {
      const layer = frame.layers?.find((entry) => entry.id === conflict?.layerId)
      if (!layer) continue
      const padded = { x: layer.x - CROP_PAD, y: layer.y - CROP_PAD, right: layer.x + layer.width + CROP_PAD, bottom: layer.y + layer.height + CROP_PAD }
      let area = { x: layer.x, y: layer.y, right: layer.x + layer.width, bottom: layer.y + layer.height }
      for (const other of frame.layers) {
        if (other === layer || other.width * other.height > (frame.width * frame.height) / 2) continue
        // (Only one right above or below it — sharing its columns. One beside it, an icon's label, stays out.)
        const cut = other.x < layer.x + layer.width && other.x + other.width > layer.x && other.y < padded.bottom && other.y + other.height > padded.y
        if (cut) area = { x: Math.min(area.x, other.x), y: Math.min(area.y, other.y), right: Math.max(area.right, other.x + other.width), bottom: Math.max(area.bottom, other.y + other.height) }
      }
      const x = Math.max(0, area.x - CROP_PAD)
      const y = Math.max(0, area.y - CROP_PAD)
      const right = Math.min(frame.width ?? Infinity, area.right + CROP_PAD)
      const bottom = Math.min(frame.height ?? Infinity, area.bottom + CROP_PAD)
      return { frame, box: { x, y, width: right - x, height: bottom - y } }
    }
  }
  return null
}
// The fit: the crop filling the card's inside, never past 8×.
export const fitOf = (natural, inner) => (natural?.width && natural?.height && inner?.width && inner?.height ? Math.min(MAX_SCALE, inner.width / natural.width, inner.height / natural.height) : null)
// A long crop: wider than 2:1 — its cards stack.
export const isLongCrop = (natural) => Boolean(natural?.width && natural?.height && natural.width / natural.height > 2)
// 1:1 for a near-square crop, 4:3 for a wide one, its own shape (up to 4:1) for a long one.
export const cardRatioOf = (natural) => (isLongCrop(natural) ? Math.min(4, natural.width / natural.height) : natural && natural.width / natural.height <= 1.4 && natural.height / natural.width <= 1.4 ? 1 : 4 / 3)

// What a side's values come to, in a few characters: 'stroke 2.5', '40px · #7c3aed'.
export function valueChipOf(conflict, values) {
  if (!values) return null
  const kind = conflict?.preview?.kind
  if (kind === 'icon') return values.stroke != null ? `stroke ${values.stroke}` : values.size != null ? `${values.size}px` : null
  if (kind === 'button') return [Number.isFinite(values.height) && `${values.height}px`, values.background, values.radius != null && `r ${values.radius}`].filter(Boolean).join(' · ') || null
  if (kind === 'text') return values.letterSpacing ?? (values.fontWeight != null ? `weight ${values.fontWeight}` : null)
  if (kind === 'spacing') return values.gap != null ? `gap ${values.gap}` : null
  return null
}

function CropDrawing({ frame, box, overrides }) {
  return (
    <div data-card-crop className="relative overflow-hidden" style={{ width: box.width, height: box.height }}>
      <div className="absolute top-0 left-0" style={{ width: frame.width, height: frame.height, transform: `translate(${-box.x}px, ${-box.y}px)` }}>
        {frame.layers.map((layer) => <StaticLayer key={layer.id} layer={layer} override={overrides?.[layer.id]} editHint={false} />)}
      </div>
    </div>
  )
}

// One card's drawing area: measures the drawing at its own size and the room inside the card, says the
// fit it would take (`onFit`), and draws at `scale` — the one both cards share.
function FitArea({ ratio, scale, onFit, label = null, children }) {
  const areaRef = useRef(null)
  const drawingRef = useRef(null)
  useLayoutEffect(() => {
    const area = areaRef.current
    const drawing = drawingRef.current
    if (!area || !drawing) return undefined
    const measure = () => onFit({ width: drawing.offsetWidth, height: drawing.offsetHeight }, { width: area.clientWidth - CARD_PAD * 2, height: area.clientHeight - CARD_PAD * 2 })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(area)
    observer.observe(drawing)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div ref={areaRef} data-card-area className="relative w-full overflow-hidden bg-[#F5F5F5]" style={{ aspectRatio: String(ratio) }}>
      <div ref={drawingRef} data-card-drawing data-scale={scale ?? undefined} className="absolute top-1/2 left-1/2 w-max" style={{ transform: `translate(-50%, -50%) scale(${scale ?? 1})`, transformOrigin: 'center', visibility: scale ? 'visible' : 'hidden' }}>
        {children}
      </div>
      {label}
    </div>
  )
}

//   sides: [{ id: 'before' | 'after', title, sub?, values, picked? }]
export default function ValueCards({ conflict, pages, sides }) {
  const crop = cropOf(conflict, pages)
  const targets = crop ? previewTargetsOf(conflict, pages).filter((target) => target.frameId === crop.frame.id) : []
  // (On the screen only when the screen can show the values; else the component drawn alone.)
  const onScreen = Boolean(crop) && targets.length > 0
  const [measured, setMeasured] = useState({})
  const report = (id) => (natural, inner) => setMeasured((now) => {
    const prev = now[id]
    if (prev && prev.natural.width === natural.width && prev.natural.height === natural.height && prev.inner.width === inner.width && prev.inner.height === inner.height) return now
    return { ...now, [id]: { natural, inner } }
  })
  const fits = sides.map((side) => (measured[side.id] ? fitOf(measured[side.id].natural, measured[side.id].inner) : null))
  const scale = fits.every((fit) => fit != null) ? Math.min(...fits) : null
  const natural = onScreen ? crop.box : measured[sides[0].id]?.natural
  const ratio = cardRatioOf(natural)
  const stacked = isLongCrop(natural)
  return (
    <div data-before-after data-value-cards={onScreen ? 'crop' : 'sample'} data-stacked={stacked ? '' : undefined} data-scale={scale ? Math.round(scale * 100) / 100 : undefined} className={cn('grid items-start', stacked ? 'grid-cols-1 gap-1' : 'grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-3')}>
      {sides.map((side, index) => (
        <FigureCard key={side.id} side={side} arrow={index === 1} stacked={stacked}>
          {/* (Its name a small tag in the drawing's corner — no line of its own under it, no frame round it:
              the card is the drawing. The values are the table's, above.) */}
          <FitArea ratio={ratio} scale={scale} onFit={report(side.id)} label={
            <figcaption className="pointer-events-none absolute top-2 right-2 flex h-5 items-center rounded-full bg-black/55 px-2 text-[11px] font-medium text-white backdrop-blur-sm">
              <span {...(side.id === 'before' ? { 'data-before-title': '' } : { 'data-after-title': '' })}>{side.title}</span>
            </figcaption>
          }>
            {onScreen
              ? <CropDrawing frame={crop.frame} box={crop.box} overrides={overridesFor(conflict, targets, side.values, pages)} />
              : <ComponentSample conflict={conflict} values={side.values} />}
          </FitArea>
        </FigureCard>
      ))}
    </div>
  )
}

function FigureCard({ side, arrow, stacked, children }) {
  return (
    <>
      {arrow && <span aria-hidden data-before-after-arrow className={cn('self-center text-slate-500', stacked ? 'justify-self-center text-[12px] leading-none' : '')}>{stacked ? '↓' : '→'}</span>}
      <figure data-layout={side.id === 'before' ? 'implementation' : 'proposal'} data-after={side.id === 'after' ? (side.picked ? 'picked' : 'design') : undefined} className={cn('m-0 min-w-0 overflow-hidden rounded-xl border', side.picked ? 'border-[var(--ds-accent-border)]' : 'border-[var(--ds-border-subtle)]')}>
        {children}
      </figure>
    </>
  )
}
