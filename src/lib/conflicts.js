import { allPeople, conflictChecklist, currentUserFor } from '@/data/mockData'

// The one conflict model every conflict surface shares — the Dashboard
// queue, the workspace bottom panel's Conflict Points tab, the project
// overview and the ConflictModal review window. All of them read the same
// records (from the app-level ConflictStore) and derive status, "who needs
// to do what" and counts with the helpers below, so no screen keeps its own
// copy or its own rules.
//
// Two things are kept apart on purpose:
//   · risk (`severity`: low / medium / high) — how much the change matters;
//   · processing status (`reviewStage`) — where it is in review and merge.
//
// The approval policy is the existing one: a Conflict Point's `reviewers`
// are its required approvers; it becomes Approved when every one of them
// has approved; approving never merges — merging (applying the change,
// `reviewStage: 'resolved'`) is its own later step.

export const REVIEW_STAGES = [
  { id: 'detected', label: 'Detected' },
  { id: 'in_review', label: 'In review' },
  { id: 'approved', label: 'Approved' },
  { id: 'resolved', label: 'Merged' },
]

// Processing status, as shown in lists.
export const STAGE_LABEL = {
  detected: 'Review not requested',
  in_review: 'Awaiting review',
  approved: 'Approved · Pending merge',
  resolved: 'Merged',
}

export const STAGE_DOT_CLASS = {
  detected: 'bg-muted-foreground/40',
  in_review: 'bg-sky-400',
  approved: 'bg-emerald-400',
  resolved: 'bg-primary',
}

export const RISK_LABEL = { low: 'Low', medium: 'Medium', high: 'High' }

export function isOpen(conflict) {
  return conflict.reviewStage !== 'resolved'
}

export function isPendingMerge(conflict) {
  return conflict.reviewStage === 'approved'
}

export function allReviewersApproved(conflict) {
  const reviewers = conflict.reviewers ?? []
  return reviewers.length > 0 && reviewers.every((r) => r.status === 'approved')
}

// Every helper below takes an optional `userId` — omit it and it resolves
// the viewer itself from the conflict's own project (`currentUserFor`), so
// "needs your review" reads correctly for both a single project's screens
// and a cross-project list (the Dashboard queue) without either passing an
// explicit id.
function viewerIdFor(conflict, userId) {
  return userId ?? currentUserFor(conflict?.projectId).id
}

export function reviewerFor(conflict, userId) {
  return (conflict.reviewers ?? []).find((r) => r.id === viewerIdFor(conflict, userId)) ?? null
}

// "Needs your review": you're one of its required approvers, it's in
// review, and you haven't approved (or requested changes) yet.
export function needsReviewFrom(conflict, userId) {
  return conflict.reviewStage === 'in_review' && reviewerFor(conflict, userId)?.status === 'pending'
}

function nameOf(id, viewerId) {
  if (id === viewerId) return 'you'
  return allPeople.find((p) => p.id === id)?.name ?? id
}

function joinNames(ids, viewerId) {
  const names = ids.map((id) => nameOf(id, viewerId))
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}

// The approval / merge status as short, direct lines ("Approved by you",
// "Waiting for Min", "All required approvals received", "Pending merge",
// "Merged") — from the actual reviewers, never an assumed rule.
export function approvalStatus(conflict, userId) {
  const viewerId = viewerIdFor(conflict, userId)
  const reviewers = conflict.reviewers ?? []
  const mine = reviewerFor(conflict, viewerId)
  if (conflict.reviewStage === 'resolved') {
    return { tone: 'done', lines: ['Merged'] }
  }
  if (conflict.reviewStage === 'approved') {
    return { tone: 'ready', lines: ['All required approvals received', 'Pending merge'] }
  }
  if (conflict.reviewStage === 'detected') {
    return {
      tone: 'idle',
      lines: [reviewers.length ? 'Review not requested yet' : 'No reviewers assigned'],
    }
  }
  const lines = []
  if (mine?.status === 'pending') lines.push('Your approval is needed')
  if (mine?.status === 'approved') lines.push('Approved by you')
  if (mine?.status === 'changes_requested') lines.push('You requested changes')
  const changes = reviewers.filter((r) => r.status === 'changes_requested' && r.id !== viewerId).map((r) => r.id)
  if (changes.length) lines.push(`Changes requested by ${joinNames(changes, viewerId)}`)
  const waiting = reviewers.filter((r) => r.status === 'pending' && r.id !== viewerId).map((r) => r.id)
  if (waiting.length) lines.push(`Waiting for ${joinNames(waiting, viewerId)}`)
  return { tone: mine?.status === 'pending' ? 'action' : 'waiting', lines }
}

// The next thing that has to happen, and whether it's on you.
export function nextActionFor(conflict, userId) {
  const viewerId = viewerIdFor(conflict, userId)
  if (conflict.reviewStage === 'resolved') return { label: 'Merged', mine: false }
  if (conflict.reviewStage === 'approved') return { label: 'Merge the approved change', mine: false }
  if (conflict.reviewStage === 'detected') {
    return { label: conflict.reviewers?.length ? 'Request review' : 'Assign reviewers', mine: false }
  }
  if (needsReviewFrom(conflict, viewerId)) return { label: 'Review and approve', mine: true }
  const waiting = (conflict.reviewers ?? []).filter((r) => r.status === 'pending').map((r) => r.id)
  return { label: waiting.length ? `Waiting for ${joinNames(waiting, viewerId)}` : 'Waiting on changes', mine: false }
}

// Normalizes a raw conflict (a conflictChecklist item or a workspace
// conflict point like paddingConflict) into the shared record.
export function toConflictRecord(raw) {
  const reviewStage = raw.reviewStage ?? (raw.resolved ? 'resolved' : 'detected')
  return {
    ...raw,
    title: raw.title ?? raw.token ?? raw.file,
    detectedAt: raw.detectedAt ?? raw.timestamp,
    reviewStage,
    reviewers: raw.reviewers ?? [],
    assigneeId: raw.assigneeId ?? raw.reviewers?.[0]?.id,
    diffInspected: raw.diffInspected ?? reviewStage === 'resolved',
  }
}

// Every project's conflicts, as records (the ConflictStore's seed).
export function allConflictRecords() {
  return conflictChecklist.map(toConflictRecord)
}

// Open items first, then merged ones, each group in its original order.
export function sortOpenFirst(conflicts) {
  return [...conflicts].sort((a, b) => Number(!isOpen(a)) - Number(!isOpen(b)))
}

// Counts every screen shows, from one set of rules (so a list, its total
// and its status breakdown can never disagree).
export function conflictCounts(conflicts, userId) {
  return {
    total: conflicts.length,
    open: conflicts.filter(isOpen).length,
    needsMyReview: conflicts.filter((c) => needsReviewFrom(c, userId)).length,
    awaitingReview: conflicts.filter((c) => c.reviewStage === 'in_review').length,
    notRequested: conflicts.filter((c) => c.reviewStage === 'detected').length,
    pendingMerge: conflicts.filter(isPendingMerge).length,
    merged: conflicts.filter((c) => c.reviewStage === 'resolved').length,
    highOpen: conflicts.filter((c) => isOpen(c) && c.severity === 'high').length,
  }
}
