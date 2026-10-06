import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { TASK_LABEL, taskFor, myTasks, isDueSoon } = await server.ssrLoadModule('/src/lib/conflicts.js')
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

  assert.equal(isDueSoon({ dueLabel: 'Due tomorrow' }), true)
  assert.equal(isDueSoon({ dueLabel: 'Due in 7 days', dueBucket: 'week' }), false)
  const list = [
    { ...base, id: 'rest', reviewStage: 'detected' },
    { ...base, id: 'blocked', reviewStage: 'detected' },
    { ...base, id: 'done', reviewStage: 'resolved' },
    { ...base, id: 'due', reviewStage: 'in_review', dueLabel: 'Due today', dueBucket: 'today' },
    { ...base, id: 'rest-2', reviewStage: 'approved' },
  ]
  const ordered = myTasks(list, { userId: 'me', isBlocked: (conflict) => conflict.id === 'blocked' })
  assert.deepEqual(ordered.map((entry) => entry.conflict.id), ['due', 'blocked', 'rest', 'rest-2'], 'due soon, then can’t merge, then the rest in their own order')
  assert.equal(ordered[1].blocked, true)
  assert.deepEqual(myTasks([{ ...base, reviewStage: 'resolved' }], { userId: 'me' }), [])

  const { translateText } = await server.ssrLoadModule('/src/i18n/translate.js')
  assert.deepEqual(Object.values(TASK_LABEL).map((label) => translateText(label, 'ko')), ['충돌 검토하기', '요청 검토하기', '이어서 하기', '병합하기'])
  assert.equal(translateText('Nothing to do right now', 'ko'), '지금 처리할 일이 없어요')
  await server.ssrLoadModule('/src/components/dashboard/MyTasks.jsx')
  console.log('Passed: task labels by state, priority order (due soon → can’t merge → rest), empty list and Korean labels.')
} finally { await server.close() }
