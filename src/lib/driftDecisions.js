import { canvasPages, designMergeVariants } from '@/data/mockData'
import { draftScreens, regionKey } from '@/data/draftScreens'

// (Same rules as DesignComparison's decisionFor / decidedValue — repeated
// here so this module doesn't import the canvas.)
const decisionFor = (diff, value) => (value === diff.optionA ? 'A' : value === diff.optionB ? 'B' : { custom: value })
const decidedValue = (diff, resolution) => (resolution == null ? undefined : typeof resolution === 'object' ? resolution.custom : resolution === 'B' ? diff.optionB : diff.optionA)

// A diff where every side has the same value isn't a decision (e.g. a tap
// area noted as unchanged) — it's left out of what you pick.
export function isRealDiff(diff) {
  return new Set([diff.optionA, diff.optionB, ...Object.values(diff.values ?? {})]).size > 1
}

// The drafts of a multi-draft item as columns (A, B, C, …), each with the
// value it gives a diff; null for an ordinary design-vs-code item.
export function draftColumns(item) {
  if (!(item?.variants?.length > 2)) return null
  return item.variants.map((variant, index) => ({
    key: variant.key,
    letter: String.fromCharCode(65 + index),
    name: `시안 ${String.fromCharCode(65 + index)}`,
    valueOf: (diff) => diff.values?.[variant.key] ?? (variant.key === item.authorBId ? diff.optionB : diff.optionA),
  }))
}

// A conflict's drifted design values, one decision each — scoped to the
// conflict's own element when it names one, else every element of its
// merge item. Shared by the review's Decide row and the conflict list.
export function driftRowsFor(conflict, item) {
  // Drafts built from different layouts: a row per screen region.
  const screen = draftScreens[item.id]
  if (screen) return screen.regions.map((region) => ({ key: regionKey(region.id), label: region.label, element: null, region }))
  const layerDiffs = designMergeVariants[item.id]?.layerDiffs ?? {}
  const scoped = conflict.layerId && layerDiffs[conflict.layerId] ? { [conflict.layerId]: layerDiffs[conflict.layerId] } : layerDiffs
  const page = canvasPages.find((p) => p.id === item.designPageId)
  const layerName = (id) => page?.frames[0]?.layers?.find((l) => l.id === id)?.name ?? id
  // A row is named by its property, plus its element when that element has
  // more than one property to decide.
  return Object.entries(scoped).flatMap(([layerId, diffs]) => {
    const real = diffs.filter(isRealDiff)
    return real.map((diff) => ({
      key: `${layerId}:${diff.id}`,
      element: real.length > 1 ? layerName(layerId) : null,
      // (Always the element's name — for telling apart parts that share a
      // property, e.g. three "Corner Radius" rows.)
      layer: layerName(layerId),
      label: diff.label,
      diff,
    }))
  })
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

// Every row of a multi-draft item with each draft's option and which one is
// picked: a region row offers each draft's version of that region (its
// summary, e.g. "Two tiles"); a property row each draft's value.
// An ordinary design-vs-code item has no drafts of its own: its two
// choices are the two sides — the design reference and what's built now.
// (Without these a new merge's Mix panel had rows and nothing to pick.)
const SIDE_COLUMNS = [
  { key: 'A', letter: 'A', name: 'Design reference', valueOf: (diff) => diff.optionA, classOf: (diff) => diff.optionAClass },
  { key: 'B', letter: 'B', name: 'Current implementation', valueOf: (diff) => diff.optionB, classOf: (diff) => diff.optionBClass },
]

export function draftRows(conflict, item, decisions) {
  const columns = draftColumns(item) ?? SIDE_COLUMNS
  const screen = draftScreens[item.id]
  return driftRowsFor(conflict, item).map((row) => {
    const options = columns.map((column) => {
      if (row.region) {
        const part = screen.drafts[column.key]?.[row.region.id]
        return { ...column, value: part?.summary ?? '—', literal: false, decision: { custom: column.key }, picked: decisions[row.key]?.custom === column.key }
      }
      const value = column.valueOf(row.diff)
      // (`swatch`: the option's color, as a class, when the diff has one.)
      const swatch = column.classOf?.(row.diff) ?? (value === row.diff.optionA ? row.diff.optionAClass : value === row.diff.optionB ? row.diff.optionBClass : null)
      return { ...column, value, swatch, literal: Boolean(row.diff.literal), decision: decisionFor(row.diff, value), picked: decisions[row.key] != null && decidedValue(row.diff, decisions[row.key]) === value }
    })
    return { ...row, options, decided: decisions[row.key] != null }
  })
}

// Checks tied to an element in the selected comparison belong on that
// card. File-wide checks (e.g. merge markers) stay below the comparison.
export function comparisonBlockers(required, side, rows) {
  if (!side) return []
  return required.filter((check) => check.layerId
    ? rows.some((row) => row.key.startsWith(`${check.layerId}:`))
    : ['tokens', 'contrast', 'text'].includes(check.id))
}
