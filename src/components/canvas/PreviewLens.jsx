import { FrameDrawing } from '@/components/canvas/CompareCanvas'

// A magnifier beside a change's element, on the canvas: 160 × 160, the element drawn at 400–800% — the
// same drawing as the screen's (FrameDrawing: StaticLayer, with the same overrides), so a way picked or
// Space held changes it as it changes the screen. Attached to the canvas: it follows the element as the
// canvas is zoomed or panned, its own size fixed, and sits on whichever side has room — never over the
// element (nor outside the canvas, so never over the detail beside it). A thin line joins the two.
//
//   frame, layer: where the element is (canvas units); view: the canvas's { x, y, zoom (%) };
//   room: the canvas's size; overrides: what the screen is drawn with now.

export const LENS = { size: 160, gap: 28, margin: 8, rail: 8, minScale: 4, maxScale: 8 }

// Where the magnifier goes, and the element's box — both in the canvas's px. Null when the element is out of view.
export function lensPlacement(frame, layer, view, room) {
  const z = view.zoom / 100
  const el = { x: view.x + (frame.x + layer.x) * z, y: view.y + (frame.y + layer.y) * z, width: layer.width * z, height: layer.height * z }
  if (el.x + el.width < 0 || el.y + el.height < 0 || el.x > room.width || el.y > room.height) return null
  const { size, gap, margin, rail } = LENS
  const clampY = (y) => Math.max(margin, Math.min(room.height - size - margin, y))
  const clampX = (x) => Math.max(rail, Math.min(room.width - size - margin, x))
  const midY = clampY(el.y + el.height / 2 - size / 2)
  const sides = [
    { side: 'right', x: el.x + el.width + gap, y: midY, fits: el.x + el.width + gap + size <= room.width - margin },
    { side: 'left', x: el.x - gap - size, y: midY, fits: el.x - gap - size >= rail },
    { side: 'below', x: clampX(el.x + el.width / 2 - size / 2), y: el.y + el.height + gap, fits: el.y + el.height + gap + size <= room.height - margin },
    { side: 'above', x: clampX(el.x + el.width / 2 - size / 2), y: el.y - gap - size, fits: el.y - gap - size >= margin },
  ]
  const at = sides.find((entry) => entry.fits) ?? sides[0]
  return { ...at, el }
}
// How far in it is: the element (and a little round it) filling about 70% of the lens, between 400% and 800%.
export const lensScaleOf = (layer) => Math.min(LENS.maxScale, Math.max(LENS.minScale, (LENS.size * 0.7) / Math.max(layer.width, layer.height, 1)))

export default function PreviewLens({ frame, layer, view, room, overrides, edits, label }) {
  const place = lensPlacement(frame, layer, view, room)
  if (!place) return null
  const { size } = LENS
  const { el } = place
  const scale = lensScaleOf(layer)
  // The line: from the element's side that faces the lens to the lens's facing side.
  const from = place.side === 'right' ? [el.x + el.width + 3, el.y + el.height / 2] : place.side === 'left' ? [el.x - 3, el.y + el.height / 2] : place.side === 'below' ? [el.x + el.width / 2, el.y + el.height + 3] : [el.x + el.width / 2, el.y - 3]
  const to = place.side === 'right' ? [place.x, place.y + size / 2] : place.side === 'left' ? [place.x + size, place.y + size / 2] : place.side === 'below' ? [place.x + size / 2, place.y] : [place.x + size / 2, place.y + size]
  return (
    <>
      <svg aria-hidden data-lens-line className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible">
        <rect x={el.x - 3} y={el.y - 3} width={el.width + 6} height={el.height + 6} rx={4} fill="none" stroke="var(--ds-accent)" strokeWidth={1} strokeDasharray="3 3" />
        <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} stroke="var(--ds-accent)" strokeWidth={1} />
        <circle cx={from[0]} cy={from[1]} r={2} fill="var(--ds-accent)" />
      </svg>
      <div data-preview-lens={place.side} data-canvas-chrome className="pointer-events-none absolute z-10 overflow-hidden rounded-xl bg-[#F5F5F5] shadow-2xl shadow-black/50 ring-1 ring-[var(--ds-accent-border)]" style={{ left: place.x, top: place.y, width: size, height: size }}>
        <div data-lens-drawing className="absolute top-0 left-0 origin-top-left" style={{ transform: `translate(${size / 2 - (layer.x + layer.width / 2) * scale}px, ${size / 2 - (layer.y + layer.height / 2) * scale}px) scale(${scale})` }}>
          <FrameDrawing frame={frame} edits={edits} overrides={overrides} />
        </div>
        <span data-lens-label className="absolute bottom-1.5 left-1.5 rounded-full bg-black/70 px-2 py-0.5 text-[10.5px] font-medium text-slate-100 tabular-nums">{label} · {Math.round(scale * 100)}%</span>
      </div>
    </>
  )
}
