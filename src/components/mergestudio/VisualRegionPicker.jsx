import { useEffect, useRef, useState } from 'react'
import { Check, CreditCard, LayoutPanelTop, PanelsTopLeft, RectangleHorizontal, Square } from 'lucide-react'
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
  return <div data-region-candidate-slot className="flex min-h-0 min-w-0 items-center justify-center">
    <button type="button" data-region-candidate={option.key} aria-pressed={selected} aria-label={`${region.label} · 시안 ${letter} 사용`} disabled={!live.onPick}
      onMouseEnter={() => live.onPick && live.onPreviewRegion({ regionId: region.id, draftKey: option.key })}
      onFocus={() => live.onPick && live.onPreviewRegion({ regionId: region.id, draftKey: option.key })}
      onBlur={() => live.onPreviewRegion(null)}
      onClick={() => { live.onPreviewRegion(null); live.onPick?.(region.id, option.key) }}
      style={{ width: cardWidth, height: cardHeight }}
      className={cn('ds-intrinsic flex shrink-0 flex-col overflow-hidden rounded-lg border text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-sky-300 disabled:cursor-default', selected ? 'border-emerald-300/70' : 'border-white/10 hover:border-sky-300/70')}>
      <span data-region-thumbnail className="relative block w-full shrink-0 overflow-hidden bg-white" style={{ height: Math.max(0, cardHeight - 24) }}>
        <span data-region-render className="pointer-events-none absolute top-1/2 left-1/2 block bg-white" style={{ width, height, transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center' }}>
          {part.layers.map((layer) => <StaticLayer key={layer.id} layer={{ ...layer, x: layer.x - minX + padding, y: layer.y - minY + padding }} override={layer.look} onSelect={() => {}} />)}
          {!part.layers.length && <span className="absolute inset-0 flex items-center justify-center text-xs text-slate-400">이 영역 생략</span>}
        </span>
      </span>
      <span className={cn('flex h-[22px] w-full shrink-0 items-center gap-1 px-1 text-[10px]', selected ? 'text-emerald-300' : 'text-slate-400')}>
        <span className="shrink-0 font-semibold">{letter}</span><span className="min-w-0 flex-1 truncate"><LocalizedText text={part.summary} /></span>{selected && <Check aria-label="사용 중" className="size-3 shrink-0" />}
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
  const screen = draftScreens[item.id]
  if (!screen) return null
  const picks = regionPicks(item.id, live.decisions)
  const region = screen.regions.find((entry) => entry.id === live.regionId)
  const parts = region ? live.options.map((option) => screen.drafts[option.key]?.[region.id]).filter(Boolean) : []
  const commonWidth = Math.max(1, ...parts.map((part) => partBounds(part).width))
  const commonHeight = Math.max(1, ...parts.map((part) => partBounds(part).height))
  const cardWidth = Math.max(0, size.width)
  const cardHeight = Math.max(0, (size.height - Math.max(0, parts.length - 1) * 4) / Math.max(1, parts.length))
  const scale = Math.max(0, Math.min(1, (cardWidth - 2) / commonWidth, (cardHeight - 24) / commonHeight))
  const letterOf = (key) => String.fromCharCode(65 + item.variants.findIndex((variant) => variant.key === key))
  return <section data-visual-region-picker className="flex h-full min-h-0 gap-2">
    <div data-component-region-list role="group" aria-label="요소 항목" className={cn('order-last flex min-h-0 shrink-0 flex-col gap-1 overflow-y-auto border-l border-white/[0.06] pl-2', region ? 'w-[110px]' : 'w-full')} onMouseLeave={() => live.onHoverRegion?.(null)}>
      {screen.regions.map((entry) => {
        const active = region?.id === entry.id
        const Icon = ({ header: LayoutPanelTop, summary: PanelsTopLeft, cards: PanelsTopLeft, payment: CreditCard, footer: RectangleHorizontal, cta: RectangleHorizontal })[entry.id] ?? Square
        return <button key={entry.id} type="button" data-component-region={entry.id} aria-label={`${entry.label} 시안 비교`} aria-pressed={active} onClick={() => live.onFocusRegion(entry.id)}
          onMouseEnter={() => live.onHoverRegion?.(entry.id)} onFocus={() => live.onHoverRegion?.(entry.id)} onBlur={() => live.onHoverRegion?.(null)}
          className={cn('ds-intrinsic flex h-8 w-full shrink-0 items-center gap-1.5 rounded-md px-2 text-left text-[10px] transition-colors focus-visible:outline-2 focus-visible:outline-sky-300', active ? 'bg-white/[0.08] text-slate-100' : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-200')}>
          <Icon aria-hidden className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate"><LocalizedText text={entry.label} /></span>
          {picks[entry.id] && <Check className="size-2.5 shrink-0 text-emerald-300" />}
        </button>
      })}
    </div>
    {!region ? null : <div key={region.id} className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 animate-in fade-in slide-in-from-bottom-1 duration-200 motion-reduce:animate-none">
      <div className="flex shrink-0 items-center justify-between text-xs"><span className="font-medium text-slate-200"><LocalizedText text={region.label} /></span><span aria-live="polite" className="text-slate-500">{picks[region.id] ? `현재 시안 ${letterOf(picks[region.id])}` : '선택 안 됨'}</span></div>
      <div className="grid min-h-0 flex-1 grid-cols-1 content-start gap-1 overflow-hidden" ref={listRef} style={{ gridTemplateRows: `repeat(${Math.max(1, parts.length)}, minmax(0, 1fr))` }} onMouseLeave={() => previewCandidate(null)}>
        {live.options.map((option) => {
          const part = screen.drafts[option.key]?.[region.id]
          if (!part) return null
          return <RegionCandidate key={option.key} part={part} option={option} letter={letterOf(option.key)} region={region} selected={picks[region.id] === option.key} live={live} scale={scale} commonWidth={commonWidth} cardWidth={cardWidth} cardHeight={cardHeight} />
        })}
      </div>
      <p className="text-[10px] text-slate-500">올려서 결과 미리보기 · 눌러서 적용</p>
    </div>}
  </section>
}
