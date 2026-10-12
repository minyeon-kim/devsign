import { flowOf } from '@/lib/conflictInsight'
import { formatTimeLabel } from '@/lib/conflictEvents'

// A change's record on its page, a line a step: who, the one thing worth
// knowing, when — and, opened, what that step has to show (label / value
// rows, the code that changes). Built from what the change itself carries,
// so every change's record reads like a design decision's (DesignDecisionFlow).
//
//   t: translates a data string (titles, causes, labels) for the reader
//   nameOf: a person's name from their id
//   choice / choiceLabel / reason: the way picked on the page, in words, and why
// out: [{ key, title, state: done | current | pending, who, summary, time,
//         preview: bool, rows: [{ label, value, mono?, tone? }], code: { file, before, after } | null, note }]

const REVIEW_WORD = { approved: '승인', changes_requested: '변경 요청', pending: '대기 중' }
const WAITING = { select: '적용할 값을 정해 주세요', approve: '검토자에게 승인을 받아요', merge: '승인된 변경 내용을 반영해요' }
// When, from how a sample says it: a clock time as the record shows times;
// anything else ("4 days ago", "Just now") in its own words.
const timeOf = (label, t) => {
  if (!label) return null
  if (!/\d{1,2}:\d{2}/.test(label)) return t(label)
  try { return formatTimeLabel(label) || null } catch { return null }
}

export function reviewRecordOf(conflict, { t = (text) => text, nameOf = (id) => id, choice = null, choiceLabel = null, reason = '' } = {}) {
  const flow = flowOf(conflict)
  if (!flow) return []
  const stateOf = (id) => { const state = flow.steps.find((step) => step.id === id)?.state; return state === 'todo' ? 'pending' : state }
  const fields = conflict.comparisonFields ?? []
  const differing = fields.filter((field) => field.current !== field.expected)
  const told = differing.length ? differing : fields
  const impact = [...(conflict.impact?.screens ?? []), ...(conflict.impact?.components ?? [])]
  const reviewers = conflict.reviewers ?? []
  const approved = reviewers.filter((reviewer) => reviewer.status === 'approved')
  const requested = conflict.reviewStage !== 'detected'
  const merged = conflict.reviewStage === 'resolved'
  const codeConflict = conflict.kind === 'code-conflict'
  const changer = conflict.changedBy?.type === 'person' ? nameOf(conflict.changedBy.id) : null

  const detect = {
    key: 'conflict', title: '차이 확인', state: stateOf('conflict'),
    who: '자동 감지',
    summary: told.length ? told.slice(0, 1).map((field) => `${t(field.label)} ${t(field.current)} → ${t(field.expected)}`).join('') : t(conflict.effect ?? conflict.message ?? ''),
    time: timeOf(conflict.detectedAt ?? conflict.timestamp, t),
    preview: Boolean(conflict.preview) && fields.length > 0 && !codeConflict,
    rows: [
      conflict.detectedBy && { label: '감지', value: t(conflict.detectedBy) },
      conflict.file && { label: '관련 파일', value: `${conflict.file}${conflict.line ? ` · ${conflict.line}행` : ''}`, mono: true },
      impact.length > 0 && { label: '영향 범위', value: impact.map(t).join(' · ') },
      conflict.cause && { label: '원인', value: t(conflict.cause) },
    ].filter(Boolean),
    code: null, note: null,
  }

  const compare = {
    key: 'compare', title: '값 비교', state: stateOf('compare'),
    who: changer,
    // (Who changed what, when that's known; else the two values side by side.)
    summary: conflict.changedBy?.what ? t(conflict.changedBy.what) : told.length ? `코드 ${t(told[0].current)} · 기준 ${t(told[0].expected)}` : '코드 값과 디자인 값을 비교해요',
    time: null, preview: false,
    rows: [
      ...told.map((field) => ({ label: t(field.label), value: `${t(field.current)} → ${t(field.expected)}` })),
      codeConflict && conflict.codeComparison?.local && { label: t(conflict.codeComparison.localTitle ?? 'Local changes'), value: t(conflict.codeComparison.local) },
      codeConflict && conflict.codeComparison?.remote && { label: t(conflict.codeComparison.remoteTitle ?? 'Remote changes'), value: t(conflict.codeComparison.remote) },
      conflict.gitFlow && { label: '브랜치', value: `${conflict.gitFlow.source} → ${conflict.gitFlow.target}`, mono: true },
    ].filter(Boolean),
    code: null, note: null,
  }

  const picked = Boolean(choice) && Boolean(choiceLabel)
  const changes = picked && choice !== 'B' && (conflict.diff?.after?.length ?? 0) > 0 && !codeConflict
  const select = {
    key: 'select', title: '해결 방법 선택', state: stateOf('select'),
    // (Asked already, by a way this page has no name for — a merge conflict's code, a mix of drafts: who asked.)
    who: requested ? nameOf(conflict.requestedBy ?? conflict.assigneeId) : null,
    summary: picked ? `${choiceLabel}${requested ? '' : ' · 요청 전'}` : requested ? '검토 요청' : WAITING.select,
    time: null, preview: false,
    rows: picked ? [
      { label: '선택한 방법', value: choiceLabel, tone: 'accent' },
      reason.trim() && { label: '이유', value: t(reason.trim()) },
      !changes && choice === 'B' && { label: '코드', value: '현재 코드를 그대로 둬요' },
    ].filter(Boolean) : [],
    code: changes && choice === 'A' ? { file: conflict.file, line: conflict.line ?? null, before: conflict.diff.before ?? [], after: conflict.diff.after ?? [] } : null,
    note: null,
  }

  const approveState = stateOf('approve')
  const approve = {
    key: 'approve', title: '승인', state: approveState,
    who: approveState === 'pending' ? null : reviewers.map((reviewer) => nameOf(reviewer.id)).filter(Boolean).join(', ') || null,
    summary: approveState === 'pending' ? WAITING.approve
      : reviewers.length ? (approved.length === reviewers.length ? '모두 승인' : `${approved.length}/${reviewers.length} 승인`) : '검토자 없음',
    time: null, preview: false,
    rows: approveState === 'pending' ? [] : reviewers.map((reviewer) => ({ label: nameOf(reviewer.id) ?? reviewer.id, value: REVIEW_WORD[reviewer.status] ?? REVIEW_WORD.pending, tone: reviewer.status === 'approved' ? 'done' : reviewer.status === 'changes_requested' ? 'warn' : null })),
    code: null, note: null,
  }

  const merge = {
    key: 'merge', title: '병합', state: stateOf('merge'),
    who: merged ? (conflict.mergedBy ? nameOf(conflict.mergedBy) : null) : null,
    summary: merged ? '반영 완료' : stateOf('merge') === 'current' ? '모두 승인했어요 · 병합할 수 있어요' : WAITING.merge,
    time: merged ? timeOf(conflict.resolvedAtLabel, t) : null,
    preview: false,
    rows: merged ? [
      conflict.mergedBy && { label: '병합', value: nameOf(conflict.mergedBy) },
      conflict.gitFlow && { label: '브랜치', value: `${conflict.gitFlow.source} → ${conflict.gitFlow.target}`, mono: true },
    ].filter(Boolean) : [],
    code: null,
    note: merged ? '변경 내용이 코드에 반영됐어요.' : null,
  }

  return [detect, compare, select, approve, merge]
}

// Whether a step has anything to open.
export const hasBody = (step) => step.preview || step.rows.length > 0 || Boolean(step.code) || Boolean(step.note)
