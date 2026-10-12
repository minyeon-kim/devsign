// Every 변경 확인 that is a design decision shows the one 해결 방법 card
// (DesignDecisionFlow's ProposalSection) — whatever kind of change it is,
// wherever it stands, whoever looks — and nothing of the older comparisons.
// What differs by kind is its adapter alone (lib/changeAdapters).
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'silent' })
try {
  const { CHANGE_TYPES, ADAPTERS, adapterOf, typeOf, scaleOf } = await server.ssrLoadModule('/src/lib/changeAdapters.js')
  const { drawingOf } = await server.ssrLoadModule('/src/lib/elementPreview.js')
  const { allConflictRecords } = await server.ssrLoadModule('/src/lib/conflicts.js')
  const { proposalOf, decisionStageOf } = await server.ssrLoadModule('/src/lib/designDecisions.js')
  const { default: DesignDecisionFlow } = await server.ssrLoadModule('/src/components/conflicts/DesignDecisionFlow.jsx')

  // ── The mapping: every kind has an adapter, whole; none is left over. ──
  const KEYS = ['picture', 'label', 'unit', 'tokens', 'key', 'values']
  assert.deepEqual(Object.keys(ADAPTERS).sort(), [...CHANGE_TYPES].sort(), 'a kind without an adapter (or an adapter without a kind)')
  for (const type of CHANGE_TYPES) for (const key of KEYS) assert.ok(ADAPTERS[type][key] != null, `${type}: adapter has no ${key}`)
  for (const type of CHANGE_TYPES) assert.ok('custom' in ADAPTERS[type], `${type}: adapter doesn't say how a value off the scale is typed`)
  assert.throws(() => adapterOf({ id: 'X', changeType: 'made-up' }), /No change adapter for "made-up"/, 'an unknown kind is an error, not a blank card')

  // ── Every seeded design decision: a known kind, drawn, and re-drawn by a value. ──
  const decisions = allConflictRecords().filter((conflict) => conflict.decisionFlow)
  assert.ok(decisions.length >= 7, 'the seeded changes are there')
  const kinds = new Set()
  for (const conflict of decisions) {
    const type = typeOf(conflict)
    kinds.add(type)
    assert.ok(CHANGE_TYPES.includes(type), `${conflict.id}: "${type}" is not a kind of change`)
    const adapter = adapterOf(conflict)
    if (adapter.picture === 'screen' && type === 'layout') { assert.ok(conflict.layouts.original && conflict.layouts.implementation, `${conflict.id}: screens to compare`); continue }
    // Both sides are drawn — and not as the same picture.
    const sides = ['original', 'current'].map((id) => drawingOf(conflict, null, proposalOf(id, null, conflict)))
    assert.ok(sides[0] && sides[1], `${conflict.id}: its design and its build can be drawn`)
    // What there is to pick is drawn, whenever the kind reads values at all.
    for (const step of scaleOf(conflict).steps) {
      if (adapter.values(conflict, step.value)) assert.ok(drawingOf(conflict, null, proposalOf('other', { values: { value: step.value } }, conflict)), `${conflict.id}: "${step.value}" is drawn`)
    }
  }
  // The Dashboard's changes say their kind, and each draws its two sides differently.
  const byId = (id) => decisions.find((conflict) => conflict.id === id)
  const TYPES = { 'CON-002': 'layout', 'CON-003': 'spacing', 'CON-005': 'color', 'CON-006': 'weight', 'CON-008': 'spacing', 'CON-009': 'breakpoint', 'CON-011': 'size' }
  for (const [id, type] of Object.entries(TYPES)) {
    const conflict = byId(id)
    assert.equal(typeOf(conflict), type, id)
    if (type === 'layout') continue
    assert.notDeepEqual(conflict.preview.before, conflict.preview.after, `${id}: the build and the design are drawn from different values`)
    const adapter = adapterOf(conflict)
    const scale = scaleOf(conflict)
    assert.ok(scale.steps.length >= 3, `${id}: a scale to pick from`)
    assert.ok(scale.steps.some((step) => step.key === scale.designKey) && scale.steps.some((step) => step.key === scale.currentKey), `${id}: the design's and the code's values are on its scale`)
    for (const step of scale.steps) assert.ok(adapter.values(conflict, step.value), `${id}: "${step.value}" changes the picture`)
  }
  assert.equal(scaleOf(byId('CON-005')).steps.find((step) => step.token === 'color.cta').swatch, '#2563EB', 'a colour comes with its chip')
  assert.equal(scaleOf(byId('CON-002')), null, 'a structure has no scale: it is laid out as a screen')
  assert.equal(ADAPTERS.breakpoint.values(byId('CON-009'), '900px').collapseAt, 900)
  assert.equal(ADAPTERS.size.values(byId('CON-011'), '108px').px, 108)

  // ── Every seeded decision × who looks × where it stands: the one card. ──
  const workspace = new Proxy({}, { get: () => () => {} })
  const people = { developer: { id: 'min', name: 'Alex', jobRole: 'Developer' }, designer: { id: 'jane', name: 'Taylor', jobRole: 'Designer' } }
  const render = (conflict, viewer) => renderToString(createElement(MemoryRouter, null, createElement(DesignDecisionFlow, { conflict, workspace, viewer })))
  const count = (html, marker) => html.split(marker).length - 1
  const OLD = ['data-decision-compare', 'data-status-compare', 'data-element-compare', 'data-fix-compare', 'data-decision-detected', 'data-compare-value']
  const seen = new Set()
  for (const conflict of decisions) {
    for (const [role, viewer] of Object.entries(people)) {
      const html = render(conflict, viewer)
      const where = `${conflict.id} (${decisionStageOf(conflict)}, ${role})`
      assert.equal(count(html, 'data-proposal-section'), 1, `${where}: one 해결 방법 card`)
      assert.equal(count(html, 'data-before-after='), 1, `${where}: one comparison, in the card`)
      for (const marker of OLD) assert.equal(count(html, marker), 0, `${where}: ${marker} is drawn`)
      const mode = /data-proposal-card="(\w+)"/.exec(html)[1]
      seen.add(`${decisionStageOf(conflict)}:${role}:${mode}`)
      // Only a way being picked has radios and a button; anything else is read-only.
      assert.equal(html.includes('role="radio"') && html.includes('data-proposal-action'), mode === 'pick', `${where}: ${mode}`)
      assert.ok(html.includes('data-show-design') && html.includes('data-proposal-fullscreen'), `${where}: 원안 보기 · 전체 화면으로 보기`)
    }
  }
  // (The seeds cover a way being picked, one waiting, and one that went in — seen by both.)
  for (const state of ['detected:developer:pick', 'detected:designer:view', 'requested:developer:pending', 'requested:designer:pending', 'resolved:developer:done', 'resolved:designer:done']) assert.ok(seen.has(state), `no seeded change is ${state}`)
  assert.ok(['layout', 'spacing', 'color', 'weight', 'breakpoint', 'size'].every((type) => kinds.has(type)), 'every kind is seeded')
} finally {
  await server.close()
}

// ── The older pieces are gone from the source. ──
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const flow = read('src/components/conflicts/DesignDecisionFlow.jsx')
const preview = read('src/components/conflicts/ElementPreview.jsx')
const lib = read('src/lib/elementPreview.js')
for (const name of ['LayoutComparison', 'ElementCompare', 'DetectedSummary', 'data-fix-compare', '<ChangePreview']) assert.ok(!flow.includes(name), `DesignDecisionFlow still has ${name}`)
for (const name of ['ElementCompare', 'CompareCell']) assert.ok(!preview.includes(name), `ElementPreview still has ${name}`)
for (const name of ['compareSidesOf', 'valueOptionsOf', 'previewValuesFor']) assert.ok(!lib.includes(name), `lib/elementPreview still has ${name}`)
assert.equal(flow.match(/<ProposalSection\b/g).length, 1, 'the card is rendered from one place')
assert.ok(existsSync(new URL('../src/lib/changeAdapters.js', import.meta.url)))
console.log('change-adapters: ok')
