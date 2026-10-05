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
  // A detection that names a file marks the version that touched that file
  // — the latest one before it — and none when no version here did.
  const byFile = foldConflictCheckpoints([
    { id: 'nav', kind: 'edit', target: 'Nav.jsx · line 2' },
    { id: 'btn', kind: 'edit', target: 'src/ui/Button.jsx' },
    { id: 'nav-conflict', kind: 'conflict', conflictId: 'n', target: 'src/components/Nav.jsx' },
    { id: 'other-conflict', kind: 'conflict', conflictId: 'o', target: 'src/components/Card.jsx' },
  ])
  assert.deepEqual(byFile.map((entry) => entry.conflictMarks.map((mark) => mark.conflictId)), [['n'], []])

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
  // every row, unbroken — here the feature's, past the hotfix's first.
  assert.deepEqual(row('history-nav-hotfix-2').lanes[1], { name: 'feature/nav-badge', dot: false, up: true, down: true })
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

  // For playback: every checkpoint keeps its whole file and the values its
  // preview is drawn from, the code is written from those values, and each
  // step (in time order, whatever the branch) changes something visible.
  const visible = (entry) => JSON.stringify([entry.snapshot.previewProps.iconSize, entry.snapshot.previewProps.hitArea, entry.snapshot.previewProps.badgeCount, entry.snapshot.previewProps.badgeCap])
  for (const [index, entry] of sample.entries()) {
    const { lines, previewProps } = entry.snapshot
    assert.ok(lines.length >= 5 && lines[0].startsWith('export function BottomNav'), `${entry.id} keeps the whole file`)
    assert.ok(lines.some((line) => line.includes(`size-${previewProps.iconSize / 4}`) && line.includes(`hitArea="${previewProps.hitArea}px"`)), `${entry.id}: code matches its preview values`)
    assert.equal(lines.some((line) => line.includes('badge=')), previewProps.badgeCount > 0)
    if (index) assert.notEqual(visible(entry), visible(sample[index - 1]), `${entry.id} changes the preview`)
  }
  assert.deepEqual(sample.map((entry) => entry.snapshot.previewProps.iconSize), [16, 20, 20, 20, 24, 20, 24])
  assert.deepEqual(sample.map((entry) => entry.snapshot.previewProps.badgeCount), [0, 0, 3, 128, 0, 128, 0])

  // A lane is reused once its branch has ended.
  const reused = branchGraph([{ id: 'a' }, { id: 'b', branch: 'one' }, { id: 'c' }, { id: 'd', branch: 'two' }])
  assert.equal(reused.lanes, 2)
  assert.deepEqual(branchGraph([]).rows, [])
  console.log('Passed: derived branches and merges, stable colors, conflicts folded into marks, forks, unbroken lanes, merge curves, open branches, lane reuse and playback snapshots that match their preview values.')
} finally {
  await server.close()
}
