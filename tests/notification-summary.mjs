import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

// A change's notification says what changed — from the change's own data, by
// template — and carries two pictures made once.
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const s = await server.ssrLoadModule('/src/lib/notificationSummary.js')
  const t = await server.ssrLoadModule('/src/lib/notificationThumbs.js')
  const { allConflictRecords } = await server.ssrLoadModule('/src/lib/conflicts.js')
  const records = allConflictRecords()
  const byId = (id) => records.find((c) => c.id === id)
  const nameOf = (id) => ({ jane: 'Taylor', min: 'Alex' }[id] ?? id)
  const note = (type, conflictId, extra = {}) => ({ id: `n-${type}`, type, authorId: null, target: { conflictId, label: byId(conflictId).title }, text: 'x', ...extra })

  // 변경 감지: "{속성} {이전 값} → {이후 값}", the same rows the detail lists.
  const padding = s.summaryOf(note('detected', 'CON-003'), byId('CON-003'), { nameOf })
  assert.equal(padding.label, '변경 감지')
  assert.equal(s.changeText(padding.changes.all[0]), 'Padding 12px → 16px (space.4)')
  assert.deepEqual(s.closedPartsOf(padding), { change: padding.changes.all[0], more: 0 })
  // The pictures' labels: what's there now and what's proposed, each with its value (without its note).
  assert.deepEqual(padding.images, ['현재 · 12px', '제안 · 16px'])
  assert.equal(s.diffChipOf(padding.changes.all[0]), 'padding  12px → 16px', 'the change as a diff chip')
  const legend = s.summaryOf(note('request', 'CON-008'), byId('CON-008'), { nameOf })
  assert.deepEqual([legend.images, s.diffChipOf(legend.changes.all[0])], [['현재 · 4px', '제안 · 8px'], 'gap  4px → 8px'])

  // Two shown, the rest "외 N건"; a value both sides share isn't a difference.
  const many = { ...byId('CON-003'), comparisonFields: ['a', 'b', 'c'].map((label) => ({ label, current: '1', expected: '2' })).concat([{ label: 'same', current: '3', expected: '3' }]) }
  const three = s.summaryOf(note('detected', 'CON-003'), many, { nameOf })
  assert.deepEqual([three.changes.shown.length, three.changes.more], [2, 1])
  assert.deepEqual(three.images, ['현재', '제안'], 'several values: the sides alone')
  assert.equal(s.closedPartsOf(three).more, 2, 'the closed line: the first, and the rest counted')

  // 마감 임박: "내일 마감 · {현재 상태}".
  assert.equal(s.summaryOf(note('due', 'CON-002'), byId('CON-002'), { nameOf }).lead, '내일 마감 · 해결 방법 미선택')
  assert.equal(s.summaryOf(note('due', 'CON-005'), byId('CON-005'), { nameOf }).lead, '내일 마감 · 승인 대기')
  // 검토 요청: the requester's message, then the summary.
  const request = s.summaryOf(note('request', 'CON-005'), byId('CON-005'), { nameOf })
  assert.ok(request.lead.length > 0 && request.requester === 'Alex')
  assert.deepEqual(Object.keys(s.closedPartsOf(request)), ['lead', 'change', 'more'])
  // 승인: "{검토자} 승인 · 병합 가능".
  assert.equal(s.summaryOf(note('decision', 'CON-005', { authorId: 'jane', text: '승인했어요 · x' }), { ...byId('CON-005'), reviewStage: 'approved' }, { nameOf }).lead, 'Taylor 승인 · 병합 가능')
  assert.equal(s.summaryOf(note('decision', 'CON-005', { authorId: 'jane', text: '수정을 요청했어요 · x' }), byId('CON-005'), { nameOf }).label, '수정 요청')
  // Not a change's values: nothing to say.
  assert.equal(s.summaryOf(note('comment', 'CON-003'), byId('CON-003'), { nameOf }), null)
  assert.equal(s.summaryOf(note('detected', 'CON-003'), null, { nameOf }), null)

  // Pictures: kept once, shared by what's drawn, hidden when they can't be made.
  let store = t.EMPTY_THUMBS
  assert.equal(t.thumbOf(store, 'a').status, 'pending')
  store = t.recordThumb(store, 'a', 'CON-003:x', { before: 'b', after: 'a' })
  store = t.recordThumb(store, 'b', 'CON-003:x', { before: 'b', after: 'a' })
  store = t.recordThumb(store, 'c', 'CON-025:none', null)
  assert.deepEqual([t.thumbOf(store, 'a').status, t.thumbOf(store, 'b').status, t.thumbOf(store, 'c').status], ['ready', 'ready', 'failed'])
  assert.equal(Object.keys(store.images).length, 1)
  let crowded = t.EMPTY_THUMBS
  for (let i = 0; i < t.MAX_IMAGE_PAIRS + 5; i += 1) crowded = t.recordThumb(crowded, `n${i}`, `s${i}`, { before: 'b', after: 'a' })
  assert.equal(Object.keys(crowded.images).length, t.MAX_IMAGE_PAIRS)
  // A merge conflict between branches has nothing to draw; a design change has.
  assert.equal(t.thumbPlanOf(byId('CON-025'), []), null)
  assert.ok(t.thumbPlanOf(byId('CON-008'), []).mode === 'sample')

  // Wired: a place of fixed height (88px, half the card's width each), a 150ms fade, 200ms height, made once in the provider.
  assert.deepEqual([t.THUMB.width, t.THUMB.height], [140, 88])
  const drawer = readFileSync(new URL('../src/components/mergestudio/MergeInboxDrawer.jsx', import.meta.url), 'utf8')
  assert.ok(drawer.includes('duration-150') && drawer.includes('duration-200') && !drawer.includes('animate-pulse'))
  assert.ok(drawer.includes("if (!gaps && thumb.status === 'failed') return null"), 'a failed picture hides its place (one drawn live has no picture to fail)')
  assert.ok(readFileSync(new URL('../src/state/WorkspaceProvider.jsx', import.meta.url), 'utf8').includes('useNotificationThumbs({ projectId, notifications, conflicts, pages: projectPages })'))
  console.log('Passed: change notifications summarise by template; pictures are kept once, shared, and hidden when they fail.')
} finally { await server.close() }
