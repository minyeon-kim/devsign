import { useEffect, useRef, useState } from 'react'
import { Check, Layers3, Play } from 'lucide-react'
import { cn } from 'cn'
import { StaticLayer } from '@/components/mergestudio/MergeInfiniteCanvas'
import { diffEffect } from '@/components/mergestudio/mergeEffects'
import { canvasPages, designMergeVariants } from '@/data/mockData'

export function designCompareOptions(item) {
  if (item?.variants?.length) {
    return item.variants.map((variant) => ({
      key: variant.key,
      label: variant.label,
      authorId: variant.authorId,
    }))
  }
  return [
    { key: 'A', label: 'Original design', side: 'A' },
    { key: 'B', label: 'Current implementation', side: 'B' },
  ]
}

function DesignComparePanel({ items, itemId, selectedKeys, onSelectItem, onToggleVariant, onCompare }) {
  const item = items.find((candidate) => candidate.id === itemId) ?? null
  const options = designCompareOptions(item)
  const selectedOptions = options.filter((option) => selectedKeys.includes(option.key))

  return (
    <div className="flex h-full min-h-0 flex-col bg-card text-xs">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-auto p-3 md:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.2fr)]">
        <section className="min-h-0 overflow-auto rounded-xl bg-white/[0.03] p-3">
          <h2 className="mb-2 text-[11px] font-semibold text-slate-300">Design sets</h2>
          <div className="space-y-1">
            {items.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                onClick={() => onSelectItem(candidate.id)}
                aria-pressed={candidate.id === itemId}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors',
                  candidate.id === itemId ? 'bg-white/[0.09] text-white' : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200'
                )}
              >
                <Layers3 className="size-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{candidate.title}</span>
                <span className="shrink-0 text-[10px] text-slate-500">{designCompareOptions(candidate).length}</span>
              </button>
            ))}
            {items.length === 0 && <p className="px-2 py-3 text-[11px] text-slate-500">No design sets are available in this project yet.</p>}
          </div>
        </section>

        <section className="min-h-0 overflow-auto rounded-xl bg-white/[0.03] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="truncate text-[11px] font-semibold text-slate-300">{item?.title ?? 'Choose a design set'}</h2>
            {item && <span className="shrink-0 text-[10px] text-slate-500">Select 2 or more</span>}
          </div>
          {item && (
            <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {options.map((option, index) => {
                const selected = selectedKeys.includes(option.key)
                return (
                  <DesignOptionCard
                    key={option.key}
                    option={option}
                    index={index}
                    selected={selected}
                    onToggle={() => onToggleVariant(option.key)}
                    frame={canvasPages.find((candidate) => candidate.id === item.designPageId)?.frames[0]}
                    effects={optionEffects(item, option)}
                  />
                )
              })}
            </div>
          )}
          {item && <p className="mt-3 text-[10px] text-slate-500">{selectedOptions.length < 2 ? 'Select at least two designs to compare.' : `${selectedOptions.length} designs selected for comparison.`}</p>}
        </section>
      </div>
      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-white/[0.06] px-3 py-2">
        <span className="text-[10px] text-slate-500">{selectedOptions.length} selected</span>
        <button
          type="button"
          disabled={!item || selectedOptions.length < 2}
          onClick={() => onCompare(item, selectedOptions)}
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-emerald-400 px-3 text-[11px] font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Play className="size-3" />
          Compare on canvas
        </button>
      </div>
    </div>
  )
}

function DesignOptionCard({ option, index, selected, onToggle, frame, effects }) {
  const boardRef = useRef(null)
  const [boardWidth, setBoardWidth] = useState(0)

  useEffect(() => {
    if (!boardRef.current) return undefined
    const observer = new ResizeObserver(([entry]) => setBoardWidth(entry.contentRect.width))
    observer.observe(boardRef.current)
    return () => observer.disconnect()
  }, [])

  const letter = String.fromCharCode(65 + index)
  const scale = frame && boardWidth ? Math.min(1, boardWidth / frame.width) : 1

  return (
    <article className={cn('min-w-0 overflow-hidden rounded-xl border transition-colors', selected ? 'border-emerald-400/50 bg-emerald-400/[0.05]' : 'border-white/[0.07] bg-black/10')}>
      <button
        type="button"
        role="checkbox"
        aria-checked={selected}
        onClick={onToggle}
        className={cn('flex w-full min-w-0 items-center gap-2 px-2.5 py-2.5 text-left', selected ? 'text-emerald-100' : 'text-slate-300 hover:bg-white/[0.04]')}
      >
        <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold', selected ? 'bg-emerald-300 text-slate-950' : 'bg-white/[0.07]')}>
          {letter}
        </span>
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium">{option.label}</span>
        {selected && <Check className="size-3.5 shrink-0 text-emerald-300" />}
      </button>
      {frame ? (
        <div
          ref={boardRef}
          className="relative mx-2 mb-2 overflow-hidden rounded-lg bg-white shadow-lg shadow-black/20 ring-1 ring-slate-200/80"
          style={{ aspectRatio: `${frame.width} / ${frame.height}` }}
        >
          <div className="absolute top-0 left-0 origin-top-left" style={{ width: frame.width, height: frame.height, transform: `scale(${scale})` }}>
            {frame.layers.map((layer) => (
              <StaticLayer key={layer.id} layer={layer} override={effects[layer.id]} onSelect={() => {}} />
            ))}
          </div>
        </div>
      ) : (
        <div className="mx-2 mb-2 flex min-h-28 items-center justify-center rounded-lg bg-black/10 text-[10px] text-slate-500">
          No design preview
        </div>
      )}
    </article>
  )
}

function optionEffects(item, option) {
  const diffsByLayer = designMergeVariants[item.id]?.layerDiffs ?? {}
  return Object.fromEntries(Object.entries(diffsByLayer).map(([layerId, diffs]) => {
    const merged = {}
    for (const diff of diffs) {
      const value = option.side ? null : diff.values?.[option.key]
      const side = option.side ?? (value === undefined ? 'A' : value === diff.optionB ? 'B' : 'A')
      const effect = diffEffect(diff, side)
      if (value !== undefined && !option.side) {
        const numeric = Number.parseFloat(value)
        if (Number.isFinite(numeric)) {
          if (/radius/.test(diff.id)) effect.radius = numeric
          else if (/weight/.test(diff.id)) effect.fontWeight = numeric
          else if (/size/.test(diff.id)) effect.dh = numeric - Number.parseFloat(diff.optionA)
          else if (/padding|spacing/.test(diff.id)) {
            effect.dw = (numeric - Number.parseFloat(diff.optionA)) * 2
            effect.dh = (numeric - Number.parseFloat(diff.optionA)) * 2
          }
        } else if (value === diff.optionA) effect.className = diff.optionAClass
        else if (value === diff.optionB) effect.className = diff.optionBClass
      }
      if (effect.className) merged.className = effect.className
      if (effect.radius !== undefined) merged.radius = effect.radius
      if (effect.fontWeight !== undefined) merged.fontWeight = effect.fontWeight
      merged.dw = (merged.dw ?? 0) + (effect.dw ?? 0)
      merged.dh = (merged.dh ?? 0) + (effect.dh ?? 0)
    }
    return [layerId, merged]
  }))
}

function DesignComparisonCanvas({ item, options, onBack, onExit }) {
  const page = canvasPages.find((candidate) => candidate.id === item?.designPageId)
  const frame = page?.frames[0]
  const effects = options.map((option) => optionEffects(item, option))
  const boardRefs = useRef(new Map())
  const [boardWidths, setBoardWidths] = useState({})

  useEffect(() => {
    const observers = options.map((option) => {
      const element = boardRefs.current.get(option.key)
      if (!element) return null
      const observer = new ResizeObserver(([entry]) => {
        const nextWidth = entry.contentRect.width
        setBoardWidths((current) => current[option.key] === nextWidth ? current : { ...current, [option.key]: nextWidth })
      })
      observer.observe(element)
      return observer
    })
    return () => observers.forEach((observer) => observer?.disconnect())
  }, [options])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] bg-card/80 px-4 py-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-slate-200">Comparing: {item.title}</p>
          <p className="text-[10px] text-slate-500">{options.length} designs · {page?.name ?? 'Design preview'}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={onBack} className="rounded-full px-3 py-1.5 text-[11px] text-slate-300 hover:bg-white/[0.08]">
            Change selection
          </button>
          <button type="button" onClick={onExit} className="rounded-full px-3 py-1.5 text-[11px] text-slate-300 hover:bg-white/[0.08]">
            Back to merge canvas
          </button>
        </div>
      </div>
      {!frame ? (
        <div className="flex min-h-0 flex-1 items-center justify-center text-xs text-slate-500">This design set has no canvas preview.</div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {options.map((option, index) => {
              const width = boardWidths[option.key] ?? 300
              const scale = Math.min(1, width / frame.width)
              return (
                <section key={option.key} className="min-w-0">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex size-5 items-center justify-center rounded-md bg-emerald-300 text-[10px] font-semibold text-slate-950">{String.fromCharCode(65 + index)}</span>
                    <span className="truncate text-[11px] font-medium text-slate-200">{option.label}</span>
                  </div>
                  <div
                    ref={(element) => element ? boardRefs.current.set(option.key, element) : boardRefs.current.delete(option.key)}
                    className="relative mx-auto w-full overflow-hidden rounded-xl bg-white shadow-xl shadow-black/30 ring-1 ring-slate-200/80"
                    style={{ aspectRatio: `${frame.width} / ${frame.height}` }}
                  >
                    <div className="absolute top-0 left-0 origin-top-left" style={{ width: frame.width, height: frame.height, transform: `scale(${scale})` }}>
                      {frame.layers.map((layer) => (
                        <StaticLayer key={layer.id} layer={layer} override={effects[index][layer.id]} onSelect={() => {}} />
                      ))}
                    </div>
                  </div>
                </section>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export { DesignComparePanel, DesignComparisonCanvas }
