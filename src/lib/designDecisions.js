// The words of a design decision (a `decisionFlow` conflict, e.g. CON-002),
// shared by the workspace's actions and the review's DesignDecisionFlow.
export const DECISION_LABEL = { keep: '원안 유지', approve: '변경 승인', rework: '재검토 요청' }
export const TIMING_LABEL = { now: '지금', 'before-release': '출시 전', 'next-version': '다음 버전' }
export const PROPOSAL_LABEL = { 'one-column': '1열로 변경', 'narrow-cards': '2열 유지 · 카드 폭 줄이기', other: '다른 수정안' }
export const DEV_STAGE_LABEL = { early: '개발 초기', mid: '개발 중간', late: '완료 직전' }
// How long the scripted designer takes to answer the developer's request.
export const DECISION_REPLY_MS = 6000

// Where a design decision stands, for both sides of it.
export function decisionStageOf(conflict) {
  if (!conflict) return null
  if (conflict.reviewStage === 'resolved') return 'resolved'
  if (conflict.decisionFix?.verified) return 'verified'
  if (conflict.decisionFix) return 'fixed'
  if (conflict.designDecision?.choice === 'rework') return 'rework'
  if (conflict.designDecision) return 'decided'
  if (conflict.decisionRequest) return 'requested'
  return 'detected'
}
