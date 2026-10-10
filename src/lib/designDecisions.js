// The words of a design decision (a `decisionFlow` conflict, e.g. CON-002),
// shared by the workspace's actions and the review's DesignDecisionFlow.
export const DECISION_LABEL = { keep: '원안 유지', approve: '변경 승인', rework: '재검토 요청' }
export const TIMING_LABEL = { now: '지금', 'before-release': '출시 전', 'next-version': '다음 버전' }
export const PROPOSAL_LABEL = { 'one-column': '1열로 변경', 'narrow-cards': '2열 유지 · 카드 폭 줄이기', other: '다른 수정안' }
export const DEV_STAGE_LABEL = { early: '개발 초기', mid: '개발 중간', late: '완료 직전' }

// What the developer is asked for depends on how far along the work is:
// early on the change is wide and free-form (what, why, what for); in the
// middle it's about cost and impact (how important, what it touches, can it
// land now); near the end it's about the release (what kind of problem it
// is, so must-fix and later-improvement are told apart).
export const SEVERITY_LABEL = { high: '높음', medium: '보통', low: '낮음' }
export const CATEGORY_LABEL = { bug: '기능 오류', visual: '사용에 큰 영향', polish: '단순 개선' }
export const CAN_APPLY_LABEL = { now: '지금 반영할 수 있어요', later: '다음 작업으로 미뤄야 해요' }
export const REQUEST_FIELD_LABEL = {
  target: '변경 대상', reason: '변경 사유', expected: '기대 결과', severity: '중요도', affected: '영향받는 화면·기능',
  canApplyNow: '지금 반영 가능 여부', category: '분류', attachment: '구현 화면', timing: '희망 반영 시점',
}
// The fields that must be filled before a request can be sent, per stage.
// (The hope for when it lands is asked of every stage.)
export const REQUIRED_BY_STAGE = {
  early: ['target', 'reason', 'expected', 'timing'],
  mid: ['severity', 'reason', 'affected', 'canApplyNow', 'timing'],
  late: ['category', 'reason', 'attachment', 'timing'],
}
export const STAGE_GUIDE = {
  early: '수정 범위가 넓어요. 무엇을 왜 바꾸고, 어떻게 되길 바라는지 적어 주세요.',
  mid: '수정 비용과 영향을 확인해요. 지금 반영할지, 다음 작업으로 미룰지 판단할 수 있게 적어 주세요.',
  late: '필수 수정과 후속 개선을 구분해요. 출시 전에 꼭 반영할 사항인지 골라 주세요.',
}
// When it should land, if the stage (and, near the end, the kind of problem)
// already says. The developer can change it; nothing is forced.
export function defaultTimingFor(stage, category) {
  if (stage === 'early') return 'now'
  if (stage === 'late') return category === 'polish' ? 'next-version' : category ? 'before-release' : null
  return null
}
export const TIMING_HINT = {
  early: '초기에는 바로 반영하는 편이 비용이 적어요.',
  mid: '지금 반영할 수 있는지 판단할 수 있게 알려 주세요.',
  late: '완료 직전에는 출시 전에 꼭 필요한 수정만 반영하길 권장해요.',
}

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
