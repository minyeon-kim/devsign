import { canvasPages, codeMergeVariants, designMergeVariants, openFiles } from '@/data/mockData'
import { ASSEMBLY_FILLS, assemblyToOverride, diffEffect, frameWithLayers, isCustomResolution, mergeOverride } from '@/components/mergestudio/mergeEffects'
import { codeOverrides } from '@/components/mergestudio/codeSync'

// Turns the merge item + the user's resolutions + the canvas annotations
// into the pre-flight summary shown at the top of the modal. `manualCode`
// holds hand-typed code lines keyed `fileId:line`.
export function buildSummary(item, resolutions, annotations, preset, assemblies = {}, extraLayers = [], manualCode = {}) {
  const layers = frameWithLayers(canvasPages.find((p) => p.id === item.designPageId)?.frames[0], extraLayers)?.layers ?? []
  const layerDiffs = designMergeVariants[item.id]?.layerDiffs ?? {}

  const design = Object.entries(resolutions).map(([key, side]) => {
    const split = key.indexOf(':')
    const layerId = key.slice(0, split)
    const diffId = key.slice(split + 1)
    const diff = layerDiffs[layerId]?.find((d) => d.id === diffId)
    const layer = layers.find((l) => l.id === layerId)
    return {
      key,
      text: `${layer?.name ?? layerId} · ${diff?.label ?? 'Design decision'}`,
      choice: isCustomResolution(side)
        ? `Edited to ${side.custom}`
        : diff
          ? side === 'A' ? `Kept ${diff.optionA}` : `Accepted ${diff.optionB}`
          : side === 'A' ? 'Kept original design' : 'Accepted current implementation',
    }
  })
  for (const l of extraLayers) {
    design.push({ key: `added-${l.id}`, text: `Design System · ${l.name}`, choice: 'Added to Original Design and Current Implementation' })
  }
  for (const [layerId, a] of Object.entries(assemblies)) {
    const layer = layers.find((l) => l.id === layerId)
    if (!layer || extraLayers.some((l) => l.id === layerId)) continue
    const parts = [
      a.asName && `replaced with ${a.asName}`,
      a.asLabel && !a.asName && `text “${a.asLabel}”`,
      a.shape && `${a.shape} shape`,
      (a.width || a.height) && `${Math.round(a.width ?? layer.width)}×${Math.round(a.height ?? layer.height)}`,
      a.fill && `${ASSEMBLY_FILLS.find((f) => f.id === a.fill)?.label ?? a.fill} fill`,
      a.border && a.border !== 'none' && `${a.border} border`,
      a.shadow && a.shadow !== 'none' && `${a.shadow} shadow`,
      a.icon && `icon ${a.icon}`,
    ].filter(Boolean)
    design.push({ key: `assembly-${layerId}`, text: `${layer.name} · Assembled block`, choice: parts.join(' · ') || 'Customized' })
  }
  if (preset) {
    design.push({
      key: 'preset',
      text: `${layers.find((l) => l.id === preset.layerId)?.name ?? preset.layerId} · AI style preset`,
      choice: `Applied ${preset.label}`,
    })
  }

  const files = openFiles
    .filter((f) => item.fileIds?.includes(f.id))
    .map((f) => ({
      id: f.id,
      name: f.name,
      changed: codeMergeVariants[item.id]?.[f.id]?.length ?? 0,
      aiLines: annotations.filter((a) => a.status === 'done' && a.fileId === f.id).length,
      manualLines: Object.keys(manualCode).filter((k) => k.startsWith(`${f.id}:`)).length,
    }))

  return {
    design,
    files,
    applied: annotations.filter((a) => a.status === 'done'),
    pending: annotations.filter((a) => a.status !== 'done').length,
  }
}

// Every drift between Original Design and Current Implementation for an item —
// design property diffs (grouped per layer) plus raw code-line diffs, with
// a code line dropped when it's already covered by a design layer's own
// code-span (see `layerCodeMap`): that's the *same* underlying change, so
// counting it again as a separate "code" drift would be a redundant
// duplicate — and, since selecting that line reverse-syncs back to the
// owning layer, it could make `< >` navigation loop back on itself.
// Shared by the canvas's own drift pager and the merge wizard's Check step,
// so both walk the exact same list.
export function buildDrifts(item, frame) {
  const layerDiffMap = designMergeVariants[item.id]?.layerDiffs ?? {}
  const codeMap = designMergeVariants[item.id]?.layerCodeMap ?? {}
  const codeCoveredByDesign = (fileId, line) =>
    Object.values(codeMap).some((t) => t.fileId === fileId && line >= t.line && line <= t.line + (t.span ?? 1) - 1)
  return [
    ...(frame?.layers ?? [])
      .filter((l) => layerDiffMap[l.id])
      .map((l) => ({
        id: `d:${l.id}`,
        kind: 'design',
        layerId: l.id,
        diffs: layerDiffMap[l.id],
        label: `${l.name} · ${layerDiffMap[l.id].length} change${layerDiffMap[l.id].length === 1 ? '' : 's'}`,
      })),
    ...Object.entries(codeMergeVariants[item.id] ?? {}).flatMap(([fileId, diffs]) =>
      diffs
        .filter((d) => !codeCoveredByDesign(fileId, d.line))
        .map((d) => ({
          id: `c:${fileId}:${d.line}`,
          kind: 'code',
          fileId,
          line: d.line,
          label: `${openFiles.find((f) => f.id === fileId)?.name ?? fileId} · line ${d.line}`,
        }))
    ),
  ]
}

// Staged/merged design output: the artboard frame (plus library layers) and a
// per-layer override map with every variant choice, AI edit, Block Assemble
// edit, hand-edited code and applied preset baked in. Used by the
// responsive Preview.
export function buildOverrides(item, resolutions = {}, annotations = [], preset = null, assemblies = {}, extraLayers = [], manualCode = {}, getFileLines = () => []) {
  const frame = item.hasDesign
    ? frameWithLayers(canvasPages.find((p) => p.id === item.designPageId)?.frames[0], extraLayers)
    : null
  const layerDiffs = designMergeVariants[item.id]?.layerDiffs ?? {}
  const overrides = {}

  for (const [key, side] of Object.entries(resolutions)) {
    const split = key.indexOf(':')
    const layerId = key.slice(0, split)
    const diff = layerDiffs[layerId]?.find((d) => d.id === key.slice(split + 1))
    if (diff) overrides[layerId] = mergeOverride(overrides[layerId], diffEffect(diff, side))
  }
  for (const a of annotations) {
    if (!a.effect) continue
    for (const t of a.targets ?? []) overrides[t] = mergeOverride(overrides[t], a.effect)
  }
  for (const [layerId, a] of Object.entries(assemblies)) {
    const layer = frame?.layers.find((l) => l.id === layerId)
    const o = layer && assemblyToOverride(a, layer)
    if (o) overrides[layerId] = mergeOverride(overrides[layerId], o)
  }
  for (const [layerId, o] of Object.entries(codeOverrides(item.id, frame, manualCode, getFileLines))) {
    overrides[layerId] = mergeOverride(overrides[layerId], o)
  }
  if (preset) overrides[preset.layerId] = mergeOverride(overrides[preset.layerId], { className: preset.previewClass })
  return { frame, overrides }
}
