import { useState } from 'react'
import { Blocks, Check, ChevronRight, GitMerge, MousePointerClick } from 'lucide-react'
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

// A small palette of mock component/style presets — purely a picker;
// selecting one is just a visual "staged for the canvas" state, no deeper
// wiring, matching the mocked nature of the rest of this app's tooling.
function BlockAssembleTab() {
  const [selectedId, setSelectedId] = useState(null)

  return (
    <div className="min-h-0 flex-1 space-y-2 overflow-auto p-3">
      {blockDeckPresets.map((preset) => (
        <button
          key={preset.id}
          type="button"
          onClick={() => setSelectedId(preset.id)}
          className={cn(
            'flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors',
            selectedId === preset.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'
          )}
        >
          <span className={cn('size-8 shrink-0 rounded-full', preset.previewClass)} />
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-medium text-foreground">{preset.label}</span>
            <span className="block truncate text-[10px] text-muted-foreground">{preset.description}</span>
          </span>
          {selectedId === preset.id && <Check className="size-3.5 shrink-0 text-primary" />}
        </button>
      ))}
    </div>
  )
}

// A floating panel docked to the right side of Merge Studio — collapsed to
// a small pill by default so it doesn't compete with the infinite canvas
// for space, expanding on click. "Variant Compare" is the design-merge
// inspector (formerly a fixed sidebar next to the artboards); "Block
// Assemble" is a palette of mock component-style presets.
function BlockDeckPanel({ item, selectedLayerId }) {
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
            'flex-1 rounded-full px-2 py-1 text-[11px] font-medium transition-colors',
            tab === 'assemble' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Block Assemble
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
        <BlockAssembleTab />
      )}
    </div>
  )
}

export default BlockDeckPanel
