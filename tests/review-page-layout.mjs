import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

// Every change's full-screen detail is laid out as a design decision's is:
// status → what differs → one 해결 방법 card (before/after, the ways as a list,
// its action at the foot) → the record as a timeline in the main column.
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const timeline = await server.ssrLoadModule('/src/components/conflicts/StepTimeline.jsx')
  assert.equal(typeof timeline.StepRow, 'function', 'one timeline row, shared by both kinds of detail')
  const flowSource = readFileSync(new URL('../src/components/conflicts/DesignDecisionFlow.jsx', import.meta.url), 'utf8')
  assert.ok(!/function StepRow\(/.test(flowSource) && /StepRow,? /.test(flowSource.match(/import \{[^}]*\} from '@\/components\/conflicts\/StepTimeline'/)[0]))

  const { flowOf, FLOW_STEPS } = await server.ssrLoadModule('/src/lib/conflictInsight.js')
  assert.equal(FLOW_STEPS.length, 5)
  // The record's states follow the review's stage: done / the one under way / still to come.
  const states = (reviewStage) => flowOf({ reviewStage }).steps.map((step) => step.state)
  assert.deepEqual(states('detected'), ['done', 'done', 'current', 'todo', 'todo'])
  assert.deepEqual(states('in_review'), ['done', 'done', 'done', 'current', 'todo'])
  assert.deepEqual(states('approved'), ['done', 'done', 'done', 'done', 'current'])
  assert.deepEqual(states('resolved'), ['done', 'done', 'done', 'done', 'done'])

  // The record has the reference's five steps (CON-002's), for every value change.
  const { reviewRecordOf, reviewFixPhaseOf, reviewStatusOf, canMerge, hasBody } = await server.ssrLoadModule('/src/lib/reviewRecord.js')
  const { allConflictRecords } = await server.ssrLoadModule('/src/lib/conflicts.js')
  const padding = allConflictRecords().find((conflict) => conflict.id === 'CON-003')
  const nameOf = (id) => ({ min: 'Alex', jane: 'Taylor', james: 'Jordan' })[id] ?? id
  const roleOf = (id) => (id === 'jane' ? 'Designer' : 'Developer')
  const TITLES = ['변경 감지', '승인 요청', '디자이너 결정', '수정 · 검증', '병합']
  const open = reviewRecordOf(padding, { nameOf, roleOf })
  assert.deepEqual(open.map((step) => step.title), TITLES)
  assert.deepEqual(open.map((step) => step.state), ['done', 'current', 'pending', 'pending', 'pending'])
  assert.equal(open[0].who, '자동 감지')
  assert.match(open[0].summary, /12px → 16px \(space\.4\)/)
  assert.ok(open[0].time && open[0].preview)
  assert.equal(reviewStatusOf(padding), '해결 방법을 골라 주세요')
  // Asked: the reviewer's to decide.
  const asked = { ...padding, reviewStage: 'in_review', requestedBy: 'min', requestedAtMs: Date.now() }
  const askedSteps = reviewRecordOf(asked, { nameOf, roleOf, choice: 'A', choiceLabel: '원격 브랜치 · 16px (space.4)' })
  assert.deepEqual(askedSteps.map((step) => step.state), ['done', 'done', 'current', 'pending', 'pending'])
  assert.deepEqual([askedSteps[1].who, askedSteps[1].summary, askedSteps[2].who], ['Alex · 제안', '원격 브랜치, 16px (space.4)', 'Taylor'])
  assert.equal(reviewStatusOf(asked, { nameOf }), 'Taylor님의 결정을 기다리고 있어요')
  assert.equal(reviewStatusOf(asked, { nameOf, viewerId: 'jane' }), '요청을 확인하고 결정해 주세요')
  // Approved: the fix is applied, then checked, by itself — and only a checked fix merges.
  const approved = { ...asked, reviewStage: 'approved', reviewers: [{ id: 'jane', status: 'approved', reviewedAt: Date.now(), note: '기준 값이에요.' }] }
  assert.deepEqual([reviewFixPhaseOf(approved), canMerge(approved), reviewStatusOf(approved)], ['applying', false, '결정대로 코드를 자동으로 수정하고 있어요'])
  const applied = { ...approved, autoFix: { appliedAtMs: Date.now(), verified: false } }
  assert.deepEqual([reviewFixPhaseOf(applied), canMerge(applied)], ['verifying', false])
  const checked = { ...approved, autoFix: { appliedAtMs: Date.now(), verified: true, verifiedAtMs: Date.now() } }
  assert.deepEqual([reviewFixPhaseOf(checked), canMerge(checked), reviewStatusOf(checked)], ['verified', true, '검증을 통과했어요 · 병합하면 자동으로 해결돼요'])
  const checkedSteps = reviewRecordOf(checked, { nameOf, roleOf, choice: 'A', choiceLabel: '원격 브랜치' })
  assert.deepEqual(checkedSteps.map((step) => step.state), ['done', 'done', 'done', 'done', 'current'])
  assert.deepEqual(checkedSteps[2].rows.map((row) => row.value), ['승인', '기준 값이에요.'], 'the decision keeps its reason')
  assert.deepEqual([checkedSteps[3].code.before.length, checkedSteps[3].code.after.length], [1, 1], 'the fix shows the code it changed')
  // Merged: all five done.
  const done = reviewRecordOf({ ...checked, reviewStage: 'resolved', mergedBy: 'min', resolvedAtLabel: 'Just now' }, { nameOf, roleOf, choice: 'A', choiceLabel: '원격 브랜치' })
  assert.ok(done.every((step) => step.state === 'done'))
  assert.deepEqual([done[4].who, done[4].summary], ['Alex', '반영 완료'])
  // Reviewers who aren't all designers: it's the reviewers' decision.
  assert.equal(reviewRecordOf({ ...padding, reviewers: [{ id: 'james', status: 'pending' }] }, { nameOf, roleOf })[2].title, '검토자 결정')
  // Every value change gets the same five steps, each saying something — and the reference isn't one of them.
  for (const conflict of allConflictRecords().filter((record) => !record.rollback && !record.decisionFlow && record.comparisonFields?.length)) {
    const steps = reviewRecordOf(conflict, { nameOf, roleOf })
    assert.deepEqual(steps.map((step) => step.key), ['detect', 'request', 'decision', 'fix', 'resolve'], conflict.id)
    assert.ok(steps.every((step) => step.title && (step.who || step.summary)), `${conflict.id}: every step says something`)
    assert.ok(hasBody(steps[0]))
  }

  const panel = readFileSync(new URL('../src/components/dockview/panels/ConflictReviewPanel.jsx', import.meta.url), 'utf8')
  // On the page: the action is the card's, the steps are the record's — neither is in the header or the side panel.
  assert.match(panel, /conflict\.decisionFlow \|\| actionInCard \? null : approvalBar/)
  assert.match(panel, /action=\{actionInCard \? approvalBar : null\}/)
  assert.match(panel, /\{!page && !conflict\.rollback && !conflict\.decisionFlow && <FlowSteps/)
  assert.match(panel, /\{page && !conflict\.rollback && <ReviewRecord/)
  assert.match(panel, /onMerge=\{alignedFlow && !canMerge\(conflict\) \? undefined : handleMerge\}/)
  assert.match(panel, /requireApproveNote=\{alignedFlow\}/)
  // The ways are a list under a before/after picture there, and the card grid everywhere else.
  assert.match(panel, /\{page \? pageChoices\(\) : \(/)
  assert.ok(panel.includes('data-before-after') && panel.includes('data-choice-list') && panel.includes('data-resolution-action'))
  await server.ssrLoadModule('/src/components/dockview/panels/ConflictReviewPanel.jsx')
  console.log('Passed: the change detail page shares the design decision’s layout — status, summary, one resolution card with its action, and the record as a timeline.')
} finally { await server.close() }
