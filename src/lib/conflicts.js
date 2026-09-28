import { conflictChecklist } from '@/data/mockData'

// The one conflict model every conflict surface shares — the activity
// bar's Conflicts drawer, the workspace terminal's Conflict Point tab,
// the dashboard widget, the /conflicts page and the ConflictModal review
// window. Status is always the review stage below; there is no separate
// "resolved" flag or status string.

export const REVIEW_STAGES = [
  { id: 'detected', label: 'Pending' },
  { id: 'in_review', label: 'In Review' },
  { id: 'approved', label: 'Approved' },
  { id: 'resolved', label: 'Resolved' },
]

export const STAGE_LABEL = Object.fromEntries(REVIEW_STAGES.map((s) => [s.id, s.label]))

export const STAGE_DOT_CLASS = {
  detected: 'bg-muted-foreground/40',
  in_review: 'bg-sky-400',
  approved: 'bg-emerald-400',
  resolved: 'bg-primary',
}

export function isOpen(conflict) {
  return conflict.reviewStage !== 'resolved'
}

export function allReviewersApproved(conflict) {
  const reviewers = conflict.reviewers ?? []
  return reviewers.length > 0 && reviewers.every((r) => r.status === 'approved')
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

// Every project's conflicts, as records.
export function allConflictRecords() {
  return conflictChecklist.map(toConflictRecord)
}

// One project's conflicts — what that project's workspace seeds its
// conflict list with, so the drawer and the terminal read the same items.
export function projectConflictRecords(projectId) {
  return allConflictRecords().filter((c) => c.projectId === projectId)
}

// Open items first, then resolved ones, each group in its original order.
export function sortOpenFirst(conflicts) {
  return [...conflicts].sort((a, b) => Number(!isOpen(a)) - Number(!isOpen(b)))
}
