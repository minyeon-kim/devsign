import { canvasPages, codeMergeVariants, designMergeVariants, mergeFilesFor } from '@/data/mockData'
import { ASSEMBLY_FILLS, assemblyToOverride, diffEffect, frameWithLayers, isCustomResolution, mergeOverride, yieldToExact } from '@/components/mergestudio/mergeEffects'
import { codeOverrides } from '@/components/mergestudio/codeSync'

// Turns the merge item + the user's resolutions + the canvas annotations
// into the pre-flight summary shown at the top of the modal. `manualCode`
// holds hand-typed code lines keyed `fileId:line`.
// `extraFiles` are Merge Studio-only files (copy.json) to list alongside
// the item's own.
export function buildSummary(item, resolutions, annotations, preset, assemblies = {}, extraLayers = [], manualCode = {}, extraFiles = []) {
  const layers = frameWithLayers(canvasPages.find((p) => p.id === item.designPageId)?.frames[0], extraLayers)?.layers ?? []
  const layerDiffs = designMergeVariants[item.id]?.layerDiffs ?? {}

  const design = Object.entries(resolutions).map(([key, side]) => {
    // (The mix's arrangement — see data/draftScreens' LAYOUT_KEY.)
    if (key === 'layout:regions') return { key, text: 'Result · Regions', choice: side?.custom?.removed?.length ? 'Rearranged, some removed' : 'Rearranged' }
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
      a.fillColor && `fill ${a.fillColor}`,
      a.radius !== undefined && `radius ${a.radius}px`,
      (a.dx || a.dy) && `moved ${a.dx ?? 0},${a.dy ?? 0}px`,
      (a.padX !== undefined || a.padY !== undefined) && `padding ${a.padY ?? '–'}/${a.padX ?? '–'}px`,
      a.gap !== undefined && `gap ${a.gap}px`,
      a.direction && `${a.direction === 'column' ? 'vertical' : 'horizontal'} layout`,
      a.stroke && `${a.stroke.width}px ${a.stroke.color} stroke`,
      a.opacity !== undefined && a.opacity !== 100 && `${a.opacity}% opacity`,
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

  const files = [...mergeFilesFor(item).filter((f) => item.fileIds?.includes(f.id)), ...extraFiles]
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
export function buildDrifts(item, frame, { assemblies = {}, code = {}, annotations = [], preset, manualCode = {} } = {}) {
  const layerDiffMap = designMergeVariants[item.id]?.layerDiffs ?? {}
  const codeMap = designMergeVariants[item.id]?.layerCodeMap ?? {}
  const editedLayers = new Set([...Object.keys(assemblies), ...Object.keys(code), ...annotations.filter((a) => a.status === 'done').flatMap((a) => a.targets ?? []), ...(preset ? [preset.layerId] : [])])
  const layers = (frame?.layers ?? []).filter((l) => layerDiffMap[l.id]?.length || editedLayers.has(l.id))
  const codeCoveredByDesign = (fileId, line) =>
    layers.some((l) => { const t = codeMap[l.id]; return t && t.fileId === fileId && line >= t.line && line < t.line + (t.span ?? 1) })
  const drifts = [
    ...layers
      .map((l) => ({
        id: `d:${l.id}`,
        kind: 'design',
        layerId: l.id,
        diffs: layerDiffMap[l.id] ?? [],
        label: `${l.name} · ${layerDiffMap[l.id]?.length ?? 1} change${(layerDiffMap[l.id]?.length ?? 1) === 1 ? '' : 's'}`,
      })),
    ...Object.entries(codeMergeVariants[item.id] ?? {}).flatMap(([fileId, diffs]) =>
      diffs
        .filter((d) => !codeCoveredByDesign(fileId, d.line))
        .map((d) => ({
          id: `c:${fileId}:${d.id ?? encodeURIComponent(d.incoming.trim())}`,
          incoming: d.incoming,
          kind: 'code',
          fileId,
          line: d.line,
          label: `${mergeFilesFor(item).find((f) => f.id === fileId)?.name ?? fileId} · line ${d.line}`,
        }))
    ),
  ]
  for (const [key, text] of Object.entries(manualCode)) {
    const split = key.lastIndexOf(':')
    const fileId = key.slice(0, split)
    const line = Number(key.slice(split + 1))
    if (codeCoveredByDesign(fileId, line) || drifts.some((d) => d.fileId === fileId && d.line === line)) continue
    const base = mergeFilesFor(item).find((f) => f.id === fileId)?.lines[line - 1]
    if (base === text) continue
    // Source content identifies an otherwise unlinked code change, not its line index.
    const anchor = base?.trim() || text.trim()
    drifts.push({ id: `c:${fileId}:${encodeURIComponent(anchor)}`, kind: 'code', fileId, line, incoming: text, label: `${fileId} · code change` })
  }
  return [...new Map(drifts.map((d) => [d.id, d])).values()]
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

  // Undecided options default to the Current Implementation's value.
  for (const [layerId, diffs] of Object.entries(layerDiffs)) {
    for (const diff of diffs) {
      overrides[layerId] = mergeOverride(overrides[layerId], yieldToExact(diffEffect(diff, resolutions[`${layerId}:${diff.id}`] ?? 'B'), assemblies[layerId]))
    }
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

// ---- Drift severity --------------------------------------------------
// A drift's severity comes from how many of its properties conflict: 3+ is
// High, 2 is Medium, 1 is Low; a code drift (one line) is Low. The Compare
// list uses this per row.
const SEVERITY_RANK = { low: 1, medium: 2, high: 3 }
export function driftSeverity(d) {
  if (d.kind !== 'design') return 'low'
  if (d.diffs.length >= 3) return 'high'
  if (d.diffs.length === 2) return 'medium'
  return 'low'
}

// An item's (file-level) conflict severity = the HIGHEST severity among
// all its component drifts, plus which drift sets it — so a badge on the
// item reads as its overall merge risk. If drift details are unavailable,
// keep the item's declared level. null means no known conflicts.
export function itemSeverity(item) {
  if (String(item.conflictLevel).toLowerCase() === 'none') return null
  const layers = canvasPages.find((p) => p.id === item.designPageId)?.frames[0]?.layers ?? []
  const candidates = [
    ...Object.entries(designMergeVariants[item.id]?.layerDiffs ?? {}).map(([layerId, diffs]) => ({
      level: driftSeverity({ kind: 'design', diffs }),
      source: `${layers.find((l) => l.id === layerId)?.name ?? layerId} · ${diffs.length} change${diffs.length === 1 ? '' : 's'}`,
    })),
    ...Object.entries(codeMergeVariants[item.id] ?? {}).flatMap(([fileId, lines]) =>
      lines.map((d) => ({ level: 'low', source: `${mergeFilesFor(item).find((f) => f.id === fileId)?.name ?? fileId} · line ${d.line}` }))
    ),
  ]
  if (!candidates.length) {
    const declared = String(item.conflictLevel).toLowerCase()
    return SEVERITY_RANK[declared]
      ? { level: declared.charAt(0).toUpperCase() + declared.slice(1), source: 'Item conflict level', count: 0 }
      : null
  }
  const top = candidates.reduce((a, b) => (SEVERITY_RANK[b.level] > SEVERITY_RANK[a.level] ? b : a))
  const label = top.level.charAt(0).toUpperCase() + top.level.slice(1)
  return { level: label, source: top.source, count: candidates.length }
}
