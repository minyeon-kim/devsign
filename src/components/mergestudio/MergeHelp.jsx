import { useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from 'cn'
import { STUDIO_PILL as FLOATING_PILL } from '@/components/mergestudio/floatingStyles'
import { getLanguage } from '@/i18n/language'

// Help as coach marks: pressing ? outlines the few areas that matter, in
// the order they're used, each with one short note — right where it is.
// Any click or Esc closes it. A mark shows only for what's on screen.
const MARKS = [
  { selector: '[data-draft-board]', ko: ['시안 비교', '요소에 올리고 "이걸로" · 끌어서 이동 · ⌘+스크롤 확대'], en: ['Drafts', 'Point at a part, "Use this" · drag to move · ⌘-scroll to zoom'] },
  { selector: '[data-mix-panel]', ko: ['요소', '미리보기를 눌러 교체 · 끌어서 옮기기 · 접기'], en: ['Parts', 'Press a preview to use it · drag to move · fold'] },
  { selector: '[data-frame-key="result"] [data-frame-box]', ko: ['결과', '클릭: 영역 → 요소 · 더블클릭: 텍스트 수정'], en: ['Result', 'Click a region · again for one element · double-click for text'] },
  { selector: '[data-merge-request]', ko: ['병합 요청', '조합을 마치면'], en: ['Request merge', 'When the mix is done'] },
]

function measureMarks() {
  const ko = getLanguage() === 'ko'
  const marks = []
  for (const mark of MARKS) {
    const el = document.querySelector(mark.selector)
    const r = el?.getBoundingClientRect()
    if (!r || r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > window.innerHeight) continue
    const [title, text] = ko ? mark.ko : mark.en
    marks.push({ ...mark, title, text, rect: { left: r.left, top: r.top, width: r.width, height: r.height } })
  }
  return marks
}

// Where each note goes: inside a large area (its bottom-left corner), under
// a small control (above it near the bottom edge) — nudged clear of the
// notes already placed, so no two overlap.
const NOTE_W = 260
const NOTE_H = 64
function placeNotes(marks) {
  const placed = []
  return marks.map((mark) => {
    const r = mark.rect
    const big = r.width > 300 && r.height > 200
    let left = big ? r.left + 12 : r.left
    let top = big ? r.top + r.height - NOTE_H - 8 : r.top + r.height + 10
    if (!big && top + NOTE_H > window.innerHeight - 8) top = r.top - NOTE_H - 10
    left = Math.min(Math.max(8, left), window.innerWidth - NOTE_W - 8)
    const hits = (box) => placed.some((other) => box.left < other.left + NOTE_W && other.left < box.left + NOTE_W && box.top < other.top + NOTE_H && other.top < box.top + NOTE_H)
    let note = { left, top }
    for (let tries = 0; tries < 12 && hits(note); tries++) note = { ...note, top: note.top + NOTE_H + 6 }
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
    <div data-coach-marks role="dialog" aria-label={ko ? '도움말' : 'Help'} className="fixed inset-0 z-[2000] cursor-pointer bg-slate-950/45" onClick={onClose}>
      {placeNotes(marks).map(({ mark, note }, index) => (
        <div key={mark.selector}>
          <div className="pointer-events-none absolute rounded-xl ring-1 ring-white/50" style={{ left: mark.rect.left - 3, top: mark.rect.top - 3, width: mark.rect.width + 6, height: mark.rect.height + 6 }} />
          <div
            data-coach-mark={index + 1}
            className="pointer-events-none absolute flex gap-2 rounded-xl bg-slate-900/95 px-3 py-2 shadow-xl ring-1 ring-white/10"
            style={{ left: note.left, top: note.top, width: NOTE_W }}
          >
            <span className="mt-px flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-[10px] font-semibold text-emerald-300">{index + 1}</span>
            <span className="min-w-0">
              <span className="block text-[12px] leading-4 font-semibold text-slate-100">{mark.title}</span>
              <span className="block text-[11px] leading-4 text-slate-400">{mark.text}</span>
            </span>
          </div>
        </div>
      ))}
      <p className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 text-[11px] text-slate-400">
        {ko ? '누르거나 Esc로 닫기' : 'Click or Esc to close'}
      </p>
    </div>,
    document.body,
  )
}

function MergeHelp({ inline = false, compact = false }) {
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
        className={compact
          ? cn('ds-intrinsic flex size-9 items-center justify-center rounded-lg bg-white/[0.05] text-[13px] font-semibold text-slate-200 ring-1 ring-white/10 transition-colors hover:bg-white/[0.1]', open && 'bg-white/[0.1]')
          : cn(inline && 'merge-help-inline', 'flex size-10 items-center justify-center rounded-full text-[13px] font-semibold text-foreground transition-colors hover:bg-muted', open && 'bg-muted', FLOATING_PILL)}
      >
        <span aria-hidden>?</span>
      </button>
      {open && <CoachMarks onClose={() => setOpen(false)} />}
    </div>
  )
}

export default MergeHelp
