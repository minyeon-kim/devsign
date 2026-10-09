import { useEffect, useRef, useState } from 'react'
import { LayoutGrid, Minus, Plus } from 'lucide-react'
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

function DraftCell({ item, option, letter, frame, view, usedParts, totalParts, cellRef, selected, onSelect, picks = {}, onPick, dragging = false }) {
  const ko = getLanguage() === 'ko'
  const screen = draftScreens[item.id]
  const drawn = screen ? draftFrame(item.id, frame, option.key) : frame
  const overrides = screen ? null : optionEffects(item, option)
  const whole = totalParts > 0 && usedParts === totalParts
  const [container, setContainer] = useState(null)
  const [hoverId, setHoverId] = useState(null)
  // The part (region) under the pointer — offered to use in the Result.
  const [hoverRegion, setHoverRegion] = useState(null)
  // Spacing redlines only while ⌥ / Alt is held (as in Figma): otherwise
  // the parts to pick stay clean.
  const [measuring, setMeasuring] = useState(false)
  useEffect(() => {
    const on = (event) => setMeasuring(event.altKey)
    const off = () => setMeasuring(false)
    window.addEventListener('keydown', on)
    window.addEventListener('keyup', on)
    window.addEventListener('blur', off)
    return () => { window.removeEventListener('keydown', on); window.removeEventListener('keyup', on); window.removeEventListener('blur', off) }
  }, [])
  const hoverAt = (event) => {
    const id = event.target.closest?.('[data-layer-id]')?.getAttribute('data-layer-id') ?? null
    if (id !== hoverId) setHoverId(id)
    const box = container?.getBoundingClientRect()
    const y = box ? (event.clientY - box.top) / view.scale : -1
    const inside = box && event.clientX >= box.left && event.clientX <= box.right
    const region = inside ? drawn.regions?.find((entry) => y >= entry.y && y < entry.y + entry.height)?.id ?? null : null
    if (region !== hoverRegion) setHoverRegion(region)
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
      <div ref={cellRef} data-draft-window className={cn('relative min-h-0 flex-1 overflow-hidden', onPick && hoverRegion && !dragging && 'cursor-pointer')} onPointerMove={hoverAt} onPointerLeave={() => { setHoverId(null); setHoverRegion(null) }}>
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
              // Clicking a part swaps this draft's version into the Result
              // (one already there stays: taking a part out is the Result's
              // 🗑); off a part, it keeps the element for the spacing redlines.
              if (!onSelect(id, { probe: true })) return
              if (onPick && hoverRegion) { if (picks[hoverRegion] !== option.key) onPick(hoverRegion, true) }
              else onSelect(id)
            }}
          >
            {drawn.layers.map((layer) => (
              <StaticLayer key={layer.id} layer={layer} override={overrides?.[layer.id]} selected={measuring && selected === layer.id} onSelect={() => {}} />
            ))}
            {measuring && <SpacingOverlay container={container} frame={drawn} selectedId={selected} hoverId={hoverId} version={view.scale} />}
            {/* Picking here. A part this draft gives the Result carries a ✓
                (no outline: only the part pointed at is outlined).
                Pointing at a part tints it and says what a click does —
                swap it into the Result. Kept one size at any zoom. */}
            {onPick && drawn.regions?.map((region) => {
              const used = picks[region.id] === option.key
              const offered = !dragging && hoverRegion === region.id
              if (!used && !offered) return null
              const k = 1 / view.scale
              return (
                <div key={region.id} data-draft-part={region.id} data-draft-part-used={used || undefined} className="pointer-events-none absolute inset-x-0 z-30 rounded-[6px]" style={{ top: region.y, height: region.height, boxShadow: offered ? `0 0 0 ${2 * k}px ${used ? 'rgb(110 231 183)' : 'rgb(56 189 248)'}` : undefined, background: offered && !used ? 'rgba(56,189,248,0.10)' : undefined }}>
                  {used && (
                    <span title={ko ? '결과에 사용 중' : 'Used in the Result'} className="absolute top-0 left-0 flex size-4 items-center justify-center rounded-full bg-emerald-300 text-[10px] leading-none font-bold text-slate-950 shadow" style={{ transform: `translate(${4 * k}px, ${4 * k}px) scale(${k})`, transformOrigin: 'top left' }}>
                      ✓
                    </span>
                  )}
                  {offered && (
                    <>
                      {/* What a click does, at the part's top left (clear of
                          the spacing redlines around the element pointed at). */}
                      <span data-draft-hint className={cn('absolute top-0 left-0 rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap shadow-lg', used ? 'bg-emerald-300 text-slate-950' : 'bg-sky-400 text-slate-950')} style={{ transform: `translate(${4 * k}px, ${-50 * k}%) scale(${k})`, transformOrigin: 'top left' }}>
                        {used ? (ko ? '결과에 사용 중' : 'In the Result') : (ko ? '클릭해서 교체' : 'Click to swap in')}
                      </span>
                    </>
                  )}
                </div>
              )
            })}
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

// `onPick(regionId, draftKey | null)`: use a draft's version of a part in the
// Result (null takes it back).
export default function DraftCompareBoard({ item, options: compared, frame, decisions, share = 0.5, onPick }) {
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
  const BUTTON = 'flex h-8 min-w-8 shrink-0 cursor-pointer items-center justify-center rounded-md px-1.5 text-[11px] font-medium text-slate-200 transition-colors hover:bg-white/15 hover:text-white disabled:pointer-events-none disabled:opacity-40'

  return (
    <section
      data-draft-board
      aria-label={ko ? '시안 비교' : 'Draft comparison'}
      ref={paneRef}
      className="flex h-full min-h-0 min-w-0 shrink-0 flex-col px-3"
      style={{ width: `${share * 100}%`, paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <div className="mb-2 flex shrink-0 items-center gap-2">
        {/* The view: all of them, or the drafts picked here, side by side. */}
        <div role="tablist" aria-label={ko ? '시안 보기' : 'Draft view'} data-draft-view-tabs className="flex h-9 shrink-0 items-center gap-0.5 rounded-lg bg-white/[0.05] p-0.5 ring-1 ring-white/10">
          <button
            type="button"
            role="tab"
            aria-selected={!picked}
            data-draft-view={ALL}
            title={ko ? `전체 한 번에 비교 · ${compared.length}개` : `Compare all · ${compared.length}`}
            onClick={() => setPicked(null)}
            className={cn('flex h-8 items-center gap-1 rounded-md px-2 text-[11px] font-medium transition-colors', !picked ? 'bg-white/[0.12] text-white' : 'text-slate-400 hover:text-slate-200')}
          >
            <LayoutGrid className="size-3.5" />
            {ko ? '전체 시안' : 'All drafts'}
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
              className={cn('flex size-8 items-center justify-center rounded-md text-[11px] font-semibold transition-colors', picked?.includes(option.key) ? 'bg-emerald-300 text-slate-950' : 'text-slate-400 hover:bg-white/[0.08] hover:text-slate-200')}
            >
              {letterOf(option, index)}
            </button>
          ))}
        </div>
        <span className="min-w-0 flex-1" />
        {/* One group: fit · zoom. */}
        <div data-board-zoom className="flex h-9 shrink-0 items-center gap-0.5 rounded-lg bg-white/[0.05] p-0.5 ring-1 ring-white/10">
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
            picks={picks}
            dragging={dragging}
            onPick={onPick && ((region, on) => onPick(region, on ? option.key : null))}
            onSelect={(id, { probe = false } = {}) => {
              // (A drag that ended here isn't a click.)
              if (draggedRef.current) { draggedRef.current = false; return false }
              if (probe) return true
              setSelected(id ? { key: option.key, id } : null)
              return true
            }}
          />
        ))}
      </div>
    </section>
  )
}
