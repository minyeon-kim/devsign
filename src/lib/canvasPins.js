import { isDesignReview, isOpen } from '@/lib/conflicts'
import { layerIdsOf } from '@/lib/conflictInsight'

// The canvas's change pins: one map-style pin per change, however many
// elements it's about (four cards → one pin, with a "4" on it), numbered like
// the "확인할 변경점" list — pick one in either place and the other follows.
// This file is the arithmetic (which pins, where their tips point, what to do
// when pins collide); ConflictPins draws them.

// Sizes are in screen pixels and don't follow the canvas zoom.
export const PIN = {
  head: 16, // the head's diameter
  height: 21, // head top to tail tip
  headSelected: 20,
  heightSelected: 26,
  inset: 6, // how far inside the element's corner the tip sits
  near: 24, // pins whose tips are this close (screen px) become one cluster
}

// One entry per (change, element): what's measured on the canvas — a change
// about four cards has four, with its one number. (What's drawn is one pin per
// change: markersOf.) Rollbacks and design requests have no element.
// `numbers`: Map(conflict id → its number in the list).
export function pinsFor(conflicts = [], numbers = new Map()) {
  return conflicts
    .filter((conflict) => !conflict.rollback && !isDesignReview(conflict) && numbers.has(conflict.id))
    .flatMap((conflict) => layerIdsOf(conflict).map((layerId, index) => ({
      id: `${conflict.id}:${layerId}`,
      conflictId: conflict.id,
      layerId,
      primary: index === 0,
      number: numbers.get(conflict.id),
      resolved: !isOpen(conflict),
    })))
    .sort((a, b) => a.number - b.number)
}

// A change's pin: the entries of one change gathered — `count` elements, the
// first one the one a press goes to. In number order (the Tab order).
export function markersOf(pins = []) {
  const byChange = new Map()
  for (const pin of pins) {
    const marker = byChange.get(pin.conflictId)
    if (marker) { marker.pins.push(pin); marker.count += 1 } else byChange.set(pin.conflictId, { id: pin.conflictId, conflictId: pin.conflictId, number: pin.number, resolved: pin.resolved, pins: [pin], count: 1 })
  }
  return [...byChange.values()].sort((a, b) => a.number - b.number)
}

// The box a change's pin goes on: all its elements together (their union) —
// or, when they sit in one group, that group, so long as it isn't much more
// than the elements themselves.
export function unionRect(rects = []) {
  return {
    left: Math.min(...rects.map((rect) => rect.left)),
    top: Math.min(...rects.map((rect) => rect.top)),
    right: Math.max(...rects.map((rect) => rect.right)),
    bottom: Math.max(...rects.map((rect) => rect.bottom)),
  }
}
export const GROUP_AREA_LIMIT = 2.5
export function markerRect(rects, groupRect = null) {
  const union = unionRect(rects)
  if (!groupRect) return union
  const area = (rect) => (rect.right - rect.left) * (rect.bottom - rect.top)
  return area(groupRect) <= area(union) * GROUP_AREA_LIMIT ? groupRect : union
}

// Where a pin's tip points: 6px inside the element's top-right corner — on
// the element, not hanging off it. If the head would poke out of the
// frame's right edge there, the top-left corner instead.
export function anchorOf(rect, frame, { head = PIN.head, inset = PIN.inset } = {}) {
  const flipped = Boolean(frame) && rect.right - inset + head / 2 > frame.right
  return { x: flipped ? rect.left + inset : rect.right - inset, y: rect.top + inset, flipped }
}

// Pins that end up within 24px of each other (tips, on screen) are one
// cluster pin saying how many changes it holds; pressing it lists them.
// Zooming in moves the tips apart, and the cluster comes apart with them.
// in:  [{ id, x, y, … }] (tips);  out: [{ kind: 'pin', pin, x, y } | { kind: 'cluster', key, pins, x, y }]
export function layoutPins(pins, { near = PIN.near } = {}) {
  const parent = pins.map((_, index) => index)
  const find = (index) => (parent[index] === index ? index : (parent[index] = find(parent[index])))
  for (let a = 0; a < pins.length; a++) {
    for (let b = a + 1; b < pins.length; b++) {
      if (Math.hypot(pins[a].x - pins[b].x, pins[a].y - pins[b].y) <= near) parent[find(a)] = find(b)
    }
  }
  const groups = new Map()
  pins.forEach((pin, index) => groups.set(find(index), [...(groups.get(find(index)) ?? []), pin]))
  const placed = []
  for (const group of groups.values()) {
    if (group.length === 1) { placed.push({ kind: 'pin', pin: group[0], x: group[0].x, y: group[0].y }); continue }
    const ordered = [...group].sort((a, b) => (a.number ?? 0) - (b.number ?? 0))
    placed.push({
      kind: 'cluster',
      key: ordered.map((pin) => pin.id).join('|'),
      pins: ordered,
      x: group.reduce((sum, pin) => sum + pin.x, 0) / group.length,
      y: group.reduce((sum, pin) => sum + pin.y, 0) / group.length,
    })
  }
  return placed
}
