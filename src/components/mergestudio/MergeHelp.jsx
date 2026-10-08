import { useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from 'cn'
import { STUDIO_PILL as FLOATING_PILL } from '@/components/mergestudio/floatingStyles'
import { getLanguage } from '@/i18n/language'

// Help as coach marks: pressing ? lights every control on screen that does
// something, each with a numbered note on what it does — right where it is,
// rather than a list to match against the screen. Any click or Esc closes it.
// A mark shows only for what's actually on screen (comparing drafts or not).
const MARKS = [
  { selector: '[data-draft-view-tabs]', ko: '보기: 전체, 또는 A·B·C·D 중 고른 것만 나란히', en: 'View: all, or only the drafts picked, side by side' },
  { selector: '[data-board-zoom]', ko: '시안 배율: 맞춤 · 축소 · 확대', en: 'Drafts zoom: fit · out · in' },
  { selector: '[data-draft-window]', ko: '칸 안에서 끌어 이동 · ⌘/Ctrl+스크롤 확대 · 가리키면 간격', en: 'Drag inside to move · ⌘/Ctrl-scroll to zoom · point for spacing' },
  { selector: '[data-compare-divider]', ko: '끌어서 양쪽 크기 조절 · 두 번 누르면 반반', en: 'Drag to resize both sides · double-click for half and half' },
  { selector: '[data-mix-region-trigger]', ko: '조합할 요소 고르기', en: 'Pick the part to mix' },
  { selector: '[data-mix-option]', ko: '이 요소를 이 시안 것으로 · 다시 누르면 해제', en: 'Use this draft for the part · press again to undo' },
  { selector: '[data-check-status]', ko: '병합 전 검사 결과', en: 'Pre-merge checks' },
  { selector: '[data-view-frames]', ko: '결과를 볼 기기 프레임', en: 'Device frame for the result' },
  { selector: '[data-result-zoom]', ko: '결과 배율', en: 'Result zoom' },
  { selector: '[data-result-preview]', ko: '결과를 크게 미리보기', en: 'Preview the result large' },
  { selector: '[data-frame-key="result"] [data-frame-box]', ko: '결과: 끌어서 이동 · 영역을 누르면 선택', en: 'Result: drag to move · click a part to select it' },
  { selector: '[data-merge-request]', ko: '조합을 마치고 병합 요청', en: 'Finish the mix and request the merge' },
  { selector: '[data-history-controls]', ko: '되돌리기 · 다시 실행', en: 'Undo · redo' },
]

function measureMarks() {
  const ko = getLanguage() === 'ko'
  const marks = []
  for (const mark of MARKS) {
    const el = document.querySelector(mark.selector)
    const r = el?.getBoundingClientRect()
    if (!r || r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > window.innerHeight) continue
    marks.push({ ...mark, text: ko ? mark.ko : mark.en, rect: { left: r.left, top: r.top, width: r.width, height: r.height } })
  }
  return marks
}

// Where each note goes: under its control (above it near the bottom edge,
// beside it for a tall one like the divider), nudged down until it clears
// the notes already placed — so no two overlap.
const NOTE_H = 24
function placeNotes(marks) {
  const placed = []
  return marks.map((mark) => {
    // (Hangul runs about twice as wide as Latin at this size.)
    const textWidth = [...mark.text].reduce((sum, char) => sum + (char.charCodeAt(0) > 0x2e80 ? 11 : 6.5), 0) + 36
    const width = Math.min(240, textWidth)
    const lines = Math.ceil(textWidth / 240)
    const height = NOTE_H + (lines - 1) * 16
    const r = mark.rect
    let left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8)
    let top
    if (r.height > 240) { left = Math.min(r.left + r.width + 8, window.innerWidth - width - 8); top = r.top + r.height / 2 - height / 2 }
    else if (r.top + r.height + height + 16 < window.innerHeight) top = r.top + r.height + 8
    else top = r.top - height - 8
    const hits = (box) => placed.some((other) => box.left < other.left + other.width && other.left < box.left + box.width && box.top < other.top + other.height && other.top < box.top + box.height)
    let note = { left, top, width, height }
    for (let tries = 0; tries < 12 && hits(note); tries++) note = { ...note, top: note.top + height + 4 }
    placed.push(note)
    return { mark, note }
  })
}

function CoachMarks({ onClose }) {
  const [marks, setMarks] = useState([])
  useLayoutEffect(() => {
    const update = () => setMarks(measureMarks())
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const ko = getLanguage() === 'ko'
  return createPortal(
    <div data-coach-marks role="dialog" aria-label={ko ? '도움말' : 'Help'} className="fixed inset-0 z-[2000] cursor-pointer bg-slate-950/55" onClick={onClose}>
      {placeNotes(marks).map(({ mark, note }, index) => (
        <div key={mark.selector}>
          <div className="pointer-events-none absolute rounded-lg ring-2 ring-emerald-300" style={{ left: mark.rect.left - 2, top: mark.rect.top - 2, width: mark.rect.width + 4, height: mark.rect.height + 4 }} />
          <div
            data-coach-mark={index + 1}
            className="pointer-events-none absolute flex items-start gap-1.5 rounded-lg bg-emerald-300 px-2 py-1 text-[11px] leading-4 font-medium text-slate-950 shadow-lg"
            style={{ left: note.left, top: note.top, width: note.width }}
          >
            <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-slate-950 text-[9.5px] text-emerald-300">{index + 1}</span>
            {mark.text}
          </div>
        </div>
      ))}
      <p className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/90 px-4 py-2 text-xs text-slate-200 ring-1 ring-white/10">
        {ko ? '아무 곳이나 누르거나 Esc로 닫기' : 'Click anywhere or press Esc to close'}
      </p>
    </div>,
    document.body,
  )
}

function MergeHelp({ inline = false }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={inline ? 'shrink-0' : 'absolute bottom-5 left-4 z-40'}>
      <button
        type="button"
        data-merge-help
        aria-label="Merge Studio help"
        title="Merge Studio help"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={cn(inline && 'merge-help-inline', 'flex size-10 items-center justify-center rounded-full text-[13px] font-semibold text-foreground transition-colors hover:bg-muted', open && 'bg-muted', FLOATING_PILL)}
      >
        <span aria-hidden>?</span>
      </button>
      {open && <CoachMarks onClose={() => setOpen(false)} />}
    </div>
  )
}

export default MergeHelp
