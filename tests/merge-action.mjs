import assert from 'node:assert/strict'
import { mergeAction } from '../src/lib/mergeAction.js'
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
assert.equal(mergeAction(item, [conflict], 'me').kind, 'check')
conflict.reviewStage = 'changes_requested'
assert.equal(mergeAction(item, [conflict], 'me').kind, 'request')
item.tag = 'Merged'
assert.equal(mergeAction(item, [conflict], 'me').kind, 'merged')
console.log('Passed: request, own approval, waiting progress, merge, blockers and completed states.')
