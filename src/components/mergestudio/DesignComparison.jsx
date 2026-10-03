import { useEffect, useRef, useState } from 'react'
import { Check, Layers3, MapPin, MessageSquarePlus, Play, Send, X } from 'lucide-react'
import { cn } from 'cn'
import { StaticLayer } from '@/components/mergestudio/MergeInfiniteCanvas'
import { diffEffect } from '@/components/mergestudio/mergeEffects'
import { canvasPages, designMergeVariants } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'

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
  const { comments, addComment } = useWorkspace()
  const item = items.find((candidate) => candidate.id === itemId) ?? null
  const options = designCompareOptions(item)
  const selectedOptions = options.filter((option) => selectedKeys.includes(option.key))
  const [commentModeVariantKey, setCommentModeVariantKey] = useState(null)
  const [commentAnchor, setCommentAnchor] = useState(null)
  const [commentDraft, setCommentDraft] = useState('')
  const designComments = comments.filter(
    (comment) => comment.target?.type === 'design-compare' && comment.target.itemId === item?.id
  )

  function chooseLayer(option, layer) {
    if (commentModeVariantKey === option.key) {
      setCommentAnchor({
        variantKey: option.key,
        variantLabel: option.label,
        layerId: layer.id,
        layerName: layer.name ?? layer.label ?? layer.id,
      })
      setCommentModeVariantKey(null)
      return
    }
    onToggleVariant(option.key)
  }

  function postComment(event) {
    event.preventDefault()
    if (!item || !commentAnchor || !commentDraft.trim()) return
    addComment(commentDraft, {
      type: 'design-compare',
      itemId: item.id,
      variantKey: commentAnchor.variantKey,
      layerId: commentAnchor.layerId,
      layerName: commentAnchor.layerName,
    })
    setCommentDraft('')
    setCommentAnchor(null)
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-card text-xs">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-auto p-3 xl:grid-cols-[clamp(190px,38%,360px)_minmax(0,1fr)_360px]">
        <section className="min-h-0 overflow-auto rounded-xl bg-white/[0.03] p-3 xl:max-w-[360px]">
          <h2 className="mb-2 text-[11px] font-semibold text-slate-300">Design sets</h2>
          <div className="space-y-1">
            {items.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                onClick={() => {
                  setCommentModeVariantKey(null)
                  setCommentAnchor(null)
                  setCommentDraft('')
                  onSelectItem(candidate.id)
                }}
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
                    commentMode={commentModeVariantKey === option.key}
                    onStartComment={() => {
                      setCommentModeVariantKey(option.key)
                      setCommentAnchor(null)
                    }}
                    onSelectLayer={(layer) => chooseLayer(option, layer)}
                    frame={canvasPages.find((candidate) => candidate.id === item.designPageId)?.frames[0]}
                    effects={optionEffects(item, option)}
                  />
                )
              })}
            </div>
          )}
          {item && <p className="mt-3 text-[10px] text-slate-500">{selectedOptions.length < 2 ? 'Select at least two designs to compare.' : `${selectedOptions.length} designs selected for comparison.`}</p>}
        </section>
        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl bg-white/[0.03] p-3">
          <div className="mb-2 flex shrink-0 items-center justify-between">
            <h2 className="text-[11px] font-semibold text-slate-300">Design comments</h2>
            <span className="text-[10px] text-slate-500">{designComments.length}</span>
          </div>
          {commentModeVariantKey && (
            <p className="mb-2 flex shrink-0 items-center gap-1.5 text-[10px] text-emerald-300">
              <MapPin className="size-3 shrink-0" />
              <span className="min-w-0 flex-1">Click an element in {options.find((option) => option.key === commentModeVariantKey)?.label} to pin a comment.</span>
              <button type="button" onClick={() => setCommentModeVariantKey(null)} aria-label="Cancel pinning" className="rounded p-0.5 hover:bg-white/10">
                <X className="size-3" />
              </button>
            </p>
          )}
          {commentAnchor && (
            <form onSubmit={postComment} className="mb-3 flex shrink-0 flex-col gap-2">
              <span className="flex min-w-0 items-center gap-1 truncate rounded-md bg-emerald-400/10 px-2 py-1 text-[10px] text-emerald-200">
                <MapPin className="size-3 shrink-0" />
                {commentAnchor.variantLabel} · {commentAnchor.layerName}
              </span>
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={commentDraft}
                  onChange={(event) => setCommentDraft(event.target.value)}
                  placeholder="Write a comment..."
                  aria-label="Write a design comment"
                  className="h-8 min-w-0 flex-1 rounded-md border border-white/10 bg-black/20 px-2 text-[11px] text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-400/50"
                />
                <button type="submit" disabled={!commentDraft.trim()} aria-label="Post design comment" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-slate-950 disabled:opacity-40">
                  <Send className="size-3.5" />
                </button>
              </div>
            </form>
          )}
          <div className="min-h-0 flex-1 space-y-2 overflow-auto">
            {!item && <p className="text-[10px] text-slate-500">Choose a design set to view its comments.</p>}
            {item && designComments.length === 0 && (
              <p className="text-[10px] text-slate-500">Pin a comment to a design element to start a focused thread.</p>
            )}
            {designComments.map((comment) => (
              <article key={comment.id} className="rounded-lg bg-black/15 px-2.5 py-2">
                <p className="mb-1 flex items-center gap-1 text-[10px] text-emerald-200">
                  <MapPin className="size-3 shrink-0" />
                  <span className="truncate">{options.find((option) => option.key === comment.target.variantKey)?.label ?? comment.target.variantKey} · {comment.target.layerName}</span>
                  <span className="ml-auto shrink-0 text-slate-500">{comment.timeLabel}</span>
                </p>
                <p className="text-[11px] leading-relaxed text-slate-300">{comment.text}</p>
              </article>
            ))}
          </div>
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

function DesignOptionCard({ option, index, selected, onToggle, commentMode, onStartComment, onSelectLayer, frame, effects }) {
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
      <div className="flex min-w-0 items-center gap-2 px-2.5 py-2">
        <button
          type="button"
          role="checkbox"
          aria-checked={selected}
          onClick={onToggle}
          className={cn('flex min-w-0 flex-1 items-center gap-2 rounded-md py-0.5 text-left', selected ? 'text-emerald-100' : 'text-slate-300 hover:text-white')}
        >
          <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold', selected ? 'bg-emerald-300 text-slate-950' : 'bg-white/[0.07]')}>
            {letter}
          </span>
          <span className="min-w-0 flex-1 truncate text-[11px] font-medium">{option.label}</span>
          {selected && <Check className="size-3.5 shrink-0 text-emerald-300" />}
        </button>
        <button
          type="button"
          title={`Pin comment to ${option.label}`}
          aria-label={`Pin comment to ${option.label}`}
          aria-pressed={commentMode}
          onClick={onStartComment}
          className={cn('flex size-6 shrink-0 items-center justify-center rounded-md transition-colors', commentMode ? 'bg-emerald-400/15 text-emerald-300' : 'text-slate-500 hover:bg-white/[0.07] hover:text-slate-200')}
        >
          <MessageSquarePlus className="size-3.5" />
        </button>
      </div>
      {frame ? (
        <div
          role="checkbox"
          tabIndex={0}
          aria-label={`Select ${option.label}`}
          aria-checked={selected}
          onClick={onToggle}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget || !['Enter', ' '].includes(event.key)) return
            event.preventDefault()
            onToggle()
          }}
          ref={boardRef}
          className={cn('relative mx-2 mb-2 block w-[calc(100%-1rem)] overflow-hidden rounded-lg bg-white text-left shadow-lg shadow-black/20 ring-1 ring-slate-200/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300', commentMode && 'cursor-crosshair')}
          style={{ aspectRatio: `${frame.width} / ${frame.height}` }}
        >
          <div className="absolute top-0 left-0 origin-top-left" style={{ width: frame.width, height: frame.height, transform: `scale(${scale})` }}>
            {frame.layers.map((layer) => (
              <StaticLayer key={layer.id} layer={layer} override={effects[layer.id]} onSelect={() => onSelectLayer(layer)} />
            ))}
          </div>
        </div>
      ) : (
        <div
          role="checkbox"
          tabIndex={0}
          aria-label={`Select ${option.label}`}
          aria-checked={selected}
          onClick={onToggle}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget || !['Enter', ' '].includes(event.key)) return
            event.preventDefault()
            onToggle()
          }}
          className="mx-2 mb-2 flex min-h-28 w-[calc(100%-1rem)] items-center justify-center rounded-lg bg-black/10 text-[10px] text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300"
        >
          No design preview
        </div>
      )}
    </article>
  )
}

export function optionEffects(item, option, valueOf = null, diffsOverride = null) {
  const diffsByLayer = diffsOverride ?? designMergeVariants[item.id]?.layerDiffs ?? {}
  return Object.fromEntries(Object.entries(diffsByLayer).map(([layerId, diffs]) => {
    const merged = {}
    for (const diff of diffs) {
      const value = valueOf ? valueOf(diff, layerId) : option.side ? null : diff.values?.[option.key]
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

// Mixing drafts: the value a draft gives one property, and the decision
// (A / B / custom) that takes it — the same shape the Drifts tab records,
// so a mix flows into checks and merging like any other decision.
export function draftValue(diff, option) {
  if (option.side) return option.side === 'A' ? diff.optionA : diff.optionB
  return diff.values?.[option.key] ?? diff.optionA
}
export function decisionFor(diff, value) {
  return value === diff.optionA ? 'A' : value === diff.optionB ? 'B' : { custom: value }
}
// The value a property currently resolves to, or undefined when undecided.
export function decidedValue(diff, resolution) {
  if (resolution == null) return undefined
  if (typeof resolution === 'object') return resolution.custom
  return resolution === 'B' ? diff.optionB : diff.optionA
}

// The "Result" artboard: the current picks drawn the way a draft is
// (undecided properties keep the design's value).
export function resolvedEffects(item, resolutions) {
  const diffsByLayer = designMergeVariants[item.id]?.layerDiffs ?? {}
  return optionEffects({ id: item.id }, { key: '__result', values: true }, (diff, layerId) => decidedValue(diff, resolutions[`${layerId}:${diff.id}`]) ?? diff.optionA, diffsByLayer)
}

export { DesignComparePanel }
