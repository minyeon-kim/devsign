import { eventsOf, progressOf } from '@/lib/conflictEvents'
// The words of a design decision (a `decisionFlow` conflict, e.g. CON-002),
// shared by the workspace's actions and the review's DesignDecisionFlow.
export const DECISION_LABEL = { keep: '원안 유지', approve: '변경 승인', rework: '재검토 요청' }
export const TIMING_LABEL = { now: '지금', 'before-release': '출시 전', 'next-version': '다음 버전' }
// When an approved change goes in. Approving *is* the start of it — the fix
// and its check run at once — so "now" is the default and is never said.
// Putting it off is the approver's call (not the requester's, who can't
// decide it): only then is there a time to show — "v2.4 출시 전", "다음 버전".
// The field is the decision's (`designDecision.timing`); a request no longer
// carries one (older records that do are read as if they didn't).
export const isDeferred = (decision) => Boolean(decision && decision.choice !== 'rework' && decision.timing && decision.timing !== 'now')
// `release`: the project's next release ({ name, date }), when it has one.
export const scheduleWordOf = (timing, release) => (timing === 'before-release' ? `${release?.name ? `${release.name} ` : ''}출시 전` : timing === 'next-version' ? '다음 버전' : null)
// "v2.4 출시 전 반영 예정" — null when it goes in at once.
export const scheduleOf = (conflict, release) => (isDeferred(conflict?.designDecision) ? `${scheduleWordOf(conflict.designDecision.timing, release)} 반영 예정` : null)
export const PROPOSAL_LABEL = { original: '원안대로 맞추기', 'one-column': '1열로 변경', 'narrow-cards': '2열 유지 · 카드 폭 줄이기', other: '다른 수정안' }
// What the screen is now, said the way a proposal's spec is.
export const IMPLEMENTATION_SPEC = '360px 고정 2열'
// The ways forward a developer can propose. Each carries the values it stands
// for (the same ones 다른 수정안's controls edit), draws its own 768px preview
// from them and says itself in one line.
// values: { columns, cardWidth: { mode: 'fit' | 'fixed', px }, gap, range }
export const PROPOSALS = [
  { id: 'original', name: '원안대로 맞추기', spec: '화면 폭 맞춤 2열', values: { columns: 2, cardWidth: { mode: 'fit' }, range: '~768px' } },
  { id: 'one-column', name: '1열로 변경', spec: '768px 이하 카드 1열', values: { columns: 1, cardWidth: { mode: 'fit' }, range: '~768px' } },
  { id: 'narrow-cards', name: '2열 유지 · 카드 폭 줄이기', spec: '2열 · 카드 폭을 줄여 맞춤', values: { columns: 2, cardWidth: { mode: 'fixed', px: 320 }, range: '~768px' } },
  { id: 'other', name: '다른 수정안', spec: '직접 입력', values: {} },
]
// The controls a conflict offers for 다른 수정안: one per property that
// differs between the design and the code (`conflict.driftProps`, from what
// was detected), each with what the code has now. A conflict that doesn't
// list any gets the layout basics.
const DEFAULT_PROPS = [
  { id: 'columns', label: '열 수', kind: 'choice', options: [1, 2, 3], current: 2, currentText: '현재 2열' },
  { id: 'cardWidth', label: '카드 폭', kind: 'width', current: { mode: 'fixed', px: 360 }, currentText: '현재 360px 고정' },
]
export const controlsOf = (conflict) => conflict?.driftProps ?? DEFAULT_PROPS
// 다른 수정안 shows two of them at once — how many columns, how wide a card —
// and keeps the rest (the gap, where it applies) behind 세부 조정.
export const PRIMARY_CONTROLS = ['columns', 'cardWidth']
// What the code has now, as values: what every control starts from, so no
// field is ever empty.
export const currentValuesOf = (conflict) => Object.fromEntries(controlsOf(conflict).map((control) => [control.id, control.current]))
// Where 다른 수정안 starts the first time it's opened: the code's current
// values, with the preset that was picked just before laid over them — so
// it begins from that way, not from nothing. A fixed width always has a
// number (the preset's, else what the code has).
export function seedValuesFor(conflict, fromProposal) {
  const current = currentValuesOf(conflict)
  const preset = fromProposal && fromProposal !== 'other' ? PROPOSALS.find((proposal) => proposal.id === fromProposal)?.values ?? {} : {}
  const values = { ...current, ...preset }
  if (values.cardWidth?.mode === 'fixed' && !values.cardWidth.px) values.cardWidth = { ...values.cardWidth, px: current.cardWidth?.px ?? null }
  return values
}
const RANGE_LABEL = { '~768px': '768px 이하', '~1024px': '1024px 이하', 전체: '모든 화면' }
// The values as one line: "768px 이하 · 카드 3열 · 화면 맞춤 · 간격 12px".
export function summarizeValues(values = {}) {
  return [
    values.range && RANGE_LABEL[values.range],
    values.columns && `카드 ${values.columns}열`,
    values.cardWidth?.mode === 'fit' ? '화면 맞춤' : values.cardWidth?.mode === 'fixed' ? `폭 ${values.cardWidth.px ? `${values.cardWidth.px}px ` : ''}고정` : null,
    values.gap != null && values.gap !== '' && `간격 ${values.gap}px`,
  ].filter(Boolean).join(' · ')
}
// The values a proposal stands for — a preset's own, or what 다른 수정안 has set.
export const valuesOf = (id, custom) => (id === 'other' ? (custom?.values ?? {}) : PROPOSALS.find((proposal) => proposal.id === id)?.values ?? {})
// One proposal, fully described — for previews, summaries and the request.
// `custom` is what 다른 수정안 holds: { values, note }.
export function proposalOf(id, custom) {
  const base = PROPOSALS.find((proposal) => proposal.id === id)
  if (!base) return null
  const values = valuesOf(id, custom)
  const widthMode = values.cardWidth?.mode === 'fixed' ? (id === 'narrow-cards' ? 'narrow' : 'fixed') : values.cardWidth?.mode ?? null
  const shape = { ...base, values, columns: values.columns ?? null, widthMode, gap: values.gap ?? null }
  if (id !== 'other') return shape
  const summary = summarizeValues(values)
  return { ...shape, spec: summary || custom?.note?.trim() || base.spec, described: Boolean(summary || custom?.note?.trim()) }
}
// Why-it-fits sentences to pick from, made from the way chosen and what was
// detected. They are offered, never filled in.
export function reasonChipsFor(id, custom) {
  const shape = proposalOf(id, custom)
  if (!shape) return []
  const { columns, gap, values } = shape
  const chips = [`${IMPLEMENTATION_SPEC}이라 768px에서 카드가 겹쳐요`]
  if (columns === 1) chips.push('1열로 쌓으면 카드가 겹치지 않고 숫자가 또렷해요', '태블릿에서는 한 줄에 하나씩 보는 편이 읽기 쉬워요')
  else if (columns === 2 && values.cardWidth?.mode === 'fixed') chips.push('2열을 유지해서 한 화면에 보이는 정보가 줄지 않아요', '카드 폭을 줄이면 겹치지 않아요')
  else if (columns === 2) chips.push('디자인 원안과 같은 2열이라 디자인을 바꿀 필요가 없어요')
  else if (columns === 3) chips.push('3열이 한 화면에 가장 많이 보여요', '1열은 스크롤이 길어지고 2열은 카드가 좁아 숫자가 잘려요')
  if (gap != null && gap !== '') chips.push(`간격을 ${gap}px로 하면 카드가 한 줄에 더 들어가요`)
  return chips.slice(0, 3)
}

// ── What was decided, said one way everywhere ───────────────────────
// The banner, the decision card and its summary, the fix's summary, the side
// panel and the History checkpoints all read the decision from here, so none
// of them can say a different thing.
//   the way forward, as a noun phrase: "2열 유지 · 카드 폭 줄이기", "1열 레이아웃"
const PROPOSAL_RESULT = { original: '디자인 원안', 'one-column': '1열 레이아웃', 'narrow-cards': '2열 유지 · 카드 폭 줄이기' }
// A particle after a word, by whether it ends in a final consonant
// ("로" after a vowel or ㄹ, "으로" otherwise; "를" / "을").
function finalConsonant(word) {
  const code = String(word).trim().slice(-1).charCodeAt(0) - 0xAC00
  return code >= 0 && code <= 11171 ? code % 28 : null
}
export const withRo = (word) => `${word}${[null, 0, 8].includes(finalConsonant(word)) && finalConsonant(word) !== null ? '로' : '으로'}`
export const withEul = (word) => `${word}${finalConsonant(word) === 0 ? '를' : '을'}`
export function decisionOutcomeOf(conflict) {
  const decision = conflict?.designDecision
  if (!decision) return null
  const request = conflict.decisionRequest
  const shape = decision.choice === 'approve' ? proposalOf(request?.proposal, request?.custom) : null
  const name = decision.choice === 'approve' ? (shape ? (PROPOSAL_RESULT[shape.id] ?? shape.spec) : '수정안') : `디자인 원안(${conflict.layouts?.original?.columns ?? 2}열)`
  const label = DECISION_LABEL[decision.choice]
  // The final decision, said whole ("디자인 원안 유지(2열)", "변경 승인 · 1열 레이아웃").
  const final = decision.choice === 'approve' ? `${label} · ${name}` : decision.choice === 'keep' ? `디자인 원안 유지(${conflict.layouts?.original?.columns ?? 2}열)` : label
  return { choice: decision.choice, label, name, shape, final, line: `${label} · ${name}`, resolvedLine: `${label} · ${withRo(name)} 해결` }
}
// The code line the decision lands on: the design as it is, or the way
// that was approved (each has its own).
export const fixLineOf = (conflict) => {
  const choice = conflict?.designDecision?.choice
  return choice === 'approve' ? conflict.fixes?.[conflict.decisionRequest?.proposal] ?? conflict.fixes?.approve : conflict?.fixes?.[choice]
}
// A way forward in one phrase (its name; a 다른 수정안 says its values).
export const proposalPhraseOf = (shape) => (!shape ? null : shape.id === 'other' ? shape.spec : shape.name)

export const DEV_STAGE_LABEL = { early: '개발 초기', mid: '개발 중간', late: '완료 직전' }
// How long the scripted designer takes to answer the developer's request.
export const DECISION_REPLY_MS = 6000

// Where a design decision stands, for both sides of it — read off its
// History (lib/conflictEvents), so the stage can't say something the
// record doesn't.
export function decisionStageOf(conflict) {
  if (!conflict) return null
  return progressOf(eventsOf(conflict)).stage
}

// Where carrying the decision out is: put off to a later time (nothing runs
// until then) → waiting for a go-ahead (a high-risk change only) → applying →
// verifying → verified | failed (→ retried, or taken over by hand) → resolved.
// A change Devsign doesn't make by itself: the risk is high, so its diff is
// looked at and approved first.
export const fixNeedsApproval = (conflict) => conflict.severity === 'high' || conflict.severity === 'critical'
export const canAutoFix = (conflict) => Boolean(fixLineOf(conflict) && conflict.fileId && conflict.line)
export function fixPhaseOf(conflict) {
  const fix = conflict.decisionFix
  if (conflict.reviewStage === 'resolved') return 'resolved'
  if (!fix) return isDeferred(conflict.designDecision) ? 'deferred' : fixNeedsApproval(conflict) ? 'approval' : canAutoFix(conflict) ? 'applying' : 'unfixable'
  if (fix.verified) return 'verified'
  if (fix.manual) return 'manual'
  if (fix.failed) return 'failed'
  return 'verifying'
}
