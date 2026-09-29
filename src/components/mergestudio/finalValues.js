import { signature } from '@/lib/demoStorage'
import { ASSEMBLY_FILLS, SHAPES, isCustomResolution } from '@/components/mergestudio/mergeEffects'

// Final (to-be-merged) values for the Preview step, derived only from the
// studio's single source of truth — the candidate choices (`resolutions`),
// Assemble edits (`assemblies`) with where each of their fields came from
// (`assemblySources`), code edits (`codeOverrides`), applied AI edits and the
// AI style preset — never a display-only copy.
//
// Precedence mirrors how PreviewStep layers the same inputs to render the
// Merged result (drift choice → AI edits → Assemble → code edits → preset),
// so a Final value always matches what the Merged result shows.
//
// Sources are tracked from the action that set a value, never inferred by
// comparing values: a hand-typed value that happens to equal Current stays
// `custom`.
//   { kind: 'original' | 'current' | 'custom' | 'designSystem', detail?, defaulted? }

export const SOURCE_LABELS = {
  original: 'Original',
  current: 'Current',
  custom: 'Custom',
  designSystem: 'Design system',
}

// Which merge-relevant property a drift describes.
export function propKindOf(diff) {
  if (diff.optionAClass || diff.optionBClass) return 'color'
  if (/radius/.test(diff.id)) return 'radius'
  if (/padding/.test(diff.id)) return 'padding'
  if (/spacing/.test(diff.id)) return 'spacing'
  if (/weight/.test(diff.id)) return 'weight'
  if (/size/.test(diff.id)) return 'size'
  return 'other'
}

function fillLabel(className) {
  return ASSEMBLY_FILLS.find((f) => f.className === className)?.label ?? className
}

// Source for an Assemble field, from what was recorded when it was written.
function assembleSource(sources, ...keys) {
  for (const k of keys) if (sources?.[k]) return sources[k]
  // Written before tracking existed / without a recorded action: it's still
  // an Assemble edit the user made.
  return { kind: 'custom', detail: 'Assemble' }
}

// The value + source the chosen candidate (or a Compare inline edit) gives.
function fromResolution(diff, side) {
  if (isCustomResolution(side)) return { value: side.custom, source: { kind: 'custom', detail: 'Edited in Compare' } }
  if (side === 'A') return { value: diff.optionA, source: { kind: 'original' } }
  if (side === 'B') return { value: diff.optionB, source: { kind: 'current' } }
  // Undecided: the merge uses the Current Implementation's value.
  return { value: diff.optionB, source: { kind: 'current', defaulted: true } }
}

// One row per drift property: Original | Current | Final (+ source).
export function finalRowsFor({ layerId, diffs, resolutions, assembly, sources, aiEffects = [], codeOverride, preset, layer }) {
  return diffs.map((diff) => {
    const kind = propKindOf(diff)
    let final = fromResolution(diff, resolutions[`${layerId}:${diff.id}`])

    // Applied AI edits targeting this element.
    for (const e of aiEffects) {
      if (kind === 'color' && e.className) final = { value: fillLabel(e.className), source: { kind: 'custom', detail: 'AI edit' } }
      if (kind === 'radius' && e.radius !== undefined) final = { value: `${e.radius}px`, source: { kind: 'custom', detail: 'AI edit' } }
      if (kind === 'weight' && e.fontWeight !== undefined) final = { value: String(e.fontWeight), source: { kind: 'custom', detail: 'AI edit' } }
    }

    // Assemble edits (exact values replace the drift's value).
    if (assembly) {
      if (kind === 'radius') {
        if (assembly.radius !== undefined) final = { value: `${assembly.radius}px`, source: assembleSource(sources, 'radius') }
        else if (assembly.shape) {
          const shape = SHAPES.find((s) => s.id === assembly.shape)
          if (shape) final = { value: `${shape.radius}px (${shape.label})`, source: assembleSource(sources, 'shape') }
        }
      }
      if (kind === 'size' && /height/i.test(diff.label) && assembly.height !== undefined) final = { value: `${assembly.height}px`, source: assembleSource(sources, 'height') }
      if (kind === 'size' && /width/i.test(diff.label) && assembly.width !== undefined) final = { value: `${assembly.width}px`, source: assembleSource(sources, 'width') }
      if (kind === 'color') {
        if (assembly.fillColor) final = { value: assembly.fillColor, source: assembleSource(sources, 'fillColor') }
        else if (assembly.fill) {
          const fill = ASSEMBLY_FILLS.find((f) => f.id === assembly.fill)
          if (fill) final = { value: fill.label, source: assembleSource(sources, 'fill') }
        }
      }
      if ((kind === 'padding' || kind === 'spacing') && (assembly.padX !== undefined || assembly.padY !== undefined)) {
        final = { value: `${assembly.padY ?? '–'}px ${assembly.padX ?? '–'}px`, source: assembleSource(sources, 'padY', 'padX') }
      }
    }

    // Code edits (e.g. a changed token line) apply after Assemble.
    if (codeOverride) {
      if (kind === 'size' && /height/i.test(diff.label) && layer && codeOverride.dh) final = { value: `${layer.height + codeOverride.dh}px`, source: { kind: 'custom', detail: 'Edited in code' } }
      if (kind === 'radius' && codeOverride.radius !== undefined) final = { value: `${codeOverride.radius}px`, source: { kind: 'custom', detail: 'Edited in code' } }
      if (kind === 'color' && codeOverride.fillStyle?.background) final = { value: codeOverride.fillStyle.background, source: { kind: 'custom', detail: 'Edited in code' } }
      else if (kind === 'color' && codeOverride.className) final = { value: fillLabel(codeOverride.className), source: { kind: 'custom', detail: 'Edited in code' } }
    }

    // The AI style preset repaints the element last.
    if (preset?.layerId === layerId && kind === 'color') {
      final = { value: preset.label, source: { kind: 'custom', detail: 'AI style preset' } }
    }

    return { id: diff.id, label: diff.label, original: diff.optionA, current: diff.optionB, final: final.value, source: final.source }
  })
}

// A Design System component behind this element, when there is one:
// replaced outright (a different component type), or restyled with a
// library component's look. Only names actually recorded are shown.
export function componentOf(assembly, sources) {
  if (!assembly) return null
  const fromLibrary = sources?.component
  if (assembly.asName) return { replaced: true, name: assembly.asName, tokens: fromLibrary?.tokens ?? [] }
  if (fromLibrary) return { replaced: false, name: fromLibrary.component, tokens: fromLibrary.tokens ?? [] }
  return null
}

// What the reviewer signed off on for one review item: everything that
// determines its merged result. Reviewing records this; the item only
// stays "Reviewed" while it's unchanged, so any later change to the
// element's final values, component, Assemble edits, code edits or AI
// edits (including shared token changes that reach it) reopens it —
// while panning, zooming or switching tabs, which change none of this,
// never do.
export function reviewSignature(drift, ctx) {
  if (drift.kind === 'design') {
    const layerId = drift.layerId
    return signature({
      final: ctx.rowsFor(drift),
      asm: ctx.assemblies[layerId] ?? null,
      src: ctx.assemblySources[layerId] ?? null,
      code: ctx.codeOverrides[layerId] ?? null,
      // Hand-edited lines inside the element's own code block (text-only
      // edits change its merged code even without a visual effect).
      lines: ctx.layerCodeLines(layerId),
      ai: ctx.aiEffectsFor(layerId),
      preset: ctx.preset?.layerId === layerId ? ctx.preset : null,
    })
  }
  return signature({
    final: ctx.codeValueFor(drift),
    ai: ctx.aiLineFor(drift.fileId, drift.line),
  })
}

// Review status per item: reviewed only while its recorded signature still
// matches; `stale` marks an item reviewed earlier whose result has since
// changed ("Changed since review").
export function reviewStatus(drift, marks, ctx) {
  const mark = marks[drift.id]
  if (mark === undefined) return 'unreviewed'
  return mark === reviewSignature(drift, ctx) ? 'reviewed' : 'stale'
}
