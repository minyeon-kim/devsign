import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, X } from 'lucide-react'
import { cn } from 'cn'

// The resolution's comparison board: the ways to resolve a change, enlarged,
// beside the detail rather than over it — so the ways stay in view and can be
// picked while the board is up (it isn't modal: nothing behind it is blocked).
//
//   · It opens on the canvas's side of the detail (whichever side has the
//     room), can be moved by its header, and comes back where it was left.
//   · One at a time: tabs for what's built now and each way, each with its
//     key values; ← / → or 1–4 step through them, cross-fading in place.
//   · Side by side: an editorial grid — a 160px label column, then the same
//     picture in its states (default, hover, pressed, disabled) at one size
//     and one scale, a dotted rule between rows. A row is a way: pressing it
//     (or ↑ / ↓ and Enter) picks it, here and in the detail.
//   · 100% / 200% / fit apply to every picture at once; past the board's
//     width the pictures scroll, the labels stay.
// The pictures are the detail's own (`render(which, width)`); the board only
// lays them out. What's picked is the detail's (`picked`, `onPick`).
//
//   rows: [{ id, title, spec, which, drawable, current? }] — the first is what's built now.

const POS_KEY = 'devsign:compareBoard.pos'
const PREFS_KEY = 'devsign:compareBoard.prefs'
const LABEL_W = 160
const GAP = 8
const BASE_CELL = 132
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback } catch { return fallback } }
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* not kept */ } }
const typing = (target) => target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))

// The states a control is seen in, side by side. (Drawn from the same picture: hover a touch lighter,
// pressed a touch darker and smaller, disabled faded and grey — the states the code itself gives it.)
export const STATES = [
  { id: 'default', label: '기본', style: {} },
  { id: 'hover', label: 'Hover', style: { filter: 'brightness(1.08)' } },
  { id: 'pressed', label: 'Pressed', style: { filter: 'brightness(0.9)', transform: 'scale(0.97)' } },
  { id: 'disabled', label: 'Disabled', style: { filter: 'grayscale(0.85)', opacity: 0.45 } },
]
// A way's colour, for its chip: the colour it sets, when it sets one; otherwise its place's accent.
const ACCENTS = ['#34d399', '#38bdf8', '#a78bfa', '#f472b6']
export const chipOf = (row, index) => (row.current ? '#94a3b8' : row.spec?.match(/#[0-9a-f]{6}\b/i)?.[0] ?? ACCENTS[(index - 1) % ACCENTS.length])
// A way's values against what's built: the parts that differ are the ones to see.
export function changedParts(spec, current) {
  const base = new Set(String(current ?? '').split(' · ').map((part) => part.trim().toLowerCase()))
  return String(spec ?? '').split(' · ').map((part) => ({ text: part, changed: !base.has(part.trim().toLowerCase()) }))
}
// Where the board opens: on whichever side of the detail has more room, its top a little under the detail's.
export function placeBoard(panel, size, viewport) {
  const left = panel.left
  const right = viewport.width - panel.right
  const x = right > left ? Math.min(viewport.width - size.width - 16, panel.right + 16) : Math.max(16, panel.left - 16 - size.width)
  return { x: Math.round(Math.max(16, x)), y: Math.round(Math.max(16, Math.min(viewport.height - size.height - 16, panel.top + 56))) }
}

// (`opening`: a new object each time it's opened — the tab asked for is shown then; between openings the tab in view is kept, even if the detail draws the board anew.)
const TABS = new Map()

function CompareBoard({ open, onClose, conflict, rows, picked, onPick, focusId = null, opening = null, render, anchor }) {
  const [prefs, setPrefs] = useState(() => ({ view: 'single', zoom: 'fit', ...read(PREFS_KEY, {}) }))
  const setPref = (patch) => setPrefs((prev) => { const next = { ...prev, ...patch }; write(PREFS_KEY, next); return next })
  const boardRef = useRef(null)
  const [pos, setPos] = useState(() => read(POS_KEY, null))
  // The tab in view (one at a time): the one asked for on opening, then the way picked as it changes.
  // (What's remembered: this opening's tab, and the way that was picked when it was last looked at.)
  const kept = TABS.get(conflict.id)?.opening === opening ? TABS.get(conflict.id) : null
  const [tab, setTabState] = useState(() => kept?.tab ?? focusId ?? picked ?? rows[0]?.id)
  const setTab = (next) => { TABS.set(conflict.id, { opening, tab: next, pick: picked }); setTabState(next) }
  const [seenPick, setSeenPick] = useState(() => kept?.pick ?? picked)
  if (seenPick !== picked) { setSeenPick(picked); if (picked && rows.some((row) => row.id === picked)) setTab(picked) }
  const [shownOpening, setShownOpening] = useState(opening)
  if (open && opening !== shownOpening) { setShownOpening(opening); if (focusId) setTab(focusId) }

  // First opening: beside the detail, on its roomier side.
  useLayoutEffect(() => {
    if (!open || pos || !boardRef.current) return
    const panel = anchor?.getBoundingClientRect?.() ?? { left: 0, right: 0, top: 80 }
    const box = boardRef.current.getBoundingClientRect()
    setPos(placeBoard(panel, { width: box.width, height: box.height }, { width: window.innerWidth, height: window.innerHeight }))
  }, [open, pos, anchor])

  // Moved by its header; kept where it's left.
  function drag(event) {
    if (event.button !== 0 || event.target.closest('button, [role="tab"]')) return
    event.preventDefault()
    const start = { x: event.clientX, y: event.clientY, pos: pos ?? { x: 16, y: 16 } }
    let last = start.pos
    const onMove = (move) => {
      last = { x: Math.round(Math.max(0, Math.min(window.innerWidth - 120, start.pos.x + move.clientX - start.x))), y: Math.round(Math.max(0, Math.min(window.innerHeight - 48, start.pos.y + move.clientY - start.y))) }
      setPos(last)
    }
    const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); write(POS_KEY, last) }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // Esc closes it; one at a time, ← / → and 1–4 step through the tabs. (Not while typing — the detail's own field is beside it.)
  const keys = useRef(null)
  keys.current = (event) => {
    if (event.defaultPrevented || typing(event.target) || event.metaKey || event.ctrlKey || event.altKey) return
    if (event.key === 'Escape') { if (document.querySelector('[role="menu"], [data-slot="dialog-content"]')) return; event.preventDefault(); event.stopPropagation(); onClose(); return }
    if (prefs.view !== 'single') return
    const at = rows.findIndex((row) => row.id === tab)
    const to = event.key === 'ArrowRight' ? at + 1 : event.key === 'ArrowLeft' ? at - 1 : /^[1-9]$/.test(event.key) ? Number(event.key) - 1 : null
    if (to == null || !rows[to]) return
    event.preventDefault()
    choose(rows[to].id)
  }
  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => keys.current(event)
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open])

  // A tab or a row taken: a way is picked in the detail too (what's built now is only looked at).
  function choose(id) {
    setTab(id)
    const row = rows.find((entry) => entry.id === id)
    if (row && !row.current) onPick(id)
  }

  if (!open) return null
  const current = rows[0]
  // The pictures' size: every one the same — 100% and 200% of the base, or fitted to the board's width.
  const states = conflict.layouts ? STATES.slice(0, 1) : STATES
  const sideRoom = 720 - LABEL_W - 48 - GAP * (states.length - 1)
  const cell = prefs.zoom === '200' ? BASE_CELL * 2 : prefs.zoom === '100' ? BASE_CELL : Math.floor(sideRoom / states.length)
  const singleW = prefs.zoom === '200' ? 560 : prefs.zoom === '100' ? 280 : 440

  const board = (
    <div
      ref={boardRef}
      data-compare-board
      role="dialog"
      aria-label="해결 방법 비교"
      aria-modal="false"
      className="fixed z-[880] flex max-h-[calc(100vh-32px)] w-[720px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#161618] text-slate-200 shadow-2xl shadow-black/60"
      style={{ left: pos?.x ?? -9999, top: pos?.y ?? 0 }}
    >
      <header data-compare-head onPointerDown={drag} className="flex shrink-0 cursor-grab items-start gap-4 border-b border-white/[0.08] px-5 pt-4 pb-3 select-none active:cursor-grabbing">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] text-slate-500" translate="no">#{conflict.id} · {conflict.title?.split(' / ')[0]}</p>
          <h2 className="mt-0.5 text-[20px] leading-7 font-bold text-white">해결 방법 비교</h2>
          <p className="mt-0.5 text-[12px] text-slate-400">같은 배율·같은 상태로 나란히 확인하세요</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-1">
          <div role="radiogroup" aria-label="보기" className="flex h-7 items-center rounded-md bg-white/[0.05] p-0.5">
            {[['single', '한 개씩'], ['side', '나란히']].map(([id, label]) => (
              <button key={id} type="button" role="radio" aria-checked={prefs.view === id} data-compare-view={id} onClick={() => setPref({ view: id })} className={cn('h-6 rounded px-2.5 text-[11.5px] transition-colors focus-visible:outline-2 focus-visible:outline-emerald-300', prefs.view === id ? 'bg-white/[0.12] font-semibold text-white' : 'text-slate-400 hover:text-slate-200')}>{label}</button>
            ))}
          </div>
          <div role="radiogroup" aria-label="배율" className="flex h-7 items-center rounded-md bg-white/[0.05] p-0.5">
            {[['100', '100%'], ['200', '200%'], ['fit', '맞춤']].map(([id, label]) => (
              <button key={id} type="button" role="radio" aria-checked={prefs.zoom === id} data-compare-zoom={id} onClick={() => setPref({ zoom: id })} className={cn('h-6 rounded px-2 text-[11.5px] tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-emerald-300', prefs.zoom === id ? 'bg-white/[0.12] font-semibold text-white' : 'text-slate-400 hover:text-slate-200')}>{label}</button>
            ))}
          </div>
          <button type="button" data-compare-close aria-label="닫기" title="닫기 · Esc" onClick={onClose} className="flex size-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300"><X className="size-4" /></button>
        </div>
      </header>

      {prefs.view === 'single' ? (
        <div data-compare-single className="flex min-h-0 flex-col">
          <div role="tablist" aria-label="해결 방법" className="flex shrink-0 gap-1 overflow-x-auto px-5 pt-3 [scrollbar-width:none]">
            {rows.map((row, index) => (
              <button key={row.id} type="button" role="tab" aria-selected={tab === row.id} data-compare-tab={row.id} onClick={() => choose(row.id)} title={row.spec}
                className={cn('flex min-w-0 shrink-0 flex-col items-start rounded-lg px-3 py-1.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-emerald-300', tab === row.id ? 'bg-white/[0.1]' : 'hover:bg-white/[0.05]')}>
                <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-100"><span aria-hidden className="size-2.5 rounded-full" style={{ background: chipOf(row, index) }} />{row.title}{!row.current && picked === row.id && <Check aria-label="선택됨" className="size-3.5 text-emerald-300" />}</span>
                <span className="max-w-[180px] truncate text-[11px] text-slate-400 tabular-nums">{row.spec || '—'}</span>
              </button>
            ))}
          </div>
          {/* Every tab's picture in one place, the one in view on top: changing tabs cross-fades, nothing moves. */}
          <div className="min-h-0 overflow-auto p-5">
            <div className="grid rounded-xl bg-[#F2F2F2] p-6">
              {rows.map((row) => (
                <div key={row.id} data-compare-pane={row.id} aria-hidden={tab !== row.id} className={cn('col-start-1 row-start-1 flex items-center justify-center transition-opacity duration-150 ease-out motion-reduce:transition-none', tab === row.id ? 'opacity-100' : 'pointer-events-none opacity-0')}>
                  {row.drawable ? render(row.which, singleW) : <p className="text-xs text-slate-500">미리보기 없음 · 값을 골라 주세요</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        // The grid: a label column that stays, and the pictures' columns that scroll past the board's width.
        <div data-compare-side className="min-h-0 overflow-auto px-5 pb-4">
          <div className="grid w-max min-w-full" style={{ gridTemplateColumns: `${LABEL_W}px repeat(${states.length}, ${cell}px)`, columnGap: GAP }}>
            <span className="sticky left-0 z-10 bg-[#161618]" />
            {states.map((state) => <span key={state.id} data-compare-col={state.id} className="pt-3 pb-2 text-[11px] text-slate-500">{state.label}</span>)}
            {rows.map((row, index) => {
              const chosen = !row.current && picked === row.id
              const parts = changedParts(row.spec, current.spec)
              return (
                <Fragment key={row.id}>
                  {/* (A row is one button — its label and pictures — laid over the grid's own cells.) */}
                  <button
                    type="button"
                    data-compare-row={row.id}
                    aria-pressed={row.current ? undefined : chosen}
                    disabled={row.current}
                    onClick={() => choose(row.id)}
                    onKeyDown={(event) => {
                      const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
                      if (!step) return
                      event.preventDefault()
                      event.currentTarget.parentElement.querySelectorAll('[data-compare-row]')[Math.max(0, Math.min(rows.length - 1, index + step))]?.focus()
                    }}
                    className={cn('group/row relative col-span-full grid items-center rounded-lg border py-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-emerald-300 disabled:cursor-default', index > 0 && 'mt-0', chosen ? 'border-emerald-400 bg-emerald-400/[0.05]' : 'border-transparent enabled:hover:bg-white/[0.03]')}
                    style={{ gridTemplateColumns: 'subgrid' }}
                  >
                    {/* (The dotted rule above every row but the first.) */}
                    {index > 0 && <span aria-hidden className="pointer-events-none absolute inset-x-0 -top-px border-t border-dashed border-white/10" />}
                    <span className="sticky left-0 z-10 flex min-w-0 flex-col gap-1 self-start bg-inherit pr-3 pl-3">
                      <span className={cn('flex items-center gap-1.5 text-[14px] leading-5 font-semibold', row.current ? 'text-slate-400' : 'text-white')}>
                        <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: chipOf(row, index) }} />
                        <span className="min-w-0 truncate">{row.title}</span>
                        {chosen && <span data-compare-picked className="ml-auto shrink-0 rounded-full bg-emerald-400/15 px-1.5 py-0.5 text-[10px] leading-none font-semibold text-emerald-200">선택됨</span>}
                      </span>
                      <span className="line-clamp-2 text-[12px] leading-4 text-slate-400 tabular-nums">
                        {parts.length && row.spec ? parts.map((part, i) => <Fragment key={i}>{i > 0 && ' · '}{!row.current && part.changed ? <b className="font-semibold text-slate-100">{part.text}</b> : part.text}</Fragment>) : '직접 입력'}
                      </span>
                    </span>
                    {states.map((state) => (
                      <span key={state.id} title={`${row.title} · ${state.label}${row.spec ? ` · ${row.spec}` : ''}`} data-compare-cell={state.id} className="flex items-center justify-center overflow-hidden rounded-lg bg-[#F2F2F2] p-2" style={{ width: cell, height: Math.round(cell * 0.75) }}>
                        {row.drawable
                          ? <span className="block w-full origin-center" style={state.style}>{render(row.which, cell - 16)}</span>
                          : <span className="text-[10.5px] text-slate-500">미리보기 없음</span>}
                      </span>
                    ))}
                  </button>
                </Fragment>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
  return createPortal(board, document.body)
}

export default CompareBoard
