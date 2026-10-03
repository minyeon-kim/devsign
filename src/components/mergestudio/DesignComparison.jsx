import { useEffect, useRef, useState } from 'react'
import { Check, Layers3, MapPin, MessageSquarePlus, Play, Send, X } from 'lucide-react'
import { cn } from 'cn'
import { StaticLayer } from '@/components/mergestudio/MergeInfiniteCanvas'
import { diffEffect, mergeOverride } from '@/components/mergestudio/mergeEffects'
import { canvasPages, designMergeVariants } from '@/data/mockData'
import { draftFrame, draftScreens } from '@/data/draftScreens'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { toast } from '@/i18n/toast'

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
  const { conflicts, addComment, openConflictReview, setBottomPanel } = useWorkspace()
  const item = items.find((candidate) => candidate.id === itemId) ?? null
  const options = designCompareOptions(item)
  const selectedOptions = options.filter((option) => selectedKeys.includes(option.key))
  const [commentModeVariantKey, setCommentModeVariantKey] = useState(null)
  const [commentAnchor, setCommentAnchor] = useState(null)
  const [commentDraft, setCommentDraft] = useState('')
  // Comments on a draft go to the item's conflict — its Comments are the
  // one thread — tagged with the draft and element they're pinned to.
  const conflict = item ? conflicts.find((c) => c.mergeItemId === item.id || c.id === item.conflictId) : null

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
    if (!item || !conflict || !commentAnchor || !commentDraft.trim()) return
    addComment(commentDraft, {
      conflictId: conflict.id,
      anchor: `${commentAnchor.variantLabel} · ${commentAnchor.layerName}`,
    })
    setCommentDraft('')
    setCommentAnchor(null)
    toast('Comment added to the conflict', {
      description: conflict.title,
      action: { label: 'View', onClick: () => { openConflictReview(conflict.id); setBottomPanel({ tab: 'conflict', open: true }) } },
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-card text-xs">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-auto p-3 xl:grid-cols-[clamp(190px,30%,320px)_minmax(0,1fr)]">
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

        <section className="flex min-h-0 flex-col overflow-auto rounded-xl bg-white/[0.03] p-3">
          {/* Title, how many are picked, and the action — at the top, like
              the other panels' actions. */}
          <div className="mb-2.5 flex items-center gap-2">
            <h2 className="truncate text-xs font-medium text-slate-200">{item?.title ?? 'Choose a design set'}</h2>
            {item && (
              <span className={cn('shrink-0 text-[11px] tabular-nums', selectedOptions.length >= 2 ? 'text-emerald-300' : 'text-slate-500')}>
                {selectedOptions.length < 2 ? 'Select 2 or more' : `${selectedOptions.length} selected`}
              </span>
            )}
            <button
              type="button"
              disabled={!item || selectedOptions.length < 2}
              onClick={() => onCompare(item, selectedOptions)}
              className="ds-intrinsic ml-auto inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-emerald-400/10 px-3 text-xs font-medium text-emerald-200 ring-1 ring-emerald-400/40 ring-inset transition-colors hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:bg-white/[0.04] disabled:text-slate-500 disabled:ring-white/10"
            >
              <Layers3 className="size-3.5" />
              Compare on canvas
            </button>
          </div>
          {commentModeVariantKey && (
            <p className="mb-2 flex items-center gap-1.5 text-[10px] text-emerald-300">
              <MapPin className="size-3 shrink-0" />
              <span className="min-w-0 flex-1">{`Click an element in ${options.find((option) => option.key === commentModeVariantKey)?.label} to comment on it.`}</span>
              <button type="button" onClick={() => setCommentModeVariantKey(null)} aria-label="Cancel pinning" className="rounded p-0.5 hover:bg-white/10">
                <X className="size-3" />
              </button>
            </p>
          )}
          {commentAnchor && (
            <form onSubmit={postComment} className="mb-3 flex items-center gap-2 rounded-lg bg-black/20 p-1.5 pl-2">
              <span className="flex max-w-[45%] shrink-0 items-center gap-1 truncate rounded-md bg-emerald-400/10 px-2 py-1 text-[10px] text-emerald-200">
                <MapPin className="size-3 shrink-0" />
                <span className="truncate">{`${commentAnchor.variantLabel} · ${commentAnchor.layerName}`}</span>
              </span>
              <input
                autoFocus
                value={commentDraft}
                onChange={(event) => setCommentDraft(event.target.value)}
                onKeyDown={(event) => event.key === 'Escape' && setCommentAnchor(null)}
                placeholder="Comment — it goes to the conflict’s Comments"
                aria-label="Write a design comment"
                className="h-7 min-w-0 flex-1 bg-transparent text-[11px] text-slate-100 outline-none placeholder:text-slate-500"
              />
              <button type="submit" disabled={!commentDraft.trim() || !conflict} aria-label="Post design comment" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-slate-950 disabled:opacity-40">
                <Send className="size-3.5" />
              </button>
            </form>
          )}
          {item && (
            // Every draft in view at once: one row, each preview fit to the
            // panel's height rather than its width.
            <div className="grid min-h-[180px] flex-1 grid-cols-2 gap-2.5 lg:grid-cols-4 lg:grid-rows-[minmax(0,1fr)]">
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
                    frame={(() => {
                      const base = canvasPages.find((candidate) => candidate.id === item.designPageId)?.frames[0]
                      // Drafts with their own layout show their own screen.
                      return base && draftScreens[item.id] ? draftFrame(item.id, base, option.key) : base
                    })()}
                    effects={optionEffects(item, option)}
                  />
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function DesignOptionCard({ option, index, selected, onToggle, commentMode, onStartComment, onSelectLayer, frame, effects }) {
  const boardRef = useRef(null)
  const [box, setBox] = useState({ width: 0, height: 0 })

  useEffect(() => {
    if (!boardRef.current) return undefined
    const observer = new ResizeObserver(([entry]) => setBox({ width: entry.contentRect.width, height: entry.contentRect.height }))
    observer.observe(boardRef.current)
    return () => observer.disconnect()
  }, [])

  const letter = String.fromCharCode(65 + index)
  // The whole screen, fit inside the preview box (by width and height).
  const scale = frame && box.width && box.height ? Math.min(box.width / frame.width, box.height / frame.height) : 0

  return (
    <article className={cn('flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border transition-colors', selected ? 'border-emerald-400/50 bg-emerald-400/[0.05]' : 'border-white/[0.07] bg-black/10')}>
      <div className="flex min-w-0 shrink-0 items-center gap-2 px-2.5 py-1.5">
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
          className={cn('relative mx-2 mb-2 flex min-h-0 flex-1 justify-center overflow-hidden rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300', commentMode && 'cursor-crosshair')}
        >
          <div className="relative overflow-hidden rounded-md bg-white shadow-lg shadow-black/20 ring-1 ring-slate-200/80" style={{ width: frame.width * scale, height: frame.height * scale }}>
          <div className="absolute top-0 left-0 origin-top-left" style={{ width: frame.width, height: frame.height, transform: `scale(${scale})` }}>
            {frame.layers.map((layer) => (
              <StaticLayer key={layer.id} layer={layer} override={effects[layer.id]} onSelect={() => onSelectLayer(layer)} />
            ))}
          </div>
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
    let merged = {}
    for (const diff of diffs) {
      const value = valueOf ? valueOf(diff, layerId) : option.side ? null : diff.values?.[option.key]
      // A draft's value is drawn the same way a decision is (diffEffect):
      // A / B by side, anything else as a custom value — looks included.
      const decision = option.side ?? (value === undefined || value === diff.optionA ? 'A' : value === diff.optionB ? 'B' : { custom: value })
      merged = mergeOverride(merged, diffEffect(diff, decision))
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
