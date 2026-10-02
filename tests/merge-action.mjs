import assert from 'node:assert/strict'
import { createServer } from 'vite'
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { mergeAction } = await server.ssrLoadModule('/src/lib/mergeAction.js')
  const { mergeBlockReason } = await server.ssrLoadModule('/src/lib/mergePolicy.js')
  const item = { id: 'item', tag: 'Draft', conflictLevel: 'None' }
  const conflict = { id: 'c', mergeItemId: 'item', reviewStage: 'in_review', reviewers: [{ id: 'me', status: 'pending' }, { id: 'other', status: 'pending' }] }
  assert.equal(mergeAction(item, [conflict], 'me').kind, 'request')
  item.tag = 'In Review'
  assert.equal(mergeAction(item, [conflict], 'me').kind, 'approve')
  conflict.reviewers[0].status = 'approved'
  assert.equal(mergeAction(item, [conflict], 'me').kind, 'waiting')
  assert.equal(mergeAction(item, [conflict], 'me').progress, '1/2')
  assert.equal(mergeAction(item, [conflict], 'me').disabled, true)
  conflict.reviewers[1].status = 'approved'
  conflict.reviewStage = 'approved'
  assert.equal(mergeAction(item, [conflict], 'me').kind, 'merge')
  item.conflictLevel = 'High'
  assert.equal(mergeAction(item, [conflict], 'me').kind, 'merge')
  conflict.reviewStage = 'changes_requested'
  assert.equal(mergeAction(item, [conflict], 'me').kind, 'request')
  item.tag = 'Merged'
  assert.equal(mergeAction(item, [conflict], 'me').kind, 'merged')
  console.log('Passed: request, own approval, waiting progress, merge, blockers and completed states.')
  const authorExempt = {
    ...conflict, reviewStage: 'approved', changedBy: { type: 'person', id: 'other' },
    reviewers: [{ id: 'me', status: 'approved' }, { id: 'other', status: 'pending' }],
  }
  const reviewItem = { ...item, tag: 'In Review' }
  assert.equal(mergeBlockReason({ conflicts: [authorExempt] }), null)
  assert.equal(mergeAction(reviewItem, [authorExempt], 'me').kind, 'merge')
  assert.equal(mergeAction(reviewItem, [authorExempt], 'other').kind, 'merge')
  for (const status of ['pending', 'changes_requested']) {
    const unapproved = { ...authorExempt, reviewers: [{ id: 'me', status }, authorExempt.reviewers[1]] }
    assert.match(mergeBlockReason({ conflicts: [unapproved] }), /approve/)
    assert.equal(mergeAction(reviewItem, [unapproved], 'other').kind, 'waiting')
  }
  assert.match(mergeBlockReason({ conflicts: [{ ...authorExempt, reviewers: [authorExempt.reviewers[1]] }] }), /approve/)
  assert.match(mergeBlockReason({ conflicts: [{ ...authorExempt, reviewStage: 'in_review' }] }), /approve/)
  assert.match(mergeBlockReason({ conflicts: [authorExempt], lines: ['<<<<<<< ours'] }), /markers/)
  console.log('Passed: author exemption in merge guards and actions; required approvals and code markers still block.')
} finally {
  await server.close()
}
