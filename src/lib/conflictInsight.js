import { isDesignReview } from '@/lib/conflicts'

// What a "conflict" actually is, said in the terms of the difference rather
// than the one word the list uses for all of them:
//   · its type — a real merge conflict, a design drift, a drift against
//     code that's already in production, a design decision to make, or a
//     revert of something merged;
//   · its cause — which kind of value differs (spacing, radius, type, …);
//   · its baseline — the branch the current code is on, and whether that's
//     production;
//   · where it stands in Conflict → Compare → Select → Approve → Merge.
// Every surface (the list, the review, My tasks) reads these, so a type or
// a cause is never worded twice.
//
// The type names are provisional — the final terms are decided after the
// developer interviews; only CONFLICT_TYPES' labels change then.
export const CONFLICT_TYPES = {
  'code-conflict': { label: 'Merge Conflict', hint: 'Two branches changed the same lines; the code can’t merge on its own.', tone: 'rose' },
  'design-drift': { label: 'Design Drift', hint: 'The code differs from the design standard.', tone: 'violet' },
  // (Not another kind of conflict: a design drift whose code is already on
  // the production branch — what changing it touches, said as its own tag.)
  'production-priority': { label: 'Deployed', hint: 'This value is already deployed, so changing it shows on the live screens.', tone: 'amber' },
  'design-decision': { label: 'Design Decision', hint: 'Design drafts to choose between; no code is in conflict.', tone: 'sky' },
  // The layout's structure differs (columns, order, nesting) — not a value
  // to copy over: someone decides which structure is right.
  'structural-drift': { label: 'Structural Drift', hint: 'The implemented layout is structured differently from the design; a design decision is needed.', tone: 'amber' },
  revert: { label: 'Merge cancellation', hint: 'Creates a reviewed change that restores the values from before the merge.', tone: 'slate' },
  restore: { label: 'Restore previous version', hint: 'Restores a saved checkpoint after its affected collaborators agree.', tone: 'slate' },
}

const PRODUCTION_BRANCHES = /^(main|master|production|prod)$/i

// The branch the current code sits on (where the change merges into), and
// whether it's the production branch.
export function baselineOf(conflict) {
  const branch = conflict?.gitFlow?.target ?? null
  if (!branch) return null
  return { branch, production: PRODUCTION_BRANCHES.test(branch) }
}

export function conflictTypeOf(conflict) {
  if (!conflict) return null
  const text = `${conflict.title ?? ''} ${conflict.cause ?? ''} ${conflict.message ?? ''}`
  const id = conflict.rollback ? 'restore'
    : conflict.revertOf || /^Revert: /.test(conflict.title ?? '') ? 'revert'
    : isDesignReview(conflict) ? 'design-decision'
    : conflict.kind === 'code-conflict' || /merge conflict|branches changed/i.test(text) || conflict.diff?.before?.some((line) => /^<{7}|^={7}$|^>{7}/.test(line)) ? 'code-conflict'
      : conflict.driftType === 'structural' ? 'structural-drift'
      : baselineOf(conflict)?.production ? 'production-priority'
        : 'design-drift'
  return { id, ...CONFLICT_TYPES[id] }
}

// The one tag a compact row carries, if any: the default kind — a design
// drift, which most are — says nothing, so only the exceptions are tagged.
export function exceptionTypeOf(conflict) {
  const type = conflictTypeOf(conflict)
  return type && type.id !== 'design-drift' ? type : null
}

// A compared value's kind, from what it's called.
const FIELD_KINDS = [
  ['spacing', /padding|gap|spacing|margin/i, 'Spacing mismatch'],
  ['radius', /radius|corner/i, 'Border radius mismatch'],
  ['typography', /tracking|letter|font|weight|line height|typograph/i, 'Typography mismatch'],
  ['color', /color|background|primary|divider|fill|accent/i, 'Color mismatch'],
  ['stroke', /stroke/i, 'Stroke mismatch'],
  ['size', /height|width|size|area/i, 'Size mismatch'],
]
export function fieldKindOf(field) {
  const found = FIELD_KINDS.find(([, pattern]) => pattern.test(field?.label ?? ''))
  if (found) return found[0]
  return /#[0-9a-f]{3,8}\b/i.test(`${field?.current} ${field?.expected}`) ? 'color' : 'other'
}

// What differs, value by value: the element's property, what the code has,
// what the design asks for, and the kind of difference. A value both sides
// share isn't a difference between them — it's one neither side fixes
// (`shared`: a touch area under the minimum in the code and the design).
export function differencesOf(conflict) {
  return (conflict?.comparisonFields ?? []).map((field) => {
    const kind = fieldKindOf(field)
    return { label: field.label, current: field.current, expected: field.expected, kind, shared: field.current === field.expected }
  })
}

// The cause in a few words: the kinds of difference, most telling first —
// "Size mismatch", "Size mismatch · Color mismatch", "Merge conflict".
export function mismatchesOf(conflict) {
  const type = conflictTypeOf(conflict)
  // (A merge conflict or a revert is said by its type; nothing finer.)
  if (type?.id === 'code-conflict' || type?.id === 'revert') return []
  if (type?.id === 'design-decision') return ['Drafts to choose between']
  const differences = differencesOf(conflict)
  const differing = differences.filter((entry) => !entry.shared)
  const labelOf = (kind) => FIELD_KINDS.find(([id]) => id === kind)?.[2] ?? 'Value mismatch'
  if (differing.length) return [...new Set(differing.map((entry) => labelOf(entry.kind)))]
  // Nothing differs between the two: both miss the same standard.
  return differences.length ? ['Below the standard on both sides'] : []
}

// What a row's title doesn't already say about the difference, if anything:
// that neither side meets the standard, or that it's several differences
// at once (`detail` lists them). A single mismatch named by the title
// ("Tab icon / Size" → "Size mismatch") is nothing new, so it's null.
export function differenceNoteOf(conflict) {
  const type = conflictTypeOf(conflict)
  if (!type || ['code-conflict', 'revert', 'restore', 'design-decision'].includes(type.id)) return null
  const labels = mismatchesOf(conflict)
  if (labels.includes('Below the standard on both sides')) return { text: 'Below the standard on both sides', detail: [] }
  return labels.length >= 2 ? { text: `${labels.length} differences`, detail: labels } : null
}

// Conflict → Compare → Select → Approve → Merge: progress follows the
// persisted review stage so it cannot disagree with the status badge.
export const FLOW_STEPS = [
  { id: 'conflict', label: 'Check the difference' },
  { id: 'compare', label: 'Compare values' },
  { id: 'select', label: 'Choose a resolution' },
  { id: 'approve', label: 'Approve' },
  { id: 'merge', label: 'Merge' },
]
// (One short line each: the progress card's subtitle never wraps.)
const NEXT = {
  select: 'Choose a resolution to continue.',
  approve: 'The resolution is waiting for reviewer approval.',
  merge: 'All approved — ready to merge.',
  done: 'The change has been merged.',
}
export function flowOf(conflict) {
  if (!conflict) return null
  const current = conflict.reviewStage === 'resolved' ? 'done'
    : conflict.reviewStage === 'approved' ? 'merge'
      : conflict.reviewStage === 'in_review' ? 'approve' : 'select'
  const at = current === 'done' ? FLOW_STEPS.length : FLOW_STEPS.findIndex((step) => step.id === current)
  return {
    current,
    next: NEXT[current],
    steps: FLOW_STEPS.map((step, index) => ({ ...step, state: index < at ? 'done' : index === at ? 'current' : 'todo' })),
  }
}

// Which design screen a conflict is about: its element's page, frame and the
// element itself, with the page's and frame's place in the project's canvas
// (page 2 of 4, frame 1) — counted from `pages`, the project's canvas pages
// in order, never stored. Null when it has no element, or the canvas no
// longer has it (so nothing is drawn for a conflict that isn't about a screen).
export function designLinkOf(conflict, pages = []) {
  if (!conflict?.layerId) return null
  for (const [pageIndex, page] of pages.entries()) {
    for (const [frameIndex, frame] of (page.frames ?? []).entries()) {
      const layer = frame.layers?.find((candidate) => candidate.id === conflict.layerId)
      if (layer) return { page, pageNumber: pageIndex + 1, pageCount: pages.length, frame, frameNumber: frameIndex + 1, frameCount: page.frames.length, layer }
    }
  }
  return null
}
