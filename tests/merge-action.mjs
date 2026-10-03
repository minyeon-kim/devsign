import assert from 'node:assert/strict'
import { createServer } from 'vite'
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { mergeBlockReason } = await server.ssrLoadModule('/src/lib/mergePolicy.js')
  const item = { id: 'item', tag: 'Draft', conflictLevel: 'None' }
  const conflict = { id: 'c', mergeItemId: 'item', reviewStage: 'in_review', reviewers: [{ id: 'me', status: 'pending' }, { id: 'other', status: 'pending' }] }
  assert.match(mergeBlockReason({ item, conflicts: [conflict] }), /approve/)
  conflict.reviewers[0].status = 'approved'
  assert.match(mergeBlockReason({ item, conflicts: [conflict] }), /approve/)
  conflict.reviewers[1].status = 'approved'
  conflict.reviewStage = 'approved'
  assert.equal(mergeBlockReason({ item, conflicts: [conflict] }), null)
  assert.equal(mergeBlockReason({ item: { ...item, conflictLevel: 'High' }, conflicts: [conflict] }), null)
  assert.match(mergeBlockReason({ item: { ...item, tag: 'Merged' }, conflicts: [conflict] }), /already merged/)
  console.log('Passed: pending approvals, full approval, risk independent of approval and duplicate merge prevention.')
  const authorExempt = {
    ...conflict, reviewStage: 'approved', changedBy: { type: 'person', id: 'other' },
    reviewers: [{ id: 'me', status: 'approved' }, { id: 'other', status: 'pending' }],
  }
  assert.equal(mergeBlockReason({ conflicts: [authorExempt] }), null)
  for (const status of ['pending', 'changes_requested']) {
    const unapproved = { ...authorExempt, reviewers: [{ id: 'me', status }, authorExempt.reviewers[1]] }
    assert.match(mergeBlockReason({ conflicts: [unapproved] }), /approve/)
  }
  assert.match(mergeBlockReason({ conflicts: [{ ...authorExempt, reviewers: [authorExempt.reviewers[1]] }] }), /approve/)
  assert.match(mergeBlockReason({ conflicts: [{ ...authorExempt, reviewStage: 'in_review' }] }), /approve/)
  assert.match(mergeBlockReason({ conflicts: [authorExempt], lines: ['<<<<<<< ours'] }), /markers/)
  console.log('Passed: author exemption in merge guards and actions; required approvals and code markers still block.')
} finally {
  await server.close()
}
