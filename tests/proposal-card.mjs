// The 해결 방법 card (DesignDecisionFlow → ProposalSection) is one card for every
// change: [현재 구현] → [선택한 결과], the ways, the request, the button. For a
// value change the result is the real element drawn with the way's value.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'silent' })
try {
  const { drawingOf, codeOverridesOf } = await server.ssrLoadModule('/src/lib/elementPreview.js')
  const { adapterOf, scaleOf } = await server.ssrLoadModule('/src/lib/changeAdapters.js')
  const { allConflictRecords } = await server.ssrLoadModule('/src/lib/conflicts.js')
  const { proposalOf, proposalsOf } = await server.ssrLoadModule('/src/lib/designDecisions.js')
  const byId = (id) => allConflictRecords().find((conflict) => conflict.id === id)
  const layerOf = (conflict) => conflict.layerId ?? conflict.layerIds?.[0]
  // (A frame is only looked up by layer; one that holds the change's layer does.)
  const frameOf = (conflict) => ({ layers: [{ id: layerOf(conflict), x: 0, y: 0, width: 100, height: 40, padding: 10 }] })

  // Selection: each way of a font-weight change draws its own value.
  const weight = byId('CON-006')
  const frame = frameOf(weight)
  const drawn = (conflict, id, custom) => drawingOf(conflict, frameOf(conflict), proposalOf(id, custom, conflict))
  assert.deepEqual(drawn(weight, 'original').overrides, {}, 'the original way is the design as it is')
  assert.deepEqual(drawn(weight, 'current').overrides, codeOverridesOf(weight, frame), 'keeping the current value draws what the code has')
  assert.ok(JSON.stringify(drawn(weight, 'current').overrides).includes('600'), 'the current value (600) is on the element')

  // Value input: a picked or typed value re-draws; junk draws nothing.
  const other = (value) => drawn(weight, 'other', { values: { value } })
  assert.ok(JSON.stringify(other('800').overrides).includes('800'), 'a picked weight is applied at once')
  assert.notDeepEqual(other('800').overrides, other('500').overrides, 'another value, another drawing')
  assert.equal(other('bold-ish'), null, 'a value that reads as nothing is not drawn')
  assert.equal(adapterOf(weight).values(weight, '700').fontWeight, 700)

  // Every kind has values to pick from, and parses them.
  for (const id of ['CON-003', 'CON-005', 'CON-006']) {
    const conflict = byId(id)
    assert.ok(proposalsOf(conflict).some((way) => way.id === 'original'), `${id}: the recommended way exists (picked to start)`)
    const options = scaleOf(conflict).steps.map((step) => step.value)
    assert.ok(options.length >= 3, `${id}: values to pick from`)
    for (const option of options) assert.ok(adapterOf(conflict).values(conflict, option), `${id}: "${option}" can be drawn`)
    assert.ok(drawn(conflict, 'other', { values: { value: options.at(-1) } }), `${id}: its last option draws`)
  }
} finally {
  await server.close()
}

// The card itself: one component, no second comparison or summary above it.
const flow = readFileSync(new URL('../src/components/conflicts/DesignDecisionFlow.jsx', import.meta.url), 'utf8')
assert.ok(!flow.includes('DetectedSummary'), 'the yellow summary card is gone')
assert.ok(!flow.includes('디자인 결정 필요'), 'its chips are gone')
assert.equal(flow.match(/<ProposalSection\b/g).length, 1, 'one 해결 방법 card for every change')
assert.ok(flow.includes('<ElementCrop conflict={conflict} link={link} overrides={drawing.overrides}'), 'a value change is drawn as its real element')
assert.ok(!flow.includes('data-show-design') && !flow.includes('data-proposal-fullscreen') && !flow.includes('ElementPreviewDialog'), 'no 원안 보기 toggle, no separate full-screen viewer')
assert.ok(flow.includes('function ZoomPicture(') && flow.includes('<CompareBoard'), 'a picture, pressed, opens larger — on the comparison board beside the detail (tests/compare-board)')
assert.ok(flow.includes('data-fold-section="request"') && flow.includes('data-fold-section="proposal"') && flow.includes('data-fold-section="decision"'), '승인 요청, 해결 방법, 내 결정 fold')
assert.ok(!flow.includes('님에게 전달됐어요 · 승인 기록이 남았어요') && flow.includes("'승인 기록 저장됨'"), 'what came of a decision is said once, in the status block')
assert.ok(flow.includes("way.id === 'original') ? 'original' : null"), 'the recommended way is picked to start')
assert.ok(!flow.includes('data-status-compare'), 'no separate 원안 / 현재 구현 card')
assert.ok(flow.includes("step.key === 'detect' && <DetectionFacts") && flow.includes('자동 감지 · {conflict.detectedBy}'), 'what detected it is in the record\'s 변경 감지 step')
const preview = readFileSync(new URL('../src/components/conflicts/ElementPreview.jsx', import.meta.url), 'utf8')
assert.ok(!preview.includes('data-compare-value'), 'no value badge over the element')
console.log('proposal-card: ok')
