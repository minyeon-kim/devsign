import { useState } from 'react'
import {
  Blocks,
  Check,
  ChevronRight,
  GitMerge,
  MousePointerClick,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react'
import { cn } from 'cn'
import { blockDeckPresets, canvasPages, designMergeVariants, inspectorSpecsByType } from '@/data/mockData'

function DiffRow({ diff, resolution, onResolve }) {
  return (
    <div className="rounded-xl border bg-card p-2.5">
      <p className="mb-1.5 text-[11px] font-medium text-foreground">{diff.label}</p>
      <div className="grid grid-cols-1 gap-1.5">
        <button
          type="button"
          onClick={() => onResolve(diff.id, 'A')}
          className={cn(
            'flex items-center gap-1.5 rounded-lg border p-1.5 text-left text-[10px] transition-colors',
            resolution === 'A'
              ? 'border-primary bg-primary/10 text-foreground'
              : 'border-border text-muted-foreground hover:bg-muted'
          )}
        >
          {diff.optionAClass && <span className={cn('size-2.5 shrink-0 rounded-full', diff.optionAClass)} />}
          <span className="truncate">A · {diff.optionA}</span>
          {resolution === 'A' && <Check className="ml-auto size-3 shrink-0 text-primary" />}
        </button>
        <button
          type="button"
          onClick={() => onResolve(diff.id, 'B')}
          className={cn(
            'flex items-center gap-1.5 rounded-lg border p-1.5 text-left text-[10px] transition-colors',
            resolution === 'B'
              ? 'border-primary bg-primary/10 text-foreground'
              : 'border-border text-muted-foreground hover:bg-muted'
          )}
        >
          {diff.optionBClass && <span className={cn('size-2.5 shrink-0 rounded-full', diff.optionBClass)} />}
          <span className="truncate">B · {diff.optionB}</span>
          {resolution === 'B' && <Check className="ml-auto size-3 shrink-0 text-primary" />}
        </button>
      </div>
    </div>
  )
}

// What used to be MergeCanvasCompare's own docked "Variant Inspector"
// column — now a tab inside the floating Block Deck instead of a fixed
// sidebar next to the artboards, so it can float freely like the rest of
// the deck. Still entirely selection-driven: reacts to whichever layer was
// last clicked on either artboard on the infinite canvas.
function VariantCompareTab({ item, selectedLayerId }) {
  const [resolutions, setResolutions] = useState({})
  const page = canvasPages.find((p) => p.id === item.designPageId)
  const frame = page?.frames[0]
  const selectedLayer = frame?.layers.find((l) => l.id === selectedLayerId)
  const specificDiffs = designMergeVariants[item.id]?.layerDiffs?.[selectedLayerId]
  const tokenSpec = selectedLayer ? inspectorSpecsByType[selectedLayer.type] : null

  const genericDiff = selectedLayer
    ? {
        id: `layer:${selectedLayer.id}`,
        label: `${selectedLayer.name} — Design Decision`,
        optionA: 'Keep current design',
        optionB: 'Accept incoming design',
      }
    : null

  const diffs = specificDiffs ?? (genericDiff ? [genericDiff] : [])
  const resolvedCount = diffs.filter((d) => resolutions[d.id]).length

  function resolve(diffId, side) {
    setResolutions((prev) => ({ ...prev, [diffId]: side }))
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="shrink-0 px-3 pt-2 text-[10px] text-muted-foreground">
        {selectedLayer ? `${resolvedCount} of ${diffs.length} resolved` : 'Nothing selected'}
      </p>

      <div className="min-h-0 flex-1 space-y-3 overflow-auto p-3">
        {!selectedLayer && (
          <div className="flex flex-col items-center gap-2 p-3 text-center">
            <MousePointerClick className="size-4 text-muted-foreground" />
            <p className="text-[11px] text-muted-foreground">
              Select an element, frame, or component on the canvas to inspect it.
            </p>
          </div>
        )}

        {selectedLayer && !specificDiffs && tokenSpec && (
          <div className="rounded-xl border bg-background p-2.5">
            <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              Token Binding
            </p>
            <div className="space-y-1 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Fill</span>
                <span className="flex items-center gap-1.5 text-foreground">
                  <span
                    className="size-2.5 rounded-sm border border-border"
                    style={{ background: tokenSpec.fill.color }}
                  />
                  {tokenSpec.fill.token}
                </span>
              </div>
              {tokenSpec.typography && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span className="text-foreground">
                    {tokenSpec.typography.font} {tokenSpec.typography.size}/{tokenSpec.typography.weight}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Layout</span>
                <span className="text-foreground">{tokenSpec.layout.mode}</span>
              </div>
            </div>
          </div>
        )}

        {diffs.map((diff) => (
          <DiffRow key={diff.id} diff={diff} resolution={resolutions[diff.id]} onResolve={resolve} />
        ))}
      </div>

      {selectedLayer && (
        <div className="shrink-0 border-t p-3">
          <button
            type="button"
            disabled={resolvedCount < diffs.length}
            className="flex w-full items-center justify-center gap-1.5 rounded-full bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
          >
            <GitMerge className="size-3.5" />
            Reconcile &amp; Merge
          </button>
        </div>
      )}
    </div>
  )
}

// A single AI-generated style suggestion — badge, preview swatch, rationale
// copy explaining why the (mock) model picked it, and its own dismiss
// button so an unsatisfactory suggestion can be cleared without affecting
// the rest of the list.
function AiSuggestionCard({ preset, applied, onApply, onDelete }) {
  return (
    <div
      className={cn(
        'group relative rounded-xl border p-2.5 text-left transition-colors',
        applied ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/60'
      )}
    >
      <button type="button" onClick={() => onApply(preset)} className="flex w-full items-start gap-2.5 text-left">
        <span className={cn('size-8 shrink-0 rounded-full', preset.previewClass)} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-foreground">{preset.label}</span>
            <span className="flex items-center gap-0.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-1.5 py-0.5 text-[9px] font-semibold text-white">
              <Sparkles className="size-2.5" />
              AI
            </span>
            {applied && <Check className="ml-auto size-3.5 shrink-0 text-primary" />}
          </span>
          <span className="mt-0.5 block text-[10px] leading-relaxed text-muted-foreground">
            {preset.rationale}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={() => onDelete(preset.id)}
        title="Dismiss suggestion"
        className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-full text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted hover:text-foreground"
      >
        <X className="size-3" />
      </button>
    </div>
  )
}

// The AI-driven "Block Assemble" tab — a short list of mock AI style
// suggestions (badged, with rationale) for whichever canvas layer is
// currently selected. Picking one calls `onApplyPreset` so the parent can
// live-preview it on the Option B artboard; dismissing one just removes it
// from view; "Generate alternatives" pulls more from the shared preset pool
// until it's exhausted.
function BlockAssembleTab({ selectedLayerName, appliedPresetId, onApplyPreset }) {
  const [visibleIds, setVisibleIds] = useState(() => blockDeckPresets.slice(0, 3).map((p) => p.id))
  // Dismissed suggestions stay dismissed — "Generate alternatives" only ever
  // pulls presets that have never been shown yet, so clearing a bad
  // suggestion never brings that exact one back.
  const [seenIds, setSeenIds] = useState(() => new Set(visibleIds))

  const visiblePresets = blockDeckPresets.filter((p) => visibleIds.includes(p.id))
  const hasMore = seenIds.size < blockDeckPresets.length

  function generateAlternatives() {
    const next = blockDeckPresets.find((p) => !seenIds.has(p.id))
    if (!next) return
    setVisibleIds((prev) => [...prev, next.id])
    setSeenIds((prev) => new Set(prev).add(next.id))
  }

  function deleteSuggestion(id) {
    setVisibleIds((prev) => prev.filter((v) => v !== id))
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="shrink-0 px-3 pt-2 text-[10px] text-muted-foreground">
        {selectedLayerName ? (
          <>
            Suggestions for <span className="font-medium text-foreground">{selectedLayerName}</span>
          </>
        ) : (
          'Select a canvas element to preview suggestions on it'
        )}
      </p>

      <div className="min-h-0 flex-1 space-y-2 overflow-auto p-3">
        {visiblePresets.map((preset) => (
          <AiSuggestionCard
            key={preset.id}
            preset={preset}
            applied={appliedPresetId === preset.id}
            onApply={onApplyPreset}
            onDelete={deleteSuggestion}
          />
        ))}
        {visiblePresets.length === 0 && (
          <p className="p-3 text-center text-[11px] text-muted-foreground">
            All suggestions dismissed. Generate more below.
          </p>
        )}
      </div>

      <div className="shrink-0 border-t p-3">
        <button
          type="button"
          onClick={generateAlternatives}
          disabled={!hasMore}
          className="flex w-full items-center justify-center gap-1.5 rounded-full border border-primary/40 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Wand2 className="size-3.5" />
          {hasMore ? 'Generate alternatives' : 'No more alternatives'}
        </button>
      </div>
    </div>
  )
}

// A floating panel docked to the right side of Merge Studio — collapsed to
// a small pill by default so it doesn't compete with the infinite canvas
// for space, expanding on click. "Variant Compare" is the design-merge
// inspector (formerly a fixed sidebar next to the artboards); "Block
// Assemble" is the AI style-suggestion picker.
function BlockDeckPanel({ item, selectedLayerId, selectedLayerName, appliedPresetId, onApplyPreset }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('compare')

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="absolute top-4 right-4 z-20 flex items-center gap-1.5 rounded-full border bg-card px-3 py-2 text-xs font-medium text-foreground shadow-lg transition-colors hover:bg-muted"
      >
        <Blocks className="size-3.5 text-primary" />
        Block Deck
      </button>
    )
  }

  return (
    <div className="absolute top-4 right-4 z-20 flex h-[calc(100%-2rem)] max-h-[640px] w-72 flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl">
      <div className="flex h-10 shrink-0 items-center gap-1.5 border-b px-3">
        <Blocks className="size-3.5 shrink-0 text-primary" />
        <span className="flex-1 text-xs font-semibold text-foreground">Block Deck</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ChevronRight className="size-3.5" />
        </button>
      </div>

      <div className="flex h-9 shrink-0 items-center gap-1 border-b px-2">
        <button
          type="button"
          onClick={() => setTab('compare')}
          className={cn(
            'flex-1 rounded-full px-2 py-1 text-[11px] font-medium transition-colors',
            tab === 'compare' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Variant Compare
        </button>
        <button
          type="button"
          onClick={() => setTab('assemble')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium transition-colors',
            tab === 'assemble' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Block Assemble
          <Sparkles className="size-2.5 text-primary" />
        </button>
      </div>

      {tab === 'compare' ? (
        item.hasDesign ? (
          <VariantCompareTab item={item} selectedLayerId={selectedLayerId} />
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-center text-xs text-muted-foreground">
            This merge item has no design page to compare.
          </div>
        )
      ) : (
        <BlockAssembleTab
          selectedLayerName={selectedLayerName}
          appliedPresetId={appliedPresetId}
          onApplyPreset={onApplyPreset}
        />
      )}
    </div>
  )
}

export default BlockDeckPanel
