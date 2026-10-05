import assert from 'node:assert/strict'
import { createServer } from 'vite'

// History's branch graph (src/lib/historyBranches.js): which branch a
// checkpoint sits on, and what its row of the graph draws.
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { TRUNK, withBranches, branchNames, branchColors, branchGraph } = await server.ssrLoadModule('/src/lib/historyBranches.js')
  const { projectHistorySeeds } = await server.ssrLoadModule('/src/data/mockData.js')

  // A conflict's checkpoint sits on its conflict's source branch; a merge is
  // on the trunk and names what it brings in; an explicit branch wins.
  const conflicts = [{ id: 'c1', gitFlow: { source: 'feature/x', target: 'main' } }]
  const derived = withBranches([
    { id: 'edit', kind: 'edit' },
    { id: 'detected', kind: 'conflict', conflictId: 'c1' },
    { id: 'merged', kind: 'merge', conflictIds: ['c1'] },
    { id: 'explicit', kind: 'edit', branch: 'hotfix/y' },
    { id: 'unknown', kind: 'conflict', conflictId: 'missing' },
  ], conflicts)
  assert.deepEqual(derived.map((entry) => entry.branch), [TRUNK, 'feature/x', TRUNK, 'hotfix/y', TRUNK])
  assert.deepEqual(derived[2].mergedBranches, ['feature/x'])
  assert.deepEqual(branchNames(derived), [TRUNK, 'feature/x', 'hotfix/y'])
  const colors = branchColors(derived)
  assert.equal(new Set(colors.values()).size, 3, 'each branch has its own color')

  // Only saved versions are nodes: a conflict's detection folds into a mark
  // on the version before it (or the first one, when nothing precedes it).
  const { foldConflictCheckpoints } = await server.ssrLoadModule('/src/lib/historyBranches.js')
  const folded = foldConflictCheckpoints([
    { id: 'early', kind: 'conflict', conflictId: 'c0', label: 'Early' },
    { id: 'v1', kind: 'edit' },
    { id: 'found', kind: 'conflict', conflictId: 'c1', label: 'Found' },
    { id: 'v2', kind: 'edit' },
  ])
  assert.deepEqual(folded.map((entry) => entry.id), ['v1', 'v2'])
  assert.deepEqual(folded[0].conflictMarks.map((mark) => mark.conflictId), ['c0', 'c1'])
  assert.deepEqual(folded[1].conflictMarks, [])

  // The sample history: main forks into a feature branch and the hotfix,
  // they run side by side, the feature merges back, the hotfix carries on.
  const sample = foldConflictCheckpoints(withBranches(projectHistorySeeds['mobile-nav-revamp'], []))
  assert.ok(sample.every((entry) => entry.branch), 'every sample checkpoint names its branch')
  assert.ok(sample.every((entry) => entry.label.length <= 20), 'labels are short enough for the list')
  assert.deepEqual(sample.find((entry) => entry.id === 'history-nav-2').conflictMarks.map((mark) => mark.conflictId), ['cc-4'])
  const graph = branchGraph(sample)
  const row = (id) => graph.rows[sample.findIndex((entry) => entry.id === id)]
  assert.equal(graph.lanes, 3, 'the trunk and two branches open at once')
  assert.equal(row('history-nav-1').label, TRUNK)
  assert.deepEqual(row('history-nav-feature-1').fork, { lane: 1, name: 'feature/nav-badge' })
  assert.deepEqual(row('history-nav-hotfix-2').fork, { lane: 2, name: 'hotfix/mobile-nav-icon' })
  // Between its first and last checkpoint a branch's lane runs through
  // every row, unbroken.
  assert.deepEqual(row('history-nav-hotfix-2').lanes[1], { name: 'feature/nav-badge', dot: false, up: true, down: true })
  assert.deepEqual(row('history-nav-feature-2').lanes[2], { name: 'hotfix/mobile-nav-icon', dot: false, up: true, down: true })
  // The merge takes the feature's lane into the trunk; the hotfix passes by.
  const merge = sample.find((entry) => entry.id === 'history-nav-merge-badge')
  assert.deepEqual([merge.mergedBranches, merge.branch], [['feature/nav-badge'], TRUNK])
  assert.deepEqual(row('history-nav-merge-badge').merges, [{ lane: 1, name: 'feature/nav-badge' }])
  assert.equal(row('history-nav-merge-badge').lane, 0)
  assert.equal(row('history-nav-merge-badge').lanes[1], undefined)
  assert.equal(row('history-nav-merge-badge').lanes[2].dot, false)
  // Still in progress: the hotfix's last checkpoint ends its lane, unmerged.
  assert.deepEqual(row('history-nav-hotfix-3').lanes[2], { name: 'hotfix/mobile-nav-icon', dot: true, up: false, down: true })
  assert.deepEqual(row('history-nav-hotfix-3').merges, [])

  // A lane is reused once its branch has ended.
  const reused = branchGraph([{ id: 'a' }, { id: 'b', branch: 'one' }, { id: 'c' }, { id: 'd', branch: 'two' }])
  assert.equal(reused.lanes, 2)
  assert.deepEqual(branchGraph([]).rows, [])
  console.log('Passed: derived branches and merges, stable colors, conflicts folded into marks, forks, unbroken lanes, merge curves, open branches and lane reuse.')
} finally {
  await server.close()
}
