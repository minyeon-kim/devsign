import { isOpen } from '@/lib/conflicts'
import { layerIdsOf } from '@/lib/conflictInsight'

// The open changes on each screen of a project — what the Screens board
// counts on its cards. A change is on the screen that holds an element it's
// about (any of them), or the screen it names itself (`designPageId`);
// one that's about no screen is `unplaced`: counted in the total, shown on no
// card. Resolved ones, and restores of an earlier version, aren't counted.
//
//   → { byScreen: Map<screenId, conflict[]>, unplaced: conflict[], total }
export const isCounted = (conflict) => isOpen(conflict) && !conflict.rollback

export function conflictsByScreen(prototype, conflicts = []) {
  const screenOfLayer = new Map()
  for (const screen of prototype.screens) for (const layer of screen.frame.layers) if (!screenOfLayer.has(layer.id)) screenOfLayer.set(layer.id, screen.id)
  const known = new Set(prototype.screens.map((screen) => screen.id))
  const byScreen = new Map()
  const unplaced = []
  for (const conflict of conflicts.filter(isCounted)) {
    const screens = new Set(layerIdsOf(conflict).map((layerId) => screenOfLayer.get(layerId)).filter(Boolean))
    if (!screens.size && known.has(conflict.designPageId)) screens.add(conflict.designPageId)
    if (!screens.size) { unplaced.push(conflict); continue }
    for (const id of screens) byScreen.set(id, [...(byScreen.get(id) ?? []), conflict])
  }
  return { byScreen, unplaced, total: new Set([...[...byScreen.values()].flat(), ...unplaced].map((conflict) => conflict.id)).size }
}

// "3", "99+" — never wider than that.
export const countLabel = (count) => (count > 99 ? '99+' : String(count))

// What a change's references point at that isn't there — an element or a
// screen of its project — as sentences; none when they're all real.
export function conflictReferenceProblems(prototype, conflicts = []) {
  const layers = new Set(prototype.screens.flatMap((screen) => screen.frame.layers.map((layer) => layer.id)))
  const screens = new Set(prototype.screens.map((screen) => screen.id))
  const problems = []
  for (const conflict of conflicts) {
    if (conflict.designPageId && !screens.has(conflict.designPageId)) problems.push(`${conflict.id} names screen "${conflict.designPageId}", which doesn't exist`)
    for (const layerId of layerIdsOf(conflict)) if (!layers.has(layerId)) problems.push(`${conflict.id} is about element "${layerId}", which isn't on any screen`)
  }
  return problems
}

// The board's open changes, one by one, in the order the toolbar's ‹ › walk them: screen by screen in
// the board's order (`order`: its cards' ids), and on one screen from top to bottom (then left to right).
// Each with what the camera goes to — the box (board units, the card's own coordinates) around its
// elements on that screen, the whole screen when it names only the screen — and the element its pin is on.
//   → [{ conflict, screenId, box: { x, y, width, height } | null, layerId: string | null }]
// (A change about no screen comes last, with no box: its detail shows, the board doesn't move.)
export function conflictSequence(prototype, conflicts = [], order = prototype.screens.map((screen) => screen.id)) {
  const { byScreen, unplaced } = conflictsByScreen(prototype, conflicts)
  const steps = []
  const seen = new Set()
  for (const screenId of order) {
    const screen = prototype.screens.find((entry) => entry.id === screenId)
    const here = []
    for (const conflict of byScreen.get(screenId) ?? []) {
      if (seen.has(conflict.id)) continue
      seen.add(conflict.id)
      const layers = layerIdsOf(conflict).map((id) => screen.frame.layers.find((layer) => layer.id === id)).filter(Boolean)
      const box = layers.length ? unionBox(layers) : { x: 0, y: 0, width: screen.size?.width ?? screen.frame.width ?? 0, height: screen.size?.height ?? screen.frame.height ?? 0 }
      here.push({ conflict, screenId, box, layerId: layers[0]?.id ?? null })
    }
    here.sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x)
    steps.push(...here)
  }
  for (const conflict of unplaced) if (!seen.has(conflict.id)) steps.push({ conflict, screenId: null, box: null, layerId: null })
  return steps
}

function unionBox(boxes) {
  const x = Math.min(...boxes.map((b) => b.x))
  const y = Math.min(...boxes.map((b) => b.y))
  return { x, y, width: Math.max(...boxes.map((b) => b.x + b.width)) - x, height: Math.max(...boxes.map((b) => b.y + b.height)) - y }
}

// Whether a change is the viewer's to deal with: they review it, it's assigned to them, or they made or asked
// for it. (The list and the board show these by default — "내 할 일"; everything else is under "전체".)
export function isMine(conflict, viewerId) {
  if (!conflict || !viewerId) return false
  return (conflict.reviewers ?? []).some((reviewer) => (reviewer.id ?? reviewer) === viewerId)
    || conflict.assigneeId === viewerId
    || conflict.changedBy?.id === viewerId
    || conflict.requestedBy === viewerId
}
