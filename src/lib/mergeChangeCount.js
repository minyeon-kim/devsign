// Count each changed code line once, even when incoming, manual and AI edits overlap.
export function mergeChangeCount(summary, variants = {}, manualCode = {}, annotations = []) {
  if (!summary) return 0
  const lines = new Set(Object.entries(variants).flatMap(([fileId, changes]) => changes.map((change) => `${fileId}:${change.line}`)))
  for (const key of Object.keys(manualCode)) lines.add(key)
  let designAnnotations = 0
  for (const annotation of annotations) {
    if (annotation.status !== 'done') continue
    if (annotation.fileId && annotation.line != null) lines.add(`${annotation.fileId}:${annotation.line}`)
    else designAnnotations += 1
  }
  return summary.design.length + lines.size + designAnnotations
}
