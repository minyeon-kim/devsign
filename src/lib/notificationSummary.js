import { differencesOf, conflictTypeOf, kindWordOf } from '@/lib/conflictInsight'
import { eventsOf, progressOf } from '@/lib/conflictEvents'

// What a notification about a change says, in a template — never generated.
// The Inbox card reads it for its two closed lines and for what opens under
// them; the names and values are the change's own (`differencesOf`, the same
// rows the detail's "What differs" lists): the property, what the code has
// now → what the design asks for.
//
//   { type, label, target, lead, changes: { shown, more, all }, images: [before, after], file, requester }
//     label    "변경 감지" · "검토 요청" · "마감 임박" · "승인" / "수정 요청"
//     target   the change's title — the only part of the first line that is cut short
//     lead     the type's own sentence — the requester's message ("검토 요청"), "내일 마감 · 해결 방법 미선택",
//              "Jane 승인 · 병합 가능"; null for "변경 감지"
//     changes  the properties that differ: `shown` the first two, `more` how many are left ("외 N건")
//     images   the two labels over the pictures: "코드" / "디자인" for a drift, "이전" / "이후" otherwise
//   Null for a notification that isn't about a change's values (a comment, a mention, a merge).

export const CHANGE_NOTICES = { detected: '변경 감지', request: '검토 요청', due: '마감 임박', decision: '승인' }
export const REJECTED_LABEL = '수정 요청'
export const SHOWN_CHANGES = 2

// Where the change stands, in a few words: what's left to do on it.
export function stateWordOf(conflict) {
  if (!conflict) return null
  if (conflict.decisionFlow) {
    return { detected: '해결 방법 미선택', requested: '승인 대기', rework: '재검토 필요', decided: '병합 대기', fixed: '병합 대기', verified: '병합 대기', resolved: '병합 완료' }[progressOf(eventsOf(conflict)).stage] ?? null
  }
  return { detected: '해결 방법 미선택', in_review: '승인 대기', approved: '병합 대기', resolved: '병합 완료' }[conflict.reviewStage] ?? '해결 방법 미선택'
}

// The properties that differ, as the detail lists them (one both sides share
// isn't a difference): [{ label, from, to }].
export function changesOf(conflict) {
  return differencesOf(conflict).filter((entry) => !entry.shared).map((entry) => ({ label: entry.label, from: String(entry.current), to: String(entry.expected) }))
}

// "Padding 12px → 16px" — one property, as one line of text.
export const changeText = (change) => `${change.label} ${change.from} → ${change.to}`

const isRejection = (notification) => /수정을 요청|재검토/.test(notification.text ?? '')
const oneLine = (text) => String(text ?? '').replace(/\s+/g, ' ').trim()

// `nameOf(id)`: a person's name. `conflict` is the change it's about (null when it
// can't be found — then there's nothing to say beyond the notification's own words).
export function summaryOf(notification, conflict, { nameOf = (id) => id } = {}) {
  const type = notification?.type
  if (!conflict || !(type in CHANGE_NOTICES)) return null
  const all = changesOf(conflict)
  const changes = { all, shown: all.slice(0, SHOWN_CHANGES), more: Math.max(0, all.length - SHOWN_CHANGES) }
  const rejected = type === 'decision' && isRejection(notification)
  let lead = null
  if (type === 'request') {
    const message = oneLine(conflict.decisionRequest?.reason ?? conflict.requestedMessage)
    lead = message || null
  } else if (type === 'due') {
    lead = `내일 마감 · ${stateWordOf(conflict)}`
  } else if (type === 'decision') {
    const reviewer = notification.authorId ? nameOf(notification.authorId) : null
    if (rejected) lead = [reviewer, '수정 요청'].filter(Boolean).join(' ')
    else lead = [reviewer && `${reviewer} 승인`, conflict.reviewStage === 'resolved' ? '병합 완료' : '병합 가능'].filter(Boolean).join(' · ')
  }
  const drift = ['design-drift', 'production-priority', 'structural-drift', 'design-decision'].includes(conflictTypeOf(conflict)?.id)
  const requesterId = conflict.decisionRequest?.by ?? conflict.requestedBy ?? null
  return {
    type,
    label: rejected ? REJECTED_LABEL : CHANGE_NOTICES[type],
    target: notification.target?.label ?? conflict.title,
    lead,
    changes,
    kind: kindWordOf(conflict),
    images: drift ? ['코드', '디자인'] : ['이전', '이후'],
    file: String(conflict.file ?? '').split('/').pop() || null,
    requester: requesterId ? nameOf(requesterId) : null,
  }
}

// The closed card's second line, in its parts: a change's own summary (its
// first property, "외 N건" for the rest) — the type's sentence stands in for it
// on a deadline or an approval, and goes ahead of it on a request.
export function closedPartsOf(summary) {
  if (!summary) return null
  const first = summary.changes.all[0] ?? null
  const property = { change: first, more: Math.max(0, summary.changes.all.length - 1) }
  if (summary.type === 'detected') return property
  if (summary.type === 'request') return { lead: summary.lead, ...property }
  return summary.lead ? { lead: summary.lead, change: null, more: 0 } : property
}
