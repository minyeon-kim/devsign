import { canvasPages, designMergeVariants } from '@/data/mockData'

// A conflict's drifted design values, one decision each — scoped to the
// conflict's own element when it names one, else every element of its
// merge item. Shared by the review's Decide row and the conflict list.
export function driftRowsFor(conflict, item) {
  const layerDiffs = designMergeVariants[item.id]?.layerDiffs ?? {}
  const scoped = conflict.layerId && layerDiffs[conflict.layerId] ? { [conflict.layerId]: layerDiffs[conflict.layerId] } : layerDiffs
  const page = canvasPages.find((p) => p.id === item.designPageId)
  const layerName = (id) => page?.frames[0]?.layers?.find((l) => l.id === id)?.name ?? id
  const multiLayer = Object.keys(scoped).length > 1
  return Object.entries(scoped).flatMap(([layerId, diffs]) => diffs.map((diff) => ({
    key: `${layerId}:${diff.id}`,
    label: multiLayer ? `${layerName(layerId)} · ${diff.label}` : diff.label,
    diff,
  })))
}

// Whether every one of a conflict's drifts has a decision (false when it
// has none to make).
export function allDecided(conflict, mergeItems, decisionsFor) {
  const item = mergeItems.find((m) => m.id === conflict.mergeItemId || m.conflictId === conflict.id)
  if (!item || !decisionsFor) return false
  const rows = driftRowsFor(conflict, item)
  const decisions = decisionsFor(item.id)
  return rows.length > 0 && rows.every((row) => decisions[row.key] != null)
}
