import { mergeBlockReason } from './mergePolicy.js'

export function mergeAction(item, conflicts, userId) {
  const linked = conflicts.filter((c) => c.mergeItemId === item?.id || c.id === item?.conflictId)
  const records = linked.length ? linked.flatMap((c) => c.reviewers ?? []) : item?.reviewers ?? []
  const ids = [...new Set(records.map((r) => r.id))]
  const approved = ids.filter((id) => records.filter((r) => r.id === id).every((r) => r.status === 'approved')).length
  const pending = ids.filter((id) => records.some((r) => r.id === id && r.status !== 'approved'))
  if (item?.tag === 'Merged') return { kind: 'merged', label: 'Merged', disabled: true, linked, pending }
  if (item?.tag !== 'In Review' || linked.some((c) => ['detected', 'changes_requested'].includes(c.reviewStage))) return { kind: 'request', label: 'Request review', linked, pending }
  if (pending.includes(userId)) return { kind: 'approve', label: 'Approve change', linked, pending }
  if (pending.length || !ids.length) return { kind: 'waiting', label: 'Awaiting approval', progress: `${approved}/${ids.length}`, disabled: true, linked, pending }
  const reason = mergeBlockReason({ item, conflicts: linked })
  if (reason) return { kind: 'check', label: 'Continue to Check', reason, linked, pending }
  return { kind: 'merge', label: 'Merge changes', linked, pending }
}
