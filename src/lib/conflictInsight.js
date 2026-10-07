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
  'production-priority': { label: 'Production Code Priority', hint: 'The code differs from the design, and it’s already on the production branch.', tone: 'amber' },
  'design-decision': { label: 'Design Decision', hint: 'Design drafts to choose between; no code is in conflict.', tone: 'sky' },
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
  const text = `${conflict.title ?? ''} ${conflict.cause ?? ''}`
  const id = conflict.rollback ? 'restore'
    : conflict.revertOf || /^Revert: /.test(conflict.title ?? '') ? 'revert'
    : isDesignReview(conflict) ? 'design-decision'
    : /merge conflict|branches changed/i.test(text) ? 'code-conflict'
      : baselineOf(conflict)?.production ? 'production-priority'
        : 'design-drift'
  return { id, ...CONFLICT_TYPES[id] }
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

// Conflict → Compare → Select → Approve → Merge: progress follows the
// persisted review stage so it cannot disagree with the status badge.
export const FLOW_STEPS = [
  { id: 'conflict', label: 'Check the difference' },
  { id: 'compare', label: 'Compare values' },
  { id: 'select', label: 'Choose a resolution' },
  { id: 'approve', label: 'Approve' },
  { id: 'merge', label: 'Merge' },
]
const NEXT = {
  select: 'Choose a resolution to continue.',
  approve: 'The resolution is waiting for reviewer approval.',
  merge: 'All approvals are complete. Merge the change.',
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
