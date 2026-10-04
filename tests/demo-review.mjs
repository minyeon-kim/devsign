import assert from 'node:assert/strict'
import { createServer } from 'vite'
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { scheduleDemoReview, applyDueDemoReviews } = await server.ssrLoadModule('/src/lib/demoReview.js')
  const conflict = { id: 'test', reviewStage: 'in_review', changedBy: { type: 'person', id: 'author' }, reviewers: ['me', 'author', 'a', 'b'].map(id => ({ id, status: 'pending' })) }
  const scheduled = scheduleDemoReview(conflict, 'me', null, 1000)
  assert.deepEqual(scheduled.reviewers.map(r => r.demoApproveAt), [undefined, undefined, 5000, 7000])
  assert.equal(applyDueDemoReviews(scheduled, 'me', 4999), scheduled)
  const first = applyDueDemoReviews(scheduled, 'me', 5000)
  assert.deepEqual(first.reviewers.map(r => r.status), ['pending', 'pending', 'approved', 'pending'])
  const later = applyDueDemoReviews(first, 'me', 7000)
  assert.equal(later.reviewStage, 'in_review', 'participant must approve personally')
  const signed = { ...later, reviewers: later.reviewers.map(r => r.id === 'me' ? { ...r, status: 'approved' } : r) }
  const lastPending = { ...signed, reviewers: signed.reviewers.map(r => r.id === 'b' ? { ...r, status: 'pending', demoApproveAt: 7000 } : r) }
  assert.equal(applyDueDemoReviews(lastPending, 'me', 7000).reviewStage, 'approved')
  const reminder = scheduleDemoReview(conflict, 'me', ['b'], 2000)
  assert.deepEqual(reminder.reviewers.map(r => r.demoApproveAt), [undefined, undefined, undefined, 6000])
  const changed = { ...scheduled, reviewers: scheduled.reviewers.map(r => ({ ...r, demoApproveAt: undefined })) }
  assert.equal(applyDueDemoReviews(changed, 'me', 99999), changed, 'invalidated requests cannot approve edited content')
  const changesRequested = { ...scheduled, reviewers: scheduled.reviewers.map(r => r.id === 'a' ? { ...r, status: 'changes_requested' } : r) }
  assert.equal(applyDueDemoReviews(changesRequested, 'me', 99999).reviewers[2].status, 'changes_requested')
  assert.equal(applyDueDemoReviews({ ...scheduled, reviewStage: 'resolved' }, 'me', 99999).reviewStage, 'resolved')
  console.log('Passed: delayed and staggered UT approvals, targeted reminders, participant/author exclusion and stale-request guards.')
} finally { await server.close() }
