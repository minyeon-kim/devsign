import { formatTime, formatTimeLabel } from '@/lib/conflictEvents'

// A value change's approval, in the structure a design decision's has
// (CON-002, the reference — its own code isn't touched or shared here; this
// is a copy of its shape for every other change):
//
//   1 변경 감지 → 2 승인 요청 → 3 디자이너 결정 → 4 수정 · 검증 → 5 병합
//
//   · found by itself; the developer picks a way forward (and says why, when
//     it isn't the design's own value) and asks for approval;
//   · the reviewers decide — approving needs a reason; asking for changes
//     sends it back to step 2;
//   · once approved, the fix is applied and checked by itself (`autoFix`),
//     and only a checked fix can be merged;
//   · merging is the developer's one press.
//
// What's kept on the change for it, beside the fields it already has:
//   requestedAtMs — when approval was asked for
//   autoFix: { appliedAtMs, verified, verifiedAtMs } — step 4

const REVIEW_WORD = { approved: '승인', changes_requested: '변경 요청', pending: '대기 중' }

// Where step 4 is: nothing to fix yet → applying → verifying → verified (→ merged).
export function reviewFixPhaseOf(conflict) {
  if (!conflict) return null
  if (conflict.reviewStage === 'resolved') return 'resolved'
  if (conflict.reviewStage !== 'approved') return null
  if (!conflict.autoFix?.appliedAtMs) return 'applying'
  return conflict.autoFix.verified ? 'verified' : 'verifying'
}
// Whether the change can be merged: only once its fix has been checked.
export const canMerge = (conflict) => reviewFixPhaseOf(conflict) === 'verified'

// The status block's line: the one thing this page is for right now — worded
// as the reference's is.
export function reviewStatusOf(conflict, { nameOf = (id) => id, viewerId = null } = {}) {
  const reviewers = conflict.reviewers ?? []
  const waiting = reviewers.filter((reviewer) => reviewer.status !== 'approved')
  const names = waiting.map((reviewer) => nameOf(reviewer.id)).filter(Boolean)
  const phase = reviewFixPhaseOf(conflict)
  if (phase === 'resolved') return null
  if (phase === 'applying') return '결정대로 코드를 자동으로 수정하고 있어요'
  if (phase === 'verifying') return '수정한 값을 검증하고 있어요'
  if (phase === 'verified') return '검증을 통과했어요 · 병합하면 자동으로 해결돼요'
  if (conflict.reviewStage === 'in_review') {
    if (reviewers.some((reviewer) => reviewer.status === 'changes_requested')) return '검토자의 의견을 보고 해결 방법을 다시 골라 주세요'
    if (viewerId && waiting.some((reviewer) => reviewer.id === viewerId)) return '요청을 확인하고 결정해 주세요'
    return names.length ? `${names.join(', ')}님의 결정을 기다리고 있어요` : '검토자의 결정을 기다리고 있어요'
  }
  return '해결 방법을 골라 주세요'
}

// When, from how a sample says it: a clock time as the record shows times;
// anything else ("4 days ago", "Just now") in its own words.
const labelTime = (label, t) => {
  if (!label) return null
  if (!/\d{1,2}:\d{2}/.test(label)) return t(label)
  try { return formatTimeLabel(label) || null } catch { return null }
}
const clock = (ms) => (Number.isFinite(ms) ? formatTime(ms) : null)

// The record, a line a step: who, the one thing worth knowing, when — and,
// opened, what that step has to show.
//   t: translates a data string; nameOf: a person's name; roleOf: 'Designer' | 'Developer' | …
//   choice / choiceLabel / reason: the way picked on the page, in words, and why
// out: [{ key, title, state: done | current | pending, who, summary, time,
//         preview: bool, rows: [{ label, value, mono?, tone? }], code: { file, line, before, after } | null, note }]
export function reviewRecordOf(conflict, { t = (text) => text, nameOf = (id) => id, roleOf = () => null, choice = null, choiceLabel = null, reason = '' } = {}) {
  if (!conflict) return []
  const stage = conflict.reviewStage ?? 'detected'
  const fields = conflict.comparisonFields ?? []
  const differing = fields.filter((field) => field.current !== field.expected)
  const told = differing.length ? differing : fields
  const impact = [...(conflict.impact?.screens ?? []), ...(conflict.impact?.components ?? [])]
  const reviewers = conflict.reviewers ?? []
  const approved = reviewers.filter((reviewer) => reviewer.status === 'approved')
  const asked = stage !== 'detected'
  const decided = stage === 'approved' || stage === 'resolved'
  const merged = stage === 'resolved'
  const phase = reviewFixPhaseOf(conflict)
  const fixed = phase === 'verified' || merged
  const picked = Boolean(choice) && Boolean(choiceLabel)
  const fileName = conflict.file?.split('/').pop() ?? null
  const changes = (conflict.diff?.after?.length ?? 0) > 0 && choice !== 'B'
  const code = changes ? { file: conflict.file, line: conflict.line ?? null, before: conflict.diff.before ?? [], after: conflict.diff.after ?? [] } : null
  // (Every reviewer a designer: it's the designer's decision, as the reference's is.)
  const designers = reviewers.length > 0 && reviewers.every((reviewer) => roleOf(reviewer.id) === 'Designer')
  const requester = nameOf(conflict.requestedBy ?? conflict.assigneeId)

  const detect = {
    key: 'detect', title: '변경 감지', state: 'done',
    who: '자동 감지',
    summary: told.length ? `${t(told[0].label)} ${t(told[0].current)} → ${t(told[0].expected)}` : t(conflict.effect ?? conflict.message ?? ''),
    time: labelTime(conflict.detectedAt ?? conflict.timestamp, t),
    preview: Boolean(conflict.preview) && fields.length > 0,
    rows: [
      ...told.map((field) => ({ label: t(field.label), value: `${t(field.current)} → ${t(field.expected)}` })),
      conflict.file && { label: '관련 파일', value: `${conflict.file}${conflict.line ? ` · ${conflict.line}행` : ''}`, mono: true },
      impact.length > 0 && { label: '영향 범위', value: impact.map(t).join(' · ') },
      conflict.cause && { label: '원인', value: t(conflict.cause) },
    ].filter(Boolean),
    code: null, note: null,
  }

  const request = {
    key: 'request', title: '승인 요청', state: asked ? 'done' : 'current',
    who: asked ? `${requester} · 제안` : null,
    // (One part of the line: its own " · " would break it in two.)
    summary: picked ? `${choiceLabel.replace(/ · /g, ', ')}${asked ? '' : ' · 요청 전'}` : asked ? '' : '해결 방법을 고르고 승인을 요청해요',
    time: asked ? clock(conflict.requestedAtMs) : null,
    preview: false,
    rows: picked ? [
      reason.trim() && { label: '변경 사유', value: t(reason.trim()) },
      { label: '수정안', value: choiceLabel, tone: 'accent' },
    ].filter(Boolean) : [],
    code: null, note: null,
  }

  const lastReview = Math.max(...reviewers.map((reviewer) => reviewer.reviewedAt ?? -Infinity))
  const decision = {
    key: 'decision', title: designers ? '디자이너 결정' : '검토자 결정',
    state: decided ? 'done' : asked ? 'current' : 'pending',
    who: asked ? reviewers.map((reviewer) => nameOf(reviewer.id)).filter(Boolean).join(', ') || null : null,
    summary: !asked ? '검토자가 요청을 보고 결정해요'
      : decided ? '승인'
        : reviewers.some((reviewer) => reviewer.status === 'changes_requested') ? '변경 요청'
          : reviewers.length > 1 ? `${approved.length}/${reviewers.length} 승인` : '결정 대기',
    time: decided ? clock(lastReview) : null,
    preview: false,
    rows: asked ? reviewers.flatMap((reviewer) => [
      { label: nameOf(reviewer.id) ?? reviewer.id, value: REVIEW_WORD[reviewer.status] ?? REVIEW_WORD.pending, tone: reviewer.status === 'approved' ? 'done' : reviewer.status === 'changes_requested' ? 'warn' : null },
      reviewer.note && { label: '이유', value: t(reviewer.note) },
    ].filter(Boolean)) : [],
    code: null, note: null,
  }

  const fix = {
    key: 'fix', title: '수정 · 검증',
    state: fixed ? 'done' : decided ? 'current' : 'pending',
    who: decided ? '자동 수정' : null,
    summary: !decided ? '승인되면 자동으로 수정하고 검증해요'
      : [phase === 'applying' ? '코드 수정 중' : phase === 'verifying' ? '검증 중' : '검증 통과', fileName && `${fileName}${conflict.line ? ` ${conflict.line}행` : ''}`].filter(Boolean).join(' · '),
    time: fixed ? clock(conflict.autoFix?.verifiedAtMs) : null,
    preview: false,
    rows: [],
    code: decided && phase !== 'applying' ? code : null,
    note: !decided || phase === 'applying' ? null
      : phase === 'verifying' ? '수정한 값이 기준과 같은지 확인하고 있어요.'
        : code ? '수정한 값이 결정한 값과 같아요.' : '코드는 그대로 두기로 했어요 · 바뀐 줄이 없어요.',
  }

  const merge = {
    key: 'resolve', title: '병합',
    state: merged ? 'done' : fixed ? 'current' : 'pending',
    who: merged && conflict.mergedBy ? nameOf(conflict.mergedBy) : null,
    summary: merged ? '반영 완료' : fixed ? '병합하면 해결돼요' : '검증을 통과하면 병합해요',
    time: merged ? labelTime(conflict.resolvedAtLabel, t) : null,
    preview: false, rows: [], code: null, note: null,
  }

  return [detect, request, decision, fix, merge]
}

// Whether a step has anything to open.
export const hasBody = (step) => step.preview || step.rows.length > 0 || Boolean(step.code) || Boolean(step.note)
