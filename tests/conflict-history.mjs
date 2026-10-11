import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const events = await server.ssrLoadModule('/src/lib/conflictEvents.js')
  const { sampleHistoryForCon002, sortEvents, progressOf, eventsOf, appendEvent, humanEventCount, opinionsOnly, timelineRows, continuesPrevious, decisionLineOf, referenceNameOf, relativeTimeOf, absoluteTimeOf, dayLabelOf, SYSTEM_ACTOR } = events
  const { decisionStageOf } = await server.ssrLoadModule('/src/lib/designDecisions.js')
  const { listStatusOf, allConflictRecords } = await server.ssrLoadModule('/src/lib/conflicts.js')
  const day = new Date('2026-10-11T12:00:00+09:00')
  const history = sampleHistoryForCon002({ day })

  // 1–8 in, 1–8 out: by the server's time (then seq), however they arrive.
  assert.deepEqual(history.map((event) => event.type), ['detected', 'requested', 'commented', 'commented', 'decided', 'fixed', 'verified', 'resolved'])
  assert.deepEqual(sortEvents([...history].reverse()).map((event) => event.seq), [1, 2, 3, 4, 5, 6, 7, 8])
  const tie = [{ id: 'b', createdAt: history[0].createdAt, seq: 2 }, { id: 'a', createdAt: history[0].createdAt, seq: 1 }]
  assert.deepEqual(sortEvents(tie).map((event) => event.id), ['a', 'b'], 'the same instant is ordered by seq')

  // What answers what.
  const byType = (type, at = 0) => history.filter((event) => event.type === type)[at]
  assert.equal(byType('decided').replyTo, byType('requested').id)
  assert.equal(byType('fixed').replyTo, byType('decided').id)
  assert.equal(byType('verified').replyTo, byType('fixed').id)
  assert.equal(byType('commented', 1).replyTo, byType('commented', 0).id)
  assert.equal(referenceNameOf(byType('requested')), '승인 요청')
  assert.equal(referenceNameOf(byType('commented')), 'Taylor 의견')
  // The decision reads result first, with the proposal it moved from.
  assert.deepEqual(decisionLineOf(byType('decided')), { text: '다른 수정안으로 변경 · 원안대로 맞추기', changed: ['1열로 변경', '원안대로 맞추기'], warn: false })

  // Progress is the events': 5/5, each step with who did it last and when.
  const progress = progressOf(history)
  assert.deepEqual([progress.stage, progress.done, progress.status], ['resolved', 5, 'done'])
  assert.deepEqual(progress.steps.map((step) => step.state), ['done', 'done', 'done', 'done', 'done'])
  assert.deepEqual(progress.steps.map((step) => step.last?.actor.name), ['Devsign', 'Alex', 'Taylor', 'Devsign', 'Alex'])
  assert.equal(progress.steps[2].last.id, byType('decided').id)
  assert.equal(events.clockOf(progress.steps[2].last.createdAt), '오후 2:40')
  // Step by step.
  const stages = history.map((_, index) => progressOf(history.slice(0, index + 1)).stage)
  assert.deepEqual(stages, ['detected', 'requested', 'requested', 'requested', 'decided', 'fixed', 'verified', 'resolved'])
  assert.equal(progressOf(history.slice(0, 7)).stage, 'verified', 'verified isn’t resolved: a person marks that')

  // Turned down: back to step 2, and the next request follows on — nothing is removed.
  const rejected = sampleHistoryForCon002({ day, rejected: true })
  const turnedDown = progressOf(rejected.slice(0, 5))
  assert.deepEqual([turnedDown.stage, turnedDown.step], ['rework', 2])
  assert.equal(decisionLineOf(rejected[4]).warn, true)
  assert.equal(rejected.length, 6)
  assert.deepEqual([progressOf(rejected).stage, progressOf(rejected).step], ['requested', 3])
  assert.equal(rejected.filter((event) => event.type === 'requested').length, 2, 'both requests are in the history')
  // Opened again: starts over, the earlier record still there.
  const again = [...history, { id: 'r', conflictId: 'CON-002', type: 'reopened', actor: SYSTEM_ACTOR, createdAt: new Date(Date.parse(history.at(-1).createdAt) + 60000).toISOString(), seq: 9, step: 1, payload: { cause: 'drift' } }]
  assert.deepEqual([progressOf(again).stage, progressOf(again).status, again.length], ['detected', 'before', 9])

  // The tab counts what people did; "opinions only" keeps each opinion and what it answers.
  assert.equal(humanEventCount(history), 6)
  assert.deepEqual(opinionsOnly(history).map((event) => event.seq), [2, 3, 4])
  // Three or more of the system's events in a row fold; a person's never do.
  const system = (seq) => ({ id: `s${seq}`, type: 'verified', actor: SYSTEM_ACTOR, createdAt: new Date(Date.parse(history[0].createdAt) + seq * 1000).toISOString(), seq, payload: { match: true } })
  const rows = timelineRows([system(1), system(2), system(3), byType('requested')])
  assert.deepEqual(rows.map((row) => row.kind), ['system-run', 'event'])
  assert.equal(rows[0].events.length, 3)
  assert.deepEqual(timelineRows([system(1), system(2), system(3)], { expanded: new Set(['s1']) }).map((row) => row.kind), ['event', 'event', 'event'])
  assert.deepEqual(timelineRows(history).map((row) => row.kind), Array(8).fill('event'), 'the sample folds nothing')
  // Opinions by one person within five minutes read as one.
  const first = { type: 'commented', actor: { id: 'min' }, createdAt: '2026-10-11T02:00:00.000Z' }
  assert.equal(continuesPrevious({ ...first, createdAt: '2026-10-11T02:04:00.000Z' }, first), true)
  assert.equal(continuesPrevious({ ...first, createdAt: '2026-10-11T02:06:00.000Z' }, first), false)
  assert.equal(continuesPrevious({ ...first, actor: { id: 'jane' }, createdAt: '2026-10-11T02:01:00.000Z' }, first), false)

  // Times are KST, whatever the machine's zone.
  const now = Date.parse('2026-10-11T17:00:00+09:00')
  assert.equal(relativeTimeOf(history[0].createdAt, now), '오전 9:12')
  assert.equal(relativeTimeOf(new Date(now - 12 * 60000).toISOString(), now), '12분 전')
  assert.equal(absoluteTimeOf(history[0].createdAt), '2026.10.11 오전 9:12:00 KST')
  // One time format everywhere: the clock today, the date and clock on another day.
  const { formatTime, isSystemActor, stepActionOf } = events
  assert.equal(formatTime(history[0].createdAt, now), '오전 9:12')
  assert.equal(formatTime(history[0].createdAt, Date.parse('2026-10-12T12:00:00+09:00')), '10월 11일 오전 9:12')
  // Devsign is never a person: the system reads as what it did.
  assert.ok(isSystemActor(SYSTEM_ACTOR) && !isSystemActor(history[1].actor))
  assert.match(stepActionOf(history[0]).text, /^자동 감지/)
  assert.match(stepActionOf(history[6]).text, /검증 통과/)
  assert.equal(stepActionOf(history[4]).name, history[4].actor.name)
  assert.equal(dayLabelOf(history[0].createdAt, now), '오늘')
  assert.equal(dayLabelOf('2026-10-10T03:00:00.000Z', now), '어제')
  assert.equal(dayLabelOf('2026-10-09T03:00:00.000Z', now), '10월 9일 (금)')

  // A change with no log yet has the events its own state implies — never none.
  const sample = allConflictRecords().find((conflict) => conflict.id === 'CON-002')
  const implied = eventsOf(sample)
  assert.equal(implied[0].type, 'detected')
  assert.ok(implied.length >= 1)
  assert.equal(decisionStageOf(sample), progressOf(implied).stage)
  assert.equal(listStatusOf(sample).id, 'detected')
  // The stage and the list's status follow the log, not a field beside it.
  assert.equal(decisionStageOf({ ...sample, events: history }), 'resolved')
  assert.equal(listStatusOf({ ...sample, events: history }).id, 'done')
  assert.equal(listStatusOf({ ...sample, events: history.slice(0, 5) }).id, 'in_review')
  // Appending never rewrites: the log grows by one, in order, on the step it's at.
  const next = appendEvent({ ...sample, events: history.slice(0, 2) }, { type: 'commented', actorId: 'jane', replyTo: history[1].id, payload: { body: '확인할게요' } })
  assert.equal(next.length, 3)
  assert.deepEqual(next.slice(0, 2), history.slice(0, 2))
  assert.deepEqual([next[2].seq, next[2].step, next[2].replyTo, next[2].actor.role], [3, 3, history[1].id, 'designer'])
  await server.ssrLoadModule('/src/components/conflicts/DesignDecisionFlow.jsx')
  console.log('Passed: event order, reply links, progress from events (5/5, rejection, reopening), counts, folding, KST times and the append-only log.')
} finally { await server.close() }
