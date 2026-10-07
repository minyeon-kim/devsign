import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { baselineOf, conflictTypeOf, differencesOf, fieldKindOf, flowOf, mismatchesOf, CONFLICT_TYPES } = await server.ssrLoadModule('/src/lib/conflictInsight.js')
  const { allConflictRecords } = await server.ssrLoadModule('/src/lib/conflicts.js')
  const byId = Object.fromEntries(allConflictRecords().map((conflict) => [conflict.id, conflict]))

  // Type: a real merge conflict, a drift, a drift against production code, a design request.
  assert.equal(conflictTypeOf(byId['cc-2']).id, 'code-conflict')
  assert.equal(conflictTypeOf(byId['cc-tab-icon-size']).id, 'design-drift')
  assert.equal(conflictTypeOf(byId['cc-11']).id, 'production-priority', 'a drift whose code is on main')
  assert.equal(conflictTypeOf({ id: 'mr-1', kind: 'design-review' }).id, 'design-decision')
  for (const conflict of Object.values(byId)) assert.ok(CONFLICT_TYPES[conflictTypeOf(conflict).id], `${conflict.id} has a type`)

  // Baseline: the branch the current code is on, and whether it's production.
  assert.deepEqual(baselineOf(byId['cc-11']), { branch: 'main', production: true })
  assert.deepEqual(baselineOf(byId['cc-tab-icon-size']), { branch: 'develop', production: false })
  assert.equal(baselineOf({}), null)

  // Cause: the kind of value that differs, not "meets the standard or not".
  assert.equal(fieldKindOf({ label: 'Padding X' }), 'spacing')
  assert.equal(fieldKindOf({ label: 'Radius' }), 'radius')
  assert.equal(fieldKindOf({ label: 'Tracking' }), 'typography')
  assert.equal(fieldKindOf({ label: 'Primary', current: '#5B5BD6', expected: '#5E6AD2' }), 'color')
  assert.equal(fieldKindOf({ label: 'Icon size' }), 'size')
  assert.deepEqual(mismatchesOf(byId['cc-tab-icon-size']), ['Size mismatch'])
  assert.deepEqual(mismatchesOf(byId['cc-3']), ['Border radius mismatch'])
  assert.deepEqual(mismatchesOf(byId['cc-6']), ['Spacing mismatch'])
  assert.deepEqual(mismatchesOf(byId['cc-9']), ['Typography mismatch'])
  assert.deepEqual(mismatchesOf(byId['cc-11']), ['Size mismatch', 'Color mismatch'])
  assert.deepEqual(mismatchesOf(byId['cc-2']), ['Merge conflict'])
  assert.deepEqual(mismatchesOf(byId['cc-touch-adjusted']), ['Below the standard on both sides'], 'the same value on both sides isn’t a mismatch between them')
  assert.deepEqual(differencesOf(byId['cc-tab-icon-size']), [{ label: 'Icon size', current: '20px', expected: '24px', kind: 'size', shared: false }])

  // Flow: Conflict → Compare → Select → Approve → Merge.
  const base = { id: 'c', reviewStage: 'detected' }
  const at = (conflict, options) => flowOf(conflict, options).current
  assert.equal(at(base), 'compare')
  assert.equal(at(base, { chosen: true }), 'select')
  assert.equal(at({ ...base, decidedSide: 'A' }), 'select')
  assert.equal(at({ ...base, reviewStage: 'in_review' }), 'approve')
  assert.equal(at({ ...base, reviewStage: 'approved' }), 'merge')
  assert.equal(at({ ...base, reviewStage: 'resolved' }), 'done')
  assert.deepEqual(flowOf({ ...base, reviewStage: 'in_review' }).steps.map((step) => step.state), ['done', 'done', 'done', 'current', 'todo'])
  assert.ok(flowOf({ ...base, reviewStage: 'resolved' }).steps.every((step) => step.state === 'done'))
  assert.ok(flowOf(base).next)

  const { translateText } = await server.ssrLoadModule('/src/i18n/translate.js')
  for (const text of ['Design Drift', 'Size mismatch', 'Production baseline', 'Show code', flowOf(base).next]) assert.notEqual(translateText(text, 'ko'), text, `"${text}" has Korean copy`)
  await server.ssrLoadModule('/src/components/conflicts/ConflictInsight.jsx')
  console.log('Passed: conflict types, production baseline, mismatch causes by value kind, flow steps and Korean copy.')
} finally { await server.close() }
