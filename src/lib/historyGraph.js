// The legacy timeline has order but no recorded ancestry. Keep that distinction
// visible; only explicit source IDs create merge/restore branches.
export function historyGraphEdges(entries) {
  const known = new Set(entries.map((entry) => entry.id))
  return entries.flatMap((entry, index) => {
    const parents = entry.parentIds ?? (index ? [entries[index - 1].id] : [])
    const edges = parents.filter((id) => known.has(id) && id !== entry.id).map((id) => ({ from: entry.id, to: id, kind: entry.parentIds ? 'parent' : 'sequence' }))
    for (const id of entry.mergedFromIds ?? []) {
      if (known.has(id) && id !== entry.id && !parents.includes(id)) edges.push({ from: entry.id, to: id, kind: 'merge' })
    }
    if (known.has(entry.restoredFrom) && entry.restoredFrom !== entry.id) edges.push({ from: entry.id, to: entry.restoredFrom, kind: 'restore' })
    return edges
  })
}
