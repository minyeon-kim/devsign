import { authorOf, allReviewersApproved } from '@/lib/conflicts'

// UT teammates respond to a request; the active participant and author never auto-approve.
export function scheduleDemoReview(conflict, viewerId, ids = null, now = Date.now()) {
  if (conflict.reviewStage !== 'in_review') return conflict
  let index = 0
  return { ...conflict, reviewers: conflict.reviewers.map(reviewer => {
    if (reviewer.id === viewerId || reviewer.id === authorOf(conflict) || reviewer.status !== 'pending' || (ids && !ids.includes(reviewer.id))) return reviewer
    return { ...reviewer, demoApproveAt: now + 4000 + index++ * 2000 }
  }) }
}

export function applyDueDemoReviews(conflict, viewerId, now = Date.now()) {
  if (conflict.reviewStage !== 'in_review') return conflict
  let changed = false
  const reviewers = conflict.reviewers.map(reviewer => {
    if (reviewer.id === viewerId || reviewer.id === authorOf(conflict) || reviewer.status !== 'pending' || !reviewer.demoApproveAt || reviewer.demoApproveAt > now) return reviewer
    changed = true
    return { ...reviewer, status: 'approved', demoApproveAt: undefined }
  })
  if (!changed) return conflict
  const next = { ...conflict, reviewers }
  return { ...next, reviewStage: allReviewersApproved(next) ? 'approved' : 'in_review' }
}
