import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { cn } from 'cn'
import { StaticLayer } from '@/components/mergestudio/MergeInfiniteCanvas'
import { overrideFromEdit } from '@/lib/prototypeSync'
import { focusView } from '@/lib/screensBoard'
import { setCanvasPreview } from '@/lib/canvasPreview'

// The canvas comparing a fix's ways, in its own place (over the canvas, never over the detail beside it):
// the change's screen laid out once per way — what's built, then each way — drawn the one way the canvas
// draws (StaticLayer), each with only its way's values put over it. Nothing else is shown.
//
//   · 나란히: the screens side by side, one view for all of them ({ zoom, x, y }): the wheel zooms about the
//     pointer and a drag pans, in any of them, and the rest follow — the same spot at the same size. It
//     opens on the element, as the canvas closes in on it. A press that isn't a drag picks that way.
//   · Swipe: what's built and the way picked on one screen, a handle between them dragged across.
//   · Onion: the way picked over what's built, its opacity on a slider.
//   · Esc or "비교 종료": back to the canvas as it was.
//
//   preview: lib/canvasPreview's state; frame: the change's screen; box: its element, in the frame's units.

const MODES = [['side', '나란히'], ['swipe', 'Swipe'], ['onion', 'Onion']]
const ZOOM_MIN = 0.25
const ZOOM_MAX = 6
const NONE = () => {}

// One screen, drawn as the canvas draws it, with `overrides` put over it.
export function FrameDrawing({ frame, edits = {}, overrides = {} }) {
  return (
    <div data-compare-frame={frame.id} className="relative overflow-hidden rounded-xl bg-white shadow-2xl shadow-black/40 ring-1 ring-slate-200/80" style={{ width: frame.width, height: frame.height }}>
      {frame.layers.map((layer) => {
        const own = overrideFromEdit(edits[layer.id])
        return <StaticLayer key={layer.id} layer={layer} override={overrides[layer.id] ? { ...own, ...overrides[layer.id] } : own} editHint={false} onSelect={NONE} onHover={NONE} />
      })}
    </div>
  )
}

export default function CompareCanvas({ preview, frame, box, edits }) {
  const mode = preview.compare ?? 'side'
  const cells = [preview.base, ...preview.ways]
  const shownWay = preview.ways.find((way) => way.id === preview.picked && !way.empty) ?? preview.ways.find((way) => !way.empty) ?? preview.ways[0]
  const set = (patch) => setCanvasPreview((prev) => (prev ? { ...prev, ...patch } : prev))
  const exit = () => set({ compare: null })

  // The room one view has: a cell's (side by side), or the whole (swipe, onion).
  const gridRef = useRef(null)
  const [room, setRoom] = useState(null)
  useLayoutEffect(() => {
    const grid = gridRef.current
    if (!grid) return undefined
    const measure = () => setRoom({ width: grid.clientWidth, height: grid.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(grid)
    return () => observer.disconnect()
  }, [])
  const cols = !room || mode !== 'side' ? 1 : room.width >= 4 * 230 + 3 * 12 ? 4 : 2
  const rows = mode === 'side' ? 4 / cols : 1
  const cell = room ? { width: (room.width - 12 * (cols - 1)) / cols, height: (room.height - 12 * (rows - 1)) / rows - (mode === 'side' ? 36 : 0) } : null

  // One view for all: opened on the element (as the canvas closes in on it), again when the layout changes.
  const [view, setView] = useState(null)
  const layoutKey = cell ? `${mode}:${cols}:${Math.round(cell.width)}:${Math.round(cell.height)}` : null
  const placed = useRef(null)
  useEffect(() => {
    if (!layoutKey || placed.current === layoutKey) return
    placed.current = layoutKey
    setView(focusView(box, { x: 0, y: 0, width: cell.width, height: cell.height }, { min: 1.5, max: 4 }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey])

  // The wheel, over any of them: zoomed about the pointer — the same in all.
  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return undefined
    const onWheel = (event) => {
      const area = event.target.closest?.('[data-compare-view]')
      if (!area) return
      event.preventDefault()
      const rect = area.getBoundingClientRect()
      const px = event.clientX - rect.left
      const py = event.clientY - rect.top
      setView((now) => {
        if (!now) return now
        const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, now.zoom * Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.0025))))
        const k = zoom / now.zoom
        return { zoom, x: px - (px - now.x) * k, y: py - (py - now.y) * k }
      })
    }
    grid.addEventListener('wheel', onWheel, { passive: false })
    return () => grid.removeEventListener('wheel', onWheel)
  }, [])
  // A drag pans all of them; a press that doesn't move picks that way.
  const [dragging, setDragging] = useState(false)
  function startPan(event, cellId) {
    if (event.button !== 0 || !view) return
    event.preventDefault()
    const from = { x: event.clientX, y: event.clientY, view }
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
      if (!moved && cellId && cellId !== 'before') preview.onPick?.(cellId)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }
  // Swipe's handle, dragged across.
  function startSwipe(event) {
    event.preventDefault()
    event.stopPropagation()
    const rect = gridRef.current.getBoundingClientRect()
    const onMove = (move) => set({ mix: Math.min(1, Math.max(0, (move.clientX - rect.left) / rect.width)) })
    const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
    onMove(event)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // Esc: back to the canvas (its own — the detail beside it stays).
  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      event.preventDefault()
      event.stopImmediatePropagation()
      setCanvasPreview((prev) => (prev ? { ...prev, compare: null } : prev))
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  const placeStyle = view ? { transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`, transformOrigin: 'top left' } : { visibility: 'hidden' }
  const drawing = (overrides) => <div className="absolute top-0 left-0" style={placeStyle}><FrameDrawing frame={frame} edits={edits} overrides={overrides} /></div>
  const DOTS = { backgroundImage: 'radial-gradient(color-mix(in oklch, var(--foreground) 14%, transparent) 1px, transparent 1px)', backgroundSize: '18px 18px' }

  return (
    <div data-compare-canvas={mode} data-canvas-chrome className="absolute inset-y-0 right-0 left-14 z-30 flex flex-col bg-canvas" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-white/[0.06] px-3">
        <div role="radiogroup" aria-label="비교 방식" className="flex items-center gap-0.5 rounded-lg border border-white/[0.08] bg-black/30 p-0.5">
          {MODES.map(([id, label]) => (
            <button key={id} type="button" role="radio" aria-checked={mode === id} data-compare-mode={id} onClick={() => set({ compare: id })}
              className={cn('h-7 rounded-md px-2.5 text-[12px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-emerald-300', mode === id ? 'bg-white/[0.1] text-white' : 'text-slate-400 hover:text-slate-200')}>{label}</button>
          ))}
        </div>
        {mode === 'onion' && (
          <label className="flex items-center gap-2 text-[11.5px] text-slate-400">
            투명도
            <input type="range" min={0} max={100} value={Math.round(preview.mix * 100)} data-onion-mix onChange={(event) => set({ mix: Number(event.target.value) / 100 })} className="w-32 accent-emerald-400" />
            <span className="w-9 text-slate-300 tabular-nums">{Math.round(preview.mix * 100)}%</span>
          </label>
        )}
        {mode !== 'side' && <span className="truncate text-[11.5px] text-slate-500">현재 구현 vs 옵션 {shownWay?.n} · {shownWay?.label}</span>}
        <span className="flex-1" />
        {view && <span data-compare-zoom className="text-[11.5px] text-slate-400 tabular-nums">{Math.round(view.zoom * 100)}%</span>}
        <button type="button" data-compare-exit onClick={exit} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.1] px-2.5 text-[12px] font-medium text-slate-200 transition-colors hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-emerald-300">
          <X className="size-3.5" />비교 종료 <kbd className="font-sans text-[10.5px] text-slate-500">Esc</kbd>
        </button>
      </div>

      <div ref={gridRef} className={cn('relative min-h-0 flex-1 m-3', mode === 'side' && 'grid gap-3')} style={mode === 'side' ? { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` } : undefined}>
        {mode === 'side' ? cells.map((entry) => {
          const on = entry.id !== 'before' && entry.id === preview.picked
          return (
            <section key={entry.id} data-compare-cell={entry.id} data-selected={on ? '' : undefined} aria-label={entry.label} className={cn('flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border', on ? 'border-[var(--ds-accent-border)]' : 'border-white/[0.08]')}>
              <div className={cn('flex h-9 shrink-0 items-center gap-1.5 px-2.5 text-[12px]', on ? 'bg-[var(--ds-accent-bg)]' : 'bg-black/30')}>
                <span className={cn('truncate font-medium', entry.id === 'before' ? 'text-slate-400' : 'text-slate-100')}>{entry.id === 'before' ? `${entry.label} · 기준` : <><span className="text-slate-400">옵션 {entry.n}</span> {entry.label}</>}</span>
                {entry.chip && <span data-compare-chip className="shrink-0 rounded bg-white/[0.07] px-1.5 font-mono text-[11px] leading-[18px] text-slate-300 tabular-nums">{entry.chip}</span>}
                <span className="flex-1" />
                {on && <span className="shrink-0 rounded bg-[var(--ds-accent-bg)] px-1 text-[10.5px] leading-[18px] font-medium text-[var(--ds-accent-text)] ring-1 ring-[var(--ds-accent-border)] ring-inset">선택됨</span>}
              </div>
              <div data-compare-view={entry.id} onPointerDown={(event) => startPan(event, entry.id)} className={cn('relative min-h-0 flex-1 overflow-hidden touch-none select-none', dragging ? 'cursor-grabbing' : entry.id === 'before' ? 'cursor-grab' : 'cursor-pointer')} style={DOTS}>
                {/* (A way without its value yet is drawn as built — never an empty cell — and says so.) */}
                {drawing(entry.empty ? {} : entry.overrides)}
                {entry.empty && <span className="absolute bottom-2 left-1/2 max-w-[calc(100%-16px)] -translate-x-1/2 truncate rounded-full bg-black/70 px-2.5 py-1 text-[11px] whitespace-nowrap text-slate-200">값 입력 전 · 현재 구현</span>}
              </div>
            </section>
          )
        }) : (
          <div data-compare-view="overlay" onPointerDown={(event) => startPan(event, null)} className={cn('absolute inset-0 overflow-hidden rounded-xl border border-white/[0.08] touch-none select-none', dragging ? 'cursor-grabbing' : 'cursor-grab')} style={DOTS}>
            {drawing(preview.base.overrides)}
            {/* The way over what's built: cut at the handle (Swipe), or seen through (Onion). */}
            <div data-compare-top={shownWay?.id} className="absolute inset-0" style={mode === 'swipe' ? { clipPath: `inset(0 0 0 ${preview.mix * 100}%)` } : { opacity: preview.mix }}>
              {drawing(shownWay?.overrides ?? {})}
            </div>
            {mode === 'swipe' && (
              <div data-swipe-handle onPointerDown={startSwipe} className="absolute inset-y-0 z-10 w-6 -translate-x-1/2 cursor-ew-resize" style={{ left: `${preview.mix * 100}%` }}>
                <span aria-hidden className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-[var(--ds-accent)]" />
                <span aria-hidden className="absolute top-1/2 left-1/2 flex h-8 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--ds-accent)] text-[10px] font-bold text-slate-950">⇆</span>
              </div>
            )}
            <span className="absolute top-2 left-2 rounded-full bg-black/70 px-2.5 py-1 text-[11px] text-slate-200">{preview.base.label} · {preview.base.chip}</span>
            <span className="absolute top-2 right-2 rounded-full border border-[var(--ds-accent-border)] bg-black/70 px-2.5 py-1 text-[11px] text-[var(--ds-accent-text)]">옵션 {shownWay?.n} · {shownWay?.chip}</span>
          </div>
        )}
      </div>
    </div>
  )
}
