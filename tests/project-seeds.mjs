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
  const { reviewRecordOf } = await server.ssrLoadModule('/src/lib/reviewRecord.js')
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
      if (change.steps.requested && change.kind === 'value') assert.equal(record.requestedAtMs, derive.momentOf(change.steps.requested).getTime(), `${change.id}: asked when its seed says`)
      // As the reference's: a developer asks, the designer decides.
      if (change.kind !== 'code') {
        assert.deepEqual(change.reviewers ?? [seed.people.designer], [seed.people.designer], `${change.id}: the designer decides`)
        if (change.steps.requested) assert.notEqual(change.steps.requested.by, seed.people.designer, `${change.id}: a developer asks`)
      }
      if (change.kind === 'value') assert.equal(Boolean(change.steps.requested), record.reviewStage !== 'detected', `${change.id}: asked ⇔ past 변경 감지`)
    }
  }

  // ── The merged ones: all five steps done, each with who and when ──
  for (const id of ['CON-012', 'CON-021']) {
    const record = byId(id)
    const steps = derive.seededChangeOf(id).steps
    const nameOf = (person) => ({ jane: 'Taylor', james: 'Jordan', min: 'Alex' })[person]
    const record5 = reviewRecordOf(record, { nameOf, roleOf: (person) => (person === 'jane' ? 'Designer' : 'Developer'), choice: 'A', choiceLabel: 'Change to the design reference' })
    assert.deepEqual(record5.map((step) => step.title), ['변경 감지', '승인 요청', '디자이너 결정', '수정 · 검증', '병합'])
    assert.ok(record5.every((step) => step.state === 'done'), `${id}: every step is done`)
    assert.ok(record5.every((step) => step.who && step.time), `${id}: every step says who and when`)
    assert.equal(record5[1].who, `${nameOf(steps.requested.by)} · 제안`)
    assert.equal(record5[2].who, nameOf(steps.decided.by))
    assert.equal(record5[4].who, nameOf(steps.merged.by))
    assert.ok(record.reviewers.every((reviewer) => reviewer.status === 'approved' && reviewer.note === steps.decided.reason))
    assert.deepEqual([record.autoFix.verified, record.resolvedAtLabel], [true, derive.timeLabelOf(steps.merged)])
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
