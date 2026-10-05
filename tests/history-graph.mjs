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

  // The sample history: main forks into the hotfix and a feature branch,
  // they run side by side, the feature merges back, the hotfix carries on.
  const sample = withBranches(projectHistorySeeds['mobile-nav-revamp'], [])
  const graph = branchGraph(sample)
  const row = (id) => graph.rows[sample.findIndex((entry) => entry.id === id)]
  assert.equal(graph.lanes, 3, 'the trunk and two branches open at once')
  assert.equal(row('history-nav-1').label, TRUNK)
  assert.deepEqual(row('history-conflict-cc-4').fork, { lane: 1, name: 'hotfix/mobile-nav-icon' })
  assert.equal(row('history-conflict-cc-4').label, 'hotfix/mobile-nav-icon')
  assert.deepEqual(row('history-nav-feature-1').fork, { lane: 2, name: 'feature/nav-badge' })
  // Between its first and last checkpoint a branch's lane runs through
  // every row, unbroken.
  assert.deepEqual(row('history-nav-feature-1').lanes[1], { name: 'hotfix/mobile-nav-icon', dot: false, up: true, down: true })
  assert.deepEqual(row('history-nav-hotfix-2').lanes[2], { name: 'feature/nav-badge', dot: false, up: true, down: true })
  // The merge takes the feature's lane into the trunk; the hotfix passes by.
  assert.deepEqual(row('history-nav-merge-badge').merges, [{ lane: 2, name: 'feature/nav-badge' }])
  assert.equal(row('history-nav-merge-badge').lane, 0)
  assert.equal(row('history-nav-merge-badge').lanes[2], undefined)
  assert.equal(row('history-nav-merge-badge').lanes[1].dot, false)
  // Still in progress: the hotfix's last checkpoint ends its lane, unmerged.
  assert.deepEqual(row('history-nav-hotfix-3').lanes[1], { name: 'hotfix/mobile-nav-icon', dot: true, up: false, down: true })
  assert.deepEqual(row('history-nav-hotfix-3').merges, [])

  // A lane is reused once its branch has ended.
  const reused = branchGraph([{ id: 'a' }, { id: 'b', branch: 'one' }, { id: 'c' }, { id: 'd', branch: 'two' }])
  assert.equal(reused.lanes, 2)
  assert.deepEqual(branchGraph([]).rows, [])
  console.log('Passed: derived branches and merges, stable colors, forks, unbroken lanes, merge curves, open branches and lane reuse.')
} finally {
  await server.close()
}
