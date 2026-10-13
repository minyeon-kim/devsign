// The Screens board's geometry: fitting and zooming the view, which cards are
// in it, and the line a link is drawn as. Pure — the board component only
// draws what these say.

export const ZOOM_MIN = 0.1
export const ZOOM_MAX = 2
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
