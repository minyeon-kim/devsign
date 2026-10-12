import { layerIdsOf } from '@/lib/conflictInsight'
import { focusBox } from '@/lib/devicePreview'
import { categoryFor, renderOf } from '@/lib/codeRender'
import { adapterOf } from '@/lib/changeAdapters'

// A Conflict Point's own element, drawn by itself — what its thumbnail and
// its element preview show, instead of the whole screen scaled down.
//
// The design frame is the design: its layers are drawn as designed. The
// current code is the same element with the conflict's `preview.before`
// values put back on it (`codeOverridesOf`), so the two sides differ exactly
// where the conflict says they do.

// A card's inset as the frame draws it (StaticLayer's `p-2.5`).
const CARD_PADDING = 10
const px = (value) => parseFloat(value)

// The element(s) a conflict is about on its frame: the one its thumbnail
// crops to (`layerId`), and every one its preview marks (`layerIds` too).
// Null when it isn't about an element on that frame.
export function targetOf(conflict, link) {
  const frame = link?.frame
  if (!frame || !link.layer) return null
  const ids = layerIdsOf(conflict).filter((id) => frame.layers.some((layer) => layer.id === id))
  return ids.length ? { frame, mainId: link.layer.id, ids } : null
}

// The crop: the box around `ids` with room around it (lib/devicePreview),
// never the frame's full width for a single small element.
export function cropOf(frame, ids, pad = 10) {
  return focusBox(frame, ids, pad)
}

// `{ [layerId]: override }` that turns the designed element into the one the
// code currently renders. Empty when the conflict's values can't be put on
// the element (the preview then shows the design on both sides, said so).
export function codeOverridesOf(conflict, frame) {
  return valueOverridesOf(conflict, frame, conflict?.preview?.before)
}

// `{ [layerId]: override }` that draws the designed element with `values` on
// it instead — the code's (`preview.before`), or any value being tried
// (a change adapter's `values`). Empty when they're the design's own, or can't be put
// on the element.
export function valueOverridesOf(conflict, frame, values) {
  const preview = conflict?.preview
  const layer = frame?.layers.find((candidate) => candidate.id === conflict?.layerId)
  if (!preview || !layer || !values) return {}
  const before = values
  const { after = {} } = preview
  let override = null
  let ids = [layer.id]
  if (preview.kind === 'button') {
    override = {
      ...(before.background && before.background !== after.background && { fillStyle: { background: before.background, color: '#fff' } }),
      ...(Number.isFinite(before.height - after.height) && before.height !== after.height && { dh: before.height - after.height }),
      ...(before.radius !== undefined && before.radius !== after.radius && { radius: before.radius }),
    }
  } else if (preview.kind === 'text') {
    override = { ...(before.fontWeight !== undefined && before.fontWeight !== after.fontWeight && { fontWeight: before.fontWeight }) }
  } else if (preview.kind === 'spacing' && layer.type === 'card' && px(after.gap) > 0) {
    // The frame is drawn smaller than the product: the inset keeps its
    // proportion (12 of 16 → 7.5 of 10).
    const inset = CARD_PADDING * (px(before.gap) / px(after.gap))
    if (Number.isFinite(inset) && px(before.gap) !== px(after.gap)) override = { padding: { x: inset, y: inset } }
    // (A spacing rule is about every card it applies to.)
    ids = layerIdsOf(conflict).filter((id) => frame.layers.some((candidate) => candidate.id === id))
  }
  return override && Object.keys(override).length ? Object.fromEntries(ids.map((id) => [id, override])) : {}
}

// How one way forward is drawn: the design as it is ('after'), the code as
// built ('before'), or a value of one's own (read by the change's adapter,
// lib/changeAdapters).
//   shape: a proposal (lib/designDecisions.proposalOf) — { side } or { values: { value } }
// out: { values, overrides } — the values a sample is drawn with, and what
// they put on the element when it's on the design screen (`frame`). Null
// when the way has nothing that can be drawn.
export function drawingOf(conflict, frame, shape) {
  if (!shape || !conflict?.preview) return null
  if (shape.side === 'after') return { values: conflict.preview.after ?? {}, overrides: {} }
  if (shape.side === 'before') return { values: conflict.preview.before ?? {}, overrides: codeOverridesOf(conflict, frame) }
  const values = adapterOf(conflict).values(conflict, shape.values?.value)
  return values ? { values, overrides: valueOverridesOf(conflict, frame, values) } : null
}

// Whether the element on the design screen can show the change: the code's
// values put on it make it differ from the design. (When they can't — a
// stroke, a letter-spacing — the change is drawn as its own sample instead,
// so the two sides never look the same.)
export const elementShows = (conflict, frame) => Object.keys(codeOverridesOf(conflict, frame)).length > 0

// Where on the element the difference is, for the mark drawn over it:
// 'inset' — a band along the inside edge, `band` px wide (a padding);
// 'fill' — the whole element (a background); 'text' — its text.
export function markOf(conflict, frame, side = 'before') {
  const preview = conflict?.preview
  const layer = frame?.layers.find((candidate) => candidate.id === conflict?.layerId)
  if (!preview || !layer) return { kind: 'outline' }
  if (preview.kind === 'spacing' && layer.type === 'card') {
    const value = px(preview[side]?.gap)
    const design = px(preview.after?.gap)
    return { kind: 'inset', band: design > 0 && value > 0 ? CARD_PADDING * (value / design) : CARD_PADDING }
  }
  if (preview.kind === 'button') return { kind: 'fill' }
  if (preview.kind === 'text') return { kind: 'text' }
  return { kind: 'outline' }
}

// A conflict about a layout the code decides (a design decision on the
// grid): its two sides as code renders (lib/codeRender) — what the code
// lays out now and what the design asks for — instead of a design-frame
// crop, so it can be looked at on a phone, a tablet or a desktop. Null for
// any other conflict.
export function codeSidesOf(conflict) {
  if (!conflict?.decisionFlow || !conflict.fixes?.keep || !conflict.diff?.before?.length) return null
  const before = renderOf(conflict.projectId, conflict.fileId, conflict.diff.before)?.spec
  const after = renderOf(conflict.projectId, conflict.fileId, [conflict.fixes.keep])?.spec
  return before && after ? { before, after, category: conflict.targetDevice ?? categoryFor(conflict.projectId, conflict.fileId) } : null
}

// ── The change's element, enlarged, side by side (the detail's comparison) ──
// Not the whole screen: the element with COMPARE_PAD of what's around it,
// scaled so that crop fills its cell's width (never past COMPARE_MAX_ZOOM,
// where a small element would turn into a blur of pixels).
export const COMPARE_PAD = 24
export const COMPARE_MAX_ZOOM = 6
// (The element in the middle, COMPARE_PAD on every side — past the frame's edge
// when it sits against one, so it's never pushed off-centre.)
export function compareRegionOf(frame, mainId) {
  const layer = frame?.layers.find((candidate) => candidate.id === mainId)
  return layer ? { x: layer.x - COMPARE_PAD, y: layer.y - COMPARE_PAD, width: layer.width + COMPARE_PAD * 2, height: layer.height + COMPARE_PAD * 2 } : cropOf(frame, [mainId], COMPARE_PAD)
}
// The element alone: itself and what's drawn inside it — not its neighbours,
// whose edges would otherwise show in the room around it.
export function ownLayerIdsOf(frame, mainId) {
  const main = frame?.layers.find((candidate) => candidate.id === mainId)
  if (!main) return []
  const inside = (layer) => layer.x >= main.x - 0.5 && layer.y >= main.y - 0.5 && layer.x + layer.width <= main.x + main.width + 0.5 && layer.y + layer.height <= main.y + main.height + 0.5
  return frame.layers.filter((layer) => layer.id === mainId || inside(layer)).map((layer) => layer.id)
}
// A spacing drawn on its element with `values`: the inset as a band (frame
// px) and the dimension it stands for — what the picture tints and says
// beside the element. Null for anything that isn't an inset on a card.
export function insetOf(conflict, frame, values) {
  const layer = frame?.layers.find((candidate) => candidate.id === conflict?.layerId)
  const design = px(conflict?.preview?.after?.gap)
  const value = px(values?.gap)
  if (conflict?.preview?.kind !== 'spacing' || layer?.type !== 'card' || !(design > 0) || !(value >= 0)) return null
  return { band: CARD_PADDING * (value / design), label: `${value}px` }
}
export const compareScaleOf = (cellWidth, region) => (region?.width > 0 && cellWidth > 0 ? Math.min(COMPARE_MAX_ZOOM, cellWidth / region.width) : 1)

// What went in, once a change is fixed or merged — the third pane of the
// full-screen viewer: { value, side } ('after' the design's drawing, 'before'
// the code's). The design's value, unless keeping the code's was what was
// approved. Null while nothing has gone in yet.
export function appliedSideOf(conflict) {
  const field = conflict?.comparisonFields?.find((entry) => entry.current !== entry.expected) ?? conflict?.comparisonFields?.[0]
  const applied = Boolean(conflict?.decisionFix?.appliedAtMs || conflict?.decisionFix?.verified || conflict?.autoFix?.appliedAtMs || conflict?.reviewStage === 'resolved' || conflict?.resolved)
  if (!field || !applied) return null
  const kept = conflict.decidedSide === 'B' || (conflict.decisionRequest?.proposal === 'current' && conflict.designDecision?.choice !== 'keep')
  return { value: String((kept ? field.current : field.expected) ?? '').replace(/\s*\(.*\)\s*$/, ''), side: kept ? 'before' : 'after' }
}
