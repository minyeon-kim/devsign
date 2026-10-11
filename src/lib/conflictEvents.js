import { allPeople } from '@/data/mockData'

// A change's History: everything that happened to it, as events — detected,
// a decision asked for, opinions, the decision, the fix, its verification,
// resolved (or opened again). The log is append-only: nothing in it is
// edited or removed (an opinion that's edited or deleted says so itself).
//
// Where the change stands — its stage, its step in the progress card, its
// status in the list — is worked out from these events and nothing else
// (progressOf), so no screen can show a state its history doesn't.
//
// ConflictEvent
//   id, conflictId, type, actor { id, name, role: system | developer | designer },
//   createdAt (ISO 8601, the server's clock), seq (order within one instant),
//   step (1–5: which progress step it belongs to), replyTo? (the event it
//   answers), payload (by type — see EVENT_TYPES).
export const EVENT_TYPES = {
  detected: { label: '변경 감지', step: 1 }, // { summary, width, design, implementation }
  requested: { label: '결정 요청', step: 2 }, // { proposal, proposalName, reason, timing, reviewerId }
  commented: { label: '의견', step: null }, // { body, mentions?, editedAt?, deleted? } — the step it was said in
  decided: { label: '결정', step: 3 }, // { result: approved | changed | rejected, proposalName, previousName?, reason }
  fixed: { label: '수정', step: 4 }, // { pr: { number, title }, files, preview? }
  verified: { label: '검증', step: 4 }, // { match, width, difference? }
  resolved: { label: '해결', step: 5 }, // { how: fix | design-change | exception }
  reopened: { label: '다시 열림', step: 1 }, // { cause: drift | manual, summary }
}
export const STEP_LABELS = ['변경 감지', '승인 요청', '디자이너 결정', '수정 · 검증', '해결']
export const SYSTEM_ACTOR = { id: 'system', name: 'Devsign', role: 'system' }

export function actorOf(personId) {
  const person = allPeople.find((entry) => entry.id === personId)
  if (!person) return SYSTEM_ACTOR
  return { id: person.id, name: person.name, role: person.jobRole === 'Developer' ? 'developer' : 'designer' }
}

// Oldest first: by the server's time, then by `seq` within the same instant.
export function sortEvents(events = []) {
  return [...events].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || (a.seq ?? 0) - (b.seq ?? 0))
}

// "Today, 9:12 AM" (how a sample says when it was detected) as a time today.
function timeFromLabel(label, now) {
  const match = /(\d{1,2}):(\d{2})\s*(AM|PM)?/i.exec(label ?? '')
  const at = new Date(now)
  if (!match) { at.setHours(9, 0, 0, 0); return at }
  const hours = (Number(match[1]) % 12) + (/pm/i.test(match[3] ?? '') ? 12 : 0)
  at.setHours(hours, Number(match[2]), 0, 0)
  if (/yesterday/i.test(label)) at.setDate(at.getDate() - 1)
  return at
}

const RESULT_OF_CHOICE = { approve: 'approved', keep: 'changed', rework: 'rejected' }

// A change whose log hasn't started (a sample, or one saved before there
// was a log): the events its own fields imply, in order. Appending to it
// (appendEvent) starts the real log from these.
function impliedEvents(conflict, now = Date.now()) {
  const events = []
  let last = 0
  const push = (type, actorId, at, payload, replyTo) => {
    // (Never before the event it follows.)
    const time = Math.max(Number.isFinite(at) ? at : last + 60000, last + 1000)
    last = time
    const event = { id: `${conflict.id}:${type}:${events.length + 1}`, conflictId: conflict.id, type, actor: actorId ? actorOf(actorId) : SYSTEM_ACTOR, createdAt: new Date(time).toISOString(), seq: events.length + 1, step: EVENT_TYPES[type].step, payload, ...(replyTo && { replyTo }) }
    events.push(event)
    return event
  }
  const detectedAt = Math.min(timeFromLabel(conflict.detectedAt ?? conflict.timestamp, now).getTime(), now)
  push('detected', null, detectedAt, { summary: conflict.uxNote ?? conflict.message ?? conflict.title, design: conflict.comparisonFields?.[0]?.expected ?? null, implementation: conflict.comparisonFields?.[0]?.current ?? null })
  const request = conflict.decisionRequest
  const asked = request && push('requested', request.by, request.sentAt, { proposal: request.proposal, proposalName: request.proposalName ?? null, reason: request.reason ?? '', timing: request.timing ?? null, reviewerId: conflict.reviewers?.[0]?.id ?? null })
  const decision = conflict.designDecision
  const decided = decision && push('decided', decision.by, decision.decidedAt, { result: RESULT_OF_CHOICE[decision.choice] ?? 'approved', choice: decision.choice, reason: decision.reason ?? '', timing: decision.timing ?? null }, asked?.id)
  const fix = conflict.decisionFix
  const fixed = fix && push('fixed', request?.by ?? null, fix.appliedAtMs, { files: 1, choice: fix.choice }, decided?.id)
  const verified = fix?.verified && push('verified', null, fix.verifiedAtMs, { match: true, width: 768 }, fixed?.id)
  if (conflict.reviewStage === 'resolved') push('resolved', conflict.mergedBy ?? request?.by ?? null, undefined, { how: fix?.choice === 'approve' ? 'design-change' : 'fix' }, verified?.id)
  return events
}

export function eventsOf(conflict, now) {
  if (!conflict) return []
  return conflict.events?.length ? sortEvents(conflict.events) : impliedEvents(conflict, now)
}

// The log with one more event at its end. Never rewrites what's there.
// `createdAt` is the caller's (server) time; `step` comes from the type —
// an opinion takes the step the change is on.
export function appendEvent(conflict, { type, actorId, payload = {}, replyTo, createdAt = new Date().toISOString() }) {
  const events = eventsOf(conflict)
  const seq = (events.at(-1)?.seq ?? 0) + 1
  const step = EVENT_TYPES[type].step ?? progressOf(events).step
  // (Not earlier than what it follows: a log only moves forward.)
  const time = Math.max(Date.parse(createdAt), Date.parse(events.at(-1)?.createdAt ?? createdAt))
  return [...events, { id: `${conflict.id}:${type}:${seq}`, conflictId: conflict.id, type, actor: actorId ? actorOf(actorId) : SYSTEM_ACTOR, createdAt: new Date(time).toISOString(), seq, step, payload, ...(replyTo && { replyTo }) }]
}

// Where a change stands, from its events alone.
//   stage  — detected | requested | rework | decided | fixed | verified | resolved
//   step   — the progress step it's on (1–5), `done` how many are complete
//   status — before | reviewing | done (the list's 검토 전 / 검토 중 / 완료)
//   steps  — for each step, its first and last event (who, and when)
// A rejected decision sends it back to step 2: the request has to be made
// again. Opening it again starts over; nothing before it is lost.
export function progressOf(events = []) {
  let stage = 'detected'
  let round = [] // the events since it was last (re)opened
  for (const event of sortEvents(events)) {
    if (event.type === 'reopened') { stage = 'detected'; round = [event]; continue }
    round.push(event)
    if (event.type === 'detected') stage = 'detected'
    else if (event.type === 'requested') stage = 'requested'
    else if (event.type === 'decided') stage = event.payload?.result === 'rejected' ? 'rework' : 'decided'
    else if (event.type === 'fixed') stage = 'fixed'
    else if (event.type === 'verified') stage = event.payload?.match === false ? 'fixed' : 'verified'
    else if (event.type === 'resolved') stage = 'resolved'
  }
  const done = { detected: 1, requested: 2, rework: 1, decided: 3, fixed: 3, verified: 4, resolved: 5 }[stage]
  const step = Math.min(done + 1, 5)
  const steps = [1, 2, 3, 4, 5].map((number) => {
    const own = round.filter((event) => event.step === number && event.type !== 'commented')
    return { step: number, label: STEP_LABELS[number - 1], state: number <= done ? 'done' : number === step ? 'current' : 'todo', first: own[0] ?? null, last: own.at(-1) ?? null }
  })
  return { stage, step, done, status: stage === 'detected' ? 'before' : stage === 'resolved' ? 'done' : 'reviewing', steps }
}

// What people wrote or did — the tab's count leaves the system's notes out.
export const humanEventCount = (events = []) => events.filter((event) => event.actor?.role !== 'system').length

// "Opinions only": the opinions, and what each one answers.
export function opinionsOnly(events = []) {
  const keep = new Set(events.filter((event) => event.type === 'commented').flatMap((event) => [event.id, event.replyTo]).filter(Boolean))
  return events.filter((event) => keep.has(event.id))
}

// The timeline as rows: an event, or — for three or more of the system's
// events in a row — one folded row. Something a person did is never folded.
export function timelineRows(events = [], { expanded = new Set() } = {}) {
  const rows = []
  let run = []
  const flush = () => {
    if (run.length >= 3 && !expanded.has(run[0].id)) rows.push({ kind: 'system-run', id: run[0].id, events: run })
    else rows.push(...run.map((event) => ({ kind: 'event', id: event.id, event })))
    run = []
  }
  for (const event of events) {
    if (event.actor?.role === 'system' && event.type !== 'reopened') { run.push(event); continue }
    flush()
    rows.push({ kind: event.type === 'reopened' ? 'reopened' : 'event', id: event.id, event })
  }
  flush()
  return rows
}

// Opinions by one person within five minutes read as one: the later ones
// drop their avatar and name.
export const GROUP_WINDOW_MS = 5 * 60 * 1000
export function continuesPrevious(event, previous) {
  return Boolean(previous) && event.type === 'commented' && previous.type === 'commented' && event.actor?.id === previous.actor?.id && !event.replyTo
    && Date.parse(event.createdAt) - Date.parse(previous.createdAt) <= GROUP_WINDOW_MS
}

// Times, shown in KST whatever the viewer's clock is set to.
const KST = 'Asia/Seoul'
const dayKey = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: KST, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
export function dayLabelOf(iso, now = Date.now()) {
  const key = dayKey(new Date(iso))
  if (key === dayKey(new Date(now))) return '오늘'
  if (key === dayKey(new Date(now - 86400000))) return '어제'
  const parts = new Intl.DateTimeFormat('ko-KR', { timeZone: KST, month: 'long', day: 'numeric', weekday: 'short' }).formatToParts(new Date(iso))
  const get = (type) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('month').replace(/월$/, '')}월 ${get('day').replace(/일$/, '')}일 (${get('weekday')})`
}
export const clockOf = (iso) => new Intl.DateTimeFormat('ko-KR', { timeZone: KST, hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(iso))
// "방금", "12분 전" within the hour; the clock time after that.
export function relativeTimeOf(iso, now = Date.now()) {
  const minutes = Math.floor((now - Date.parse(iso)) / 60000)
  if (minutes < 1 && minutes >= 0) return '방금'
  if (minutes > 0 && minutes < 60) return `${minutes}분 전`
  return clockOf(iso)
}
export function absoluteTimeOf(iso) {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: KST, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso)).replaceAll('-', '.')
  return `${date} ${clockOf(iso)} KST`
}

// How a decision reads, result first.
export function decisionLineOf(event) {
  const { result, proposalName, previousName } = event.payload ?? {}
  if (result === 'rejected') return { text: '반려', changed: null, warn: true }
  if (result === 'changed') return { text: `다른 수정안으로 변경${proposalName ? ` · ${proposalName}` : ''}`, changed: previousName && proposalName && previousName !== proposalName ? [previousName, proposalName] : null, warn: false }
  return { text: `승인${proposalName ? ` · ${proposalName}` : ''}`, changed: null, warn: false }
}

// What a reference line calls the event being answered: "결정 요청", "Taylor 의견".
export function referenceNameOf(event) {
  if (!event) return ''
  return event.type === 'commented' ? `${event.actor.name} 의견` : EVENT_TYPES[event.type].label
}

// ── A sample history for CON-002 — for looking at the screen only. ────
// Eight events over one day (KST), ending resolved. `rejected: true` plays
// the same day with the decision turned down, and a second request after it.
export function sampleHistoryForCon002({ day = new Date(), rejected = false } = {}) {
  const key = dayKey(day)
  const at = (hour, minute) => new Date(`${key}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+09:00`).toISOString()
  const id = (seq, type) => `CON-002:${type}:${seq}`
  const make = (seq, type, actorId, time, payload, replyTo, step) => ({ id: id(seq, type), conflictId: 'CON-002', type, actor: actorId ? actorOf(actorId) : SYSTEM_ACTOR, createdAt: time, seq, step: step ?? EVENT_TYPES[type].step, payload, ...(replyTo && { replyTo }) })
  const head = [
    make(1, 'detected', null, at(9, 12), { summary: '768px에서 카드가 겹쳐요', width: 768, design: '화면 폭 맞춤 2열', implementation: '360px 고정 2열' }),
    make(2, 'requested', 'min', at(10, 5), { proposal: 'one-column', proposalName: '1열로 변경', reason: '태블릿에서 카드 내용이 가려짐, 2열 유지 시 카드 폭이 너무 좁아짐', reviewerId: 'jane' }),
    make(3, 'commented', 'jane', at(11, 20), { body: '1열이면 스크롤이 너무 길어질 것 같아요. 원안 2열을 유지하는 방법은 없을까요?' }, id(2, 'requested'), 2),
    make(4, 'commented', 'min', at(11, 34), { body: '그리드를 화면 폭 기준으로 바꾸면 원안대로 2열이 가능해요.' }, id(3, 'commented'), 2),
  ]
  if (rejected) {
    return [
      ...head,
      make(5, 'decided', 'jane', at(14, 40), { result: 'rejected', reason: '1열은 스크롤이 너무 길어요. 2열을 유지하는 수정안으로 다시 요청해 주세요.' }, id(2, 'requested')),
      make(6, 'requested', 'min', at(15, 10), { proposal: 'original', proposalName: '원안대로 맞추기', reason: '그리드를 화면 폭 기준으로 바꿔 원안 2열을 유지해요.', reviewerId: 'jane' }),
    ]
  }
  return [
    ...head,
    make(5, 'decided', 'jane', at(14, 40), { result: 'changed', previousName: '1열로 변경', proposalName: '원안대로 맞추기', reason: '원안 2열을 유지할 수 있다면 그 방향으로 가요.' }, id(2, 'requested')),
    make(6, 'fixed', 'min', at(16, 15), { pr: { number: 482, title: 'DashboardGrid: 컬럼 폭을 화면 기준으로 변경' }, files: 2 }, id(5, 'decided')),
    make(7, 'verified', null, at(16, 22), { match: true, width: 768 }, id(6, 'fixed')),
    make(8, 'resolved', 'min', at(16, 30), { how: 'fix' }, id(7, 'verified')),
  ]
}
