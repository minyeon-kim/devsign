// 다른 값 is picked with one tool — a scale (conflicts/ValueScale) whose steps
// are the change's adapter's (lib/changeAdapters.scaleOf) — and written about
// in one place, the reason. What's picked for one change is never another's.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'silent' })
try {
  const { scaleOf, wayOfStep, customValueOf } = await server.ssrLoadModule('/src/lib/changeAdapters.js')
  const { SPACE_TOKENS } = await server.ssrLoadModule('/src/lib/designTokens.js')
  const { allConflictRecords } = await server.ssrLoadModule('/src/lib/conflicts.js')
  const { proposalOf, ownCustomOf } = await server.ssrLoadModule('/src/lib/designDecisions.js')
  const { drawingOf, insetOf, compareRegionOf, ownLayerIdsOf } = await server.ssrLoadModule('/src/lib/elementPreview.js')
  const { default: ValueScale } = await server.ssrLoadModule('/src/components/conflicts/ValueScale.jsx')
  const byId = (id) => allConflictRecords().find((conflict) => conflict.id === id)
  const padding = byId('CON-003')

  // ── The scale: the spacing tokens, smallest first, the code's and the design's marked. ──
  const scale = scaleOf(padding)
  assert.deepEqual(scale.steps.map((step) => `${step.label} ${step.token}`), SPACE_TOKENS.map(({ token, px }) => `${px} ${token}`), 'the token list, in order')
  assert.deepEqual([scale.unit, scale.currentKey, scale.designKey, scale.custom], ['px', '12', '16', 'px'])
  // Every kind gives the same shape — a palette, a weight scale, a size scale.
  const SHAPES = { 'CON-005': ['color', ''], 'CON-006': ['weight', ''], 'CON-011': ['size', 'px'], 'CON-008': ['spacing', 'px'], 'CON-009': ['breakpoint', 'px'] }
  for (const [id, [, unit]] of Object.entries(SHAPES)) {
    const own = scaleOf(byId(id))
    assert.equal(own.unit, unit, id)
    assert.ok(own.steps.length >= 3 && own.steps.every((step) => step.key && step.value && step.label), `${id}: steps with a value each`)
    assert.equal(new Set(own.steps.map((step) => step.key)).size, own.steps.length, `${id}: no value twice`)
    assert.ok(own.steps.some((step) => step.key === own.designKey) && own.steps.some((step) => step.key === own.currentKey), `${id}: 원안 and 현재 are on it`)
  }
  assert.deepEqual(scaleOf(byId('CON-006')).steps.map((step) => step.label), ['400', '500', '600', '700', '800', '900'])
  assert.ok(scaleOf(byId('CON-005')).steps.every((step) => step.swatch), 'a palette: every step with its colour')
  assert.equal(scaleOf(byId('CON-006')).custom, null, 'a weight is only ever one of the scale')

  // ── Picking a step: the design's → 원안대로 맞추기, the code's → 현재 값 유지, any other → 다른 값. ──
  const at = (key) => scale.steps.find((step) => step.key === key)
  assert.deepEqual(['16', '12', '20', '4'].map((key) => wayOfStep(scale, at(key))), ['original', 'current', 'other', 'other'])
  // The value picked is the way's own line, and re-draws the picture.
  const picked = proposalOf('other', { values: { value: at('20').value } }, padding)
  assert.equal(picked.spec, '20px (space.5)')
  assert.equal(drawingOf(padding, null, picked).values.gap, '20px')
  assert.equal(proposalOf('other', { values: {} }, padding).described, false, 'nothing picked yet: 직접 고르기')

  // ── Typed: kept as a px value; said when it's no token (and still taken). ──
  assert.deepEqual(customValueOf(padding, '18'), { value: '18px', key: '18', onScale: false })
  assert.equal(customValueOf(padding, '20').onScale, true)
  assert.equal(customValueOf(padding, 'abc'), null)
  assert.equal(customValueOf(byId('CON-005'), '1d4ed8').value, '#1d4ed8')

  // ── Each change's 다른 값 is its own: a layout's values are never a padding's. ──
  const layoutValues = { values: { range: '~768px', columns: 2, cardWidth: { mode: 'fixed', px: 320 }, gap: 24 }, note: '' }
  assert.deepEqual(ownCustomOf(padding, layoutValues).values, {}, 'another change\'s properties are dropped')
  const mixed = proposalOf('other', layoutValues, padding)
  assert.ok(!/768|열|320|간격/.test(mixed.spec) && mixed.described === false, `a padding never says a grid's values (${mixed.spec})`)
  assert.equal(proposalOf('other', { values: { ...layoutValues.values, value: '20px (space.5)' } }, padding).spec, '20px (space.5)')
  assert.equal(Object.keys(ownCustomOf(byId('CON-002'), layoutValues).values).length, 4, 'a layout keeps its own')

  // ── The scale component: one radiogroup, marks over 현재 / 원안, the field only once asked for. ──
  const html = (props) => renderToString(createElement(ValueScale, { scale, selectedKey: null, onTry() {}, onPick() {}, onCustom() {}, ...props }))
  const closed = html({})
  assert.equal(closed.split('role="radio"').length - 1, 6)
  assert.ok(closed.includes('data-scale-mark="current"') && closed.includes('data-scale-mark="design"'))
  assert.ok(closed.includes('data-scale-custom-open') && !closed.includes('data-scale-custom-input'), '직접 입력 is a text button until pressed')
  assert.match(html({ selectedKey: '20' }), /aria-checked="true"[^>]*data-scale-step="20"/)
  const typing = html({ selectedKey: '18', customText: '18', customNote: '디자인 토큰에 없는 값이에요' })
  assert.ok(typing.includes('data-scale-custom-input') && typing.includes('디자인 토큰에 없는 값이에요'), 'a value off the scale opens the field, with the note')

  // ── The crop: the element in the middle with 24px around it, alone, its inset as a dimension. ──
  const { designLinkOf } = await server.ssrLoadModule('/src/lib/conflictInsight.js')
  const { canvasPages } = await server.ssrLoadModule('/src/data/mockData.js')
  const frame = designLinkOf(padding, canvasPages.filter((page) => page.projectId === padding.projectId)).frame
  const card = frame.layers.find((layer) => layer.id === padding.layerId)
  assert.deepEqual(compareRegionOf(frame, card.id), { x: card.x - 24, y: card.y - 24, width: card.width + 48, height: card.height + 48 })
  const others = padding.layerIds.filter((id) => id !== card.id)
  assert.ok(others.length > 0 && others.every((id) => !ownLayerIdsOf(frame, card.id).includes(id)), 'the cards beside it are not drawn')
  assert.equal(insetOf(padding, frame, { gap: '12px' }).label, '12px')
  assert.ok(insetOf(padding, frame, { gap: '20px' }).band > insetOf(padding, frame, { gap: '12px' }).band, 'a wider inset is a wider band')
} finally {
  await server.close()
}

const flow = readFileSync(new URL('../src/components/conflicts/DesignDecisionFlow.jsx', import.meta.url), 'utf8')
const panel = readFileSync(new URL('../src/components/dockview/panels/ConflictReviewPanel.jsx', import.meta.url), 'utf8')
assert.ok(panel.includes('<DesignDecisionFlow key={conflict.id}'), 'the flow is the change\'s own: nothing picked carries to the next')
assert.ok(flow.includes('ownCustomOf(conflict, request?.custom ?? conflict.decisionDraft?.custom)'), 'a kept draft is read as this change\'s alone')
assert.ok(!flow.includes('data-control-measure') && !flow.includes("control.kind === 'text'"), 'no chips, field and "= 20px" for a value')
assert.equal(flow.match(/<ValueScale\b/g).length, 1, 'one scale, for every kind')
assert.ok(flow.includes('(scale ? (') && flow.includes(') : <ProposalControls'), 'a layout keeps its screen controls; a value never gets them')
assert.ok(flow.includes('이 값을 고른 이유를 적어 주세요. 값만으로 설명하기 어려운 내용도 여기에.'))
console.log('value-scale: ok')
