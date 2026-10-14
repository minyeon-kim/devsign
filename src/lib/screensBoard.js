// The Screens board's geometry: fitting and zooming the view, which cards are
// in it, and the line a link is drawn as. Pure — the board component only
// draws what these say.

export const ZOOM_MIN = 0.1
export const ZOOM_MAX = 4
export const clampZoom = (zoom) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom))

// The view that shows a box whole, centred, never past 100%.
//   box: { x?, y?, width, height } in board units;  room: the view's size
export function boardFit(box, room, pad = 40) {
  if (!room.width || !room.height || !box.width || !box.height) return { x: 0, y: 0, zoom: 1 }
  const zoom = clampZoom(Math.min(1, (room.width - pad * 2) / box.width, (room.height - pad * 2) / box.height))
  return { zoom, x: (room.width - box.width * zoom) / 2 - (box.x ?? 0) * zoom, y: (room.height - box.height * zoom) / 2 - (box.y ?? 0) * zoom }
}

// The same view at another zoom, the point under `anchor` (view px) staying where it is.
export function zoomAt(view, zoom, anchor) {
  const next = clampZoom(zoom)
  const k = next / view.zoom
  return { zoom: next, x: anchor.x - (anchor.x - view.x) * k, y: anchor.y - (anchor.y - view.y) * k }
}

// The cards that are in view (with a margin, so one arriving is already drawn).
export function visibleCards(cards, view, room, margin = 240) {
  if (!room.width || !room.height) return cards
  return cards.filter((card) => {
    const left = view.x + card.x * view.zoom
    const top = view.y + card.y * view.zoom
    return left < room.width + margin && left + card.width * view.zoom > -margin && top < room.height + margin && top + card.height * view.zoom > -margin
  })
}

// A link's line, in board units: { d, label: { x, y } }.
//   · 'next' — straight, from the screen's right edge to the next one's left.
//   · within a row otherwise — an arc over the row (a way back) or under it (a skip ahead).
//   · to another row of the same flow — a curve between the two, the way down a little left of
//     centre and the way back up a little right, so a branch and its return don't lie on each other.
//   · to another flow — out to the right, along the gap between the flows, then in from above
//     (from below, when the flow is an earlier one): around the cards, not across them.
const LABEL = 32 // the name row over a card
const R = (n) => Math.round(n * 10) / 10
export function linkPath(link, from, to, layout = {}) {
  const cx = (card) => card.x + card.width / 2
  const cy = (card) => card.y + card.height / 2
  if (link.kind === 'next') {
    const y = cy(from)
    return { d: `M${R(from.x + from.width)} ${R(y)}L${R(to.x - 3)} ${R(cy(to))}`, label: { x: R((from.x + from.width + to.x) / 2), y: R(y - 10) } }
  }
  if (from.group === to.group && from.row === to.row) {
    const span = Math.abs(to.col - from.col)
    if (to.col < from.col) {
      const sx = from.x + from.width * 0.3
      const ex = to.x + to.width * 0.7
      const y = from.y - LABEL - 4
      const lift = 34 + 12 * span
      return { d: `M${R(sx)} ${R(y)}C${R(sx)} ${R(y - lift)} ${R(ex)} ${R(y - lift)} ${R(ex)} ${R(to.y - LABEL - 6)}`, label: { x: R((sx + ex) / 2), y: R(y - lift * 0.75 - 6) } }
    }
    const sx = from.x + from.width * 0.7
    const ex = to.x + to.width * 0.3
    const y = from.y + from.height + 4
    const dip = 30 + 10 * span
    return { d: `M${R(sx)} ${R(y)}C${R(sx)} ${R(y + dip)} ${R(ex)} ${R(y + dip)} ${R(ex)} ${R(to.y + to.height + 6)}`, label: { x: R((sx + ex) / 2), y: R(y + dip * 0.75 + 14) } }
  }
  if (from.group === to.group) {
    const down = to.row > from.row
    const off = down ? -16 : 16
    const sx = cx(from) + off
    const ex = cx(to) + off
    const sy = down ? from.y + from.height + 4 : from.y - LABEL - 4
    const ey = down ? to.y - LABEL - 6 : to.y + to.height + 6
    const my = (sy + ey) / 2
    return { d: `M${R(sx)} ${R(sy)}C${R(sx)} ${R(my)} ${R(ex)} ${R(my)} ${R(ex)} ${R(ey)}`, label: { x: R((sx + ex) / 2 + off * 2.4), y: R(my + 4) } }
  }
  const forward = to.groupIndex > from.groupIndex
  const sx = from.x + from.width + 4
  const out = sx + 44
  const sy = cy(from)
  const ex = cx(to) + (forward ? 0 : 16)
  const gap = (layout.cellH ?? to.height)
  // (The gap between flows: just over the target's name row — or just under the target, coming back up.)
  const lane = forward ? to.y - LABEL - 44 : to.y + Math.max(to.height, gap) + 40
  const ey = forward ? to.y - LABEL - 6 : to.y + to.height + 6
  return { d: `M${R(sx)} ${R(sy)}H${R(out)}V${R(lane)}H${R(ex)}V${R(ey)}`, label: { x: R((out + ex) / 2), y: R(lane - 8) } }
}

// Close in on a box (board units): centred in `area` — what's clear of the panels, { x, y, width, height } in
// view px — at the zoom where it takes about `share` of that width, between `min` and `max`; with at least
// `margin` px of what's around it in view (a box too big for that at `min` — a whole screen — fits instead).
export const FOCUS = { share: 0.4, min: 1.5, max: 4, margin: 48 }
export function focusView(box, area, { share = FOCUS.share, min = FOCUS.min, max = FOCUS.max, margin = FOCUS.margin } = {}) {
  const width = Math.max(1, box.width)
  const height = Math.max(1, box.height)
  const fits = Math.min((area.width - margin * 2) / width, (area.height - margin * 2) / height)
  const zoom = Math.max(ZOOM_MIN, Math.min(Math.max(min, Math.min(max, (area.width * share) / width)), fits))
  return { zoom, x: area.x + area.width / 2 - (box.x + width / 2) * zoom, y: area.y + area.height / 2 - (box.y + height / 2) * zoom }
}

// The camera on its way from one view to another, at `t` (0 → 1, eased in and out): the point in the
// middle of `area` travels in a straight line on the board, the zoom in proportion (on a log scale) —
// and when the two are far apart (more than the area's width apart at the zoom it's at) it backs out a
// little on the way, so where it's going is seen coming.
export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)
export function glideAt(from, to, t, area) {
  const e = easeInOut(Math.min(1, Math.max(0, t)))
  const cx = area.x + area.width / 2
  const cy = area.y + area.height / 2
  const a = { x: (cx - from.x) / from.zoom, y: (cy - from.y) / from.zoom }
  const b = { x: (cx - to.x) / to.zoom, y: (cy - to.y) / to.zoom }
  const far = Math.hypot(b.x - a.x, b.y - a.y) * Math.min(from.zoom, to.zoom) > area.width
  const dip = far ? 1 - 0.35 * Math.sin(Math.PI * e) : 1
  const zoom = Math.exp(Math.log(from.zoom) + (Math.log(to.zoom) - Math.log(from.zoom)) * e) * dip
  const px = a.x + (b.x - a.x) * e
  const py = a.y + (b.y - a.y) * e
  return { zoom, x: cx - px * zoom, y: cy - py * zoom }
}
