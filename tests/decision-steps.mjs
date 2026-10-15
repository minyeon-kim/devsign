// The detail of a value change, one step at a time: the values said once (ValueTable), the request step
// for whoever proposes, the decision for the reviewer alone — anyone else sees whose turn it is — and a
// finished step folded to a line. One set of words for the ways and the decisions.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'

const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'silent' })
try {
  const { allConflictRecords } = await server.ssrLoadModule('/src/lib/conflicts.js')
  const { DECISION_LABEL, PROPOSAL_LABEL, decisionStageOf } = await server.ssrLoadModule('/src/lib/designDecisions.js')
  const { splitValue, swatchOf } = await server.ssrLoadModule('/src/components/conflicts/ValueTable.jsx')
  const { default: DesignDecisionFlow } = await server.ssrLoadModule('/src/components/conflicts/DesignDecisionFlow.jsx')
  const byId = (id) => allConflictRecords().find((c) => c.id === id)

  // One set of words.
  assert.deepEqual(DECISION_LABEL, { keep: '원안으로 수정', approve: '승인', rework: '재검토 요청' })
  assert.equal(PROPOSAL_LABEL.original, '원안으로 맞추기')
  // A cell: the value over its note; a colour with its swatch.
  assert.deepEqual(splitValue('44px (button.height.lg)'), { value: '44px', note: 'button.height.lg' })
  assert.deepEqual(splitValue('#7c3aed (fixed hex)'), { value: '#7c3aed', note: 'fixed hex' })
  assert.equal(swatchOf('Background', 'color.primary (Indigo 500)', '#6366f1'), '#6366f1')
  assert.equal(swatchOf('Height', '44px (button.height.lg)'), null)

  const workspace = new Proxy({}, { get: () => () => {} })
  const taylor = { id: 'jane', name: 'Taylor', jobRole: 'Designer' }
  const jordan = { id: 'james', name: 'Jordan', jobRole: 'Developer' }
  const render = (conflict, viewer) => renderToString(createElement(MemoryRouter, null, createElement(DesignDecisionFlow, { conflict, workspace, viewer })))
  const count = (html, re) => (html.match(re) ?? []).length

  // Asked (CON-014): the reviewer sees the request in one block and decides; no ways to pick, one reason box.
  const asked = byId('CON-014')
  assert.equal(decisionStageOf(asked), 'requested')
  const reviewer = render(asked, taylor)
  assert.ok(reviewer.includes('data-value-table') && reviewer.includes('data-request-summary') && reviewer.includes('data-decision-segments'))
  assert.ok(!reviewer.includes('data-choice="proposal:') && !reviewer.includes('어떻게 할까요?') && !reviewer.includes('data-proposal-action'))
  assert.ok(count(reviewer, /<textarea/g) <= 1, 'one reason box at most')
  assert.equal(count(reviewer, />40px</g), 1, 'a value is written once — in the table')
  // Anyone else: whose turn it is, in a line — no decision to make.
  const requester = render(asked, jordan)
  assert.ok(requester.includes('data-waiting-on="jane"') && requester.replace(/<!-- -->/g, '').includes('Taylor님의 결정을 기다리는 중') && !requester.includes('data-decision-form'))

  // Not asked yet (CON-013): the ways by name, no decision UI, no sub-title, the values in the table.
  const open = render(byId('CON-013'), taylor)
  assert.ok(open.includes('data-choice="proposal:original"') && !open.includes('data-decision-form') && !open.includes('어떤 값으로 맞출지'))
  assert.ok(!open.includes('data-proposal-about'), 'no summary line over the table')

  const flow = read('components/conflicts/DesignDecisionFlow.jsx')
  assert.ok(flow.includes("const DECISION_ORDER = ['rework', 'keep', 'approve']") && flow.includes("title={missing ?? `${requester}님에게 전달 · 승인 이력에 저장`}"))
  assert.ok(flow.includes("const needsReason = choice && choice !== 'approve'"), 'a reason for anything but 승인')
  assert.ok(flow.includes("[proposalOf(request.proposal, request.custom, conflict)?.name, nameOf(request.by), agoOf("), 'the request folded to a line')
  console.log('Passed: one step at a time — the values once, the request for who proposes, the decision for the reviewer.')
} finally { await server.close() }
