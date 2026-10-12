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
  const { STEP_DESCRIPTION } = await server.ssrLoadModule('/src/components/conflicts/ConflictInsight.jsx')
  // Every step of the record has a line to say under its name.
  for (const step of FLOW_STEPS) assert.ok(STEP_DESCRIPTION[step.id], `${step.id} has a description`)
  // The record's states follow the review's stage: done / the one under way / still to come.
  const states = (reviewStage) => flowOf({ reviewStage }).steps.map((step) => step.state)
  assert.deepEqual(states('detected'), ['done', 'done', 'current', 'todo', 'todo'])
  assert.deepEqual(states('in_review'), ['done', 'done', 'done', 'current', 'todo'])
  assert.deepEqual(states('approved'), ['done', 'done', 'done', 'done', 'current'])
  assert.deepEqual(states('resolved'), ['done', 'done', 'done', 'done', 'done'])

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
