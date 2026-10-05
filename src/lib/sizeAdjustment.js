import { canvasPages, conflictChecklist, mergeListItems } from '@/data/mockData'
import { driftRowsFor } from '@/lib/driftDecisions'

// A size set by hand in Merge Studio (W / H in Properties → Layout) on a
// conflict's own element — the "precise adjustment" that settles a conflict
// no side can fix by being picked.
//
// It lives in the merge item's draft (`assemblies[layerId].width / height`),
// the same place the studio writes it, so everything that shows it — the
// review's card, code and summary, the conflict list — reads one value and
// follows it the moment it's made or undone.

const sizeText = (size) => `${size.width} × ${size.height}px`

// What was adjusted, or null when the element is still its original size.
// `drafts` is the workspace's merge drafts ({ [itemId]: draft }).
export function sizeAdjustmentOf(conflict, item, drafts) {
  if (!conflict || !item) return null
  // The conflict's own element first — then any other element of its item
  // that was resized (the one a check pointed at isn't always the same).
  const layers = canvasPages.find((page) => page.id === item.designPageId)?.frames[0]?.layers ?? []
  const assemblies = drafts?.[item.id]?.assemblies ?? {}
  const resized = [...new Set([conflict.layerId, ...Object.keys(assemblies)].filter(Boolean))]
    .map((id) => {
      const candidate = layers.find((l) => l.id === id)
      const size = assemblies[id]
      if (!candidate || !size) return null
      const next = { width: size.width ?? candidate.width, height: size.height ?? candidate.height }
      return next.width === candidate.width && next.height === candidate.height ? null : { layer: candidate, to: next }
    })
    .find(Boolean)
  if (!resized) return null
  const { layer, to } = resized
  const square = (size) => (size.width === size.height ? `${size.width}px` : sizeText(size))
  // The size as a class: on the 4px scale when it is ("size-6"), spelled
  // out otherwise.
  const sizeClass = to.width === to.height
    ? (to.width % 4 === 0 ? `size-${to.width / 4}` : `size-[${to.width}px]`)
    : `w-[${to.width}px] h-[${to.height}px]`
  return {
    layerId: layer.id, layerName: layer.name, from: sizeText(layer), to: sizeText(to),
    // A compared value written either way ("20 × 20px", or "20px" for a
    // square) reads as the original size: its old → new pair, else null.
    display: (value) => (value === sizeText(layer) ? { from: sizeText(layer), to: sizeText(to) }
      : value === `${layer.width}px` && layer.width === layer.height ? { from: value, to: square(to) } : null),
    // The same change in the code: the element's size classes.
    applyTo: (line) => line
      .replace(/\bw-\[\d+(?:\.\d+)?px\]/, `w-[${to.width}px]`)
      .replace(/\bh-\[\d+(?:\.\d+)?px\]/, `h-[${to.height}px]`)
      .replace(/\bsize-(?:\d+(?:\.\d+)?|\[\d+(?:\.\d+)?px\])/, sizeClass),
  }
}

// The drafts a project starts with: a seeded conflict that's already been
// adjusted by hand (`adjustment.to`, see mockData) opens with that size in
// its item's draft, exactly as if it had been set in Merge Studio.
export function seedMergeDrafts(projectId) {
  const mine = conflictChecklist.filter((conflict) => conflict.projectId === projectId && conflict.mergeItemId)
  return {
    ...Object.fromEntries(mine
      .filter((conflict) => conflict.adjustment && conflict.layerId)
      .map((conflict) => [conflict.mergeItemId, { resolutions: {}, assemblies: { [conflict.layerId]: { ...conflict.adjustment.to } } }])),
    // A sample that was already decided one way (`decidedSide`): every one
    // of its values on that side, so its review opens with that card picked.
    ...Object.fromEntries(mine
      .filter((conflict) => conflict.decidedSide)
      .map((conflict) => {
        const item = mergeListItems.find((candidate) => candidate.id === conflict.mergeItemId)
        const rows = item ? driftRowsFor(conflict, item).filter((row) => row.diff) : []
        return [conflict.mergeItemId, { resolutions: Object.fromEntries(rows.map((row) => [row.key, conflict.decidedSide])), assemblies: {} }]
      })),
  }
}
