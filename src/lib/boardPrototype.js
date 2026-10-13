import { flowOf } from '@/lib/prototypeEngine'
import { transitionsOf } from '@/lib/screens'
import { clampZoom } from '@/lib/screensBoard'

// The Screens board while a prototype plays in one of its cards: what each
// other card is to the screen showing, where the camera goes once, and the
// lines from the screen's hotspots to the cards they lead to (no longer drawn
// on the board). Pure.

// The interactions of the screen showing, numbered as they're listed:
//   [{ n, transition, layer, target }] — `layer`: the hotspot's layer on that screen.
export function interactionsOf(prototype, screenId) {
  const screen = prototype.screens.find((entry) => entry.id === screenId)
  if (!screen) return []
  return transitionsOf(prototype, screenId).live.map((transition, index) => ({
    n: index + 1,
    transition,
    layer: screen.frame.layers.find((layer) => layer.id === transition.hotspotId) ?? null,
    target: transition.scrollTo ? null : transition.targetScreenId,
  }))
}

// What a card is while `current` shows in the frame at `frameId`'s place:
//   'frame'   — the card the prototype plays in;
//   'current' — the board's own card of the screen showing (when that isn't the frame's);
//   'next'    — where a press on this screen leads;
//   'later'   — further along the flow the screen is in;
//   'rest'    — everything else.
export function tierOf(prototype, { frameId, current }, cardId) {
  if (cardId === frameId) return 'frame'
  if (cardId === current) return 'current'
  if (interactionsOf(prototype, current).some((entry) => entry.target === cardId)) return 'next'
  const flow = flowOf(prototype, current)
  if (flow) {
    const at = flow.screenIds.indexOf(current)
    const from = at === -1 ? flow.screenIds.indexOf(flow.branches.find((branch) => branch.screenIds.includes(current))?.fromScreenId) : at
    if (flow.screenIds.indexOf(cardId) > from) return 'later'
  }
  return 'rest'
}

// The rest of the flow from the screen showing, as names to read: "Cart → Checkout → Order complete".
export function pathAhead(prototype, current) {
  const flow = flowOf(prototype, current)
  if (!flow) return []
  const at = flow.screenIds.indexOf(current)
  return at === -1 ? [] : flow.screenIds.slice(at + 1)
}

// Where the camera goes as a prototype starts — once; it doesn't follow after.
// The frame at a size that can be read (never under 50%, never past 100%),
// with the cards its screen leads to in view when they fit at that zoom —
// the frame alone, centred, when they don't.
export function cameraFor(cards, frameId, targetIds, room, zoomNow, pad = 56) {
  const frame = cards.find((card) => card.id === frameId)
  if (!frame || !room.width || !room.height) return null
  const boxOf = (list) => {
    const x = Math.min(...list.map((card) => card.x))
    const y = Math.min(...list.map((card) => card.y - 32))
    return { x, y, width: Math.max(...list.map((card) => card.x + card.width)) - x, height: Math.max(...list.map((card) => card.y + card.height)) - y }
  }
  const fits = (box, zoom) => box.width * zoom <= room.width - pad * 2 && box.height * zoom <= room.height - pad * 2
  const all = boxOf([frame, ...cards.filter((card) => targetIds.includes(card.id))])
  const zoomFor = (box) => clampZoom(Math.min(1, (room.width - pad * 2) / box.width, (room.height - pad * 2) / box.height))
  const wanted = Math.max(0.5, Math.min(1, Math.max(zoomNow, zoomFor(all))))
  const box = fits(all, wanted) ? all : boxOf([frame])
  const zoom = fits(box, wanted) ? wanted : Math.max(0.5, zoomFor(box))
  // (Whole pixels: the frame's edges land on the grid, so its text stays sharp.)
  return { zoom, x: Math.round(room.width / 2 - (box.x + box.width / 2) * zoom), y: Math.round(room.height / 2 - (box.y + box.height / 2) * zoom) }
}

// The line from a hotspot (in the frame, at the frame card's place) to the card it leads to:
//   { d, label: { x, y }, short? } in board units. Out of the frame's nearer side, into the card's facing side.
export function hotspotLine(frame, layer, to) {
  const hy = frame.y + layer.y + layer.height / 2
  const right = to.x >= frame.x
  const sx = right ? frame.x + frame.width + 2 : frame.x - 2
  const below = to.y > frame.y + frame.height
  const above = to.y + to.height < frame.y
  if (below || above) {
    const ex = to.x + to.width / 2
    const ey = below ? to.y - 38 : to.y + to.height + 6
    const bend = sx + (right ? 36 : -36)
    return { d: `M${sx} ${hy}H${bend}C${bend + (right ? 40 : -40)} ${hy} ${ex} ${(hy + ey) / 2} ${ex} ${ey}`, label: { x: (bend + ex) / 2, y: (hy + ey) / 2 } }
  }
  const ex = right ? to.x - 6 : to.x + to.width + 6
  const ey = to.y + Math.min(to.height - 24, Math.max(24, hy - to.y))
  const mid = (sx + ex) / 2
  // (`short`: the two are neighbours — the gap holds a number, not a sentence.)
  return { d: `M${sx} ${hy}C${mid} ${hy} ${mid} ${ey} ${ex} ${ey}`, label: { x: mid, y: (hy + ey) / 2 - 8 }, short: Math.abs(ex - sx) < 200 }
}

// The prototype in the address: ?proto=<the card it plays in>&at=<the screen showing> (ids without "page-").
const slug = (id) => String(id ?? '').replace(/^page-/, '')
export function readProto(search, screenIds = []) {
  const params = new URLSearchParams(search ?? '')
  const find = (value) => (value ? screenIds.find((id) => id === value || slug(id) === value) ?? null : null)
  const frameId = find(params.get('proto'))
  return frameId ? { frameId, current: find(params.get('at')) ?? frameId } : null
}
export function withProto(search, proto) {
  const params = new URLSearchParams(search ?? '')
  if (proto?.frameId) { params.set('proto', slug(proto.frameId)); params.set('at', slug(proto.current ?? proto.frameId)) } else { params.delete('proto'); params.delete('at') }
  const rest = params.toString()
  return rest ? `?${rest}` : ''
}

// What a transition's animation is, played: none under reduced motion.
//   slide: 300ms, cubic-bezier(0.2, 0, 0, 1) — the new screen pushes the old one out;
//   fade: 200ms — the new screen comes up over the old one, which stays whole until it's covered.
export const MOTION = {
  slide: { duration: 300, easing: 'cubic-bezier(0.2, 0, 0, 1)', incoming: [{ transform: 'translateX(100%)' }, { transform: 'translateX(0)' }], outgoing: [{ transform: 'translateX(0)' }, { transform: 'translateX(-100%)' }] },
  fade: { duration: 200, easing: 'linear', incoming: [{ opacity: 0 }, { opacity: 1 }], outgoing: null },
}
export const motionOf = (animation, reduced = false) => (reduced ? null : MOTION[animation] ?? null)
