import { useSyncExternalStore } from 'react'
import { layerIdsOf } from '@/lib/conflictInsight'
import { valueOverridesOf } from '@/lib/elementPreview'

// A fix previewed where it would land: on the canvas's own screens — the same drawing (StaticLayer) given
// values to put over what's built (`overrides`, by layer id), never a picture drawn apart from them.
//
// Which elements a change's fix reaches:
//   · an icon's stroke: every one of the project's icons of the component it's about that carries the same
//     token — on its own screen and on every other — so the canvas shows how far it goes;
//   · any other value the canvas can draw (a button's height or colour, a radius, a weight): the element
//     itself, where it is — when its values put on it make it differ (lib/elementPreview).
//   → [{ pageId, frameId, layerId, token }]
export function previewTargetsOf(conflict, pages = []) {
  if (conflict?.preview?.kind !== 'icon') return elementTargetsOf(conflict, pages)
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

function elementTargetsOf(conflict, pages) {
  const ids = layerIdsOf(conflict)
  if (!ids.length || !conflict?.preview) return []
  for (const page of pages) {
    for (const frame of page.frames ?? []) {
      if (!frame.layers?.some((layer) => layer.id === conflict.layerId)) continue
      const shows = Object.keys(valueOverridesOf(conflict, frame, conflict.preview.before)).length > 0
      return shows ? ids.filter((id) => frame.layers.some((layer) => layer.id === id)).map((layerId) => ({ pageId: page.id, frameId: frame.id, layerId, token: null })) : []
    }
  }
  return []
}

// What a way's values put on those elements: { [layerId]: override }. Empty for none — or for the
// design's own values, which is how the canvas draws the element already.
export function overridesFor(conflict, targets, values, pages = []) {
  if (!values || !targets.length) return {}
  if (conflict?.preview?.kind === 'icon') return values.stroke != null ? Object.fromEntries(targets.map((target) => [target.layerId, { strokeWidth: values.stroke }])) : {}
  const frame = pages.flatMap((page) => page.frames ?? []).find((entry) => entry.id === targets[0].frameId)
  if (!frame) return {}
  // (A button's values said outright — the canvas may be drawing it as the code has it, not as designed —
  // so the design's way shows the design's height and colour, not "nothing to change".)
  if (conflict.preview.kind === 'button') {
    return Object.fromEntries(targets.map((target) => {
      const layer = frame.layers.find((entry) => entry.id === target.layerId)
      const override = {
        ...(values.background && { fillStyle: { background: values.background, color: '#fff' } }),
        ...(Number.isFinite(values.height) && layer && { dh: values.height - layer.height }),
        ...(values.radius != null && { radius: values.radius }),
      }
      return [target.layerId, override]
    }))
  }
  return valueOverridesOf(conflict, frame, values)
}

// Whether what changes is too small to see at the canvas's size — a stroke, a size or a gap of 4px or
// less, two colours close to each other — so a magnifier comes up beside the element by itself. A button's
// height and colour together, say, are plain to see: no magnifier, unless it's asked for.
const numberOf = (value) => (typeof value === 'number' ? value : Number.parseFloat(value))
const rgbOf = (value) => {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(value ?? '').trim())?.[1]
  if (!hex) return null
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex
  return [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16))
}
export function isSubtleChange(conflict) {
  const { before = {}, after = {} } = conflict?.preview ?? {}
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((key) => String(before[key]) !== String(after[key]))
  if (!keys.length) return false
  return keys.every((key) => {
    if (/stroke/i.test(key)) return true
    const [a, b] = [rgbOf(before[key]), rgbOf(after[key])]
    if (a && b) return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 48
    const [x, y] = [numberOf(before[key]), numberOf(after[key])]
    return Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) <= 4
  })
}
// The magnifier on or off for a change, as last set by hand (kept in the browser); null: never set.
const LENS_KEY = 'devsign:previewLens'
export function readLens(conflictId) {
  try { const saved = JSON.parse(localStorage.getItem(LENS_KEY) ?? '{}'); return typeof saved[conflictId] === 'boolean' ? saved[conflictId] : null } catch { return null }
}
export function writeLens(conflictId, on) {
  try { const saved = JSON.parse(localStorage.getItem(LENS_KEY) ?? '{}'); localStorage.setItem(LENS_KEY, JSON.stringify({ ...saved, [conflictId]: on })) } catch { /* not kept */ }
}

// The screens a fix reaches, in order, the change's own first.
export const affectedPagesOf = (targets, ownPageId) => [...new Set([ownPageId, ...targets.map((target) => target.pageId)].filter((id) => id && targets.some((target) => target.pageId === id)))]

// The preview in hand — the detail's (ProposalSection) to say, the canvas's (CanvasPanel) to draw. Null: none.
//   { conflictId, targets, pages, focus: { pageId, layerId }, base: Cell, ways: Cell[], picked, peek, lens,
//     compare: null | 'side' | 'swipe' | 'onion', mix, fitNonce, onPick(id) }
// (Picking a way never moves the camera: the canvas shows it where it's looking.)
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

// The overrides the canvas draws with now: the way picked — or, Space held, what's built.
export function liveOverridesOf(preview) {
  if (!preview || preview.compare) return {}
  if (preview.peek) return preview.base?.overrides ?? {}
  return preview.ways.find((way) => way.id === preview.picked)?.overrides ?? {}
}
