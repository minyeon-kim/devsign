// Figma-style spacing on the canvas: the gaps between two boxes, or a box's
// inset inside the one that holds it. Boxes are { x, y, w, h } in the
// frame's own units; every measurement is a line { x1, y1, x2, y2, value }
// with the number to label it with.

const right = (b) => b.x + b.w
const bottom = (b) => b.y + b.h
const cx = (b) => b.x + b.w / 2
const cy = (b) => b.y + b.h / 2
const round = (n) => Math.round(n * 10) / 10

export const contains = (outer, inner) => outer !== inner
  && outer.x <= inner.x && outer.y <= inner.y && right(outer) >= right(inner) && bottom(outer) >= bottom(inner)

// The smallest of `boxes` that holds `box` (its parent on the canvas), else
// `fallback` (the frame).
export function parentOf(box, boxes, fallback) {
  return boxes
    .filter((candidate) => contains(candidate, box) && !(candidate.w === box.w && candidate.h === box.h))
    .sort((a, b) => a.w * a.h - b.w * b.h)[0] ?? fallback
}

// `inner`'s distance to each side of `outer` — the padding around it.
export function insets(inner, outer) {
  return [
    { x1: outer.x, y1: cy(inner), x2: inner.x, y2: cy(inner) },
    { x1: right(inner), y1: cy(inner), x2: right(outer), y2: cy(inner) },
    { x1: cx(inner), y1: outer.y, x2: cx(inner), y2: inner.y },
    { x1: cx(inner), y1: bottom(inner), x2: cx(inner), y2: bottom(outer) },
  ].map((line) => ({ ...line, value: round(Math.abs(line.x2 - line.x1) + Math.abs(line.y2 - line.y1)) })).filter((line) => line.value > 0)
}

// The gap from `a` to `b`: along whichever axes they're apart, drawn where
// they overlap on the other axis (else from `a`'s middle). One holding the
// other: the inner one's insets.
export function gaps(a, b) {
  if (contains(b, a)) return insets(a, b)
  if (contains(a, b)) return insets(b, a)
  const lines = []
  const overlapY = Math.max(a.y, b.y) < Math.min(bottom(a), bottom(b)) ? (Math.max(a.y, b.y) + Math.min(bottom(a), bottom(b))) / 2 : cy(a)
  const overlapX = Math.max(a.x, b.x) < Math.min(right(a), right(b)) ? (Math.max(a.x, b.x) + Math.min(right(a), right(b))) / 2 : cx(a)
  if (right(a) <= b.x) lines.push({ x1: right(a), y1: overlapY, x2: b.x, y2: overlapY })
  else if (right(b) <= a.x) lines.push({ x1: right(b), y1: overlapY, x2: a.x, y2: overlapY })
  if (bottom(a) <= b.y) lines.push({ x1: overlapX, y1: bottom(a), x2: overlapX, y2: b.y })
  else if (bottom(b) <= a.y) lines.push({ x1: overlapX, y1: bottom(b), x2: overlapX, y2: a.y })
  return lines.map((line) => ({ ...line, value: round(Math.abs(line.x2 - line.x1) + Math.abs(line.y2 - line.y1)) })).filter((line) => line.value > 0)
}
