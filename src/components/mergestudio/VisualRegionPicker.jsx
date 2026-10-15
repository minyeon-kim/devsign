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
  // (Opened straight on a part: MergeStudioWorkspace picks the first not yet picked.)
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
    {/* (The parts as capsules — the one being compared raised, the draft taken on each beside its name.) */}
    <div data-component-region-list role="group" aria-label="요소 항목" className="flex shrink-0 flex-wrap items-center gap-1.5" onMouseLeave={() => live.onHoverRegion?.(null)}>
      {screen.regions.map((entry) => {
        const active = region?.id === entry.id
        return <button key={entry.id} type="button" data-component-region={entry.id} aria-label={`${entry.label} 시안 비교`} aria-pressed={active} onClick={() => { if (!active) live.onFocusRegion(entry.id) }}
          onMouseEnter={() => live.onHoverRegion?.(entry.id)} onFocus={() => live.onHoverRegion?.(entry.id)} onBlur={() => live.onHoverRegion?.(null)}
          className={cn('ds-intrinsic flex h-7 shrink-0 items-center gap-1 rounded-full px-3 text-xs whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-sky-300', active ? 'bg-white/[0.16] font-semibold text-white shadow-[0_1px_2px_rgb(0_0_0/0.35)]' : 'bg-white/[0.06] text-slate-400 hover:bg-white/[0.1] hover:text-slate-200')}>
          <LocalizedText text={entry.label} />
          {picks[entry.id] && <span data-region-picked className="text-[11px] font-medium text-emerald-300">{letterOf(picks[entry.id])}</span>}
        </button>
      })}
    </div>
    {!region ? null : <div key={region.id} className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 animate-in fade-in slide-in-from-bottom-1 duration-200 motion-reduce:animate-none">
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
