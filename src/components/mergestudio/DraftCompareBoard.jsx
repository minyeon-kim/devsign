import { useEffect, useRef, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { cn } from 'cn'
import { StaticLayer } from '@/components/mergestudio/MergeInfiniteCanvas'
import { optionEffects } from '@/components/mergestudio/DesignComparison'
import { draftFrame, draftScreens, regionPicks } from '@/data/draftScreens'
import { getLanguage } from '@/i18n/language'

// The drafts being mixed, side by side in their own pane — the whole left
// half, one cell each (four drafts, four cells) — apart from the Result
// artboard, with a view of its own. It opens fitted to the pane; from there
// it's a canvas: drag (or scroll) to move to the part you want to see,
// ⌘/Ctrl-scroll or the buttons to zoom. Every cell moves and zooms
// together, so the drafts stay side by side at the same size.
const ZOOM_STEP = 1.25
const MIN_SCALE = 0.1
const MAX_SCALE = 3
const GAP = 12
const CAPTION = 30
const PAD = 10

function DraftCell({ item, option, letter, frame, scale, usedParts, totalParts }) {
  const ko = getLanguage() === 'ko'
  const screen = draftScreens[item.id]
  const drawn = screen ? draftFrame(item.id, frame, option.key) : frame
  const overrides = screen ? null : optionEffects(item, option)
  const whole = totalParts > 0 && usedParts === totalParts
  return (
    <figure data-draft-cell={option.key} className="flex flex-col rounded-xl bg-white/[0.03] ring-1 ring-white/[0.08]" style={{ padding: `0 ${PAD}px ${PAD}px` }}>
      <figcaption className="flex shrink-0 items-center gap-1.5 text-[11px]" style={{ height: CAPTION }}>
        <span className={cn('flex size-4 shrink-0 items-center justify-center rounded text-[9.5px] font-semibold', usedParts ? 'bg-emerald-300 text-slate-950' : 'bg-white/[0.1] text-slate-200')}>{letter}</span>
        <span className="min-w-0 truncate font-medium text-slate-200">{option.label.replace(/^시안 [A-Z] · /, '')}</span>
        {usedParts > 0 && (
          <span data-draft-used className="ml-auto shrink-0 rounded bg-emerald-300/15 px-1.5 text-[10px] leading-4 text-emerald-200">
            {whole ? (ko ? '전체 사용' : 'All used') : ko ? `요소 ${usedParts}개 사용` : `${usedParts} used`}
          </span>
        )}
      </figcaption>
      <div className="relative overflow-hidden rounded-lg bg-white" style={{ width: frame.width * scale, height: frame.height * scale }}>
        <div className="pointer-events-none absolute top-0 left-0 origin-top-left" style={{ width: drawn.width, height: drawn.height, transform: `scale(${scale})` }}>
          {drawn.layers.map((layer) => <StaticLayer key={layer.id} layer={layer} override={overrides?.[layer.id]} onSelect={() => {}} />)}
        </div>
      </div>
    </figure>
  )
}

// The pane's clear room: under the mix panel and above the bottom panel,
// which float over it. They move and resize, so it's measured again as
// they do. (AI Chat floats closed by default and, opened, floats over the
// drafts like any window — the pane keeps the whole left half.)
function useClearInsets(ref) {
  const [insets, setInsets] = useState({ top: 72, bottom: 16 })
  useEffect(() => {
    const element = ref.current
    if (!element) return
    function measure() {
      const box = element.getBoundingClientRect()
      let top = 72
      let bottom = 16
      for (const el of document.querySelectorAll('[data-mix-panel], section[aria-label="Bottom panel"], section[aria-label="하단 패널"]')) {
        const r = el.getBoundingClientRect()
        if (!r.width || !r.height || r.right <= box.left || r.left >= box.right) continue
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

export default function DraftCompareBoard({ item, options, frame, decisions }) {
  const ko = getLanguage() === 'ko'
  const paneRef = useRef(null)
  const insets = useClearInsets(paneRef)
  const viewportRef = useRef(null)
  const [room, setRoom] = useState(null)
  // null: fitted and centered (it follows the pane's size); else where
  // it's been moved and zoomed to.
  const [view, setView] = useState(null)
  const [dragging, setDragging] = useState(false)
  const count = options.length
  const cols = Math.max(1, Math.ceil(Math.sqrt(count)))
  const rows = Math.max(1, Math.ceil(count / cols))
  useEffect(() => {
    const element = viewportRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setRoom({ width: entry.contentRect.width, height: entry.contentRect.height }))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  // The grid's size at a scale: the screens scale, the captions and padding don't.
  const sizeAt = (scale) => ({
    width: cols * (frame.width * scale + PAD * 2) + GAP * (cols - 1),
    height: rows * (frame.height * scale + CAPTION + PAD) + GAP * (rows - 1),
  })
  const fitScale = room
    ? Math.max(MIN_SCALE, Math.min(
      (room.width - GAP * (cols - 1) - cols * PAD * 2) / (cols * frame.width),
      (room.height - GAP * (rows - 1) - rows * (CAPTION + PAD)) / (rows * frame.height),
    ))
    : 0.3
  const fitted = (() => {
    const size = sizeAt(fitScale)
    return { scale: fitScale, x: room ? (room.width - size.width) / 2 : 0, y: room ? (room.height - size.height) / 2 : 0 }
  })()
  const current = view ?? fitted
  const viewRef = useRef(current)
  viewRef.current = current

  // Zoom keeping the point under (cx, cy) — viewport coordinates — still.
  function zoomAt(next, cx, cy) {
    const from = viewRef.current
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next))
    const k = scale / from.scale
    setView({ scale, x: cx - (cx - from.x) * k, y: cy - (cy - from.y) * k })
  }
  const zoomAtCenter = (factor) => zoomAt(viewRef.current.scale * factor, (room?.width ?? 0) / 2, (room?.height ?? 0) / 2)

  // Scroll moves the view; ⌘/Ctrl-scroll (and a trackpad pinch) zooms at
  // the pointer. Native and non-passive, so the page itself never scrolls.
  useEffect(() => {
    const element = viewportRef.current
    if (!element) return
    function onWheel(event) {
      event.preventDefault()
      const from = viewRef.current
      if (event.ctrlKey || event.metaKey) {
        const box = element.getBoundingClientRect()
        zoomAt(from.scale * Math.exp(-event.deltaY * 0.0025), event.clientX - box.left, event.clientY - box.top)
      } else {
        setView({ ...from, x: from.x - event.deltaX, y: from.y - event.deltaY })
      }
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Drag anywhere on the drafts to move the view.
  const dragRef = useRef(null)
  function onPointerDown(event) {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { x: event.clientX, y: event.clientY, from: viewRef.current }
    setDragging(true)
  }
  function onPointerMove(event) {
    const drag = dragRef.current
    if (!drag) return
    setView({ ...drag.from, x: drag.from.x + event.clientX - drag.x, y: drag.from.y + event.clientY - drag.y })
  }
  function onPointerUp(event) {
    if (!dragRef.current) return
    dragRef.current = null
    setDragging(false)
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }

  const picks = regionPicks(item.id, decisions)
  const totalParts = draftScreens[item.id]?.regions.length ?? 0
  const usedOf = (key) => Object.values(picks).filter((value) => value === key).length
  const BUTTON = 'flex h-6 min-w-6 shrink-0 cursor-pointer items-center justify-center rounded-md px-1.5 text-[11px] font-medium text-slate-200 transition-colors hover:bg-white/15 hover:text-white disabled:pointer-events-none disabled:opacity-40'

  return (
    <section
      data-draft-board
      aria-label={ko ? '시안 비교' : 'Draft comparison'}
      ref={paneRef}
      className="flex h-full min-h-0 w-1/2 min-w-0 shrink-0 flex-col border-r border-white/[0.08] px-4"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <div className="mb-2 flex shrink-0 items-center gap-2">
        <h2 className="text-xs font-semibold text-slate-200">{ko ? `시안 비교 · ${count}개` : `Drafts · ${count}`}</h2>
        <span className="text-[11px] text-slate-500">{ko ? '끌어서 이동 · ⌘/Ctrl+스크롤로 확대' : 'Drag to move · ⌘/Ctrl-scroll to zoom'}</span>
        <div data-board-zoom className="ml-auto flex items-center gap-0.5 rounded-lg bg-slate-900/95 p-0.5 ring-1 ring-white/15">
          <button type="button" data-board-fit title={ko ? '전체 보기' : 'Fit all'} onClick={() => setView(null)} className={BUTTON}>{ko ? '맞춤' : 'Fit'}</button>
          <button type="button" aria-label={ko ? '축소' : 'Zoom out'} disabled={current.scale <= MIN_SCALE} onClick={() => zoomAtCenter(1 / ZOOM_STEP)} className={BUTTON}><Minus className="size-3.5" /></button>
          <span data-board-percent className="min-w-10 text-center text-[11px] text-slate-300 tabular-nums">{Math.round(current.scale * 100)}%</span>
          <button type="button" aria-label={ko ? '확대' : 'Zoom in'} disabled={current.scale >= MAX_SCALE} onClick={() => zoomAtCenter(ZOOM_STEP)} className={BUTTON}><Plus className="size-3.5" /></button>
        </div>
      </div>
      <div
        ref={viewportRef}
        data-draft-viewport
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={cn('relative min-h-0 flex-1 touch-none overflow-hidden rounded-xl select-none', dragging ? 'cursor-grabbing' : 'cursor-grab')}
      >
        <div
          data-draft-grid
          className="absolute top-0 left-0 grid origin-top-left will-change-transform"
          style={{ gap: GAP, gridTemplateColumns: `repeat(${cols}, max-content)`, transform: `translate(${current.x}px, ${current.y}px)` }}
        >
          {options.map((option, index) => (
            <DraftCell
              key={option.key}
              item={item}
              option={option}
              letter={/^시안 ([A-Z])/.exec(option.label)?.[1] ?? String.fromCharCode(65 + index)}
              frame={frame}
              scale={current.scale}
              usedParts={usedOf(option.key)}
              totalParts={totalParts}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
