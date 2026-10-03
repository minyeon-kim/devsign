import assert from 'node:assert/strict'
import { createServer } from 'vite'
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { checksFor } = await server.ssrLoadModule('/src/components/mergestudio/mergeChecks.js')
  const { canvasPages } = await server.ssrLoadModule('/src/data/mockData.js')
  const { compositionChecks, draftScreens } = await server.ssrLoadModule('/src/data/draftScreens.js')
  canvasPages.push({ id: 'checks-test', frames: [{ id: 'checks-frame', width: 390, height: 800, layers: [{ id: 'tiny-button', type: 'button', name: 'Pay', x: 0, y: 0, width: 16, height: 16 }] }] })
  const item = { id: 'checks-test-item', hasDesign: true, designPageId: 'checks-test', fileIds: ['test-file'] }
  const failing = checksFor(item)
  assert.equal(failing.blocking.find((check) => check.id === 'targets').layerId, 'tiny-button')
  const fixed = checksFor(item, { assemblies: { 'tiny-button': { width: 44, height: 44 } } })
  assert.ok(!fixed.blocking.some((check) => check.id === 'targets'), 'resizing the actual target clears its check')
  assert.equal(checksFor(item, {}, () => ['<<<<<<< ours']).blocking.find((check) => check.id === 'markers').fileId, 'test-file')
  assert.ok(!checksFor(item, {}, () => ['resolved']).blocking.some((check) => check.id === 'markers'))
  for (const [id, screen] of Object.entries(draftScreens)) {
    const draftKey = Object.keys(screen.drafts)[0]
    const picks = Object.fromEntries(screen.regions.map((region) => [region.id, draftKey]))
    const checks = compositionChecks(id, picks, draftKey)
    assert.ok(checks.find((check) => check.id === 'picked').ok)
    for (const check of checks) for (const region of check.regionIds ?? []) assert.ok(screen.regions.some((candidate) => candidate.id === region))
  }
  const { requiredReviewers, allReviewersApproved } = await server.ssrLoadModule('/src/lib/conflicts.js')
  const authorOnly = { changedBy: { type: 'person', id: 'author' }, reviewers: [{ id: 'author', status: 'approved' }] }
  assert.equal(requiredReviewers(authorOnly).length, 0)
  assert.equal(allReviewersApproved(authorOnly), false)
  console.log('Passed: failed-check targets, geometry corrections, code marker corrections, region links and author-only approval guard.')
} finally { await server.close() }
