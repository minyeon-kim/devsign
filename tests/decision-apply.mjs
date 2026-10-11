import assert from 'node:assert/strict'
import { createServer } from 'vite'

// Approve → apply. Approving is what starts a change going in: the fix and
// its check run at once, unless the approver put it off — then nothing runs,
// and there's a time to show. A request carries no time of its own.
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
try {
  const { fixPhaseOf, isDeferred, scheduleOf, scheduleWordOf } = await server.ssrLoadModule('/src/lib/designDecisions.js')
  const { conflictChecklist } = await server.ssrLoadModule('/src/data/mockData.js')
  const seed = conflictChecklist.find((conflict) => conflict.id === 'CON-002')
  const release = { name: 'v2.4', date: '10/24' }
  const asked = { ...seed, reviewStage: 'approved', decisionRequest: { by: 'min', proposal: 'narrow-cards', reason: '겹쳐요', devStage: 'mid' } }
  assert.equal(seed.scriptedRequest.timing, undefined, 'the sample request asks for no time')

  // Approved to go in at once (the default): the fix starts, then its check, then it can be merged.
  const now = { ...asked, designDecision: { choice: 'approve', by: 'jane', timing: 'now', reason: '좋아요' } }
  assert.equal(isDeferred(now.designDecision), false)
  assert.equal(scheduleOf(now, release), null, '"now" is never said')
  assert.equal(fixPhaseOf(now), 'applying', 'approving starts the fix')
  assert.equal(fixPhaseOf({ ...now, decisionFix: { verified: false } }), 'verifying')
  assert.equal(fixPhaseOf({ ...now, decisionFix: { verified: true } }), 'verified', 'checked: ready to merge')
  assert.equal(fixPhaseOf({ ...now, decisionFix: { verified: true }, reviewStage: 'resolved' }), 'resolved')
  // Keeping the design goes the same way.
  assert.equal(fixPhaseOf({ ...asked, designDecision: { choice: 'keep', by: 'jane', timing: 'now' } }), 'applying')

  // Put off by the approver: approved, nothing runs, and when it goes in is said.
  const beforeRelease = { ...asked, designDecision: { choice: 'approve', by: 'jane', timing: 'before-release', reason: '출시 때 같이' } }
  assert.equal(isDeferred(beforeRelease.designDecision), true)
  assert.equal(fixPhaseOf(beforeRelease), 'deferred', 'no fix starts')
  assert.equal(scheduleOf(beforeRelease, release), 'v2.4 출시 전 반영 예정')
  assert.equal(scheduleOf(beforeRelease, null), '출시 전 반영 예정', 'a project without a release still says when')
  assert.equal(scheduleOf({ ...asked, designDecision: { choice: 'approve', timing: 'next-version' } }, release), '다음 버전 반영 예정')
  assert.deepEqual([scheduleWordOf('now', release), scheduleWordOf(null, release), scheduleWordOf('before-release', release)], [null, null, 'v2.4 출시 전'])

  // Older records: a decision with no time, or a request that wished for one, go in at once and show nothing.
  const legacy = { ...asked, decisionRequest: { ...asked.decisionRequest, timing: 'before-release' }, designDecision: { choice: 'approve', by: 'jane' } }
  assert.equal(fixPhaseOf(legacy), 'applying', 'a request’s old wish puts nothing off')
  assert.equal(scheduleOf(legacy, release), null)
  // A rework isn't an approval: nothing to schedule.
  assert.equal(isDeferred({ choice: 'rework', timing: 'before-release' }), false)
  // A high-risk change still waits for a go-ahead before it's fixed — unless it was put off.
  assert.equal(fixPhaseOf({ ...now, severity: 'high' }), 'approval')
  assert.equal(fixPhaseOf({ ...beforeRelease, severity: 'high' }), 'deferred')
  console.log('Passed: approving starts the fix and its check; putting it off holds it and says when; old records show nothing.')
} finally {
  await server.close()
}
