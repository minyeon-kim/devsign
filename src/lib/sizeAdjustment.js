import { canvasPages, conflictChecklist } from '@/data/mockData'

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
  if (!conflict?.layerId || !item) return null
  const layer = canvasPages.find((page) => page.id === item.designPageId)?.frames[0]?.layers?.find((l) => l.id === conflict.layerId)
  const sized = drafts?.[item.id]?.assemblies?.[conflict.layerId]
  if (!layer || !sized) return null
  const to = { width: sized.width ?? layer.width, height: sized.height ?? layer.height }
  if (to.width === layer.width && to.height === layer.height) return null
  const square = (size) => (size.width === size.height ? `${size.width}px` : sizeText(size))
  // The size as a class: on the 4px scale when it is ("size-6"), spelled
  // out otherwise.
  const sizeClass = to.width === to.height
    ? (to.width % 4 === 0 ? `size-${to.width / 4}` : `size-[${to.width}px]`)
    : `w-[${to.width}px] h-[${to.height}px]`
  return {
    layerName: layer.name, from: sizeText(layer), to: sizeText(to),
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
  return Object.fromEntries(conflictChecklist
    .filter((conflict) => conflict.projectId === projectId && conflict.adjustment && conflict.mergeItemId && conflict.layerId)
    .map((conflict) => [conflict.mergeItemId, { resolutions: {}, assemblies: { [conflict.layerId]: { ...conflict.adjustment.to } } }]))
}
