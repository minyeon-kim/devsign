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
