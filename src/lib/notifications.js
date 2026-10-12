// The Inbox's notifications, as data: what one is, when it counts as read,
// which tab shows it, how long it's kept — and the history a project's
// sample changes imply. Nothing here touches storage or React (the provider
// keeps the list; MergeInboxDrawer draws it).
//
// One notification:
//   { id, type, kind, authorId, recipientId, target: { conflictId?, itemId?, label },
//     text, createdAt (ms), readAt (ms | null), count? }
//   type: request · decision · comment · mention · merged · detected · due
//   kind: the tab it belongs to — approval · comment · update
// Read is `readAt`; nothing is removed by reading. (`unread` is kept beside
// it for the cards and lists that already read it.)

export const NOTIFICATION_TYPES = { request: '승인 요청', decision: '승인 · 반려', comment: '댓글', mention: '멘션', merged: '병합 완료', detected: '변경 감지', due: '마감 임박' }
const KIND_OF = { request: 'approval', decision: 'approval', comment: 'comment', mention: 'comment', merged: 'update', detected: 'update', due: 'update' }
export const kindOf = (type) => KIND_OF[type] ?? 'update'

export const RETENTION_DAYS = 30
export const RETENTION_MAX = 200
const DAY = 86400000

// Your own action never notifies you; nobody to tell, nothing made.
export const shouldNotify = ({ authorId, recipientId }) => Boolean(recipientId) && recipientId !== authorId

let serial = 0
export function createNotification({ id, type, authorId = null, recipientId, target, text, createdAt = Date.now(), readAt = null, ...rest }) {
  serial += 1
  return { id: id ?? `n-${createdAt}-${serial}`, type, kind: kindOf(type), authorId, recipientId, target, text, createdAt, readAt, unread: readAt == null, ...rest }
}

// One saved before there was `readAt` / `createdAt` (a sample, an older
// session): its `unread` flag and the time it's read at stand in.
export function normalize(notification, now = Date.now()) {
  const createdAt = Number.isFinite(notification.createdAt) ? notification.createdAt : now
  const readAt = notification.readAt !== undefined ? notification.readAt : notification.unread === false ? createdAt : null
  const type = notification.type ?? (notification.kind === 'comment' ? 'comment' : notification.notificationType === 'review_request' ? 'request' : notification.kind === 'approval' ? 'decision' : 'detected')
  return { ...notification, type, kind: notification.kind ?? kindOf(type), createdAt, readAt, unread: readAt == null }
}
export const isUnread = (notification) => notification.readAt == null && notification.unread !== false

// Reading only writes when it was read; marking unread clears it.
export function markRead(list, id, read = true, now = Date.now()) {
  return list.map((notification) => (notification.id !== id ? notification : { ...notification, readAt: read ? notification.readAt ?? now : null, unread: !read }))
}
export function markAllRead(list, now = Date.now(), recipientId = null) {
  return list.map((notification) => (isUnread(notification) && (!recipientId || !notification.recipientId || notification.recipientId === recipientId) ? { ...notification, readAt: now, unread: false } : notification))
}

// Kept: the last 30 days, 200 at most — the oldest go first.
export function prune(list, now = Date.now()) {
  return [...list]
    .filter((notification) => !Number.isFinite(notification.createdAt) || now - notification.createdAt <= RETENTION_DAYS * DAY)
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    .slice(0, RETENTION_MAX)
}

// The tabs: Unread is what hasn't been read; All is everything, read or not;
// Approvals and Comments are their kind, read or not.
export const NOTIFICATION_TABS = ['unread', 'all', 'approval', 'comment']
export const showsIn = (tab, notification) => (tab === 'all' ? true : tab === 'unread' ? isUnread(notification) : notification.kind === tab)
// Opened on what's new — or, with nothing new, on everything.
export const defaultTabOf = (list) => (list.some(isUnread) ? 'unread' : 'all')

// The bell: how many are unread — nothing at zero, "99+" past 99.
export function badgeOf(list) {
  const count = list.filter(isUnread).length
  return count === 0 ? null : count > 99 ? '99+' : String(count)
}

// Where one sits in the list: 오늘 / 어제 / 이번 주 / 이전.
export const DAY_GROUP_LABEL = { today: '오늘', yesterday: '어제', week: '이번 주', earlier: '이전' }
export function dayGroupOf(createdAt, now = Date.now()) {
  const start = (ms) => { const date = new Date(ms); date.setHours(0, 0, 0, 0); return date.getTime() }
  const days = Math.round((start(now) - start(createdAt)) / DAY)
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : days < 7 ? 'week' : 'earlier'
}

// Comments on the same thing, one after another: one notification that counts
// them ("댓글 3개"), not a row each. `incoming` joins the newest unread one
// from the same person-to-person thread made within the window.
export const COMMENT_WINDOW_MS = 10 * 60 * 1000
const targetKey = (target) => target?.conflictId ?? target?.itemId ?? target?.label ?? ''
export function addNotification(list, incoming) {
  if (incoming.kind === 'comment') {
    const at = list.findIndex((entry) => entry.kind === 'comment' && isUnread(entry) && entry.recipientId === incoming.recipientId
      && targetKey(entry.target) === targetKey(incoming.target) && incoming.createdAt - entry.createdAt <= COMMENT_WINDOW_MS)
    if (at >= 0) {
      const merged = { ...list[at], count: (list[at].count ?? 1) + 1, text: incoming.text, authorId: incoming.authorId, createdAt: incoming.createdAt }
      return [merged, ...list.filter((_, index) => index !== at)]
    }
  }
  return [incoming, ...list]
}

// ── The history a project's changes imply ────────────────────────────
// From each change's own events (lib/conflictEvents): who was told what,
// when it happened. A step still waiting on its reader is unread; what's
// been acted on since is read, a little after it arrived.
//   eventsOf: (conflict) => events;  nameless system events have no author
export function seedNotificationsOf(conflicts = [], { eventsOf, now = Date.now() } = {}) {
  const made = []
  const push = (conflict, event, type, recipientId, text, { unread = false, suffix = '' } = {}) => {
    const authorId = event.actor?.actorType === 'person' ? event.actor.id : null
    if (!shouldNotify({ authorId, recipientId })) return
    const createdAt = Math.min(Date.parse(event.createdAt), now)
    made.push(createNotification({
      id: `seed:${conflict.id}:${event.type}:${recipientId}${suffix}`, type, authorId, recipientId, text, createdAt,
      readAt: unread ? null : Math.min(createdAt + 5 * 60 * 1000, now),
      target: { conflictId: conflict.id, label: conflict.title }, projectId: conflict.projectId, seeded: true,
    }))
  }
  for (const conflict of conflicts) {
    if (conflict.rollback) continue
    const events = eventsOf(conflict) ?? []
    const reviewers = (conflict.reviewers ?? []).map((reviewer) => reviewer.id)
    const requester = conflict.requestedBy ?? conflict.decisionRequest?.by ?? null
    const owner = conflict.changedBy?.type === 'person' ? conflict.changedBy.id : conflict.assigneeId ?? null
    const open = conflict.reviewStage !== 'resolved'
    const last = events.at(-1)
    for (const event of events) {
      // (Still the latest thing that happened, on a change that's open: nobody has answered it yet.)
      // (From today, that is: yesterday's has been seen by now.)
      const waiting = open && event === last && dayGroupOf(Date.parse(event.createdAt), now) === 'today'
      if (event.type === 'detected') push(conflict, event, 'detected', owner, `변경을 감지했어요 · ${conflict.title}`, { unread: waiting })
      if (event.type === 'requested') for (const id of reviewers) push(conflict, event, 'request', id, `승인을 요청했어요 · ${conflict.title}`, { unread: waiting })
      if (event.type === 'decided') push(conflict, event, 'decision', requester, `${event.payload?.result === 'rejected' ? '수정을 요청했어요' : '승인했어요'} · ${conflict.title}`, { unread: waiting })
      if (event.type === 'commented') for (const id of new Set([...reviewers, requester, owner])) push(conflict, event, 'comment', id, event.payload?.body ?? '댓글을 남겼어요', { unread: waiting })
      if (event.type === 'resolved') for (const id of new Set([...reviewers, requester])) push(conflict, event, 'merged', id, `병합했어요 · ${conflict.title}`)
    }
    // Due tomorrow, still open: told this morning, to whoever it's waiting on.
    if (open && /tomorrow/i.test(conflict.dueLabel ?? '')) {
      const morning = new Date(now); morning.setHours(9, 0, 0, 0)
      const due = { type: 'due', createdAt: new Date(Math.min(morning.getTime(), now)).toISOString(), actor: null }
      for (const id of new Set(conflict.reviewStage === 'in_review' ? reviewers : [owner])) push(conflict, due, 'due', id, `마감이 내일이에요 · ${conflict.title}`, { unread: true })
    }
  }
  return made.sort((a, b) => b.createdAt - a.createdAt)
}
