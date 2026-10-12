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

  // The record says who, what and when for each step from the change's own data, and what a step opens to.
  const { reviewRecordOf, hasBody } = await server.ssrLoadModule('/src/lib/reviewRecord.js')
  const { allConflictRecords } = await server.ssrLoadModule('/src/lib/conflicts.js')
  const padding = allConflictRecords().find((conflict) => conflict.id === 'CON-003')
  const nameOf = (id) => ({ min: 'Alex', jane: 'Taylor' })[id] ?? id
  const open = reviewRecordOf(padding, { nameOf })
  assert.deepEqual(open.map((step) => [step.title, step.state]), [['차이 확인', 'done'], ['값 비교', 'done'], ['해결 방법 선택', 'current'], ['승인', 'pending'], ['병합', 'pending']])
  assert.equal(open[0].who, '자동 감지')
  assert.match(open[0].summary, /12px → 16px \(space\.4\)/)
  assert.ok(open[0].time && open[0].preview)
  assert.deepEqual(open[0].rows.map((row) => row.label), ['감지', '관련 파일', '영향 범위', '원인'])
  assert.equal(open[1].who, 'Alex')
  assert.deepEqual(open.map(hasBody), [true, true, false, false, false], 'a step still to come has nothing to open')
  // A way picked: said on its step, with the code it changes; asked for: who asked, and who's to approve.
  const picked = reviewRecordOf(padding, { nameOf, choice: 'A', choiceLabel: '원격 브랜치 · 16px (space.4)' })
  assert.equal(picked[2].summary, '원격 브랜치 · 16px (space.4) · 요청 전')
  assert.deepEqual([picked[2].code.before.length, picked[2].code.after.length], [1, 1])
  const asked = reviewRecordOf({ ...padding, reviewStage: 'in_review', requestedBy: 'min' }, { nameOf, choice: 'A', choiceLabel: '원격 브랜치 · 16px (space.4)' })
  assert.deepEqual([asked[2].who, asked[2].summary, asked[3].who, asked[3].summary], ['Alex', '원격 브랜치 · 16px (space.4)', 'Taylor', '0/1 승인'])
  const done = reviewRecordOf({ ...padding, reviewStage: 'resolved', requestedBy: 'min', mergedBy: 'min', resolvedAtLabel: 'Just now', reviewers: [{ id: 'jane', status: 'approved' }] }, { nameOf, choice: 'A', choiceLabel: '원격 브랜치' })
  assert.deepEqual([done[3].summary, done[4].who, done[4].summary], ['모두 승인', 'Alex', '반영 완료'])
  assert.ok(done.every((step) => step.state === 'done') && done.every(hasBody))
  // Every sample change has a record with something on every line.
  for (const conflict of allConflictRecords().filter((record) => !record.rollback && !record.decisionFlow)) {
    const steps = reviewRecordOf(conflict, { nameOf })
    assert.equal(steps.length, 5, conflict.id)
    assert.ok(steps.every((step) => step.title && (step.who || step.summary)), `${conflict.id}: every step says something`)
  }

  const panel = readFileSync(new URL('../src/components/dockview/panels/ConflictReviewPanel.jsx', import.meta.url), 'utf8')
  // On the page: the action is the card's, the steps are the record's — neither is in the header or the side panel.
  assert.match(panel, /conflict\.decisionFlow \|\| actionInCard \? null : approvalBar/)
  assert.match(panel, /action=\{actionInCard \? approvalBar : null\}/)
  assert.match(panel, /\{!page && !conflict\.rollback && !conflict\.decisionFlow && <FlowSteps/)
  assert.match(panel, /\{page && !conflict\.rollback && <ReviewRecord/)
  // The ways are a list under a before/after picture there, and the card grid everywhere else.
  assert.match(panel, /\{page \? pageChoices\(\) : \(/)
  assert.ok(panel.includes('data-before-after') && panel.includes('data-choice-list') && panel.includes('data-resolution-action'))
  await server.ssrLoadModule('/src/components/dockview/panels/ConflictReviewPanel.jsx')
  console.log('Passed: the change detail page shares the design decision’s layout — status, summary, one resolution card with its action, and the record as a timeline.')
} finally { await server.close() }
