import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { PRIMARY_CONTROLS, PROPOSALS, controlsOf, currentValuesOf, proposalOf, seedValuesFor } = await server.ssrLoadModule('/src/lib/designDecisions.js')
  const { conflictChecklist } = await server.ssrLoadModule('/src/data/mockData.js')
  const conflict = conflictChecklist.find((entry) => entry.driftProps)
  assert.ok(conflict, 'a sample conflict lists its controls')

  // Two controls show at once; the rest are behind 세부 조정.
  assert.deepEqual(PRIMARY_CONTROLS, ['columns', 'cardWidth'])
  const controls = controlsOf(conflict)
  assert.deepEqual(controls.filter((control) => !PRIMARY_CONTROLS.includes(control.id)).map((control) => control.id), ['gap', 'range'])

  // What the code has now: every control has a value, so no field starts empty.
  const current = currentValuesOf(conflict)
  assert.deepEqual(current, { columns: 2, cardWidth: { mode: 'fixed', px: 360 }, gap: 24, range: '~768px' })
  for (const control of controls) assert.notEqual(current[control.id] ?? '', '', `${control.id} has a current value`)

  // 다른 수정안 starts from the preset picked just before, laid over the current values.
  assert.deepEqual(seedValuesFor(conflict, 'one-column'), { columns: 1, cardWidth: { mode: 'fit' }, gap: 24, range: '~768px' })
  assert.deepEqual(seedValuesFor(conflict, 'narrow-cards').cardWidth, { mode: 'fixed', px: 320 })
  // With nothing picked before (or 다른 수정안 itself), it starts from the code as it is — 360px fixed.
  assert.deepEqual(seedValuesFor(conflict, null), current)
  assert.deepEqual(seedValuesFor(conflict, 'other'), current)
  // A conflict without its own list still gets a filled start.
  assert.deepEqual(seedValuesFor({}, null), { columns: 2, cardWidth: { mode: 'fixed', px: 360 } })

  // A preset is fixed: its values are its own, whatever 다른 수정안 holds.
  const custom = { values: { columns: 3, cardWidth: { mode: 'fit' } }, note: '' }
  for (const preset of PROPOSALS.filter((proposal) => proposal.id !== 'other')) assert.deepEqual(proposalOf(preset.id, custom).values, preset.values)
  assert.equal(proposalOf('other', custom).columns, 3)
  // The radio row's label already says the values in a line.
  assert.equal(proposalOf('other', { values: seedValuesFor(conflict, 'one-column') }).spec, '768px 이하 · 카드 1열 · 화면 맞춤 · 간격 24px')
  await server.ssrLoadModule('/src/components/conflicts/DesignDecisionFlow.jsx')
  console.log('Passed: fixed presets, two primary controls, filled starting values, and seeding from the last preset.')
} finally { await server.close() }
