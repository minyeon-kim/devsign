import { isDesignReview } from '@/lib/conflicts'

// What a "conflict" actually is, said in the terms of the difference rather
// than the one word the list uses for all of them:
//   · its type — a real code conflict, a design drift, a drift against code
//     that's already in production, or a design decision to make;
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
  'code-conflict': { label: 'Code Conflict', hint: 'Two branches changed the same lines; the code can’t merge on its own.', tone: 'rose' },
  'design-drift': { label: 'Design Drift', hint: 'The code differs from the design standard.', tone: 'violet' },
  'production-priority': { label: 'Production Code Priority', hint: 'The code differs from the design, and it’s already on the production branch.', tone: 'amber' },
  'design-decision': { label: 'Design Decision', hint: 'Design drafts to choose between; no code is in conflict.', tone: 'sky' },
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
  const id = isDesignReview(conflict) ? 'design-decision'
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
  if (type?.id === 'code-conflict') return ['Merge conflict']
  if (type?.id === 'design-decision') return ['Drafts to choose between']
  const differences = differencesOf(conflict)
  const differing = differences.filter((entry) => !entry.shared)
  const labelOf = (kind) => FIELD_KINDS.find(([id]) => id === kind)?.[2] ?? 'Value mismatch'
  if (differing.length) return [...new Set(differing.map((entry) => labelOf(entry.kind)))]
  // Nothing differs between the two: both miss the same standard.
  return differences.length ? ['Below the standard on both sides'] : []
}

// Conflict → Compare → Select → Approve → Merge: the steps, which one a
// conflict is on, and what to do there. A step before it is done; `chosen`
// says whether a way to resolve it has been picked (the review knows — a
// saved record carries it once decided).
export const FLOW_STEPS = [
  { id: 'conflict', label: 'Conflict' },
  { id: 'compare', label: 'Compare' },
  { id: 'select', label: 'Select' },
  { id: 'approve', label: 'Approve' },
  { id: 'merge', label: 'Merge' },
]
const NEXT = {
  compare: 'Compare the two values and choose how to resolve it.',
  select: 'A way is chosen. Send it for review to move on.',
  approve: 'Waiting for the reviewers’ approval.',
  merge: 'Every approval is in. Merge it to finish.',
  done: 'Merged. Nothing is left to do.',
}
export function flowOf(conflict, { chosen } = {}) {
  if (!conflict) return null
  const picked = chosen ?? Boolean(conflict.decidedSide || conflict.customChosen)
  const current = conflict.reviewStage === 'resolved' ? 'done'
    : conflict.reviewStage === 'approved' ? 'merge'
      : conflict.reviewStage === 'in_review' ? 'approve'
        : picked ? 'select' : 'compare'
  const at = current === 'done' ? FLOW_STEPS.length : FLOW_STEPS.findIndex((step) => step.id === current)
  return {
    current,
    next: NEXT[current],
    steps: FLOW_STEPS.map((step, index) => ({ ...step, state: index < at ? 'done' : index === at ? 'current' : 'todo' })),
  }
}
