import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Maximize2, Minus, Plus, Scan, X } from 'lucide-react'
import { cn } from 'cn'

// The resolution's comparison, opened large: what's built now and every way to resolve it, side by side
// at the same size and the same zoom — 2×2, or 1×4 on a screen 1600px wide and up. Each cell is the
// change's real component drawn with that way's values (`render(id)`), on the product's light grey.
//
//   · One view for all four: { scale, x, y }. The wheel (or a pinch) zooms about the pointer, a drag pans
//     — in any cell, and the other three do the same, so the same spot is compared. − / + step through
//     맞춤 · 200% · 400% · 800%; 맞춤 is the component at 80% of a cell's width. Scaled with a transform,
//     so an icon's lines stay sharp.
//   · A way is picked by its cell (its header, or a press that isn't a drag) or ← / →; the pick is the
//     detail's own (both ways round). Holding Space shows what's built in the picked cell until it's let go.
//   · The way with a value of one's own takes it in its header (`cells[].editor`); the action at the bottom
//     right is the detail's, for the way picked.
//   · Esc or ✕ closes it.
//
//   cells: [{ id, label, value?, base?, badge?, editor? }] — `base`: what's built (the reference: no radio).

// A component's width, as 맞춤 draws it: this share of a cell's (and never more of its height).
export const FIT_SHARE = 0.8
export const PRESETS = [2, 4, 8]
const MAX = 8
export function fitScaleOf(natural, box, share = FIT_SHARE) {
  if (!natural?.width || !box?.width) return 1
  return Math.min((box.width * share) / natural.width, (box.height * share) / Math.max(1, natural.height))
}
// − / +: the presets around the zoom it's at, 맞춤 the lowest ("null": fitted).
export function stepZoom(scale, fit, direction) {
  const stops = [fit, ...PRESETS.filter((value) => value > fit + 0.001)]
  const now = scale ?? fit
  const next = direction > 0 ? stops.find((value) => value > now + 0.001) : [...stops].reverse().find((value) => value < now - 0.001)
  if (next === undefined) return direction > 0 ? stops[stops.length - 1] : null
  return Math.abs(next - fit) < 0.001 ? null : next
}
// The view at another scale, the point under `point` (px from a cell's middle) staying where it is.
export function zoomAbout(view, scale, point) {
  const k = scale / view.scale
  return { scale, x: point.x - (point.x - view.x) * k, y: point.y - (point.y - view.y) * k }
}

const BUTTON = 'flex size-8 items-center justify-center rounded-lg text-slate-200 transition-colors duration-150 hover:bg-white/[0.1] hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300 disabled:opacity-40'

function PictureViewer({ open, title, cells, selected, onSelect, onClose, render, action = null, below = null }) {
  // { scale: null (맞춤) | number, x, y } — x, y: the component's middle, from each cell's middle.
  const [view, setView] = useState({ scale: null, x: 0, y: 0 })
  const [box, setBox] = useState(null)
  const [natural, setNatural] = useState(null)
  const [peek, setPeek] = useState(false)
  const [dragging, setDragging] = useState(false)
  const areaRef = useRef(null)
  const measureRef = useRef(null)
  const closeRef = useRef(null)
  const returnTo = useRef(null)
  const fit = fitScaleOf(natural, box)
  const scale = view.scale ?? fit
  const ways = cells.filter((cell) => !cell.base)
  const base = cells.find((cell) => cell.base)

  // Opened: fitted, centred, the focus on ✕ (and back where it was on closing).
  useLayoutEffect(() => {
    if (!open) return undefined
    returnTo.current = document.activeElement
    setView({ scale: null, x: 0, y: 0 })
    closeRef.current?.focus({ preventScroll: true })
    return () => { const back = returnTo.current; if (back instanceof HTMLElement && back.isConnected) back.focus({ preventScroll: true }) }
  }, [open])
  // A cell's size (they're all one size), and the component's own (drawn unscaled, out of sight).
  useLayoutEffect(() => {
    if (!open) return undefined
    const area = areaRef.current
    const drawing = measureRef.current
    if (!area || !drawing) return undefined
    const measure = () => {
      setBox((now) => (now && now.width === area.clientWidth && now.height === area.clientHeight ? now : { width: area.clientWidth, height: area.clientHeight }))
      setNatural((now) => (now && now.width === drawing.offsetWidth && now.height === drawing.offsetHeight ? now : { width: drawing.offsetWidth, height: drawing.offsetHeight }))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(area)
    observer.observe(drawing)
    return () => observer.disconnect()
  }, [open])

  const zoomTo = (next, point = { x: 0, y: 0 }) => setView((now) => {
    const from = { scale: now.scale ?? fit, x: now.x, y: now.y }
    if (next === null) return { scale: null, x: 0, y: 0 }
    return zoomAbout(from, Math.min(MAX, Math.max(fit / 2, next)), point)
  })
  const step = (by) => {
    const at = ways.findIndex((cell) => cell.id === selected)
    const next = ways[at === -1 ? (by > 0 ? 0 : ways.length - 1) : (at + by + ways.length) % ways.length]
    if (next) onSelect(next.id)
  }

  // Keys: Esc (its own — the detail under it stays), ← / →, Space held, − / + / 0.
  const keyRef = useRef(null)
  keyRef.current = (event) => {
    if (event.defaultPrevented) return
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); onClose(); return }
    if (event.target instanceof HTMLElement && (event.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName))) return
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); step(event.key === 'ArrowRight' ? 1 : -1) }
    else if (event.key === ' ') { event.preventDefault(); if (!event.repeat) setPeek(true) }
    else if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomTo(stepZoom(view.scale, fit, 1)) }
    else if (event.key === '-') { event.preventDefault(); zoomTo(stepZoom(view.scale, fit, -1)) }
    else if (event.key === '0') { event.preventDefault(); zoomTo(null) }
  }
  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => keyRef.current(event)
    const onUp = (event) => { if (event.key === ' ') setPeek(false) }
    const onBlur = () => setPeek(false)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('keyup', onUp, true)
    window.addEventListener('blur', onBlur)
    return () => { window.removeEventListener('keydown', onKey, true); window.removeEventListener('keyup', onUp, true); window.removeEventListener('blur', onBlur) }
  }, [open])

  // The wheel or a pinch, over any cell: zoomed about the pointer — the same in all four.
  const gridRef = useRef(null)
  const fitRef = useRef(fit)
  fitRef.current = fit
  useEffect(() => {
    const grid = gridRef.current
    if (!open || !grid) return undefined
    const onWheel = (event) => {
      const area = event.target.closest?.('[data-compare-area]')
      if (!area) return
      event.preventDefault()
      const rect = area.getBoundingClientRect()
      const point = { x: event.clientX - rect.left - rect.width / 2, y: event.clientY - rect.top - rect.height / 2 }
      const factor = Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.0025))
      setView((now) => {
        const from = { scale: now.scale ?? fitRef.current, x: now.x, y: now.y }
        return zoomAbout(from, Math.min(MAX, Math.max(fitRef.current / 2, from.scale * factor)), point)
      })
    }
    grid.addEventListener('wheel', onWheel, { passive: false })
    return () => grid.removeEventListener('wheel', onWheel)
  }, [open])

  // A drag in any cell pans all four; a press that doesn't move picks that cell's way.
  function startPan(event, cell) {
    if (event.button !== 0) return
    event.preventDefault()
    const from = { x: event.clientX, y: event.clientY, view: { scale, x: view.x, y: view.y } }
    let moved = false
    const onMove = (move) => {
      const dx = move.clientX - from.x
      const dy = move.clientY - from.y
      if (!moved && Math.hypot(dx, dy) < 4) return
      if (!moved) { moved = true; setDragging(true) }
      setView({ ...from.view, x: from.view.x + dx, y: from.view.y + dy })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setDragging(false)
      if (!moved && !cell.base) onSelect(cell.id)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  if (!open) return null
  const zoomLabel = view.scale === null ? '맞춤' : `${Math.round(scale * 100)}%`
  return createPortal(
    <div data-picture-viewer data-compare-viewer role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[950] flex flex-col bg-black/[0.76] backdrop-blur-[3px] animate-in fade-in duration-200 motion-reduce:animate-none">
      <header className="flex h-14 shrink-0 items-center gap-3 px-4">
        <button ref={closeRef} type="button" data-viewer-close aria-label="닫기" title="닫기 · Esc" onClick={onClose} className={cn(BUTTON, 'border border-white/[0.08] bg-black/45')}><X className="size-4" /></button>
        <h2 data-viewer-title className="min-w-0 truncate text-[14px] font-semibold text-slate-100">{title}</h2>
      </header>

      <div ref={gridRef} data-compare-grid className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-4 px-6 pb-2 min-[1600px]:grid-cols-4 min-[1600px]:grid-rows-1">
        {cells.map((cell, index) => {
          const on = !cell.base && cell.id === selected
          const shown = on && peek && base ? base.id : cell.id
          const drawing = render(shown)
          return (
            <section key={cell.id} data-compare-cell={cell.id} data-selected={on ? '' : undefined} aria-label={cell.label} className={cn('flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border', on ? 'border-[var(--ds-accent-border)]' : 'border-white/[0.08]')}>
              {/* Its header: what it is, its value, and — a way — its radio (the reference has none). */}
              <div data-compare-head className={cn('flex h-10 shrink-0 items-center gap-2 px-3 text-[12.5px]', on ? 'bg-[var(--ds-accent-bg)]' : 'bg-[#161618]')}>
                {cell.base ? (
                  <span className="flex min-w-0 flex-1 items-center gap-2 text-slate-400">
                    <span className="truncate font-medium">{cell.label}</span>
                    {cell.value && <Chip>{cell.value}</Chip>}
                  </span>
                ) : (
                  <>
                    <button type="button" role="radio" aria-checked={on} data-compare-pick={cell.id} onClick={() => onSelect(cell.id)} className="ds-intrinsic flex min-w-0 shrink items-center gap-2 rounded-md text-left focus-visible:outline-2 focus-visible:outline-emerald-300">
                      <span aria-hidden className={cn('flex size-4 shrink-0 items-center justify-center rounded-full border-2', on ? 'border-emerald-400' : 'border-white/30')}>{on && <span className="size-2 rounded-full bg-emerald-400" />}</span>
                      <span className="truncate font-medium text-slate-100"><span className="text-slate-400">옵션 {index}</span> {cell.label}</span>
                    </button>
                    {cell.badge && <span className="shrink-0 rounded bg-[var(--ds-accent-bg)] px-1.5 text-[10.5px] leading-[18px] font-medium text-[var(--ds-accent-text)]">{cell.badge}</span>}
                    {cell.editor ?? (cell.value && <Chip>{cell.value}</Chip>)}
                    <span className="flex-1" />
                    {on && <span data-compare-selected className="shrink-0 rounded bg-[var(--ds-accent-bg)] px-1.5 text-[10.5px] leading-[18px] font-medium text-[var(--ds-accent-text)] ring-1 ring-[var(--ds-accent-border)] ring-inset">{peek && base ? '현재 구현 보는 중' : '선택됨'}</span>}
                  </>
                )}
              </div>
              {/* The drawing: on the product's grey, at the one view all four share. */}
              <div
                ref={index === 0 ? areaRef : undefined}
                data-compare-area={cell.id}
                onPointerDown={(event) => startPan(event, cell)}
                className={cn('relative min-h-0 flex-1 overflow-hidden bg-[#F5F5F5] touch-none select-none', dragging ? 'cursor-grabbing' : 'cursor-grab')}
              >
                {drawing ? (
                  <div data-compare-drawing={shown} className="absolute top-1/2 left-1/2 w-max" style={{ transform: `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) scale(${scale})` }}>
                    {drawing}
                  </div>
                ) : (
                  <p className="absolute inset-0 flex items-center justify-center text-[12.5px] text-slate-500">값을 입력하면 여기에 그려져요</p>
                )}
              </div>
            </section>
          )
        })}
      </div>
      {/* (The component at its own size, out of sight: what 맞춤 is worked out from.) */}
      <div aria-hidden className="pointer-events-none fixed top-0 left-[-10000px] invisible"><div ref={measureRef} className="w-max">{render(base?.id ?? cells[0]?.id)}</div></div>

      {below && <div data-viewer-controls className="mx-auto w-[min(640px,calc(100vw-48px))] shrink-0 rounded-xl border border-white/[0.08] bg-[#161618]/95 p-3">{below}</div>}

      <footer className="flex h-16 shrink-0 items-center gap-3 px-6">
        <p data-viewer-hint className="min-w-0 flex-1 truncate text-[12px] text-slate-400">←→ 옵션 선택 · Space 누르고 있으면 현재와 비교</p>
        <div role="toolbar" aria-label="확대" className="flex items-center gap-0.5 rounded-xl border border-white/[0.08] bg-black/45 p-1">
          <button type="button" data-viewer-zoom-out aria-label="축소" title="축소 · −" disabled={view.scale === null} onClick={() => zoomTo(stepZoom(view.scale, fit, -1))} className={BUTTON}><Minus className="size-4" /></button>
          <button type="button" data-viewer-zoom title="맞춤 · 0" onClick={() => zoomTo(null)} className="h-8 w-14 rounded-lg text-center text-xs text-slate-200 tabular-nums hover:bg-white/[0.1]">{zoomLabel}</button>
          <button type="button" data-viewer-zoom-in aria-label="확대" title="확대 · +" disabled={scale >= MAX - 0.001} onClick={() => zoomTo(stepZoom(view.scale, fit, 1))} className={BUTTON}><Plus className="size-4" /></button>
          <button type="button" data-viewer-fit aria-label="맞춤" title="맞춤 · 0" onClick={() => zoomTo(null)} className={BUTTON}><Scan className="size-4" /></button>
        </div>
        {/* The detail's action, for the way picked — the one solid green on the screen. */}
        {action && (
          <button type="button" data-viewer-apply disabled={action.disabled} title={action.title} onClick={action.onClick} className="ds-intrinsic inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-[var(--ds-accent)] px-4 text-[13px] font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-slate-500">
            {action.label}
          </button>
        )}
      </footer>
    </div>,
    document.body
  )
}

function Chip({ children }) {
  return <span data-compare-value className="min-w-0 shrink truncate rounded bg-white/[0.07] px-1.5 font-mono text-[11px] leading-[18px] text-slate-300 tabular-nums">{children}</span>
}

// A picture in the detail that opens large: the drawing as it is, and — on hover or focus only — an
// expand button at its top right. The picture itself opens it too.
export function ExpandablePicture({ id, label, onOpen, children }) {
  return (
    <div data-zoom-picture={id} className="group/zoom relative grid h-full min-h-0 w-full items-center">
      <button type="button" data-picture-zoom aria-label={`${label} · 크게 보기`} aria-haspopup="dialog" onClick={() => onOpen(id)} className="ds-intrinsic grid h-full min-h-0 w-full cursor-zoom-in items-center overflow-hidden rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300">
        <span data-zoom-source={id} className="mx-auto block w-full">{children}</span>
      </button>
      <button type="button" tabIndex={-1} aria-hidden data-picture-expand onClick={() => onOpen(id)}
        className="absolute top-0 right-0 flex size-8 cursor-zoom-in items-center justify-center rounded-lg border border-white/[0.08] bg-black/55 text-slate-100 opacity-0 backdrop-blur-sm transition-opacity duration-[160ms] ease-out group-focus-within/zoom:opacity-100 group-hover/zoom:opacity-100 hover:bg-black/70 motion-reduce:transition-none">
        <Maximize2 className="size-4" />
      </button>
    </div>
  )
}

export default PictureViewer
