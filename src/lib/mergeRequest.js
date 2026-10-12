// A merge request — a mix of drafts sent from Merge Studio for approval — has
// one state, and everything its page says is worked out from it: the status
// block, the meta line, the record's steps and their count. (The reviewers'
// own statuses in the side panel are the same data this reads.)
//
//   mixing    parts still to pick                    → carry on in Merge Studio
//   ready     everything picked, not asked for yet   → ask the reviewers
//   waiting   asked, reviewers deciding
//   approved  every reviewer approved                → merge
//   merged    done
//   rejected  a reviewer asked for changes           → fix it in Merge Studio
//
// The request is sent from Merge Studio (its parts bar), so a request opened
// from there starts at `waiting`; `mixing` and `ready` are a mix that was
// saved without being sent.

export const isMergeRequest = (conflict) => conflict?.kind === 'design-review'

export const MERGE_REQUEST_STATES = ['mixing', 'ready', 'waiting', 'approved', 'merged', 'rejected']
export const MERGE_REQUEST_LABEL = { mixing: '조합 중', ready: '요청 전', waiting: '승인 대기', approved: '승인됨', merged: '병합 완료', rejected: '반려' }

// `rows`: the mix's parts (draftRows) — each `decided` or not.
export function mergeRequestStateOf(conflict, rows = []) {
  const reviewers = conflict?.reviewers ?? []
  if (conflict?.reviewStage === 'resolved') return 'merged'
  if (reviewers.some((reviewer) => reviewer.status === 'changes_requested')) return 'rejected'
  if (conflict?.reviewStage === 'approved') return 'approved'
  if (conflict?.reviewStage === 'in_review') return 'waiting'
  return rows.some((row) => !row.decided) ? 'mixing' : 'ready'
}

// The status block: what it says, how it's toned, and the one thing to do.
//   action: 'continue' (Merge Studio) | 'request' | 'remind' | 'merge' | 'fix' (Merge Studio) | null
export function mergeRequestStatusOf(conflict, rows = [], { nameOf = (id) => id } = {}) {
  const state = mergeRequestStateOf(conflict, rows)
  const reviewers = conflict?.reviewers ?? []
  const names = (list) => list.map((reviewer) => nameOf(reviewer.id)).filter(Boolean).join(', ')
  const pending = rows.filter((row) => !row.decided).length
  const approved = reviewers.filter((reviewer) => reviewer.status === 'approved')
  const rejecting = reviewers.find((reviewer) => reviewer.status === 'changes_requested')
  switch (state) {
    case 'mixing': return { state, tone: 'neutral', text: `${pending}개 항목을 더 골라 주세요`, action: 'continue', actionLabel: '병합 스튜디오에서 이어서 고르기' }
    case 'ready': return { state, tone: 'neutral', text: '조합을 마쳤어요 · 승인을 요청하세요', action: reviewers.length ? 'request' : null, actionLabel: `검토자 ${reviewers.length}명에게 승인 요청`, actionTitle: names(reviewers), note: reviewers.length ? null : '검토자를 먼저 추가해 주세요' }
    case 'waiting': return { state, tone: 'waiting', text: `${names(reviewers.filter((reviewer) => reviewer.status !== 'approved')) || '검토자'}의 승인을 기다리는 중`, detail: reviewers.length > 1 ? `${approved.length}/${reviewers.length} 승인` : null, action: 'remind', actionLabel: '다시 알림' }
    case 'approved': return { state, tone: 'success', text: '승인됐어요 · 병합하면 반영돼요', detail: names(approved) ? `${names(approved)} 승인` : null, action: 'merge', actionLabel: '병합하기' }
    case 'merged': return { state, tone: 'success', text: '병합 완료 · 반영됐어요', detail: conflict?.mergedBy ? `${nameOf(conflict.mergedBy)}님이 병합` : null, action: null }
    default: return { state, tone: 'warning', text: `${nameOf(rejecting?.id) ?? '검토자'}님이 수정을 요청했어요`, detail: rejecting?.note ?? null, action: 'fix', actionLabel: '병합 스튜디오에서 수정' }
  }
}

// The record, as a merge request's own steps:
//   시안 생성 → 조합 → 승인 요청 → 승인 → 병합
// out: the shape the page's record draws (lib/reviewRecord): { key, title, state, who, summary, time, preview, rows, code, note }
export function mergeRequestRecordOf(conflict, rows = [], { nameOf = (id) => id, drafts = [], clock = () => null } = {}) {
  const state = mergeRequestStateOf(conflict, rows)
  const at = MERGE_REQUEST_STATES.indexOf(state)
  const reviewers = conflict?.reviewers ?? []
  const picked = rows.filter((row) => row.decided)
  const asked = ['waiting', 'approved', 'merged', 'rejected'].includes(state)
  const approvedAll = state === 'approved' || state === 'merged'
  const author = nameOf(conflict?.requestedBy ?? conflict?.changedBy?.id) ?? null
  const letters = drafts.map((draft) => draft.letter).filter(Boolean)
  const step = (key, title, stepState, rest) => ({ key, title, state: stepState, who: null, summary: '', time: null, preview: false, rows: [], code: null, note: null, ...rest })
  const partRows = rows.map((row) => { const option = row.options?.find((entry) => entry.picked); return { label: row.label, value: option ? `${option.letter} · ${option.value}` : '아직 고르지 않음', tone: option ? null : 'warn' } })
  return [
    step('drafts', '시안 생성', 'done', { who: 'AI 시안', summary: letters.length ? `시안 ${letters[0]}${letters.length > 1 ? `~${letters.at(-1)}` : ''} · ${letters.length}개` : '시안', rows: drafts.map((draft) => ({ label: `시안 ${draft.letter}`, value: draft.name })) }),
    step('mix', '조합', state === 'mixing' ? 'current' : 'done', { who: author, summary: state === 'mixing' ? `병합 스튜디오 · ${picked.length}/${rows.length} 선택` : '병합 스튜디오', rows: partRows }),
    step('request', '승인 요청', asked ? 'done' : state === 'ready' ? 'current' : 'pending', {
      who: asked ? author : null,
      summary: asked ? `${reviewers.map((reviewer) => nameOf(reviewer.id)).filter(Boolean).join(', ')}에게 요청` : state === 'ready' ? '검토자에게 승인을 요청해요' : '조합을 마치면 요청해요',
      time: asked ? clock(conflict?.mixRequest?.at ?? conflict?.submittedForMergeAt) : null,
      rows: asked ? [conflict?.mixRequest?.note && { label: '메모', value: conflict.mixRequest.note }, conflict?.mixRequest?.warnings > 0 && { label: '경고', value: `${conflict.mixRequest.warnings}개 포함`, tone: 'warn' }].filter(Boolean) : [],
    }),
    step('approval', '승인', approvedAll ? 'done' : state === 'rejected' ? 'problem' : state === 'waiting' ? 'current' : 'pending', {
      who: asked ? reviewers.map((reviewer) => nameOf(reviewer.id)).filter(Boolean).join(', ') || null : null,
      summary: approvedAll ? '승인' : state === 'rejected' ? '수정 요청' : state === 'waiting' ? (reviewers.length > 1 ? `${reviewers.filter((reviewer) => reviewer.status === 'approved').length}/${reviewers.length} 승인` : '결정 대기') : '검토자가 보고 결정해요',
      time: approvedAll ? clock(Math.max(...reviewers.map((reviewer) => reviewer.reviewedAt ?? -Infinity))) : null,
      rows: asked ? reviewers.flatMap((reviewer) => [
        { label: nameOf(reviewer.id) ?? reviewer.id, value: reviewer.status === 'approved' ? '승인' : reviewer.status === 'changes_requested' ? '수정 요청' : '대기 중', tone: reviewer.status === 'approved' ? 'done' : reviewer.status === 'changes_requested' ? 'warn' : null },
        reviewer.note && { label: '이유', value: reviewer.note },
      ].filter(Boolean)) : [],
    }),
    step('resolve', '병합', state === 'merged' ? 'done' : state === 'approved' ? 'current' : 'pending', {
      who: state === 'merged' && conflict?.mergedBy ? nameOf(conflict.mergedBy) : null,
      summary: state === 'merged' ? '반영 완료' : state === 'approved' ? '병합하면 반영돼요' : '승인되면 병합해요',
    }),
  ].map((entry) => entry)
    // (`at`: kept so a caller can tell how far along the request is.)
    .map((entry) => ({ ...entry, stateIndex: at }))
}
