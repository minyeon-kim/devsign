import { useEffect, useRef, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { cn } from 'cn'
import { StaticLayer } from '@/components/mergestudio/MergeInfiniteCanvas'
import { optionEffects } from '@/components/mergestudio/DesignComparison'
import { draftFrame, draftScreens, regionPicks } from '@/data/draftScreens'
import { getLanguage } from '@/i18n/language'

// The drafts being mixed, side by side in their own pane — one cell each
// (four drafts, four cells) — apart from the Result artboard, with a zoom
// of its own: fitted to the cells, or a step in or out (every cell
// together, so the drafts stay comparable), scrolling within each cell.
const ZOOM_STEP = 0.25
const MIN_ZOOM = 0.5
const MAX_ZOOM = 4

function DraftCell({ item, option, letter, frame, scale, usedParts, totalParts }) {
  const ko = getLanguage() === 'ko'
  const screen = draftScreens[item.id]
  const drawn = screen ? draftFrame(item.id, frame, option.key) : frame
  const overrides = screen ? null : optionEffects(item, option)
  const height = drawn.height
  const whole = totalParts > 0 && usedParts === totalParts
  return (
    <figure data-draft-cell={option.key} className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl bg-white/[0.03] ring-1 ring-white/[0.08]">
      <figcaption className="flex shrink-0 items-center gap-1.5 px-2.5 py-1.5 text-[11px]">
        <span className={cn('flex size-4 shrink-0 items-center justify-center rounded text-[9.5px] font-semibold', usedParts ? 'bg-emerald-300 text-slate-950' : 'bg-white/[0.1] text-slate-200')}>{letter}</span>
        <span className="min-w-0 truncate font-medium text-slate-200">{option.label.replace(/^시안 [A-Z] · /, '')}</span>
        {usedParts > 0 && (
          <span data-draft-used className="ml-auto shrink-0 rounded bg-emerald-300/15 px-1.5 text-[10px] leading-4 text-emerald-200">
            {whole ? (ko ? '전체 사용' : 'All used') : ko ? `요소 ${usedParts}개 사용` : `${usedParts} used`}
          </span>
        )}
      </figcaption>
      <div className="min-h-0 flex-1 overflow-auto px-2.5 pb-2.5">
        <div className="relative mx-auto overflow-hidden rounded-lg bg-white" style={{ width: drawn.width * scale, height: height * scale }}>
          <div className="pointer-events-none absolute top-0 left-0 origin-top-left" style={{ width: drawn.width, height, transform: `scale(${scale})` }}>
            {drawn.layers.map((layer) => <StaticLayer key={layer.id} layer={layer} override={overrides?.[layer.id]} onSelect={() => {}} />)}
          </div>
        </div>
      </div>
    </figure>
  )
}

// The pane's clear room: inside it, past the floating windows that sit over
// its left edge (AI Chat), under the mix panel and above the bottom panel.
// They move and resize, so it's measured again as they do.
function useClearInsets(ref) {
  const [insets, setInsets] = useState({ left: 16, top: 72, bottom: 16 })
  useEffect(() => {
    const element = ref.current
    if (!element) return
    function measure() {
      const box = element.getBoundingClientRect()
      let left = 16
      let top = 72
      let bottom = 16
      for (const el of document.querySelectorAll('[data-window], [data-mix-panel], section[aria-label="Bottom panel"], section[aria-label="하단 패널"]')) {
        const r = el.getBoundingClientRect()
        if (!r.width || !r.height || r.right <= box.left || r.left >= box.right) continue
        if (el.matches('[data-mix-panel]')) top = Math.max(top, r.bottom - box.top + 16)
        else if (el.tagName === 'SECTION') bottom = Math.max(bottom, box.bottom - r.top + 16)
        else if (r.left <= box.left + 40 && r.right < box.left + box.width * 0.6) left = Math.max(left, r.right - box.left + 16)
      }
      setInsets((current) => (current.left === left && current.top === top && current.bottom === bottom ? current : { left, top, bottom }))
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
  const gridRef = useRef(null)
  const [room, setRoom] = useState(null)
  const [zoom, setZoom] = useState(1)
  const count = options.length
  const cols = Math.max(1, Math.ceil(Math.sqrt(count)))
  const rows = Math.max(1, Math.ceil(count / cols))
  useEffect(() => {
    const element = gridRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setRoom({ width: entry.contentRect.width, height: entry.contentRect.height }))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  // A cell's room for its screen: its share of the grid, less its caption,
  // padding and the gaps between cells.
  const GAP = 12
  const CAPTION = 30
  const PAD = 20
  const cellW = room ? (room.width - GAP * (cols - 1)) / cols - PAD : frame.width
  const cellH = room ? (room.height - GAP * (rows - 1)) / rows - CAPTION - PAD / 2 : frame.height
  const fit = Math.max(0.05, Math.min(cellW / frame.width, cellH / frame.height))
  const scale = fit * zoom
  const picks = regionPicks(item.id, decisions)
  const totalParts = draftScreens[item.id]?.regions.length ?? 0
  const usedOf = (key) => Object.values(picks).filter((value) => value === key).length
  const BUTTON = 'flex h-6 min-w-6 shrink-0 cursor-pointer items-center justify-center rounded-md px-1.5 text-[11px] font-medium text-slate-200 transition-colors hover:bg-white/15 hover:text-white disabled:pointer-events-none disabled:opacity-40'

  return (
    <section
      data-draft-board
      aria-label={ko ? '시안 비교' : 'Draft comparison'}
      ref={paneRef}
      className="flex h-full min-h-0 w-1/2 min-w-0 shrink-0 flex-col border-r border-white/[0.08] pr-4"
      style={{ paddingLeft: insets.left, paddingTop: insets.top, paddingBottom: insets.bottom }}
      onWheel={(event) => {
        // Pinch / ⌘-scroll zooms the drafts, not the page.
        if (!event.ctrlKey && !event.metaKey) return
        event.preventDefault()
        setZoom((value) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value * (event.deltaY < 0 ? 1.1 : 1 / 1.1))))
      }}
    >
      <div className="mb-2 flex shrink-0 items-center gap-2">
        <h2 className="text-xs font-semibold text-slate-200">{ko ? `시안 비교 · ${count}개` : `Drafts · ${count}`}</h2>
        <div data-board-zoom className="ml-auto flex items-center gap-0.5 rounded-lg bg-slate-900/95 p-0.5 ring-1 ring-white/15">
          <button type="button" data-board-fit title={ko ? '칸에 맞춤' : 'Fit to cells'} onClick={() => setZoom(1)} className={BUTTON}>{ko ? '맞춤' : 'Fit'}</button>
          <button type="button" aria-label={ko ? '축소' : 'Zoom out'} disabled={zoom <= MIN_ZOOM} onClick={() => setZoom((value) => Math.max(MIN_ZOOM, value - ZOOM_STEP))} className={BUTTON}><Minus className="size-3.5" /></button>
          <span data-board-percent className="min-w-10 text-center text-[11px] text-slate-300 tabular-nums">{Math.round(scale * 100)}%</span>
          <button type="button" aria-label={ko ? '확대' : 'Zoom in'} disabled={zoom >= MAX_ZOOM} onClick={() => setZoom((value) => Math.min(MAX_ZOOM, value + ZOOM_STEP))} className={BUTTON}><Plus className="size-3.5" /></button>
        </div>
      </div>
      <div ref={gridRef} data-draft-grid className="grid min-h-0 flex-1 gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}>
        {options.map((option, index) => (
          <DraftCell
            key={option.key}
            item={item}
            option={option}
            letter={/^시안 ([A-Z])/.exec(option.label)?.[1] ?? String.fromCharCode(65 + index)}
            frame={frame}
            scale={scale}
            usedParts={usedOf(option.key)}
            totalParts={totalParts}
          />
        ))}
      </div>
    </section>
  )
}
