import assert from 'node:assert/strict'
import { createServer } from 'vite'

// Dashboard Redesign is one story, told from one seed (mocks/seed.js): what
// every screen shows about it is worked out from that, so it can't disagree
// with itself.
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { SEED } = await server.ssrLoadModule('/src/mocks/seed.js')
  const derive = await server.ssrLoadModule('/src/mocks/derive.js')
  const { allConflictRecords, isOpen } = await server.ssrLoadModule('/src/lib/conflicts.js')
  const { projectHistorySeeds, projectFileSets } = await server.ssrLoadModule('/src/data/mockData.js')
  const { eventsOf } = await server.ssrLoadModule('/src/lib/conflictEvents.js')
  const { fixPhaseOf, decisionOutcomeOf } = await server.ssrLoadModule('/src/lib/designDecisions.js')
  const { pinsFor, markersOf } = await server.ssrLoadModule('/src/lib/canvasPins.js')
  const { conflictNumbersOf } = await server.ssrLoadModule('/src/components/conflicts/useConflictList.js')
  const { foldConflictCheckpoints, withBranches } = await server.ssrLoadModule('/src/lib/historyBranches.js')

  const project = SEED.project.id
  const records = allConflictRecords().filter((record) => record.projectId === project)
  const byId = (id) => records.find((record) => record.id === id)
  const seeded = SEED.changes.map((change) => byId(change.id))
  assert.ok(seeded.every(Boolean), 'every seeded change is a record the app lists')

  // The app's records are the seed's, not copies kept beside it.
  assert.deepEqual(JSON.parse(JSON.stringify(seeded)), JSON.parse(JSON.stringify(derive.dashboardConflicts())).map((record) => ({ ...byId(record.id), ...record })).map((record) => JSON.parse(JSON.stringify(record))))

  // ── CON-002: one ending, said the same everywhere ──
  const drift = byId('CON-002')
  const story = SEED.changes[0].steps
  assert.equal(drift.reviewStage, 'resolved')
  assert.equal(fixPhaseOf(drift), 'resolved')
  assert.equal(decisionOutcomeOf(drift)?.name, '1열 레이아웃')
  assert.deepEqual([drift.decisionRequest.by, drift.decisionRequest.proposal, drift.decisionRequest.reason], ['min', 'one-column', story.requested.reason])
  assert.deepEqual([drift.designDecision.by, drift.designDecision.choice, drift.designDecision.reason], ['jane', 'approve', story.decided.reason])
  assert.ok(drift.decisionFix.verified && drift.decisionFix.auto && drift.reviewers.every((reviewer) => reviewer.status === 'approved'))
  // Its events are the story's steps, in order, at the story's times.
  const events = eventsOf(drift)
  assert.deepEqual(events.map((event) => event.type), ['detected', 'requested', 'decided', 'fixed', 'verified', 'resolved'])
  assert.deepEqual(events.map((event) => new Date(event.createdAt).getTime()), ['detected', 'requested', 'decided', 'fixed', 'verified', 'merged'].map((step) => derive.momentOf(story[step]).getTime()))
  assert.deepEqual(events.map((event) => event.actor.name), ['Devsign', 'Alex', 'Taylor', 'Devsign', 'Devsign', 'Alex'])
  // The code: what was built → what was decided, on the grid's line; no other value anywhere in its record.
  assert.deepEqual(drift.diff, { before: [derive.gridLineOf(SEED.grid.built)], after: [derive.gridLineOf(SEED.grid.decided)] })
  assert.equal(drift.fixes.approve, drift.diff.after[0])
  assert.equal(drift.fixes['one-column'], drift.diff.after[0])

  // ── The History: four saved versions, and the code they hold ──
  const history = projectHistorySeeds[project]
  const saved = history.filter((entry) => entry.kind !== 'conflict')
  assert.equal(saved.length, SEED.checkpoints.length)
  assert.equal(saved.length, 4)
  assert.equal(derive.savedVersionCount(), saved.length, '"저장된 버전 N개" is the checkpoint count')
  assert.equal(foldConflictCheckpoints(withBranches(history, records)).length, saved.length, 'the History page lists exactly the saved versions')
  assert.deepEqual(saved.map((entry) => entry.label), ['AI 시안 A · B 생성', 'DashboardGrid 반응형 구현 · 768px에서 2열 360px 고정', 'CON-002 수정 · 768px 이하 1열 (검증 통과)', 'CON-002 병합 · 반영 완료'])
  assert.deepEqual(saved.map((entry) => entry.timestamp.split(',')[0]), ['Yesterday', 'Today', 'Today', 'Today'])
  // The overlap comes in with the second version and is gone from the third.
  const line = (entry) => entry.snapshot.lines[SEED.grid.line - 1]
  assert.ok(!saved[0].snapshot.lines.some((text) => text.includes('useBreakpoint')), 'the drafts: no responsive branch yet')
  assert.equal(line(saved[1]), drift.diff.before[0])
  // CON-002's last checkpoint holds the code its 수정 · 검증 step shows.
  assert.equal(line(saved[2]), drift.diff.after[0])
  assert.equal(line(saved.at(-1)), drift.diff.after[0])
  // …and that's the file as it is now.
  assert.deepEqual(projectFileSets[project][0].lines, saved.at(-1).snapshot.lines)
  // The mark is on the version that brought it in, at the time it was found.
  const mark = history.find((entry) => entry.kind === 'conflict')
  assert.equal(history[history.indexOf(mark) - 1].id, saved[1].id)
  assert.equal(mark.timestamp, drift.timestamp)
  // A code diff is only ever the difference between two checkpoints' code.
  const changed = (a, b) => a.snapshot.lines.filter((text, index) => text !== b.snapshot.lines[index]).length
  assert.ok(changed(saved[1], saved[2]) === 1 && changed(saved[2], saved[3]) === 0)

  // ── The other changes: each at its own stage, with the values the code has ──
  assert.deepEqual(['CON-003', 'CON-005', 'CON-006'].map((id) => byId(id).reviewStage), ['detected', 'in_review', 'detected'])
  assert.deepEqual(['CON-003', 'CON-005', 'CON-006'].map((id) => byId(id).dueLabel), ['Due in 3 days', 'Due tomorrow', 'Due in 7 days'])
  assert.deepEqual(byId('CON-003').comparisonFields, [{ label: 'Padding', expected: '16px (space.4)', current: '12px' }])
  const [, css, tokens, button] = projectFileSets[project]
  assert.ok(css.lines.some((text) => text.includes('#1D4ED8')), 'the stylesheet has the fixed hex the color change is about')
  assert.ok(!css.lines.some((text) => /purchase|background/.test(text) && text.includes('var(--color-cta)')), '…and not the token already')
  assert.ok(tokens.lines.some((text) => text.includes('"cta": "#2563EB"')) && tokens.lines.some((text) => text.includes('"4": "16px"')), 'the tokens are the design’s values')
  assert.equal(button.lines[byId('CON-005').line - 1], byId('CON-005').diff.before[0], 'the line the change points at is the code as built')

  // ── What's counted is what's there ──
  const open = records.filter(isOpen)
  const done = records.filter((record) => !isOpen(record))
  assert.equal(open.length + done.length, records.length)
  assert.deepEqual(done.map((record) => record.id), ['CON-002'], 'one is done: the merged one')
  // The record's finished steps and the list's state agree: all five done ⇔ listed as done.
  for (const record of seeded) assert.equal(!isOpen(record), record.reviewStage === 'resolved')
  // A pin for every open change about an element — and none for the merged one or one with no element.
  const markers = markersOf(pinsFor(records, conflictNumbersOf(records)))
  const pinned = records.filter((record) => record.layerId && !record.rollback)
  assert.deepEqual(markers.map((marker) => marker.conflictId).sort(), pinned.map((record) => record.id).sort())
  assert.ok(markers.every((marker) => marker.resolved === !isOpen(byId(marker.conflictId))))
  assert.deepEqual(Object.fromEntries(markers.map((marker) => [marker.conflictId, marker.count])), { 'CON-003': 4, 'CON-005': 1, 'CON-006': 2 })

  // ── Applied on another day, it's still "today" ──
  const later = new Date(); later.setDate(later.getDate() + 30)
  const then = derive.dashboardConflicts(later.getTime()).find((record) => record.id === 'CON-002')
  assert.equal(then.timestamp, drift.timestamp, 'said relative to the day it’s applied')
  assert.equal(new Date(then.decisionRequest.sentAt).toDateString(), later.toDateString())
  // The same seed always gives the same state.
  assert.deepEqual(JSON.stringify(derive.dashboardConflicts(0)), JSON.stringify(derive.dashboardConflicts(0)))
  console.log('Passed: Dashboard Redesign reads from one seed — CON-002 merged with one ending, four saved versions whose code matches its fix, counts and pins that match the changes, and times relative to today.')
} finally { await server.close() }
