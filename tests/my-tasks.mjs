import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { TASK_LABEL, taskFor, taskGroups, isDueNow, remainingWorkOf } = await server.ssrLoadModule('/src/lib/conflicts.js')
  const base = { id: 'c', projectId: 'p', changedBy: { type: 'person', id: 'author' }, reviewers: [{ id: 'me', status: 'pending' }], dueLabel: 'Due in 7 days', dueBucket: 'week' }
  const kind = (patch, user = 'me') => taskFor({ ...base, ...patch }, user)?.kind ?? null
  assert.equal(kind({ reviewStage: 'detected' }), 'decide', 'nothing chosen yet: a conflict to decide')
  assert.equal(kind({ reviewStage: 'detected', decidedSide: 'B' }), 'continue', 'a way is chosen but review isn’t requested: work is left')
  assert.equal(kind({ reviewStage: 'in_review' }), 'review', 'a pending required reviewer has a request to review')
  assert.equal(kind({ reviewStage: 'in_review' }, 'author'), null, 'the author waits on the reviewers')
  assert.equal(kind({ reviewStage: 'in_review', reviewers: [{ id: 'me', status: 'changes_requested' }] }, 'author'), 'continue', 'changes requested go back to the author')
  assert.equal(kind({ reviewStage: 'in_review', reviewers: [{ id: 'me', status: 'approved' }, { id: 'other', status: 'pending' }] }), null, 'already approved: waiting on others')
  assert.equal(kind({ reviewStage: 'approved' }), 'merge')
  assert.equal(kind({ reviewStage: 'resolved' }), null)
  assert.equal(kind({ reviewStage: 'detected', kind: 'design-review' }), null, 'an unsent design request isn’t a conflict to decide')
  assert.deepEqual(Object.keys(TASK_LABEL), ['decide', 'review', 'continue', 'merge'])
  assert.equal(taskFor({ ...base, reviewStage: 'approved' }, 'me').label, TASK_LABEL.merge)

  assert.equal(isDueNow({ dueLabel: 'Due today' }), true)
  assert.equal(isDueNow({ dueLabel: 'Overdue by 2 days' }), true)
  assert.equal(isDueNow({ dueLabel: 'Due tomorrow' }), false, 'tomorrow isn’t accented')
  assert.equal(isDueNow({ dueLabel: 'Due in 7 days', dueBucket: 'week' }), false)
  const list = [
    { ...base, id: 'decide-late', reviewStage: 'detected' },
    { ...base, id: 'decide-today', reviewStage: 'detected', dueLabel: 'Due today' },
    { ...base, id: 'decide-blocked', reviewStage: 'detected' },
    { ...base, id: 'done', reviewStage: 'resolved' },
    { ...base, id: 'review', reviewStage: 'in_review', dueLabel: 'Due tomorrow' },
    { ...base, id: 'merge', reviewStage: 'approved' },
    { ...base, id: 'reason', reviewStage: 'detected', decidedSide: 'B', dueLabel: 'Due tomorrow' },
  ]
  const groups = taskGroups(list, { userId: 'me', isBlocked: (conflict) => conflict.id === 'decide-blocked' })
  assert.deepEqual(groups.decide.map((entry) => entry.conflict.id), ['decide-blocked', 'decide-today', 'decide-late'], 'can’t merge first, then by due date')
  assert.deepEqual(groups.review.map((entry) => entry.conflict.id), ['review'])
  assert.deepEqual(groups.continue.map((entry) => entry.conflict.id), ['reason', 'merge'], 'the most pressing unfinished work leads; a merge that’s left counts as work left')
  assert.equal(groups.decide[0].blocked, true)
  assert.equal(remainingWorkOf(list[6]), 'A reason is still needed')
  assert.equal(remainingWorkOf({ ...list[6], deviation: { text: 'Agreed' } }), 'The review request is still left')
  assert.equal(remainingWorkOf(list[5]), 'Only the merge is left')
  assert.deepEqual(Object.values(taskGroups([{ ...base, reviewStage: 'resolved' }], { userId: 'me' })).flat(), [])

  const { translateText } = await server.ssrLoadModule('/src/i18n/translate.js')
  assert.deepEqual(Object.values(TASK_LABEL).map((label) => translateText(label, 'ko')), ['충돌 검토하기', '요청 검토하기', '이어서 하기', '병합하기'])
  assert.equal(translateText('Nothing to do right now', 'ko'), '지금 처리할 일이 없어요')
  assert.equal(translateText('A reason is still needed', 'ko'), '이유 입력이 남았어요')
  await server.ssrLoadModule('/src/components/dashboard/MyTasks.jsx')
  console.log('Passed: task labels by state, the three groups and their order (can’t merge → due soonest), what’s left on unfinished work, and Korean labels.')
} finally { await server.close() }
