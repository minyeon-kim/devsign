import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { CONFLICT_TYPES, conflictTypeOf, exceptionTypeOf, differenceNoteOf } = await server.ssrLoadModule('/src/lib/conflictInsight.js')
  const { allConflictRecords } = await server.ssrLoadModule('/src/lib/conflicts.js')
  const { translateText } = await server.ssrLoadModule('/src/i18n/translate.js')
  const byId = Object.fromEntries(allConflictRecords().map((conflict) => [conflict.id, conflict]))

  // A compact row is tagged only when it's an exception: a design drift — most of them — isn't.
  assert.equal(conflictTypeOf(byId['cc-tab-icon-size']).id, 'design-drift')
  assert.equal(exceptionTypeOf(byId['cc-tab-icon-size']), null)
  const deployed = exceptionTypeOf(byId['cc-11'])
  assert.equal(deployed.id, 'production-priority', 'a drift whose code is on the production branch')
  // The name and its tooltip are CONFLICT_TYPES' — one place — and say what it means.
  assert.equal(deployed.label, CONFLICT_TYPES['production-priority'].label)
  assert.equal(translateText(deployed.label, 'ko'), '배포 중')
  assert.equal(translateText(deployed.hint, 'ko'), '이미 배포된 값이라 바꾸면 운영 화면에 반영돼요')
  assert.equal(translateText(CONFLICT_TYPES['design-drift'].label, 'ko'), '디자인 불일치')

  // The second line adds what the title doesn't say — and nothing when the title already does.
  assert.equal(differenceNoteOf(byId['cc-tab-icon-size']), null, '"Tab icon / Size" already says it’s a size mismatch')
  assert.equal(differenceNoteOf(byId['cc-9']), null)
  assert.deepEqual(differenceNoteOf(byId['cc-11']), { text: '2 differences', detail: ['Size mismatch', 'Color mismatch'] })
  assert.equal(translateText('2 differences', 'ko'), '차이 2건')
  assert.equal(differenceNoteOf(byId['cc-touch-adjusted']).text, 'Below the standard on both sides')
  assert.equal(differenceNoteOf(byId['cc-2']), null, 'a merge conflict is said by its tag')

  // Filters: four standing ones on one line; the finer statuses are a dropdown's.
  const { PRIMARY_FILTERS, STATUS_FILTERS } = await server.ssrLoadModule('/src/components/conflicts/useConflictList.js')
  assert.deepEqual(PRIMARY_FILTERS.map((filter) => filter.id), ['all', 'mine', 'open', 'done'])
  assert.deepEqual(PRIMARY_FILTERS.map((filter) => translateText(filter.label, 'ko')), ['전체', '내 검토', '진행 중', '완료'])
  assert.deepEqual(STATUS_FILTERS.map((filter) => filter.id), ['detected', 'in_review', 'pending_merge', 'pending_rollback'])
  const records = allConflictRecords()
  const inProgress = records.filter(PRIMARY_FILTERS[2].test)
  assert.equal(inProgress.length, STATUS_FILTERS.reduce((sum, filter) => sum + records.filter(filter.test).length, 0), '"In progress" is every status before done')
  assert.equal(inProgress.length + records.filter(PRIMARY_FILTERS[3].test).length, records.length)
  await server.ssrLoadModule('/src/components/dashboard/ConflictsDrawer.jsx')
  console.log('Passed: exception-only tags, the "Deployed" name and tooltip, difference notes, and the list’s filters.')
} finally { await server.close() }
