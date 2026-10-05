import assert from 'node:assert/strict'
import { createServer } from 'vite'
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { checksFor } = await server.ssrLoadModule('/src/components/mergestudio/mergeChecks.js')
  const { canvasPages, mergeListItems } = await server.ssrLoadModule('/src/data/mockData.js')
  const { compositionChecks, draftScreens } = await server.ssrLoadModule('/src/data/draftScreens.js')
  canvasPages.push({ id: 'checks-test', frames: [{ id: 'checks-frame', width: 390, height: 800, layers: [{ id: 'tiny-button', type: 'button', name: 'Pay', x: 0, y: 0, width: 16, height: 16 }] }] })
  const item = { id: 'checks-test-item', hasDesign: true, designPageId: 'checks-test', fileIds: ['test-file'] }
  const tokenItem = mergeListItems.find((candidate) => candidate.conflictId === 'cc-1')
  const { designMergeVariants } = await server.ssrLoadModule('/src/data/mockData.js')
  const tokenDecisions = Object.fromEntries(Object.entries(designMergeVariants[tokenItem.id].layerDiffs).flatMap(([layerId, diffs]) => diffs.map((diff) => [`${layerId}:${diff.id}`, 'A'])))
  assert.ok(!checksFor(tokenItem, { resolutions: tokenDecisions }).blocking.some((check) => check.id === 'tokens'), 'named CSS tokens in the design must pass')
  const shippingItem = mergeListItems.find((candidate) => candidate.conflictId === 'cc-10')
  const shippingCheck = checksFor(shippingItem).blocking.find((check) => check.id === 'tokens')
  const stroke = shippingCheck.details.find((detail) => detail.property === 'Icon stroke')
  assert.equal(stroke.current, '2.5')
  assert.equal(stroke.expected, '2')
  assert.equal(stroke.canApply, true)
  assert.ok(!checksFor(shippingItem, { resolutions: { [stroke.key]: 'A' } }).blocking.some((check) => check.id === 'tokens'), 'applying the 2px icon reference must clear the token failure')
  assert.ok(checksFor(shippingItem, { resolutions: { [stroke.key]: { custom: '4' } } }).blocking.some((check) => check.id === 'tokens'), 'a spacing-grid value is not a valid icon stroke')
  const labelItem = mergeListItems.find((candidate) => candidate.conflictId === 'cc-9')
  const tracking = checksFor(labelItem).blocking.find((check) => check.id === 'tokens').details[0]
  assert.equal(tracking.expected.toLowerCase(), 'normal')
  assert.ok(!checksFor(labelItem, { resolutions: { [tracking.key]: 'A' } }).blocking.some((check) => check.id === 'tokens'), 'normal letter spacing must pass')
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
