import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { cn } from 'cn'
import { draftScreens, regionPicks } from '@/data/draftScreens'
import { StaticLayer } from '@/components/mergestudio/MergeInfiniteCanvas'
import { LocalizedText } from '@/i18n/runtime'

function partBounds(part) {
  const padding = 10
  const minX = part.layers.length ? Math.min(...part.layers.map((layer) => layer.x)) : 0
  const minY = part.layers.length ? Math.min(...part.layers.map((layer) => layer.y)) : 0
  return {
    minX, minY, padding,
    width: (part.layers.length ? Math.max(...part.layers.map((layer) => layer.x + layer.width)) - minX : 240) + padding * 2,
    height: (part.layers.length ? Math.max(...part.layers.map((layer) => layer.y + layer.height)) - minY : 32) + padding * 2,
  }
}

function RegionCandidate({ part, option, letter, region, selected, live, scale, commonWidth, cardWidth, cardHeight }) {
  const { minX, minY, padding, height } = partBounds(part)
  const width = commonWidth
  return <div data-region-candidate-slot className="flex min-w-0 shrink-0 justify-center">
    <button type="button" data-region-candidate={option.key} aria-pressed={selected} aria-label={`${region.label} · 시안 ${letter} 사용`} disabled={!live.onPick}
      onMouseEnter={() => live.onPick && live.onPreviewRegion({ regionId: region.id, draftKey: option.key })}
      onFocus={() => live.onPick && live.onPreviewRegion({ regionId: region.id, draftKey: option.key })}
      onBlur={() => live.onPreviewRegion(null)}
      onClick={() => { live.onPreviewRegion(null); live.onPick?.(region.id, option.key) }}
      style={{ width: cardWidth, height: cardHeight }}
      className={cn('ds-intrinsic flex shrink-0 flex-col overflow-hidden rounded-[12px] border text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-sky-300 disabled:cursor-default', selected ? 'border-emerald-300 ring-2 ring-emerald-300/40' : 'border-white/10 opacity-80 hover:border-sky-300/70 hover:opacity-100')}>
      <span data-region-thumbnail className="relative block w-full shrink-0 overflow-hidden bg-white" style={{ height: Math.max(0, cardHeight - 24) }}>
        <span data-region-render className="pointer-events-none absolute top-1/2 left-1/2 block bg-white" style={{ width, height, transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center' }}>
          {part.layers.map((layer) => <StaticLayer key={layer.id} layer={{ ...layer, x: layer.x - minX + padding, y: layer.y - minY + padding }} override={layer.look} onSelect={() => {}} />)}
          {!part.layers.length && <span className="absolute inset-0 flex items-center justify-center text-xs text-slate-400">이 영역 생략</span>}
        </span>
      </span>
      {/* (The one in use: its outline and its label strip in the accent, and says so in words.) */}
      <span className={cn('flex h-[22px] w-full shrink-0 items-center gap-1 px-2 text-[10.5px]', selected ? 'bg-emerald-400/15 text-emerald-200' : 'text-slate-400')}>
        <span className="shrink-0 font-semibold">{letter}</span><span className="min-w-0 flex-1 truncate"><LocalizedText text={part.summary} /></span>{selected && <span data-region-in-use className="flex shrink-0 items-center gap-0.5 font-semibold"><Check aria-hidden className="size-3" />사용 중</span>}
      </span>
    </button>
  </div>
}

// Before a part is picked: every part as a card — its name, where it stands (the draft taken, or 고르기), and its
// drafts drawn small side by side — so the room is the overview, and a press opens that part's choice.
function RegionOverview({ screen, options, picks, letterOf, onFocus, onHover }) {
  return <div data-region-overview className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto [scrollbar-width:thin]" onMouseLeave={() => onHover?.(null)}>
    {screen.regions.map((entry) => {
      const parts = options.map((option) => ({ option, part: screen.drafts[option.key]?.[entry.id] })).filter(({ part }) => part)
      const commonWidth = Math.max(1, ...parts.map(({ part }) => partBounds(part).width))
      const commonHeight = Math.max(1, ...parts.map(({ part }) => partBounds(part).height))
      const picked = picks[entry.id]
      return <button key={entry.id} type="button" data-region-overview-card={entry.id} onClick={() => onFocus(entry.id)} onMouseEnter={() => onHover?.(entry.id)} onFocus={() => onHover?.(entry.id)} onBlur={() => onHover?.(null)}
        className="ds-intrinsic flex w-full shrink-0 flex-col gap-2 rounded-[14px] border border-white/[0.08] bg-[#232323] p-3 text-left transition-colors hover:bg-[#272727] focus-visible:outline-2 focus-visible:outline-sky-300">
        <span className="flex w-full items-center gap-2 text-xs">
          <span className="font-semibold text-slate-100"><LocalizedText text={entry.label} /></span>
          <span className="text-slate-500">시안 {parts.length}개</span>
          <span className={cn('ml-auto', picked ? 'font-medium text-emerald-300' : 'text-slate-400')}>{picked ? `시안 ${letterOf(picked)}` : '고르기 ›'}</span>
        </span>
        <span className="grid w-full gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.max(1, parts.length)}, minmax(0, 1fr))` }}>
          {parts.map(({ option, part }) => {
            const { minX, minY, padding } = partBounds(part)
            const on = picked === option.key
            return <span key={option.key} className={cn('relative block overflow-hidden rounded-md bg-white', on ? 'ring-2 ring-emerald-300/70' : 'ring-1 ring-white/10')} style={{ aspectRatio: `${commonWidth} / ${commonHeight}` }}>
              <MiniDrawing part={part} minX={minX} minY={minY} padding={padding} width={commonWidth} height={commonHeight} />
              <span className="absolute bottom-0.5 left-1 text-[9px] font-semibold text-slate-500">{letterOf(option.key)}</span>
            </span>
          })}
        </span>
      </button>
    })}
  </div>
}

// A part drawn to fill its small box (measured, then scaled about its top left).
function MiniDrawing({ part, minX, minY, padding, width, height }) {
  const ref = useRef(null)
  const [scale, setScale] = useState(0)
  useEffect(() => {
    const box = ref.current?.parentElement
    if (!box) return undefined
    const measure = () => setScale(Math.min(box.clientWidth / width, box.clientHeight / height))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(box)
    return () => observer.disconnect()
  }, [width, height])
  return <span ref={ref} aria-hidden className="pointer-events-none absolute top-0 left-0 block origin-top-left" style={{ width, height, transform: `scale(${scale})`, visibility: scale ? undefined : 'hidden' }}>
    {part.layers.map((layer) => <StaticLayer key={layer.id} layer={{ ...layer, x: layer.x - minX + padding, y: layer.y - minY + padding }} override={layer.look} editHint={false} onSelect={() => {}} />)}
  </span>
}

export default function VisualRegionPicker({ item, live }) {
  const { onPreviewRegion, onHoverRegion, regionId } = live
  const listRef = useRef(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    if (!listRef.current) return
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }))
    observer.observe(listRef.current)
    return () => observer.disconnect()
  }, [regionId])
  const previewCandidate = onPreviewRegion
  useEffect(() => () => { onPreviewRegion(null); onHoverRegion?.(null) }, [onPreviewRegion, onHoverRegion, regionId])
  const screen = draftScreens[item.id]
  if (!screen) return null
  const picks = regionPicks(item.id, live.decisions)
  const region = screen.regions.find((entry) => entry.id === live.regionId)
  const parts = region ? live.options.map((option) => screen.drafts[option.key]?.[region.id]).filter(Boolean) : []
  const commonWidth = Math.max(1, ...parts.map((part) => partBounds(part).width))
  const commonHeight = Math.max(1, ...parts.map((part) => partBounds(part).height))
  // (Each card as tall as its drawing — the tallest option's, at the column's width, never past 1× — plus its
  // label: no share of the panel's height to fill with white. More than fit, the list scrolls.)
  const cardWidth = Math.max(0, size.width)
  const scale = Math.max(0, Math.min(1, (cardWidth - 2) / commonWidth))
  const cardHeight = Math.ceil(commonHeight * scale) + 24
  const letterOf = (key) => String.fromCharCode(65 + item.variants.findIndex((variant) => variant.key === key))
  // (Top to bottom, one column: the parts as a row of capsules — the one being compared raised, a check on
  // those already picked — then that part's options, each card the column's width. No side list beside them.)
  return <section data-visual-region-picker className="flex h-full min-h-0 flex-col gap-3">
    {/* (The capsules once a part is open — to move between parts; before that the overview's cards are the parts.) */}
    {region && <div data-component-region-list role="group" aria-label="요소 항목" className="flex shrink-0 flex-wrap items-center gap-1.5" onMouseLeave={() => live.onHoverRegion?.(null)}>
      {screen.regions.map((entry) => {
        const active = region?.id === entry.id
        return <button key={entry.id} type="button" data-component-region={entry.id} aria-label={`${entry.label} 시안 비교`} aria-pressed={active} onClick={() => live.onFocusRegion(entry.id)}
          onMouseEnter={() => live.onHoverRegion?.(entry.id)} onFocus={() => live.onHoverRegion?.(entry.id)} onBlur={() => live.onHoverRegion?.(null)}
          className={cn('ds-intrinsic flex h-7 shrink-0 items-center gap-1 rounded-full px-3 text-xs whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-sky-300', active ? 'bg-white/[0.16] font-semibold text-white shadow-[0_1px_2px_rgb(0_0_0/0.35)]' : 'bg-white/[0.06] text-slate-400 hover:bg-white/[0.1] hover:text-slate-200')}>
          <LocalizedText text={entry.label} />
          {picks[entry.id] && <span data-region-picked className="text-[11px] font-medium text-emerald-300">{letterOf(picks[entry.id])}</span>}
        </button>
      })}
    </div>}
    {!region ? <RegionOverview screen={screen} options={live.options} picks={picks} letterOf={letterOf} onFocus={live.onFocusRegion} onHover={live.onHoverRegion} /> : <div key={region.id} className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 animate-in fade-in slide-in-from-bottom-1 duration-200 motion-reduce:animate-none">
      <div data-region-candidates className="flex min-h-0 shrink flex-col gap-2 overflow-y-auto [scrollbar-width:thin]" ref={listRef} onMouseLeave={() => previewCandidate(null)}>
        {live.options.map((option) => {
          const part = screen.drafts[option.key]?.[region.id]
          if (!part) return null
          return <RegionCandidate key={option.key} part={part} option={option} letter={letterOf(option.key)} region={region} selected={picks[region.id] === option.key} live={live} scale={scale} commonWidth={commonWidth} cardWidth={cardWidth} cardHeight={cardHeight} />
        })}
      </div>
      <p className="shrink-0 text-[11px] text-slate-500">올려서 결과 미리보기 · 눌러서 적용</p>
    </div>}
  </section>
}
