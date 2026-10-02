import { allReviewersApproved } from './conflicts.js'

// Shared by Conflict Point and Merge Studio's final merge actions.
export function mergeBlockReason({ conflicts = [], item, lines = [] }) {
  if (item?.tag === 'Merged' || (conflicts.length && conflicts.every((c) => c.reviewStage === 'resolved'))) return 'This change is already merged.'
  if (conflicts.length) {
    // An already-resolved conflict (e.g. an earlier merge still linked to
    // this item, with a revert now pending beside it) doesn't need to be
    // re-approved — only the ones still actually in play do.
    if (conflicts.some((c) => c.reviewStage !== 'resolved' && (c.reviewStage !== 'approved' || !allReviewersApproved(c)))) {
      return 'Every required reviewer has to approve the latest changes first.'
    }
  } else if (!item?.reviewers?.length || item.reviewers.some((r) => r.status !== 'approved')) {
    return 'Every required reviewer has to approve the latest changes first.'
  }
  if (lines.some((line) => /^(<<<<<<<|=======|>>>>>>>)(?:\s|$)/.test(line))) return 'Unresolved conflict markers remain in the code.'
  return null
}
