// The words of a design decision (a `decisionFlow` conflict, e.g. CON-002),
// shared by the workspace's actions and the review's DesignDecisionFlow.
export const DECISION_LABEL = { keep: '원안 유지', approve: '변경 승인', rework: '재검토 요청' }
export const TIMING_LABEL = { now: '지금', 'before-release': '출시 전', 'next-version': '다음 버전' }
export const PROPOSAL_LABEL = { original: '원안대로 맞추기', 'one-column': '1열로 변경', 'narrow-cards': '2열 유지 · 카드 폭 줄이기', other: '다른 수정안' }
// What the screen is now, said the way a proposal's spec is.
export const IMPLEMENTATION_SPEC = '360px 고정 2열'
// The ways forward a developer can propose. Each draws its own 768px preview
// (columns, and how the card width behaves) and says itself in one line.
export const PROPOSALS = [
  { id: 'original', name: '원안대로 맞추기', spec: '화면 폭 맞춤 2열', columns: 2, widthMode: 'fit' },
  { id: 'one-column', name: '1열로 변경', spec: '768px 이하 카드 1열', columns: 1, widthMode: 'fit' },
  { id: 'narrow-cards', name: '2열 유지 · 카드 폭 줄이기', spec: '2열 · 카드 폭을 줄여 맞춤', columns: 2, widthMode: 'narrow' },
  { id: 'other', name: '다른 수정안', spec: '직접 입력', columns: null, widthMode: null },
]
export const WIDTH_MODE_LABEL = { fixed: '고정', fit: '맞춤' }
// One proposal, fully described — for previews, summaries and the request.
// `custom` is what was typed for 다른 수정안 ({ description, columns, widthMode, reference }).
export function proposalOf(id, custom) {
  const base = PROPOSALS.find((proposal) => proposal.id === id)
  if (!base) return null
  if (id !== 'other') return base
  const columns = custom?.columns ?? null
  const widthMode = custom?.widthMode ?? null
  const parts = [columns && `${columns}열`, widthMode && `카드 폭 ${WIDTH_MODE_LABEL[widthMode]}`].filter(Boolean)
  return { ...base, columns, widthMode, spec: parts.length ? parts.join(' · ') : (custom?.description?.trim() || base.spec), described: Boolean(parts.length || custom?.description?.trim()) }
}
// The reason's suggested wording follows the proposal picked.
export function reasonSuggestionFor(id, custom) {
  if (id === 'original') return '768px에서 360px 고정 카드 2장이 화면 폭을 넘어 겹쳐요. 디자인 원안대로 화면 폭에 맞춘 2열로 되돌리면 해결돼요.'
  if (id === 'one-column') return '768px에서 360px 고정 카드 2장과 간격이 화면 폭을 넘어 카드가 겹쳐요. 태블릿에서는 1열로 쌓는 편이 읽기 쉬워요.'
  if (id === 'narrow-cards') return '768px에서 카드 폭만 줄이면 2열 배치를 그대로 두고도 겹치지 않아요. 디자인 원안의 2열을 최대한 지킬 수 있어요.'
  if (id === 'other') {
    const spec = proposalOf('other', custom)
    const why = custom?.rationale?.trim() || custom?.description?.trim()
    return `768px에서 카드가 겹치는 문제를 ${spec.described ? `${spec.spec}으로` : '제안한 방식으로'} 풀려고 해요. ${why || '이렇게 바꾸는 이유를 적어 주세요.'}`
  }
  return '768px에서 360px 고정 카드 2장과 간격이 화면 폭을 넘어 카드가 겹쳐요. 어떻게 바꾸면 좋을지 수정안을 먼저 골라 주세요.'
}

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
