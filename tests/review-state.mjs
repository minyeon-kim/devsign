import assert from 'node:assert/strict'
import { createServer } from 'vite'

// Vite resolves the application's existing aliases; no test dependency or browser data is needed.
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const { readDemo, writeDemo, resetDemo, DEMO_PREFIX, signature } = await server.ssrLoadModule('/src/lib/demoStorage.js')
  globalThis.localStorage = new class {
    getItem(k) { return this[k] ?? null }
    setItem(k, v) { this[k] = String(v) }
    removeItem(k) { delete this[k] }
  }()
  localStorage.setItem('unrelated', 'keep')
  writeDemo('project:a:draft', { assembly: { width: 256 }, marks: { card: 'reviewed' } })
  assert.equal(readDemo('project:a:draft', {}).assembly.width, 256)
  assert.deepEqual(readDemo('project:b:draft', {}), {})
  localStorage.setItem(DEMO_PREFIX + 'old', JSON.stringify({ version: 0, value: ['broken'] }))
  assert.deepEqual(readDemo('old', {}), {})
  resetDemo()
  assert.equal(localStorage.getItem('unrelated'), 'keep')
  assert.equal(localStorage.getItem(DEMO_PREFIX + 'project:a:draft'), null)
  assert.equal(signature({ b: 2, a: 1 }), signature({ a: 1, b: 2 }))

  const { mergeBlockReason } = await server.ssrLoadModule('/src/lib/mergePolicy.js')
  const approved = { reviewStage: 'approved', reviewers: [{ id: 'jane', status: 'approved' }] }
  assert.equal(mergeBlockReason({ conflicts: [approved], item: { conflictLevel: 'None' } }), null)
  assert.match(mergeBlockReason({ conflicts: [{ ...approved, reviewStage: 'in_review' }] }), /approve/)
  assert.match(mergeBlockReason({ conflicts: [approved], item: { conflictLevel: 'High' } }), /Resolve/)
  assert.match(mergeBlockReason({ conflicts: [approved], lines: ['<<<<<<< ours'] }), /markers/)
  assert.match(mergeBlockReason({ item: { conflictLevel: 'None', reviewers: [] } }), /approve/)

  const { finalRowsFor, componentOf, reviewSignature, reviewStatus } = await server.ssrLoadModule('/src/components/mergestudio/finalValues.js')
  const diff = { id: 'card-radius', label: 'Corner radius', optionA: '8px', optionB: '12px' }
  const row = (args = {}) => finalRowsFor({ layerId: 'card', diffs: [diff], resolutions: {}, ...args })[0]
  assert.equal(row().source.defaulted, true)
  assert.equal(row({ resolutions: { 'card:card-radius': 'B' } }).source.defaulted, undefined)
  assert.equal(row({ assembly: { radius: 12 }, sources: { radius: { kind: 'custom' } } }).source.kind, 'custom')
  assert.equal(componentOf({ radius: 12 }, { component: { kind: 'designSystem', component: 'Media Card' }, radius: { kind: 'custom' } }).name, 'Media Card')
  const drift = { id: 'd:card', kind: 'design', layerId: 'card', diffs: [diff] }
  const ctx = { resolutions: {}, assemblies: { card: { radius: 12 } }, assemblySources: { card: { radius: { kind: 'custom' } } }, codeOverrides: {}, rowsFor: () => [row()], layerCodeLines: () => [], aiEffectsFor: () => [], preset: null }
  const marks = { [drift.id]: reviewSignature(drift, ctx) }
  assert.equal(reviewStatus(drift, marks, ctx), 'reviewed')
  assert.equal(reviewStatus(drift, marks, { ...ctx, assemblies: { ...ctx.assemblies, unrelated: { width: 256 } } }), 'reviewed')
  assert.equal(reviewStatus(drift, marks, { ...ctx, assemblies: { card: { radius: 16 } } }), 'stale')
  assert.equal(reviewStatus(drift, marks, { ...ctx, layerCodeLines: () => ['changed code'] }), 'stale')
  assert.deepEqual(ctx.resolutions, {}) // Marking review never chooses a candidate.

  const { buildDrifts } = await server.ssrLoadModule('/src/components/mergestudio/mergeSummary.js')
  const { codeMergeVariants, designMergeVariants } = await server.ssrLoadModule('/src/data/mockData.js')
  const item = { id: 'test-stability', fileIds: ['app'] }
  codeMergeVariants[item.id] = { app: [{ id: 'semantic-button', line: 10, incoming: '<Button>Save</Button>' }] }
  const before = buildDrifts(item, null)
  codeMergeVariants[item.id].app[0].line = 11
  assert.equal(buildDrifts(item, null)[0].id, before[0].id)
  codeMergeVariants[item.id].app.push({ ...codeMergeVariants[item.id].app[0] })
  assert.equal(buildDrifts(item, null).length, 1)
  codeMergeVariants[item.id].app = []
  assert.equal(buildDrifts(item, null).length, 0)
  designMergeVariants[item.id] = { layerDiffs: { card: [diff, { ...diff, id: 'card-padding' }] } }
  assert.equal(buildDrifts(item, { layers: [{ id: 'card', name: 'Card' }] }).length, 1)
  console.log('Passed: versioned persistence/reset, merge guards, provenance, review invalidation, stable IDs and item counts.')
} finally {
  await server.close()
}
