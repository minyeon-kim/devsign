import { gitFlowOf } from '@/lib/conflicts'

// History as a branch graph (Git-graph style).
//
// Checkpoints don't record a branch of their own, so it's read from what
// they're about: a Conflict Point's checkpoint sits on that conflict's
// source branch (its gitFlow — "feature/divider-color"), everything else
// on the trunk; a merge checkpoint is on the trunk and brings its
// conflicts' branches back into it. An explicit `entry.branch` wins.

export const TRUNK = 'main'

// A small, calm set: the trunk in neutral grey, the rest cycling through
// four — enough to tell neighbouring branches apart without a rainbow.
const TRUNK_COLOR = '#a1a1aa'
const BRANCH_COLORS = ['#7dd3fc', '#c4b5fd', '#fcd34d', '#fda4af']

const conflictIdsOf = (entry) => [entry.conflictId, ...(entry.conflictIds ?? [])].filter(Boolean)

// Every entry with its `branch` (and, for a merge, `mergedBranches`).
export function withBranches(entries, conflicts) {
  const sourceOf = (id) => {
    const conflict = conflicts.find((c) => c.id === id)
    return conflict ? gitFlowOf(conflict)?.source ?? null : null
  }
  return entries.map((entry) => {
    if (entry.branch) return entry
    const sources = [...new Set(conflictIdsOf(entry).map(sourceOf).filter(Boolean))]
    if (entry.kind === 'merge') return { ...entry, branch: TRUNK, mergedBranches: sources }
    return { ...entry, branch: entry.kind === 'conflict' && sources[0] ? sources[0] : TRUNK }
  })
}

// The branches in a (branched) history, oldest first, the trunk leading.
export function branchNames(entries) {
  return [...new Set([TRUNK, ...entries.map((entry) => entry.branch ?? TRUNK)])]
}

// name → color, stable for a history: by order of first appearance.
export function branchColors(entries) {
  const colors = new Map([[TRUNK, TRUNK_COLOR]])
  for (const name of branchNames(entries)) {
    if (!colors.has(name)) colors.set(name, BRANCH_COLORS[(colors.size - 1) % BRANCH_COLORS.length])
  }
  return colors
}

// The graph for a list of checkpoints (oldest → newest): which lane each
// branch runs in and, per checkpoint, what's drawn in its row.
//   · a branch occupies a lane from its first checkpoint to its last — or
//     to the merge that brings it back to the trunk; lanes are reused once
//     free, so the graph stays as narrow as what's open at the same time;
//   · `row.lanes[n]` says what lane n does in that row: 'through', or the
//     checkpoint's own dot with a line `up` (to newer) and/or `down`;
//   · `row.fork` (a branch starts here: it curves out of the trunk below)
//     and `row.merges` (lanes curving into this trunk checkpoint).
export function branchGraph(entries) {
  const spans = new Map()
  entries.forEach((entry, index) => {
    const name = entry.branch ?? TRUNK
    const span = spans.get(name) ?? { name, first: index, last: index, end: index }
    span.last = index
    span.end = index
    spans.set(name, span)
  })
  // A branch stays open until the merge that takes it.
  entries.forEach((entry, index) => {
    for (const name of entry.mergedBranches ?? []) {
      const span = spans.get(name)
      if (span && index > span.last) span.end = Math.max(span.end, index)
    }
  })
  const trunk = spans.get(TRUNK) ?? { name: TRUNK, first: 0, last: entries.length - 1, end: entries.length - 1 }
  // The trunk runs under everything that forks from or merges into it.
  trunk.first = 0
  trunk.end = Math.max(trunk.end, ...[...spans.values()].map((span) => (span.name === TRUNK ? 0 : span.first)))
  trunk.lane = 0
  const branches = [...spans.values()].filter((span) => span.name !== TRUNK).sort((a, b) => a.first - b.first)
  const taken = []
  for (const span of branches) {
    let lane = 1
    while (taken.some((other) => other.lane === lane && other.first <= span.end && span.first <= other.end)) lane++
    span.lane = lane
    taken.push(span)
  }
  const all = [trunk, ...branches]
  const lanes = Math.max(...all.map((span) => span.lane)) + 1

  const rows = entries.map((entry, index) => {
    const name = entry.branch ?? TRUNK
    const own = name === TRUNK ? trunk : spans.get(name)
    const row = { lane: own.lane, lanes: [], fork: null, merges: [], label: null }
    for (const span of all) {
      if (index < span.first || index > span.end) continue
      if (span === own) row.lanes[span.lane] = { name: span.name, dot: true, up: index < span.end, down: index > span.first }
      // A branch being merged here ends in the curve, not a line through.
      else if (span.end === index && (entry.mergedBranches ?? []).includes(span.name)) row.merges.push({ lane: span.lane, name: span.name })
      else row.lanes[span.lane] = { name: span.name, dot: false, up: index < span.end, down: index > span.first }
    }
    // A branch's first checkpoint: it curves out of the trunk, and is named.
    if (index === own.first) {
      row.label = name
      if (own !== trunk && index > 0) row.fork = { lane: own.lane, name }
    }
    return row
  })
  return { lanes, rows }
}
