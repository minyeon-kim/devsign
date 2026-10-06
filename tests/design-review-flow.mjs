import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { isDesignReview, isQueuedConflict, reviewTabFor, conflictCounts, toConflictRecord } = await server.ssrLoadModule('/src/lib/conflicts.js')
  const { designReviewStatus, reviewForDesign } = await server.ssrLoadModule('/src/lib/designReview.js')
  const { mergeBlockReason } = await server.ssrLoadModule('/src/lib/mergePolicy.js')
  const item = { id: 'design-test', tag: 'Draft', conflictLevel: 'None' }
  const actualConflict = toConflictRecord({ id: 'cc-test', reviewStage: 'detected', severity: 'low' })
  const request = toConflictRecord({ id: 'mr-design-test', mergeItemId: item.id, reviewStage: 'detected', severity: 'low', changedBy: { type: 'person', id: 'author' }, reviewers: [{ id: 'reviewer', status: 'pending' }] })
  assert.equal(isDesignReview(request), true, 'legacy saved requests must stay discoverable without a data reset')
  assert.equal(isDesignReview({ id: 'new-review', kind: 'design-review' }), true)
  assert.equal(reviewForDesign(item, [actualConflict, request]), request)
  assert.equal(reviewForDesign({ ...item, conflictId: actualConflict.id }, [actualConflict]), actualConflict, 'real conflicts remain linked')
  assert.equal(designReviewStatus(item, null).id, 'draft')
  for (const [reviewStage, expected] of [['detected', 'draft'], ['in_review', 'in_review'], ['approved', 'approved'], ['resolved', 'merged']]) {
    const record = { ...request, reviewStage, submittedForMergeAt: 1 }
    assert.equal(reviewTabFor(record), 'design-compare')
    assert.equal(isQueuedConflict(record), false)
    assert.equal(designReviewStatus(item, record).id, expected)
    assert.equal(conflictCounts([actualConflict, record]).total, 1, `${reviewStage} must not inflate the conflict badge`)
  }
  assert.equal(reviewTabFor(actualConflict), 'conflict')
  assert.equal(isQueuedConflict(actualConflict), true)
  const rollback = { ...request, id: 'rollback-test', kind: 'design-review', rollback: true }
  assert.equal(reviewTabFor(rollback), 'conflict', 'rollback review stays with conflicts')
  const changes = { ...request, reviewStage: 'in_review', reviewers: [{ id: 'reviewer', status: 'changes_requested' }] }
  assert.equal(designReviewStatus(item, changes).id, 'changes_requested')
  assert.match(mergeBlockReason({ item, conflicts: [changes] }), /approve/)
  const approved = { ...request, reviewStage: 'approved', reviewers: [{ id: 'reviewer', status: 'approved' }] }
  assert.equal(mergeBlockReason({ item, conflicts: [approved] }), null)
  assert.equal(designReviewStatus(item, approved).id, 'approved', 'approval is not a completed merge')
  assert.equal(designReviewStatus({ ...item, tag: 'Merged' }, null).id, 'merged', 'completed design sets keep their status')
  console.log('Passed: design review routing, legacy requests, conflict counts, real-conflict links, revision status and approval/merge separation.')
} finally { await server.close() }
