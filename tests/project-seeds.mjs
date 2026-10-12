import assert from 'node:assert/strict'
import { createServer } from 'vite'

// Every project's design changes follow the reference (Dashboard Redesign's
// CON-002): told once in the seed, numbered CON-0xx, each step saying who and
// when — and each project has one change merged end to end.
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { PROJECT_SEEDS } = await server.ssrLoadModule('/src/mocks/seed.js')
  const derive = await server.ssrLoadModule('/src/mocks/derive.js')
  const { allConflictRecords } = await server.ssrLoadModule('/src/lib/conflicts.js')
  const { projectHistorySeeds, activities, conflictNotifications, mergeListItems, designSystemUpdates } = await server.ssrLoadModule('/src/data/mockData.js')

  const records = allConflictRecords()
  const byId = (id) => records.find((record) => record.id === id)
  const ids = PROJECT_SEEDS.flatMap((seed) => seed.changes.map((change) => change.id))
  assert.equal(new Set(ids).size, ids.length, 'no number is used twice')
  assert.ok(ids.every((id) => /^CON-\d{3}$/.test(id)))

  for (const seed of PROJECT_SEEDS) {
    const project = seed.project.id
    // Every change in the project is a seeded one — design changes and merge
    // conflicts alike.
    const own = records.filter((record) => record.projectId === project)
    assert.deepEqual(own.map((record) => record.id).sort(), seed.changes.map((change) => change.id).sort(), `${project}: every change is from the seed`)
    // One change merged end to end — except Dashboard, whose CON-002 is the
    // walkthrough: nothing there is done until it's played.
    const merged = seed.changes.filter((change) => change.stage === 'resolved')
    assert.equal(merged.length, project === 'dashboard-redesign' ? 0 : 1, `${project}: merged end to end`)
    for (const change of seed.changes) {
      const record = byId(change.id)
      assert.equal(record.timestamp, derive.timeLabelOf(change.steps.detected), `${change.id}: found when its seed says`)
      if (change.steps.requested && change.kind === 'value' && record.decisionFlow) assert.equal(record.decisionRequest.sentAt, derive.momentOf(change.steps.requested).getTime(), `${change.id}: asked when its seed says`)
      // Every design change is a design decision, as the reference is — but an
      // accessibility check, where design and code are alike, adjusted by hand.
      if (change.kind === 'value') assert.equal(Boolean(record.decisionFlow), change.check !== 'accessibility', `${change.id}: reviewed as a design decision`)
      // A request asks for something other than the design (following it needs no asking).
      if (change.kind === 'value' && change.steps.requested) assert.notEqual(change.steps.requested.proposal, 'original', `${change.id}: asks for a way that differs`)
      // As the reference's: a developer asks, the designer decides.
      if (change.kind !== 'code') {
        assert.deepEqual(change.reviewers ?? [seed.people.designer], [seed.people.designer], `${change.id}: the designer decides`)
        if (change.steps.requested) assert.notEqual(change.steps.requested.by, seed.people.designer, `${change.id}: a developer asks`)
      }
      if (change.kind === 'value') assert.equal(Boolean(change.steps.requested), record.reviewStage !== 'detected', `${change.id}: asked ⇔ past 변경 감지`)
    }
  }

  // ── The merged ones: every step done, each with who and when, as CON-002's are ──
  const { eventsOf, progressOf } = await server.ssrLoadModule('/src/lib/conflictEvents.js')
  const { fixPhaseOf, decisionOutcomeOf } = await server.ssrLoadModule('/src/lib/designDecisions.js')
  for (const id of ['CON-012', 'CON-021']) {
    const record = byId(id)
    const steps = derive.seededChangeOf(id).steps
    const events = eventsOf(record)
    assert.deepEqual(events.map((event) => event.type), ['detected', 'requested', 'decided', 'fixed', 'verified', 'resolved'])
    assert.equal(progressOf(events).status, 'done')
    assert.deepEqual(events.map((event) => event.actor.id ?? null), [null, steps.requested.by, steps.decided.by, null, null, steps.merged.by].map((person) => person ?? (events[0].actor.id ?? null)))
    assert.deepEqual(events.map((event) => new Date(event.createdAt).getTime()), ['detected', 'requested', 'decided', 'fixed', 'verified', 'merged'].map((step) => derive.momentOf(steps[step]).getTime()))
    assert.equal(fixPhaseOf(record), 'resolved')
    // Taylor kept the design: the fix is the design's code.
    assert.equal(decisionOutcomeOf(record).choice, 'keep')
    assert.deepEqual([record.fixes.keep].flat(), record.diff.after)
    assert.ok(record.reviewers.every((reviewer) => reviewer.status === 'approved' && reviewer.note === steps.decided.reason))
    // Its History: the fix and the merge, at the record's times, holding its fixed code.
    const history = projectHistorySeeds[record.projectId].filter((entry) => entry.conflictId === id && entry.kind !== 'conflict')
    assert.deepEqual(history.map((entry) => entry.kind), ['edit', 'merge'])
    assert.deepEqual(history.map((entry) => entry.timestamp), [derive.timeLabelOf(steps.verified), derive.timeLabelOf(steps.merged)])
    assert.ok(history.every((entry) => entry.snapshot.lines.some((line) => line.trim() === record.diff.after[0].trim())), `${id}: the History holds the fixed line`)
    assert.ok(!history[0].actorId, 'the fix is the system’s')
    assert.equal(history[1].actorId, steps.merged.by)
  }

  // ── The merge conflicts: numbered and timed like the rest, resolved as before ──
  const code = PROJECT_SEEDS.flatMap((seed) => seed.changes).filter((change) => change.kind === 'code').map((change) => byId(change.id))
  assert.deepEqual(code.map((record) => record.id), ['CON-022', 'CON-023', 'CON-025', 'CON-024'])
  assert.ok(code.every((record) => record.kind === 'code-conflict' && record.diff.before.some((line) => line.startsWith('<<<<<<<')) && record.codeComparison.resolution))

  // ── What points at a change finds it, by its title ──
  for (const entry of [...activities, ...mergeListItems].filter((entry) => entry.conflictId)) {
    assert.ok(byId(entry.conflictId), `${entry.id} points at a change that exists`)
  }
  for (const notice of conflictNotifications) assert.equal(notice.target.label, byId(notice.target.conflictId).title)
  for (const item of mergeListItems.filter((entry) => ids.includes(entry.conflictId))) assert.equal(item.title, byId(item.conflictId).title)
  assert.ok(designSystemUpdates.every((update) => byId(update.conflictId)?.reviewStage === 'resolved'), 'a design system update is born from a merged change')
  console.log('Passed: every project’s changes come from the seed as CON-0xx, each project has one merged end to end with who and when on every step, and what points at a change finds it.')
} finally { await server.close() }
