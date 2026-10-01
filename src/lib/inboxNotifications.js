// Alerts contain only changes still awaiting this user's review.
export function reviewAlerts(conflicts, userId, day) {
  const pending = conflicts.filter(c => c.reviewStage === 'in_review' && c.reviewers?.some(r => r.id === userId && r.status === 'pending'))
  const alerts = pending.filter(c => c.severity === 'high').map(c => ({
    id: `review-high-${c.id}`, kind: 'approval', notificationType: 'review_request', severity: 'high',
    text: `Immediate review · High risk: ${c.title}`, timeLabel: c.createdAtLabel ?? 'Now', unread: true,
    reviewConflictIds: [c.id], target: { conflictId: c.id, label: c.title },
  }))
  const medium = pending.filter(c => c.severity === 'medium')
  if (medium.length) alerts.push({
    id: `review-medium-${day}-${medium.map(c => c.id).sort().join('-')}`, kind: 'approval', notificationType: 'review_request', severity: 'medium',
    text: `Daily digest · ${medium.length} medium change${medium.length === 1 ? '' : 's'} need${medium.length === 1 ? 's' : ''} review`,
    // `day` (an ISO date, so re-digesting the same day doesn't duplicate
    // the alert) is only the id's cache key — showing it as the time would
    // print a raw "2026-10-01" instead of a label the Today/Yesterday
    // translation rule can read.
    timeLabel: 'Today', unread: true, reviewConflictIds: medium.map(c => c.id), target: { label: 'Medium changes awaiting your review' },
  })
  return alerts
}

export function groupInboxNotifications(notifications) {
  const groups = []
  const threads = new Map()
  for (const n of notifications) {
    if (n.kind !== 'comment' && n.kind !== 'feedback') {
      groups.push({ id: n.id, kind: n.kind, text: n.text, severity: n.severity, reviewConflictIds: n.reviewConflictIds, notifications: [n], unread: n.unread, timeLabel: n.timeLabel, target: n.target })
      continue
    }
    const key = n.target.conflictId ?? n.target.itemId ?? n.target.label
    let group = threads.get(key)
    if (!group) {
      group = { id: `comments-${key}`, kind: 'comment', target: n.target, notifications: [], unread: false, timeLabel: n.timeLabel }
      threads.set(key, group)
      groups.push(group)
    }
    group.notifications.push(n)
    group.unread ||= n.unread
  }
  for (const group of threads.values()) {
    group.text = `Comments · ${group.notifications.length} conversation${group.notifications.length === 1 ? '' : 's'}`
  }
  return groups
}

export function commentGroupSummary(group) {
  const notes = group.notifications
  return {
    latest: notes[0],
    comments: notes.filter(n => n.kind === 'comment').length,
    feedback: notes.filter(n => n.kind === 'feedback').length,
    replies: notes.reduce((total, n) => total + (n.replies?.length ?? 0), 0),
  }
}
