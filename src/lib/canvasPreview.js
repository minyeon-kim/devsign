import { useSyncExternalStore } from 'react'

// A fix previewed where it would land: on the canvas's own screens — the same drawing (StaticLayer) given
// values to put over what's built (`overrides`, by layer id), never a picture drawn apart from them.
//
// Which elements a change's fix reaches: every one of the project's elements of the component it's about
// that carries the same token — on its own screen and on every other — so the canvas shows how far it goes.
// (Today: an icon's stroke — the icon set's token.)
//   → [{ pageId, frameId, layerId, token }]
export function previewTargetsOf(conflict, pages = []) {
  if (conflict?.preview?.kind !== 'icon') return []
  const components = conflict.impact?.components ?? []
  const targets = []
  for (const page of pages) {
    if (conflict.projectId && page.projectId && page.projectId !== conflict.projectId) continue
    for (const frame of page.frames ?? []) {
      for (const layer of frame.layers ?? []) {
        if (layer.type !== 'glyph' || !layer.mock?.token) continue
        if (components.length && !components.includes(layer.mock.component)) continue
        targets.push({ pageId: page.id, frameId: frame.id, layerId: layer.id, token: layer.mock.token })
      }
    }
  }
  return targets
}

// What a way's values put on those elements: { [layerId]: override }. Empty for none.
export function overridesFor(conflict, targets, values) {
  if (!values || !targets.length) return {}
  if (conflict?.preview?.kind === 'icon' && values.stroke != null) return Object.fromEntries(targets.map((target) => [target.layerId, { strokeWidth: values.stroke }]))
  return {}
}

// The screens a fix reaches, in order, the change's own first.
export const affectedPagesOf = (targets, ownPageId) => [...new Set([ownPageId, ...targets.map((target) => target.pageId)].filter((id) => id && targets.some((target) => target.pageId === id)))]

// The preview in hand — the detail's (ProposalSection) to say, the canvas's (CanvasPanel) to draw. Null: none.
//   { conflictId, targets, pages, focus: { pageId, layerId }, base: Cell, ways: Cell[], picked, peek,
//     compare: null | 'side' | 'swipe' | 'onion', mix, focusNonce, fitNonce, onPick(id) }
//   Cell: { id, n, label, chip, overrides, empty }
let current = null
const listeners = new Set()
export const getCanvasPreview = () => current
export function setCanvasPreview(next) {
  current = typeof next === 'function' ? next(current) : next
  for (const listener of listeners) listener()
}
const subscribe = (listener) => { listeners.add(listener); return () => listeners.delete(listener) }
export const useCanvasPreview = () => useSyncExternalStore(subscribe, getCanvasPreview, getCanvasPreview)

// The overrides the canvas draws with now: the way picked — or, Space held, none (what's built).
export function liveOverridesOf(preview) {
  if (!preview || preview.peek || preview.compare) return {}
  return preview.ways.find((way) => way.id === preview.picked)?.overrides ?? {}
}
