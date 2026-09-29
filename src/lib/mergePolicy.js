// Shared by Conflict Point and Merge Studio's final merge actions.
export function mergeBlockReason({ conflicts = [], item, lines = [] }) {
  if (item?.tag === 'Merged' || (conflicts.length && conflicts.every((c) => c.reviewStage === 'resolved'))) return 'This change is already merged.'
  if (conflicts.length) {
    if (conflicts.some((c) => c.reviewStage !== 'approved' || !c.reviewers?.length || c.reviewers.some((r) => r.status !== 'approved'))) {
      return 'Every required reviewer has to approve the latest changes first.'
    }
  } else if (!item?.reviewers?.length || item.reviewers.some((r) => r.status !== 'approved')) {
    return 'Every required reviewer has to approve the latest changes first.'
  }
  if (item?.conflictLevel && item.conflictLevel !== 'None') return 'Resolve the conflicting blocks in Merge Studio’s Check step first.'
  if (lines.some((line) => /^(<<<<<<<|=======|>>>>>>>)(?:\s|$)/.test(line))) return 'Unresolved conflict markers remain in the code.'
  return null
}
