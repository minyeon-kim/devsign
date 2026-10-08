import { useEffect, useRef, useState } from 'react'
import { LayoutGrid, Minus, Plus, ScanEye } from 'lucide-react'
import { cn } from 'cn'
import { StaticLayer } from '@/components/mergestudio/MergeInfiniteCanvas'
import { optionEffects } from '@/components/mergestudio/DesignComparison'
import SpacingOverlay from '@/components/canvas/SpacingOverlay'
import { draftFrame, draftScreens, regionPicks } from '@/data/draftScreens'
import { getLanguage } from '@/i18n/language'

// The drafts being mixed, side by side in their own pane — the whole left
// half, top to bottom, one fixed cell per draft (four drafts, four cells) —
// apart from the Result artboard, with a view of its own. The cells stay
// put; what moves is the screen inside them: drag (or scroll) inside any
// cell to look at another part, ⌘/Ctrl-scroll or the buttons to zoom.
// Every cell follows, so the same part of each draft is side by side at
// the same size. Pointing at an element shows its size and spacing (the
// Workspace canvas's redlines); clicking one keeps it, so pointing at
// another shows the gap between the two.
const ZOOM_STEP = 1.25
const MIN_SCALE = 0.1
const MAX_SCALE = 4
const GAP = 8
const CAPTION = 28
const DRAG_THRESHOLD = 4

function DraftCell({ item, option, letter, frame, view, usedParts, totalParts, cellRef, selected, onSelect, regionId = null }) {
  const ko = getLanguage() === 'ko'
  const screen = draftScreens[item.id]
  const drawn = screen ? draftFrame(item.id, frame, option.key) : frame
  const overrides = screen ? null : optionEffects(item, option)
  const whole = totalParts > 0 && usedParts === totalParts
  const [container, setContainer] = useState(null)
  const [hoverId, setHoverId] = useState(null)
  const hoverAt = (event) => {
    const id = event.target.closest?.('[data-layer-id]')?.getAttribute('data-layer-id') ?? null
    if (id !== hoverId) setHoverId(id)
  }
  return (
    <figure data-draft-cell={option.key} className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl bg-white/[0.03] ring-1 ring-white/[0.08]">
      <figcaption className="flex shrink-0 items-center gap-1.5 px-2.5 text-[11px]" style={{ height: CAPTION }}>
        <span className={cn('flex size-4 shrink-0 items-center justify-center rounded text-[9.5px] font-semibold', usedParts ? 'bg-emerald-300 text-slate-950' : 'bg-white/[0.1] text-slate-200')}>{letter}</span>
        <span className="min-w-0 truncate font-medium text-slate-200">{option.label.replace(/^시안 [A-Z] · /, '')}</span>
        {usedParts > 0 && (
          <span data-draft-used className="ml-auto shrink-0 rounded bg-emerald-300/15 px-1.5 text-[10px] leading-4 text-emerald-200">
            {whole ? (ko ? '전체 사용' : 'All used') : ko ? `요소 ${usedParts}개 사용` : `${usedParts} used`}
          </span>
        )}
      </figcaption>
      {/* The cell's window onto its screen: fixed, and the screen moves in it. */}
      <div ref={cellRef} data-draft-window className="relative min-h-0 flex-1 overflow-hidden" onPointerMove={hoverAt} onPointerLeave={() => setHoverId(null)}>
        <div
          className="absolute top-0 left-0 overflow-hidden rounded-lg bg-white shadow-lg shadow-black/30"
          style={{ width: drawn.width * view.scale, height: drawn.height * view.scale, transform: `translate(${view.x}px, ${view.y}px)` }}
        >
          <div
            ref={setContainer}
            className="absolute top-0 left-0 origin-top-left"
            style={{ width: drawn.width, height: drawn.height, transform: `scale(${view.scale})` }}
            onClick={(event) => {
              const id = event.target.closest?.('[data-layer-id]')?.getAttribute('data-layer-id') ?? null
              onSelect(id)
            }}
          >
            {drawn.layers.map((layer) => (
              <StaticLayer key={layer.id} layer={layer} override={overrides?.[layer.id]} selected={selected === layer.id} onSelect={() => {}} />
            ))}
            <SpacingOverlay container={container} frame={drawn} selectedId={selected} hoverId={hoverId} version={view.scale} />
            {/* The part selected on the Result (or in the picker), outlined
                here too — the same part in every draft — the rest dimmed. */}
            {(() => {
              const band = regionId && drawn.regions?.find((region) => region.id === regionId)
              if (!band) return null
              const k = 1 / view.scale
              return (
                <div data-draft-region-highlight={regionId} aria-hidden className="pointer-events-none absolute inset-x-0 z-20 rounded-[6px]" style={{ top: band.y, height: band.height, boxShadow: `0 0 0 ${2 * k}px rgb(110 231 183), 0 0 0 9999px rgba(15,23,42,0.35)` }} />
              )
            })()}
          </div>
        </div>
      </div>
    </figure>
  )
}

// The pane's clear room: above the bottom panel, which floats over it, and
// under anything else floating over its top (the mix panel, when it's
// there). They move and resize, so it's measured again as they do.
function useClearInsets(ref) {
  const [insets, setInsets] = useState({ top: 12, bottom: 12 })
  useEffect(() => {
    const element = ref.current
    if (!element) return
    function measure() {
      const box = element.getBoundingClientRect()
      let top = 12
      let bottom = 12
      for (const el of document.querySelectorAll('[data-mix-panel], section[aria-label="Bottom panel"], section[aria-label="하단 패널"]')) {
        const r = el.getBoundingClientRect()
        // (Only what actually lies over the pane.)
        if (!r.width || !r.height || r.right <= box.left || r.left >= box.right || r.bottom <= box.top || r.top >= box.bottom) continue
        if (el.matches('[data-mix-panel]')) top = Math.max(top, r.bottom - box.top + 12)
        else bottom = Math.max(bottom, box.bottom - r.top + 12)
      }
      setInsets((current) => (current.top === top && current.bottom === bottom ? current : { top, bottom }))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    const timer = window.setInterval(measure, 400)
    return () => { observer.disconnect(); window.clearInterval(timer) }
  }, [ref])
  return insets
}

// The pane's view: every draft at once, or just the ones picked (A and B,
// A and C, one alone…), split side by side.
const ALL = 'all'
const letterOf = (option, index) => /^시안 ([A-Z])/.exec(option.label)?.[1] ?? String.fromCharCode(65 + index)

// `regionId`: the part selected on the Result, outlined in every cell.
export default function DraftCompareBoard({ item, options: compared, frame, decisions, share = 0.5, regionId = null }) {
  // null: every draft; else the keys picked to be shown.
  const [picked, setPicked] = useState(null)
  const shown = picked ? compared.filter((option) => picked.includes(option.key)) : compared
  const options = shown.length ? shown : compared
  const mode = picked ? picked.join(',') : ALL
  // A letter adds or takes out its draft; none left, or every one, is all.
  function toggle(key) {
    const current = picked ?? []
    const next = current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key]
    setPicked(next.length === 0 || next.length === compared.length ? null : compared.map((option) => option.key).filter((entry) => next.includes(entry)))
  }
  const ko = getLanguage() === 'ko'
  const paneRef = useRef(null)
  const insets = useClearInsets(paneRef)
  const firstCellRef = useRef(null)
  const [cell, setCell] = useState(null)
  // null: each screen fitted and centered in its cell (following the cell's
  // size); else where it's been moved and zoomed to — the same in every cell.
  const [view, setView] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [selected, setSelected] = useState(null) // { key, id }
  // Whether the part selected on the Result is outlined here — off, to see
  // the drafts as they are.
  const [outline, setOutline] = useState(true)
  const count = options.length
  // Up to three side by side; more in a grid.
  const cols = count <= 3 ? count : Math.ceil(Math.sqrt(count))
  const rows = Math.max(1, Math.ceil(count / cols))
  useEffect(() => {
    const element = firstCellRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setCell({ width: entry.contentRect.width, height: entry.contentRect.height }))
    observer.observe(element)
    return () => observer.disconnect()
  }, [count, mode])
  // A new view starts fitted.
  useEffect(() => { setView(null) }, [mode])
  const PAD = 12
  const fitScale = cell
    ? Math.max(MIN_SCALE, Math.min((cell.width - PAD * 2) / frame.width, (cell.height - PAD * 2) / frame.height))
    : 0.3
  const fitted = {
    scale: fitScale,
    x: cell ? (cell.width - frame.width * fitScale) / 2 : 0,
    y: cell ? Math.max(PAD, (cell.height - frame.height * fitScale) / 2) : 0,
  }
  const current = view ?? fitted
  const viewRef = useRef(current)
  viewRef.current = current

  // Zoom keeping the point under (cx, cy) — a cell's own coordinates — still.
  function zoomAt(next, cx, cy) {
    const from = viewRef.current
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next))
    const k = scale / from.scale
    setView({ scale, x: cx - (cx - from.x) * k, y: cy - (cy - from.y) * k })
  }
  const zoomAtCenter = (factor) => zoomAt(viewRef.current.scale * factor, (cell?.width ?? 0) / 2, (cell?.height ?? 0) / 2)

  // Scroll moves the screens; ⌘/Ctrl-scroll (and a trackpad pinch) zooms
  // them at the pointer. Non-passive, so the page itself never scrolls.
  const gridRef = useRef(null)
  useEffect(() => {
    const element = gridRef.current
    if (!element) return
    function onWheel(event) {
      const window_ = event.target.closest?.('[data-draft-window]')
      if (!window_) return
      event.preventDefault()
      const from = viewRef.current
      if (event.ctrlKey || event.metaKey) {
        const box = window_.getBoundingClientRect()
        zoomAt(from.scale * Math.exp(-event.deltaY * 0.0025), event.clientX - box.left, event.clientY - box.top)
      } else {
        setView({ ...from, x: from.x - event.deltaX, y: from.y - event.deltaY })
      }
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Drag inside any cell to move the screens; a click (no drag) picks the
  // element under it for the spacing redlines.
  const dragRef = useRef(null)
  const draggedRef = useRef(false)
  function onPointerDown(event) {
    if (event.button !== 0 || !event.target.closest('[data-draft-window]')) return
    dragRef.current = { x: event.clientX, y: event.clientY, from: viewRef.current, moved: false, id: event.pointerId, el: event.currentTarget }
  }
  function onPointerMove(event) {
    const drag = dragRef.current
    if (!drag) return
    const dx = event.clientX - drag.x
    const dy = event.clientY - drag.y
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      drag.moved = true
      drag.el.setPointerCapture?.(drag.id)
      setDragging(true)
    }
    setView({ ...drag.from, x: drag.from.x + dx, y: drag.from.y + dy })
  }
  function onPointerUp() {
    const drag = dragRef.current
    if (!drag) return
    dragRef.current = null
    draggedRef.current = drag.moved
    if (drag.moved) {
      setDragging(false)
      drag.el.releasePointerCapture?.(drag.id)
    }
  }

  const picks = regionPicks(item.id, decisions)
  const totalParts = draftScreens[item.id]?.regions.length ?? 0
  const usedOf = (key) => Object.values(picks).filter((value) => value === key).length
  const BUTTON = 'flex h-6 min-w-6 shrink-0 cursor-pointer items-center justify-center rounded-md px-1.5 text-[11px] font-medium text-slate-200 transition-colors hover:bg-white/15 hover:text-white disabled:pointer-events-none disabled:opacity-40'

  return (
    <section
      data-draft-board
      data-draft-region={regionId ?? undefined}
      aria-label={ko ? '시안 비교' : 'Draft comparison'}
      ref={paneRef}
      className="flex h-full min-h-0 min-w-0 shrink-0 flex-col px-3"
      style={{ width: `${share * 100}%`, paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <div className="mb-2 flex shrink-0 items-center gap-2">
        <h2 className="shrink-0 text-xs font-semibold text-slate-200">{ko ? '시안 비교' : 'Drafts'}</h2>
        {/* The view: all of them, or the drafts picked here, side by side. */}
        <div role="tablist" aria-label={ko ? '시안 보기' : 'Draft view'} data-draft-view-tabs className="flex shrink-0 items-center gap-0.5 rounded-lg bg-white/[0.05] p-0.5">
          <button
            type="button"
            role="tab"
            aria-selected={!picked}
            data-draft-view={ALL}
            title={ko ? `전체 한 번에 비교 · ${compared.length}개` : `Compare all · ${compared.length}`}
            onClick={() => setPicked(null)}
            className={cn('flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium transition-colors', !picked ? 'bg-white/[0.12] text-white' : 'text-slate-400 hover:text-slate-200')}
          >
            <LayoutGrid className="size-3.5" />
            {ko ? '전체' : 'All'}
          </button>
          {compared.map((option, index) => (
            <button
              key={option.key}
              type="button"
              role="tab"
              aria-selected={Boolean(picked?.includes(option.key))}
              data-draft-view={option.key}
              title={ko ? `${option.label} · 눌러서 보기에 넣거나 빼기` : `${option.label} · press to add or take out of the view`}
              onClick={() => toggle(option.key)}
              className={cn('flex size-6 items-center justify-center rounded-md text-[11px] font-semibold transition-colors', picked?.includes(option.key) ? 'bg-emerald-300 text-slate-950' : 'text-slate-400 hover:bg-white/[0.08] hover:text-slate-200')}
            >
              {letterOf(option, index)}
            </button>
          ))}
        </div>
        <span className="min-w-0 flex-1" />
        <button
          type="button"
          data-board-outline
          aria-pressed={outline}
          title={outline ? (ko ? '선택한 요소 표시 끄기' : 'Stop outlining the selected part') : (ko ? '선택한 요소 표시 켜기' : 'Outline the selected part')}
          onClick={() => setOutline((value) => !value)}
          className={cn('ml-auto flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-[11px] font-medium ring-1 transition-colors', outline ? 'bg-emerald-300/15 text-emerald-200 ring-emerald-300/40' : 'text-slate-400 ring-white/15 hover:text-slate-200')}
        >
          <ScanEye className="size-3.5" />
          {ko ? '표시' : 'Outline'}
        </button>
        <div data-board-zoom className="flex shrink-0 items-center gap-0.5 rounded-lg bg-slate-900/95 p-0.5 ring-1 ring-white/15">
          <button type="button" data-board-fit title={ko ? '칸에 맞춤' : 'Fit to cells'} onClick={() => setView(null)} className={BUTTON}>{ko ? '맞춤' : 'Fit'}</button>
          <button type="button" aria-label={ko ? '축소' : 'Zoom out'} disabled={current.scale <= MIN_SCALE} onClick={() => zoomAtCenter(1 / ZOOM_STEP)} className={BUTTON}><Minus className="size-3.5" /></button>
          <span data-board-percent className="min-w-10 text-center text-[11px] text-slate-300 tabular-nums">{Math.round(current.scale * 100)}%</span>
          <button type="button" aria-label={ko ? '확대' : 'Zoom in'} disabled={current.scale >= MAX_SCALE} onClick={() => zoomAtCenter(ZOOM_STEP)} className={BUTTON}><Plus className="size-3.5" /></button>
        </div>
      </div>
      <div
        ref={gridRef}
        data-draft-grid
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={cn('grid min-h-0 flex-1 touch-none select-none', dragging ? 'cursor-grabbing' : 'cursor-grab')}
        style={{ gap: GAP, gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
      >
        {options.map((option, index) => (
          <DraftCell
            key={option.key}
            item={item}
            option={option}
            letter={letterOf(option, compared.indexOf(option) >= 0 ? compared.indexOf(option) : index)}
            frame={frame}
            view={current}
            usedParts={usedOf(option.key)}
            totalParts={totalParts}
            cellRef={index === 0 ? firstCellRef : undefined}
            selected={selected?.key === option.key ? selected.id : null}
            regionId={outline ? regionId : null}
            onSelect={(id) => {
              if (draggedRef.current) { draggedRef.current = false; return }
              setSelected(id ? { key: option.key, id } : null)
            }}
          />
        ))}
      </div>
    </section>
  )
}
