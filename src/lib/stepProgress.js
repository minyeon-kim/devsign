// The change detail's 진행 기록: which steps are done, how far it has come,
// and which of them are *new* to this viewer — only those move (a step seen
// once is shown still from then on).
export const STEP_STAGGER = 120
const SEEN_KEY = 'devsign:step-record-seen:v1'

// What a step's state is called, for assistive tech (colour is never alone).
export const STEP_STATE_WORD = { done: '완료', current: '진행 중', pending: '대기', problem: '확인 필요' }

// The record's four steps — the replay's rail shows the same ones.
export const RECORD_STEPS = [
  { key: 'detect', title: '변경 감지' },
  { key: 'request', title: '승인 요청' },
  { key: 'decision', title: '디자이너 결정' },
  { key: 'fix', title: '수정 · 검증' },
]

export const countDone = (states) => states.filter((state) => state === 'done').length

// "4/4 완료" once everything is done, "2/4" while it isn't.
export function progressLabel(states) {
  const done = countDone(states)
  return `${done}/${states.length}${states.length && done === states.length ? ' 완료' : ''}`
}

const storageOf = () => { try { return localStorage } catch { return null } }

// How many of a change's steps this browser has already seen finished.
export function readSeen(conflictId, storage = storageOf()) {
  try {
    const count = JSON.parse(storage?.getItem(SEEN_KEY))?.[conflictId]
    return Number.isInteger(count) && count > 0 ? count : 0
  } catch { return 0 }
}

export function writeSeen(conflictId, count, storage = storageOf()) {
  if (!storage) return
  try {
    let saved = {}
    try { saved = JSON.parse(storage.getItem(SEEN_KEY)) ?? {} } catch { /* start over */ }
    if (saved[conflictId] === count) return
    storage.setItem(SEEN_KEY, JSON.stringify({ ...saved, [conflictId]: count }))
  } catch { /* storage unavailable: it just plays again next time */ }
}

// Which finished steps move, and when: steps `from`…`to`-1, a beat apart.
// 'wait' holds them hidden until the list is on screen; 'idle' moves nothing.
export const IDLE = { from: 0, to: 0, phase: 'idle', live: false }
export function firstView(seen, done, motion) {
  return motion && done > seen ? { from: seen, to: done, phase: 'wait', live: false } : IDLE
}
// A step finished while it was being watched: it moves now.
export function liveView(before, done, motion) {
  return motion && done > before ? { from: before, to: done, phase: 'play', live: true } : IDLE
}
export const moves = (reveal, index) => reveal.phase !== 'idle' && index >= reveal.from && index < reveal.to
export const delayOf = (reveal, index) => (index - reveal.from) * STEP_STAGGER

// The replay's rail: `reached` of the four steps are at or before the saved
// step in view. Those before the current one are done, it is under way, the
// rest wait — except at the very end, where everything is done.
export function replayStates(total, reached, atEnd) {
  return Array.from({ length: total }, (_, index) => {
    if (atEnd && reached >= total) return 'done'
    if (index < reached - 1) return 'done'
    if (index === Math.max(reached, 1) - 1) return 'current'
    return 'pending'
  })
}

// A step's meta, under its name: its parts a few to a line — never more than
// `separators` "·" in one — so a long one breaks instead of running on.
export function metaLines(parts = [], separators = 2) {
  const pieces = parts.filter(Boolean).flatMap((part) => String(part).split(' · ')).filter(Boolean)
  const lines = []
  for (let index = 0; index < pieces.length; index += separators + 1) lines.push(pieces.slice(index, index + separators + 1).join(' · '))
  return lines
}
