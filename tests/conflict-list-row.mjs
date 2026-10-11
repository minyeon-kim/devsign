import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { kindWordOf } = await server.ssrLoadModule('/src/lib/conflictInsight.js')
  const { allConflictRecords } = await server.ssrLoadModule('/src/lib/conflicts.js')
  const { translateText } = await server.ssrLoadModule('/src/i18n/translate.js')
  const ko = (conflict) => translateText(kindWordOf(conflict), 'ko')
  const records = allConflictRecords()
  const byId = Object.fromEntries(records.map((conflict) => [conflict.id, conflict]))

  // The list's meta line names the kind of change in a couple of Korean words — no English beside it.
  assert.equal(ko(byId['CON-002']), '구조 차이')
  const dashboard = records.filter((conflict) => conflict.projectId === 'dashboard-redesign')
  assert.ok(dashboard.length >= 7)
  for (const conflict of dashboard) {
    const word = ko(conflict)
    assert.ok(word && !/[A-Za-z]/.test(word), `${conflict.id}: "${word}" is a short Korean word`)
  }
  assert.ok(dashboard.some((conflict) => ko(conflict) === '컬러 토큰'))
  assert.ok(dashboard.some((conflict) => ko(conflict) === '간격'))
  assert.ok(dashboard.some((conflict) => ko(conflict) === '폰트 굵기'))
  assert.equal(kindWordOf(null), null)
  await server.ssrLoadModule('/src/components/dashboard/ConflictsDrawer.jsx')
  console.log('Passed: the conflict list names each change’s kind in short Korean words.')
} finally { await server.close() }
