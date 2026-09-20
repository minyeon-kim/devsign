import { useState } from 'react'
import { Check, GitMerge, SlidersHorizontal } from 'lucide-react'
import { cn } from 'cn'
import { canvasPages, designMergeVariants } from '@/data/mockData'

// A read-only re-rendering of a frame's layers — separate from CanvasPanel's
// interactive CanvasFrame/CanvasLayer (no zoom/tools) since this is a
// side-by-side *comparison* artboard, not an editable canvas. It's still
// clickable when `onSelect` is passed (Option A only, see StaticFrame) —
// that's the design->code half of the bidirectional sync. `accentClass` lets
// Option B visualize a color-type property diff without needing per-variant
// frame geometry.
function StaticLayer({ layer, accentClass, selected, onSelect }) {
  const style = { left: layer.x, top: layer.y, width: layer.width, height: layer.height }

  let content = null
  if (layer.type === 'bar') {
    content = (
      <div className="flex h-full w-full items-center justify-between rounded-sm bg-muted px-2">
        <span className="text-[9px] text-muted-foreground">9:41</span>
        <div className="flex items-center gap-0.5">
          <span className="size-1 rounded-full bg-muted-foreground/60" />
          <span className="size-1 rounded-full bg-muted-foreground/60" />
          <span className="size-1 rounded-full bg-muted-foreground/60" />
        </div>
      </div>
    )
  } else if (layer.type === 'card') {
    content = <div className="h-full w-full rounded-lg border border-border bg-muted/40" />
  } else if (layer.type === 'avatar') {
    content = <div className="h-full w-full rounded-full bg-muted-foreground/30" />
  } else if (layer.type === 'button') {
    content = (
      <div
        className={cn(
          'flex h-full w-full items-center justify-center rounded-md text-xs font-medium text-primary-foreground',
          accentClass ?? 'bg-primary'
        )}
      >
        {layer.label ?? 'Button'}
      </div>
    )
  } else {
    content = <div className="h-full w-full rounded-sm bg-muted-foreground/25" />
  }

  return (
    <div
      onClick={onSelect}
      className={cn(
        'absolute',
        onSelect && 'cursor-pointer',
        selected && 'outline outline-2 outline-offset-1 outline-primary'
      )}
      style={style}
    >
      {content}
    </div>
  )
}

// Artboards render at a fixed preview width regardless of the underlying
// frame's real size (scaled down via CSS transform, layer positions stay
// untouched since they're all relative to the scaled parent) — this is what
// guarantees Option A and Option B always fit side by side, plus the
// Variant Inspector, without needing horizontal scroll: a 480px-wide
// Marketing Site frame and a 280px-wide Mobile App frame both preview at the
// same compact width instead of however wide they actually are.
const PREVIEW_WIDTH = 180

function StaticFrame({ frame, label, accentClass, selectedLayerId, onSelectLayer }) {
  const scale = PREVIEW_WIDTH / frame.width

  return (
    <div className="shrink-0" style={{ width: PREVIEW_WIDTH }}>
      <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">{label}</p>
      <div
        className="overflow-hidden rounded-md border border-border bg-card shadow-lg"
        style={{ width: PREVIEW_WIDTH, height: frame.height * scale }}
      >
        <div
          className="relative"
          style={{ width: frame.width, height: frame.height, transform: `scale(${scale})`, transformOrigin: 'top left' }}
        >
          {frame.layers.map((layer) => (
            <StaticLayer
              key={layer.id}
              layer={layer}
              accentClass={layer.type === 'button' ? accentClass : undefined}
              selected={onSelectLayer ? selectedLayerId === layer.id : false}
              onSelect={onSelectLayer ? () => onSelectLayer(layer.id) : undefined}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

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

// Merge Studio's design-side comparison — two artboards ("Option A" /
// "Option B") laid out on a scrollable, dot-grid "infinite canvas" (visually
// matching the real Canvas panel) plus a Variant Inspector listing their
// property-level differences, each resolvable to A or B. This is a
// dedicated comparison surface rather than the live editable Canvas —
// merging here is about reconciling two variants, not editing one design.
function MergeCanvasCompare({ item, selectedLayerId, onSelectLayer }) {
  const [resolutions, setResolutions] = useState({})
  const page = canvasPages.find((p) => p.id === item.designPageId)
  const frame = page?.frames[0]
  const diffs = designMergeVariants[item.id]?.propertyDiffs ?? []
  const optionBAccent = diffs.find((d) => d.optionBClass)?.optionBClass
  const resolvedCount = Object.keys(resolutions).length

  function resolve(diffId, side) {
    setResolutions((prev) => ({ ...prev, [diffId]: side }))
  }

  if (!frame) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-center text-xs text-muted-foreground">
        No design page linked to this merge item.
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1">
      <div
        className="min-h-0 flex-1 overflow-auto p-4"
        style={{
          backgroundImage:
            'radial-gradient(color-mix(in oklch, var(--foreground) 14%, transparent) 1px, transparent 1px)',
          backgroundSize: '18px 18px',
        }}
      >
        <div className="flex items-start gap-6">
          <StaticFrame
            frame={frame}
            label="Option A · Current"
            selectedLayerId={selectedLayerId}
            onSelectLayer={onSelectLayer}
          />
          <StaticFrame frame={frame} label="Option B · Incoming" accentClass={optionBAccent} />
        </div>
      </div>

      <div className="flex w-52 shrink-0 flex-col border-l bg-card">
        <div className="shrink-0 border-b p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <SlidersHorizontal className="size-3.5 text-primary" />
            Variant Inspector
          </div>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {resolvedCount} of {diffs.length} resolved
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-auto p-3">
          {diffs.length === 0 && (
            <p className="p-2 text-center text-[11px] text-muted-foreground">
              No property differences detected.
            </p>
          )}
          {diffs.map((diff) => (
            <DiffRow key={diff.id} diff={diff} resolution={resolutions[diff.id]} onResolve={resolve} />
          ))}
        </div>

        {diffs.length > 0 && (
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
    </div>
  )
}

export default MergeCanvasCompare
