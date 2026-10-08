import { useLayoutEffect, useState } from 'react'
import { gaps, insets, parentOf } from '@/lib/spacing'

// Figma-style redlines over a canvas frame — what's inside a frame, its
// spacing, read off the elements as they're drawn:
//   · hovering an element: a blue outline, its size, and its distance to
//     each side of what holds it (that element's padding — the frame's when
//     nothing else does);
//   · with one selected, hovering another: the gaps between the two (or,
//     hovering one that holds the selected, the inset inside it);
//   · selected, hovering nothing else: the selected one's insets.
// Distances are red lines with their px; sizes are blue tags under the box.
// `container`: the frame's element ([data-layer-id] elements inside it are
// measured); `frame`: its size in its own units. Everything is drawn in
// those units inside the frame's (scaled) box, so the lines and tags are
// counter-scaled to stay crisp and readable at any zoom.
const RED = '#F24822'
const BLUE = '#0D99FF'

export default function SpacingOverlay({ container, frame, selectedId, hoverId, version }) {
  const [boxes, setBoxes] = useState(null)
  useLayoutEffect(() => {
    if (!container) return
    const base = container.getBoundingClientRect()
    const scale = base.width / frame.width || 1
    const measured = [...container.querySelectorAll('[data-layer-id]')].map((el) => {
      const r = el.getBoundingClientRect()
      return { id: el.getAttribute('data-layer-id'), x: (r.left - base.left) / scale, y: (r.top - base.top) / scale, w: r.width / scale, h: r.height / scale }
    })
    setBoxes({ scale, list: measured })
  }, [container, frame.width, selectedId, hoverId, version])
  if (!boxes) return null

  const frameBox = { id: frame.id, x: 0, y: 0, w: frame.width, h: frame.height }
  const byId = (id) => boxes.list.find((box) => box.id === id) ?? null
  const selected = byId(selectedId)
  const hovered = hoverId && hoverId !== selectedId ? byId(hoverId) : null
  const lines = selected && hovered ? gaps(selected, hovered)
    : hovered ? insets(hovered, parentOf(hovered, boxes.list, frameBox))
      : selected ? insets(selected, parentOf(selected, boxes.list, frameBox))
        : []
  if (!selected && !hovered) return null
  const k = 1 / boxes.scale
  // A tag, kept at screen size wherever it is in the frame.
  const tag = (key, x, y, text, color, anchor = 'center') => (
    <span
      key={key}
      className="absolute rounded-[3px] px-1 py-px font-sans text-[10px] leading-[14px] font-medium whitespace-nowrap text-white tabular-nums"
      style={{ left: x, top: y, background: color, transform: `translate(${anchor === 'center' ? '-50%' : '0'}, -50%) scale(${k})`, transformOrigin: anchor === 'center' ? 'center' : 'left center' }}
    >
      {text}
    </span>
  )
  const size = (box) => `${Math.round(box.w)} × ${Math.round(box.h)}`

  return (
    <div data-spacing-overlay aria-hidden className="pointer-events-none absolute inset-0 z-30" style={{ width: frame.width, height: frame.height }}>
      <svg className="absolute inset-0 overflow-visible" width={frame.width} height={frame.height}>
        {hovered && <rect x={hovered.x} y={hovered.y} width={hovered.w} height={hovered.h} fill="none" stroke={BLUE} strokeWidth={1.5 * k} />}
        {lines.map((line, index) => (
          <g key={index} stroke={RED} strokeWidth={k}>
            <line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} />
            {/* (End ticks, across the line.) */}
            {line.y1 === line.y2 ? (
              <>
                <line x1={line.x1} y1={line.y1 - 3 * k} x2={line.x1} y2={line.y1 + 3 * k} />
                <line x1={line.x2} y1={line.y2 - 3 * k} x2={line.x2} y2={line.y2 + 3 * k} />
              </>
            ) : (
              <>
                <line x1={line.x1 - 3 * k} y1={line.y1} x2={line.x1 + 3 * k} y2={line.y1} />
                <line x1={line.x2 - 3 * k} y1={line.y2} x2={line.x2 + 3 * k} y2={line.y2} />
              </>
            )}
          </g>
        ))}
      </svg>
      {lines.map((line, index) => tag(`gap-${index}`, (line.x1 + line.x2) / 2, (line.y1 + line.y2) / 2, line.value, RED))}
      {/* The size of what's being looked at, under it. */}
      {(hovered ?? selected) && (() => {
        const box = hovered ?? selected
        return tag('size', box.x + box.w / 2, box.y + box.h + 10 * k, size(box), BLUE)
      })()}
    </div>
  )
}
