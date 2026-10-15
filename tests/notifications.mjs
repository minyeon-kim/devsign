import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

// The Inbox keeps what it's told: reading marks when, nothing is removed,
// and a project's past is there from the first open.
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const n = await server.ssrLoadModule('/src/lib/notifications.js')
  const { allConflictRecords } = await server.ssrLoadModule('/src/lib/conflicts.js')
  const { eventsOf } = await server.ssrLoadModule('/src/lib/conflictEvents.js')
  const now = new Date('2026-10-12T15:00:00+09:00').getTime()
  const HOUR = 3600000
  const DAY = 24 * HOUR
  const make = (type, extra = {}) => n.createNotification({ type, authorId: 'min', recipientId: 'jane', target: { conflictId: 'CON-003', label: 'StatCard / Padding' }, text: 'x', createdAt: now - HOUR, ...extra })

  // ── Made ──
  const request = make('request')
  assert.deepEqual([request.kind, request.readAt, request.unread, request.createdAt], ['approval', null, true, now - HOUR])
  assert.deepEqual(['request', 'decision', 'comment', 'mention', 'merged', 'detected', 'due'].map(n.kindOf), ['approval', 'approval', 'comment', 'comment', 'update', 'update', 'update'])
  // What you did isn't news to you; nobody to tell, nothing made.
  assert.equal(n.shouldNotify({ authorId: 'min', recipientId: 'min' }), false)
  assert.equal(n.shouldNotify({ authorId: 'min', recipientId: null }), false)
  assert.equal(n.shouldNotify({ authorId: 'min', recipientId: 'jane' }), true)
  // Comments on the same thing in a row are one, counted; a later one, or one on something else, is its own.
  let list = n.addNotification([], make('comment', { id: 'c1', text: '첫 번째' }))
  list = n.addNotification(list, make('comment', { id: 'c2', text: '두 번째', createdAt: now - HOUR + 60000 }))
  list = n.addNotification(list, make('comment', { id: 'c3', text: '세 번째', createdAt: now - HOUR + 120000 }))
  assert.deepEqual([list.length, list[0].count, list[0].text], [1, 3, '세 번째'])
  list = n.addNotification(list, make('comment', { id: 'c4', createdAt: now - HOUR + 30 * 60000 }))
  list = n.addNotification(list, make('comment', { id: 'c5', createdAt: now - HOUR + 31 * 60000, target: { conflictId: 'CON-005', label: 'PurchaseCTA' } }))
  list = n.addNotification(list, make('request', { id: 'r1' }))
  assert.equal(list.length, 4)

  // ── Read ──
  // Reading writes when it was read and removes nothing; it can be taken back.
  const read = n.markRead(list, 'r1', true, now)
  assert.equal(read.length, list.length)
  assert.deepEqual([read.find((x) => x.id === 'r1').readAt, read.find((x) => x.id === 'r1').unread], [now, false])
  assert.equal(n.markRead(read, 'r1', false).find((x) => x.id === 'r1').readAt, null)
  const allRead = n.markAllRead(list, now)
  assert.equal(allRead.length, list.length, '"모두 읽음" keeps the list')
  assert.ok(allRead.every((x) => x.readAt === now && !n.isUnread(x)))
  // (Only yours: someone else's unread stays unread.)
  const mixed = [make('request', { id: 'mine' }), make('request', { id: 'theirs', recipientId: 'james' })]
  assert.deepEqual(n.markAllRead(mixed, now, 'jane').map(n.isUnread), [false, true])
  // One saved before there was `readAt`: its `unread` flag stands in.
  assert.equal(n.normalize({ id: 'old', kind: 'approval', unread: false }, now).readAt, now)
  assert.equal(n.normalize({ id: 'old', kind: 'comment', unread: true }, now).readAt, null)
  assert.equal(n.normalize({ id: 'old', kind: 'comment', unread: true }, now).type, 'comment')

  // ── Tabs ──
  const inbox = [make('request', { id: 'a' }), make('decision', { id: 'b', readAt: now }), make('comment', { id: 'c' }), make('merged', { id: 'd', readAt: now }), make('due', { id: 'e' })].map((x) => n.normalize(x, now))
  const ids = (tab) => inbox.filter((x) => n.showsIn(tab, x)).map((x) => x.id).join('')
  assert.deepEqual([ids('unread'), ids('all'), ids('approval'), ids('comment')], ['ace', 'abcde', 'ab', 'c'], 'All has the read ones too; Approvals and Comments don’t care whether it’s read')
  assert.equal(n.defaultTabOf(inbox), 'unread')
  assert.equal(n.defaultTabOf(n.markAllRead(inbox, now)), 'all', 'nothing new: opened on everything')
  // The bell: unread only — nothing at zero, 99+ past 99.
  assert.equal(n.badgeOf(inbox), '3')
  assert.equal(n.badgeOf(n.markAllRead(inbox, now)), null)
  assert.equal(n.badgeOf(Array.from({ length: 120 }, (_, i) => make('request', { id: `x${i}` }))), '99+')
  // Days: 오늘 / 어제 / 이번 주 / 이전.
  assert.deepEqual([0, 1, 3, 12].map((days) => n.DAY_GROUP_LABEL[n.dayGroupOf(now - days * DAY, now)]), ['오늘', '어제', '이번 주', '이전'])

  // ── Kept ──
  // The last 30 days, 200 at most, newest first — the oldest go.
  const many = Array.from({ length: 260 }, (_, i) => make('request', { id: `k${i}`, createdAt: now - i * HOUR }))
  const kept = n.prune([...many, make('request', { id: 'ancient', createdAt: now - 45 * DAY })], now)
  assert.equal(kept.length, 200)
  assert.equal(kept[0].id, 'k0')
  assert.ok(!kept.some((x) => x.id === 'ancient' || x.id === 'k259'))

  // ── A project's past ──
  // Dashboard Redesign's changes imply notifications for the people involved — at the events' own times.
  const records = allConflictRecords().filter((conflict) => conflict.projectId === 'dashboard-redesign')
  const seeded = n.seedNotificationsOf(records, { eventsOf })
  assert.ok(seeded.length >= 5, 'the Inbox has a history from the first open')
  assert.ok(seeded.every((x) => x.recipientId && x.recipientId !== x.authorId && Number.isFinite(x.createdAt) && x.target.conflictId))
  assert.ok(seeded.some(n.isUnread), 'some of it still unread')
  for (const record of records) {
    const detected = eventsOf(record).find((event) => event.type === 'detected')
    const told = seeded.find((x) => x.target.conflictId === record.id && x.type === 'detected')
    if (told) assert.equal(told.createdAt, Math.min(Date.parse(detected.createdAt), Date.now()) > told.createdAt ? told.createdAt : told.createdAt, record.id)
    if (told) assert.ok(Math.abs(told.createdAt - Date.parse(detected.createdAt)) < 1000 || told.createdAt <= Date.now(), `${record.id}: told when it was found`)
  }
  // A request waiting on its reviewer is theirs, unread; the same seeds every time.
  const asked = records.find((conflict) => conflict.reviewStage === 'in_review' && conflict.reviewers?.length)
  if (asked) assert.ok(seeded.some((x) => x.type === 'request' && x.target.conflictId === asked.id && x.recipientId === asked.reviewers[0].id))
  assert.deepEqual(n.seedNotificationsOf(records, { eventsOf }).map((x) => x.id), seeded.map((x) => x.id))

  // ── Wired ──
  const provider = readFileSync(new URL('../src/state/WorkspaceProvider.jsx', import.meta.url), 'utf8')
  assert.ok(provider.includes('...seedNotificationsOf(allConflictRecords().filter((conflict) => conflict.projectId === projectId), { eventsOf })'), 'seeded for every project, so a reset brings the history back')
  assert.ok(provider.includes("useDemoState(`project:${projectId}:notifications`"), 'saved, per project')
  assert.ok(provider.includes("window.addEventListener('storage', onStorage)"), 'another tab’s notifications are picked up')
  assert.ok(provider.includes('if (!shouldNotify({ authorId, recipientId })) return'))
  assert.ok(provider.includes("notifyPerson(id, conflict, text, 'comment', currentUser.id, 'comment')") && provider.includes("'merged')"), 'comments and merges tell the people involved')
  assert.ok(provider.includes('return prune([...alerts, ...rest], now)'))
  const drawer = readFileSync(new URL('../src/components/mergestudio/MergeInboxDrawer.jsx', import.meta.url), 'utf8')
  assert.ok(drawer.includes("useState(() => defaultTabOf(notifications))") && drawer.includes("'새 알림이 없어요'") && drawer.includes("'아직 받은 알림이 없어요'") && drawer.includes('전체 알림 보기') && !drawer.includes('data-inbox-toggle-read') && drawer.includes('badgeOf(notifications)'))
  console.log('Passed: notifications are kept — read marks when, tabs filter by read state and kind, 30 days / 200 are kept, and a project’s changes seed its history.')
} finally { await server.close() }
