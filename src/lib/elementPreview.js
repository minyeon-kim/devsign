import { layerIdsOf } from '@/lib/conflictInsight'
import { focusBox } from '@/lib/devicePreview'

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
  const preview = conflict?.preview
  const layer = frame?.layers.find((candidate) => candidate.id === conflict?.layerId)
  if (!preview || !layer) return {}
  const { before = {}, after = {} } = preview
  let override = null
  let ids = [layer.id]
  if (preview.kind === 'button') {
    override = {
      ...(before.background && before.background !== after.background && { fillStyle: { background: before.background, color: '#fff' } }),
      ...(Number.isFinite(before.height - after.height) && before.height !== after.height && { dh: before.height - after.height }),
      ...(before.radius !== undefined && before.radius !== after.radius && { radius: before.radius }),
    }
  } else if (preview.kind === 'text') {
    override = { ...(before.fontWeight !== undefined && { fontWeight: before.fontWeight }) }
  } else if (preview.kind === 'spacing' && layer.type === 'card' && px(after.gap) > 0) {
    // The frame is drawn smaller than the product: the inset keeps its
    // proportion (12 of 16 → 7.5 of 10).
    const inset = CARD_PADDING * (px(before.gap) / px(after.gap))
    override = { padding: { x: inset, y: inset } }
    // (A spacing rule is about every card it applies to.)
    ids = layerIdsOf(conflict).filter((id) => frame.layers.some((candidate) => candidate.id === id))
  }
  return override && Object.keys(override).length ? Object.fromEntries(ids.map((id) => [id, override])) : {}
}

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
