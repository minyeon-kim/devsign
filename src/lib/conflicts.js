import { allPeople, conflictChecklist, conflictPoints, currentUserFor } from '@/data/mockData'

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
  { id: 'detected', label: 'Review not requested' },
  { id: 'in_review', label: 'In review' },
  { id: 'approved', label: 'Pending merge' },
  { id: 'resolved', label: 'Merged' },
]

// Processing status, as shown in lists.
export const STAGE_LABEL = {
  detected: 'Review not requested',
  in_review: 'In review',
  approved: 'Pending merge',
  resolved: 'Merged',
}

export const STAGE_DOT_CLASS = {
  detected: 'bg-muted-foreground/40',
  in_review: 'bg-sky-400',
  approved: 'bg-emerald-400',
  resolved: 'bg-primary',
}

export function gitFlowOf(conflict) {
  return conflict.gitFlow ?? conflictChecklist.find(c => c.id === conflict.id)?.gitFlow ?? null
}

// Design compositions share approval records, but are not conflict points.
// Recognize saved requests from before the explicit kind was introduced.
export function isDesignReview(record) {
  if (!record || record.rollback) return false
  return record.kind === 'design-review' || record.id?.startsWith('mr-') || Boolean(record.designDraft ?? conflictChecklist.find(c => c.id === record.id)?.designDraft)
}

export function reviewTabFor(record) {
  return isDesignReview(record) ? 'design-compare' : 'conflict'
}

export function isQueuedConflict(conflict) {
  return !isDesignReview(conflict)
}

// The Conflict Points list is the shared queue for real conflicts and
// design-composition requests. Batch approval only applies to real conflicts.
export function conflictListRecord(conflict) {
  return isQueuedConflict(conflict) || isDesignReview(conflict)
}

export const RISK_LABEL = { low: 'Low', medium: 'Medium', high: 'High' }

export function isOpen(conflict) {
  return conflict.reviewStage !== 'resolved'
}

// A conflict's id as it's shown: "#cc-4". A revert or rollback is created
// under a long unique id, so it's shown as its kind and its place among the
// project's others of that kind — "rv-4" — like every other item.
const GENERATED_ID = /^(revert|rollback)-([0-9a-f]{4})[0-9a-f-]{20,}$/i
export function conflictRef(conflict, conflicts = []) {
  // A merge request made from a mix of drafts is named after its item.
  if (conflict?.id?.startsWith('mr-')) {
    const requests = conflicts.filter((c) => c.projectId === conflict.projectId && c.id.startsWith('mr-'))
    return `mr-${Math.max(1, requests.findIndex((c) => c.id === conflict.id) + 1)}`
  }
  const match = GENERATED_ID.exec(conflict?.id ?? '')
  if (!match) return conflict?.id ?? ''
  const prefix = match[1].toLowerCase() === 'revert' ? 'rv' : 'rb'
  const same = conflicts.filter((c) => c.projectId === conflict.projectId && c.id.toLowerCase().startsWith(`${match[1].toLowerCase()}-`))
  const place = same.findIndex((c) => c.id === conflict.id)
  return `${prefix}-${place >= 0 ? place + 1 : match[2]}`
}

// The one short status a list shows — the same five the list's filter uses.
// A merge and a rollback share "Done"; which it was is in the item's title
// ("Rollback · …"). Anything finer (decided or not, sign-offs so far) is the
// status's hover, not its label.
export const LIST_STATUSES = [
  { id: 'detected', label: 'Review not requested', dot: 'bg-slate-400' },
  { id: 'in_review', label: 'In review', dot: 'bg-sky-400' },
  { id: 'pending_merge', label: 'Pending merge', dot: 'bg-emerald-400' },
  { id: 'pending_rollback', label: 'Pending merge cancellation', dot: 'bg-amber-400' },
  { id: 'done', label: 'Done', dot: 'bg-violet-400' },
]
export function listStatusOf(conflict) {
  const id = conflict.reviewStage === 'resolved'
    ? 'done'
    : conflict.reviewStage === 'approved'
      ? (conflict.rollback ? 'pending_rollback' : 'pending_merge')
      : conflict.reviewStage === 'in_review' ? 'in_review' : 'detected'
  return LIST_STATUSES.find((status) => status.id === id)
}

export function mergeCancellationInfo(conflict, conflicts = []) {
  if (!conflict?.revertOf) return null
  const original = conflicts.find((candidate) => candidate.id === conflict.revertOf)
  const changes = (conflict.comparisonFields ?? [])
    .filter((field) => field.current !== field.expected)
    .map((field) => ({ label: field.label, from: field.current, to: field.expected }))
  return {
    date: original?.resolvedAtLabel ?? original?.timestamp ?? null,
    changes,
  }
}

export function isPendingMerge(conflict) {
  return conflict.reviewStage === 'approved'
}

// The reviewers whose sign-off a change needs: everyone listed except its
// author (who can't review their own change — see authorOf).
export function requiredReviewers(conflict) {
  const author = authorOf(conflict)
  return (conflict.reviewers ?? []).filter((r) => r.id !== author)
}

export function allReviewersApproved(conflict) {
  const required = requiredReviewers(conflict)
  return required.length > 0 && required.every((r) => r.status === 'approved')
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
  const reviewer = reviewerFor(conflict, userId)
  return conflict.reviewStage === 'in_review' && reviewer?.status === 'pending' && reviewer.id !== authorOf(conflict)
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
  const waiting = reviewers.filter((r) => r.status === 'pending' && r.id !== viewerId && r.id !== authorOf(conflict)).map((r) => r.id)
  if (waiting.length) lines.push(`Waiting for ${joinNames(waiting, viewerId)}`)
  return { tone: mine?.status === 'pending' ? 'action' : 'waiting', lines }
}

// The next thing that has to happen, and whether it's on you.
export function nextActionFor(conflict, userId) {
  const viewerId = viewerIdFor(conflict, userId)
  if (conflict.reviewStage === 'resolved') return { label: 'Merged', mine: false }
  if (conflict.reviewStage === 'approved') return { label: 'Merge the approved change', mine: false }
  if (conflict.reviewStage === 'detected') {
    return { label: conflict.reviewers?.length ? 'Request review' : 'Add reviewers', mine: false }
  }
  if (needsReviewFrom(conflict, viewerId)) return { label: 'Review and approve', mine: true }
  const waiting = (conflict.reviewers ?? []).filter((r) => r.status === 'pending').map((r) => r.id)
  return { label: waiting.length ? `Waiting for ${joinNames(waiting, viewerId)}` : 'Waiting on changes', mine: false }
}

// What the viewer has to do on a conflict, named as the action — the one
// label every surface puts on its button (the Dashboard's "My tasks", the
// Conflict list, notifications, the review's header), so a button says
// what pressing it starts instead of repeating a status:
//   · decide   — a conflict with no way chosen yet;
//   · review   — someone asked for your approval;
//   · continue — work of your own is left (a way is chosen but review
//                isn't requested, or changes were requested of you);
//   · merge    — every approval is in; only the merge is left.
// Null when nothing is yours to do (it's waiting on others, or done).
export const TASK_LABEL = {
  decide: 'Review the conflict',
  review: 'Review the request',
  continue: 'Continue your work',
  merge: 'Merge now',
}
export function taskFor(conflict, userId) {
  if (!conflict || !isOpen(conflict)) return null
  const viewerId = viewerIdFor(conflict, userId)
  const task = (kind) => ({ kind, label: TASK_LABEL[kind] })
  if (conflict.reviewStage === 'approved') return task('merge')
  if (needsReviewFrom(conflict, viewerId)) return task('review')
  if (conflict.reviewStage === 'in_review') {
    const changesAsked = requiredReviewers(conflict).some((reviewer) => reviewer.status === 'changes_requested')
    return changesAsked && [authorOf(conflict), conflict.requestedBy].includes(viewerId) ? task('continue') : null
  }
  // Not requested yet. (A design request or a rollback isn't a value to
  // choose: it's only yours once you've started it.)
  const started = Boolean(conflict.decidedSide || conflict.customChosen || conflict.deviation || conflict.adjustmentReason)
  if (started) return task('continue')
  return isDesignReview(conflict) || conflict.rollback ? null : task('decide')
}

// How soon it's due, as a number to sort by: past due first, then today,
// tomorrow, in N days; no due date last.
export function dueRank(conflict) {
  const text = conflict.dueLabel ?? ''
  let match
  if (conflict.dueBucket === 'overdue' || /^Overdue/.test(text)) return -1
  if (conflict.dueBucket === 'today' || /^Due today$/.test(text)) return 0
  if (/^Due tomorrow$/.test(text)) return 1
  if ((match = /^Due in (\d+) days?$/.exec(text))) return Number(match[1])
  return Infinity
}
// Due today or already past — the only due dates worth an accent.
export function isDueNow(conflict) {
  return dueRank(conflict) <= 0
}

// What's left on a task that's "continue" (or only needs merging), in a
// line: a reason still to give, the review still to request, changes to
// answer, the merge itself.
export function remainingWorkOf(conflict) {
  if (conflict.reviewStage === 'approved') return 'Only the merge is left'
  if (conflict.reviewStage === 'in_review') return 'Changes were requested'
  const reasonMissing = (conflict.customChosen && !conflict.adjustmentReason?.text?.trim())
    || (conflict.decidedSide === 'B' && !conflict.deviation?.text?.trim())
  return reasonMissing ? 'A reason is still needed' : 'The review request is still left'
}

// The viewer's tasks across `conflicts`, in the three groups the Dashboard
// shows: work of your own that's left (`continue` — a merge that's the
// only thing left counts here), conflicts with a value to choose
// (`decide`), and approvals asked of you (`review`). Within a group: ones
// that can't merge as they stand (`isBlocked`) first, then by how soon
// they're due — otherwise in their original order.
export function taskGroups(conflicts, { isBlocked = () => false, userId } = {}) {
  const groups = { continue: [], decide: [], review: [] }
  conflicts.forEach((conflict, index) => {
    const task = taskFor(conflict, userId)
    if (!task) return
    groups[task.kind === 'merge' ? 'continue' : task.kind].push({ conflict, task, blocked: Boolean(isBlocked(conflict)), index })
  })
  for (const list of Object.values(groups)) {
    list.sort((a, b) => Number(b.blocked) - Number(a.blocked) || dueRank(a.conflict) - dueRank(b.conflict) || a.index - b.index)
  }
  return groups
}

// How a due date reads and how urgent it is: today, tomorrow and overdue
// are "danger", up to 3 days out is "warn", the rest "muted" — each with its
// own words ("Due today" / "Due tomorrow" / "D-3" / "D-7"), so the level is
// never carried by color alone. Null when there's no due date.
export function dueUrgency(conflict) {
  const rank = dueRank(conflict)
  if (!Number.isFinite(rank)) return null
  if (rank < 0) return { level: 'danger', text: conflict.dueLabel }
  if (rank === 0) return { level: 'danger', text: 'Due today' }
  if (rank === 1) return { level: 'danger', text: 'Due tomorrow' }
  return { level: rank <= 3 ? 'warn' : 'muted', text: `D-${rank}` }
}

// Which task leads the Dashboard, in this order:
//   1. due within 24 hours (today, tomorrow, or already overdue);
//   2. work already in progress (a `continue` or `merge` task);
//   3. anything else — the one due soonest.
// Within a tier: the soonest due first, then the original order.
export const HERO_DUE_WINDOW = 1 // dueRank: 0 = today, 1 = tomorrow
export function heroTier(entry) {
  if (dueRank(entry.conflict) <= HERO_DUE_WINDOW) return 1
  return entry.task.kind === 'continue' || entry.task.kind === 'merge' ? 2 : 3
}
export function byDue(a, b) {
  return dueRank(a.conflict) - dueRank(b.conflict) || a.index - b.index
}
export function pickHero(entries) {
  return [...entries].sort((a, b) => heroTier(a) - heroTier(b) || byDue(a, b))[0] ?? null
}
// My tasks, laid out: the hero, then everything else by due date — the hero
// is never among them — with only the first `limit` showing until it's
// expanded. `hidden` is how many are behind "+N" (0: nothing to expand).
export function taskListOf(entries, { limit, expanded = false } = {}) {
  const hero = pickHero(entries)
  const rest = entries.filter((entry) => entry !== hero).sort(byDue)
  const collapsible = Number.isFinite(limit) && rest.length > limit
  return {
    hero,
    rest,
    visible: collapsible && !expanded ? rest.slice(0, limit) : rest,
    hidden: collapsible ? rest.length - limit : 0,
  }
}

// Normalizes a raw conflict (a conflictChecklist item or a workspace
// conflict point like paddingConflict) into the shared record.
export function toConflictRecord(raw) {
  const reviewStage = raw.reviewStage ?? (raw.resolved ? 'resolved' : 'detected')
  const defaultDue = raw.severity === 'high'
    ? { dueBucket: 'today', dueLabel: 'Due today' }
    : raw.severity === 'low'
      ? { dueBucket: 'week', dueLabel: 'Due in 7 days' }
      : { dueBucket: 'soon', dueLabel: 'Due tomorrow' }
  return {
    ...raw,
    preview: raw.preview ?? conflictChecklist.find((seed) => seed.id === raw.id)?.preview,
    // (A title saved with the prefix stacked reads as one.)
    title: raw.rollback
      ? raw.rollback.component ?? String(raw.rollback.target ?? raw.title ?? raw.file ?? '').replace(/\.[a-z]+$/i, '').replace(/^Rollback · /, '')
      : (raw.title ?? raw.token ?? raw.file)?.replace(/^(?:Revert: )+/, ''),
    // Records saved before the samples named their authors pick them up.
    changedBy: raw.changedBy ?? conflictChecklist.find((seed) => seed.id === raw.id)?.changedBy,
    // …their details (components, files)…
    impact: raw.impact?.components?.length ? raw.impact : conflictChecklist.find((seed) => seed.id === raw.id)?.impact ?? raw.impact,
    // …and so do the registered reasons (lib/rationale) the samples carry.
    ...Object.fromEntries(['ruleIds', 'purpose', 'decidedSide', 'decidedBy', 'deviation', 'adjustmentReason']
      .filter((key) => raw[key] === undefined)
      .map((key) => [key, conflictChecklist.find((seed) => seed.id === raw.id)?.[key]])
      .filter(([, value]) => value !== undefined)),
    detectedAt: raw.detectedAt ?? raw.timestamp,
    reviewStage,
    reviewers: raw.reviewers ?? [],
    assigneeId: raw.assigneeId ?? raw.reviewers?.[0]?.id,
    diffInspected: raw.diffInspected ?? reviewStage === 'resolved',
    dueBucket: raw.dueBucket ?? defaultDue.dueBucket,
    dueLabel: raw.dueLabel ?? defaultDue.dueLabel,
  }
}

// A due date as just the when ("In 2 days", "Tomorrow") — the column or
// clock icon beside it already says it's a due date. Null for none.
export function shortDue(label) {
  const text = String(label ?? '')
  let match
  if ((match = /^Due in (\d+) days?$/.exec(text))) return `In ${match[1]} day${match[1] === '1' ? '' : 's'}`
  if ((match = /^Overdue by (\d+) days?$/.exec(text))) return `${match[1]} day${match[1] === '1' ? '' : 's'} overdue`
  if (/^Due tomorrow$/.test(text)) return 'Tomorrow'
  if (/^Due today$/.test(text)) return 'Today'
  if (!text || /^No due date$/.test(text)) return null
  return text
}

// Every project's conflicts, as records (the ConflictStore's seed).
export function allConflictRecords() {
  return [...conflictChecklist, ...conflictPoints.map((point) => ({
    ...point,
    id: point.id === 'conflict-1' ? 'cc-2' : point.id,
    kind: 'code-conflict',
    title: 'DesignCanvas / Merge conflict',
    projectId: 'checkout-redesign',
    projectName: 'Checkout Redesign',
    cause: point.message,
    line: 9,
    gitFlow: { source: point.branches.local, target: point.branches.remote },
    comparisonFields: [],
  }))].map(toConflictRecord)
}

// Open items first, then merged ones, each group in its original order.
export function sortOpenFirst(conflicts) {
  return [...conflicts].sort((a, b) => Number(!isOpen(a)) - Number(!isOpen(b)))
}

// Counts every screen shows, from one set of rules (so a list, its total
// and its status breakdown can never disagree).
export function conflictCounts(conflicts, userId) {
  conflicts = conflicts.filter(isQueuedConflict)
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

// The person who made a change — who a review decision goes to, and who
// can't review it themselves. A person's change, or an AI draft someone
// applied (older records note the requester in `changedBy.what`). Null
// for an AI change nobody applied: there's no person to notify or bar.
export function authorOf(conflict) {
  const changedBy = conflict?.changedBy
  if (!changedBy) return null
  if (changedBy.type === 'person') return changedBy.id ?? null
  if (changedBy.type === 'ai' && !conflict.applicationMode) {
    return allPeople.find((person) => changedBy.what?.includes(`(requested by ${person.name} in AI chat)`))?.id ?? null
  }
  return null
}

// Preserve saved review progress while introducing missing code-conflict records.
export function restoreCodeConflicts(records) {
  const known = new Set(records.map((record) => record.id))
  return [...records, ...allConflictRecords().filter((record) => record.kind === 'code-conflict' && !known.has(record.id))]
}
