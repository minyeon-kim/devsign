// Smart-guide snapping shared by Library placement (PlacementOverlay) and
// moving / resizing added layers on the canvas (LayerTransformHandles).
// Everything is in frame units; the threshold is passed in frame units too
// (a fixed number of screen pixels divided by the artboard's scale).

export const SNAP_PX = 6
export const STACK_GAP = 12

export function snapAxis(value, candidates, threshold) {
  let best = null
  for (const c of candidates) {
    const d = Math.abs(c.value - value)
    if (d <= threshold && (!best || d < best.d)) best = { ...c, d }
  }
  return best
}

// Layers worth snapping to — skips full-bleed backgrounds, which would
// otherwise win every snap.
function snapTargets(frame, excludeId) {
  return frame.layers.filter((l) => l.id !== excludeId && (l.width < frame.width * 0.98 || l.height < frame.height * 0.5))
}

// Candidate left edges for a box of width `w`: frame center, and other
// layers' left / right / center lines. `guide` is where to draw the line.
export function xCandidates(frame, w, excludeId) {
  return [
    { value: (frame.width - w) / 2, guide: frame.width / 2 },
    ...snapTargets(frame, excludeId).flatMap((l) => [
      { value: l.x, guide: l.x },
      { value: l.x + l.width - w, guide: l.x + l.width },
      { value: l.x + l.width / 2 - w / 2, guide: l.x + l.width / 2 },
    ]),
  ]
}

// Candidate top edges for a box of height `h`: stacked 12px below / above
// another layer, or top / bottom aligned with it.
export function yCandidates(frame, h, excludeId) {
  return snapTargets(frame, excludeId).flatMap((l) => [
    { value: l.y + l.height + STACK_GAP, guide: l.y + l.height + STACK_GAP / 2 },
    { value: l.y - h - STACK_GAP, guide: l.y - STACK_GAP / 2 },
    { value: l.y, guide: l.y },
    { value: l.y + l.height - h, guide: l.y + l.height },
  ])
}

// Snap a box's top-left, returning the snapped point plus guide lines.
export function snapBox(frame, x, y, w, h, threshold, excludeId) {
  const sx = snapAxis(x, xCandidates(frame, w, excludeId), threshold)
  const sy = snapAxis(y, yCandidates(frame, h, excludeId), threshold)
  return { x: sx ? sx.value : x, y: sy ? sy.value : y, guideX: sx?.guide, guideY: sy?.guide }
}

// Every artboard currently showing the frame, with its on-screen geometry:
// `clip` is the visible box, `inner` the scaled frame surface, `k` the
// screen px per frame unit.
export function artboardRects(frame) {
  return [...document.querySelectorAll('[data-frame-box]')].flatMap((box) => {
    const clip = box.getBoundingClientRect()
    const inner = box.firstElementChild?.getBoundingClientRect()
    if (!inner?.width || !clip.width) return []
    return [{ clip, inner, k: inner.width / frame.width }]
  })
}
