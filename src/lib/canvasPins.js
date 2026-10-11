import { isDesignReview, isOpen } from '@/lib/conflicts'
import { layerIdsOf } from '@/lib/conflictInsight'

// The canvas's change pins: a numbered, map-style pin on every element a
// change is about, numbered like the "확인할 변경점" list — pick one in either
// place and the other follows. This file is the arithmetic (which pins,
// where their tips point, what to do when heads collide); ConflictPins
// draws them.

// Sizes are in screen pixels and don't follow the canvas zoom.
export const PIN = {
  head: 16, // the head's diameter
  height: 21, // head top to tail tip
  headSelected: 20,
  heightSelected: 26,
  inset: 6, // how far inside the element's corner the tip sits
  gap: 4, // between heads spread side by side
  clusterFrom: 3, // this many at one spot become one "+N" pin
}

// One pin per (change, element): a change about four cards has four pins
// with its one number. Rollbacks and design requests have no element.
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

// Where a pin's tip points: 6px inside the element's top-right corner — on
// the element, not hanging off it. If the head would poke out of the
// frame's right edge there, the top-left corner instead.
export function anchorOf(rect, frame, { head = PIN.head, inset = PIN.inset } = {}) {
  const flipped = Boolean(frame) && rect.right - inset + head / 2 > frame.right
  return { x: flipped ? rect.left + inset : rect.right - inset, y: rect.top + inset, flipped }
}

// Pins placed so no two heads sit on top of each other. Heads that collide
// are one group: two are spread side by side (4px apart) around where they
// were; three or more become one "+N" pin until it's opened (`expanded`
// holds opened groups' keys), then they spread the same way.
// in:  [{ id, x, y, … }] (tips);  out: [{ kind: 'pin', pin, x, y } | { kind: 'cluster', key, pins, x, y }]
export function layoutPins(pins, { head = PIN.head, gap = PIN.gap, clusterFrom = PIN.clusterFrom, expanded = new Set() } = {}) {
  const parent = pins.map((_, index) => index)
  const find = (index) => (parent[index] === index ? index : (parent[index] = find(parent[index])))
  for (let a = 0; a < pins.length; a++) {
    for (let b = a + 1; b < pins.length; b++) {
      if (Math.hypot(pins[a].x - pins[b].x, pins[a].y - pins[b].y) < head) parent[find(a)] = find(b)
    }
  }
  const groups = new Map()
  pins.forEach((pin, index) => groups.set(find(index), [...(groups.get(find(index)) ?? []), pin]))
  const placed = []
  for (const group of groups.values()) {
    if (group.length === 1) { placed.push({ kind: 'pin', pin: group[0], x: group[0].x, y: group[0].y }); continue }
    const key = group.map((pin) => pin.id).sort().join('|')
    const cx = group.reduce((sum, pin) => sum + pin.x, 0) / group.length
    const cy = group.reduce((sum, pin) => sum + pin.y, 0) / group.length
    if (group.length >= clusterFrom && !expanded.has(key)) { placed.push({ kind: 'cluster', key, pins: group, x: cx, y: cy }); continue }
    // Side by side, in number order, centered on where the group was.
    const step = head + gap
    const ordered = [...group].sort((a, b) => (a.number ?? 0) - (b.number ?? 0) || a.x - b.x || a.y - b.y)
    ordered.forEach((pin, index) => placed.push({ kind: 'pin', pin, x: cx + (index - (ordered.length - 1) / 2) * step, y: cy, groupKey: group.length >= clusterFrom ? key : null }))
  }
  return placed
}
