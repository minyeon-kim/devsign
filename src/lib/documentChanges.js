export const DOCUMENT_STAGES = [
  { id: 'update', label: 'Document update' },
  { id: 'documented', label: 'Documentation' },
  { id: 'archived', label: 'History' },
]

export function nextDocumentChange(changes) {
  return changes.find((change) => change.stage !== 'archived') ?? null
}

export function canProcessDocumentChange(changes, id, stage) {
  const next = nextDocumentChange(changes)
  return next?.id === id && next.stage === stage
}

// Explicit document links can point to any reference, including future docs.
// Otherwise match system changes to existing documentation topics.
export function affectedDocuments(source, docs) {
  const explicit = new Set([...(source.docIds ?? []), ...(source.affectedDocIds ?? []), source.docId].filter(Boolean))
  const linked = docs.filter((doc) => explicit.has(doc.id))
  if (linked.length) return linked
  const text = [source.title, source.summary, source.message, source.file, source.subtitle, ...(source.changes ?? []).map(c => c.label)].filter(Boolean).join(' ').toLowerCase()
  const terms = text.match(/[a-z][a-z0-9]+/g) ?? []
  const matches = docs.filter(doc => {
    const title = `${doc.title} ${doc.id}`.toLowerCase()
    return terms.some(term => term.length > 2 && !['the', 'from', 'with', 'code', 'change', 'changes', 'merged'].includes(term) && title.includes(term))
  })
  return matches.length ? matches : docs.filter(doc => doc.id === 'doc-release')
}

export function mergeDocumentUpdate(item, projectId, { files = {}, previousFiles = {}, fileNames = {}, draft = {}, layerDiffs = {} } = {}) {
  const changes = Object.entries(files).flatMap(([fileId, lines]) => {
    const before = (previousFiles[fileId] ?? []).join('\n')
    const after = lines.join('\n')
    return before === after ? [] : [{ label: fileNames[fileId] ?? fileId, from: before, to: after }]
  })
  for (const [layerId, assembly] of Object.entries(draft.assemblies ?? {})) {
    changes.push({ label: `Design · ${layerId}`, from: 'Original design', to: JSON.stringify(assembly) })
  }
  for (const layer of draft.addedLayers ?? []) {
    changes.push({ label: `Design · ${layer.name ?? layer.id}`, from: '—', to: 'Added component' })
  }
  for (const [key, choice] of Object.entries(draft.resolutions ?? {})) {
    const split = key.indexOf(':')
    const layerId = key.slice(0, split)
    const diffId = key.slice(split + 1)
    const diff = layerDiffs[layerId]?.find((entry) => entry.id === diffId)
    if (!diff || !choice) continue
    const after = typeof choice === 'object' ? choice.custom : choice === 'A' ? diff.optionA : diff.optionB
    if (after !== diff.optionA) changes.push({ label: `${layerId} · ${diff.label}`, from: diff.optionA, to: after })
  }
  if (draft.appliedPreset) {
    changes.push({ label: 'Style preset', from: 'Original design', to: draft.appliedPreset.label })
  }
  for (const annotation of draft.annotations ?? []) {
    if (annotation.status === 'done' && annotation.effect) {
      changes.push({ label: annotation.label ?? 'AI design change', from: 'Original design', to: JSON.stringify(annotation.effect) })
    }
  }
  if (!changes.length) return null
  return {
    id: `docu-merge-${item.id}`, projectId, mergeItemId: item.id, source: 'merge',
    title: item.title, summary: `System changes merged from “${item.title}”.`,
    authorId: item.authorId ?? 'jane', createdAtLabel: 'Just now', stage: 'update',
    docIds: item.docIds, affectedDocIds: item.affectedDocIds, changes,
  }
}
