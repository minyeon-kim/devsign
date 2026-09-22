import { useEffect, useRef, useState } from 'react'
import {
  Blocks,
  Check,
  ChevronDown,
  ChevronRight,
  Columns3,
  GripHorizontal,
  Library,
  Search,
  MousePointerClick,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react'
import { cn } from 'cn'
import {
  blockDeckPresets,
  canvasPages,
  codeMergeVariants,
  designMergeVariants,
  designSystemComponents,
  designSystemMeta,
  inspectorSpecsByType,
} from '@/data/mockData'
import { StaticLayer } from '@/components/mergestudio/MergeInfiniteCanvas'
import { buildDrifts } from '@/components/mergestudio/mergeSummary'
import { ASSEMBLY_FILLS, SHAPES, assemblyToOverride, blockTemplates, libraryCompat, recommendAssembly } from '@/components/mergestudio/mergeEffects'
import { useWorkspace } from '@/state/WorkspaceProvider'

function DiffRow({ diff, resolution, onResolve, onHover }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-800/70 p-3.5">
      <p className="mb-2 text-sm font-medium text-foreground">{diff.label}</p>
      <div className="grid grid-cols-1 gap-2">
        <button
          type="button"
          onClick={() => onResolve(diff.id, 'A')}
          onPointerEnter={() => onHover(diff.id, 'A')}
          onPointerLeave={() => onHover(null)}
          className={cn(
            'flex items-center gap-2 rounded-lg border p-2.5 text-left text-xs transition-colors',
            resolution === 'A'
              ? 'border-primary bg-primary/10 text-foreground'
              : 'border-border text-muted-foreground hover:bg-muted'
          )}
        >
          {diff.optionAClass && <span className={cn('size-3 shrink-0 rounded-full', diff.optionAClass)} />}
          <span className="truncate">A · {diff.optionA}</span>
          {resolution === 'A' && <Check className="ml-auto size-3.5 shrink-0 text-primary" />}
        </button>
        <button
          type="button"
          onClick={() => onResolve(diff.id, 'B')}
          onPointerEnter={() => onHover(diff.id, 'B')}
          onPointerLeave={() => onHover(null)}
          className={cn(
            'flex items-center gap-2 rounded-lg border p-2.5 text-left text-xs transition-colors',
            resolution === 'B'
              ? 'border-primary bg-primary/10 text-foreground'
              : 'border-border text-muted-foreground hover:bg-muted'
          )}
        >
          {diff.optionBClass && <span className={cn('size-3 shrink-0 rounded-full', diff.optionBClass)} />}
          <span className="truncate">B · {diff.optionB}</span>
          {resolution === 'B' && <Check className="ml-auto size-3.5 shrink-0 text-primary" />}
        </button>
      </div>
    </div>
  )
}

// ---- Modular builder controls (shared by Block Assemble and the manual
// fallback in Variant Compare) ---------------------------------------
function Seg({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn(
            'rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors',
            value === id
              ? 'bg-slate-700 text-white'
              : 'bg-slate-800/70 text-muted-foreground hover:text-foreground'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// A distinct, clearly-bounded card grouping one property control — the
// "Syntropic Studio" structure: every setting lives in its own labeled
// surface instead of a flat stack of bare labels.
function Field({ label, children }) {
  return (
    <div className="rounded-xl bg-slate-800/40 p-3">
      <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
      {children}
    </div>
  )
}

function ShapeControl({ assembly, onChange }) {
  return (
    <Field label="Shape">
      <Seg options={SHAPES.map((s) => [s.id, s.label])} value={assembly.shape} onChange={(shape) => onChange({ shape })} />
    </Field>
  )
}

function SizeControl({ layer, assembly, onChange }) {
  const w = assembly.width ?? layer.width
  const h = assembly.height ?? layer.height
  const num = (value, key) => (
    <label className="flex flex-1 items-center gap-2 rounded-full border border-white/10 bg-slate-800/70 px-3 py-1.5 text-xs text-muted-foreground focus-within:border-violet-500">
      {key === 'width' ? 'W' : 'H'}
      <input
        type="number"
        min={8}
        max={1200}
        value={Math.round(value)}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (n > 0) onChange({ [key]: n })
        }}
        className="w-full min-w-0 bg-transparent text-sm text-foreground outline-none"
      />
    </label>
  )
  return (
    <Field label="Size">
      <div className="flex gap-2">
        {num(w, 'width')}
        {num(h, 'height')}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {[
          ['S', 0.8],
          ['M', 1],
          ['L', 1.25],
        ].map(([label, k]) => (
          <button
            key={label}
            type="button"
            onClick={() => onChange({ width: Math.round(layer.width * k), height: Math.round(layer.height * k) })}
            className="rounded-full bg-slate-800/70 px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {label}
          </button>
        ))}
      </div>
    </Field>
  )
}

function FillControl({ assembly, onChange }) {
  return (
    <Field label="Fill">
      <div className="flex flex-wrap gap-2">
        {ASSEMBLY_FILLS.map((f) => (
          <button
            key={f.id}
            type="button"
            title={f.label}
            onClick={() => onChange({ fill: f.id })}
            className={cn(
              'size-7 rounded-full transition-transform hover:scale-110',
              f.swatch,
              assembly.fill === f.id && 'ring-2 ring-white ring-offset-1 ring-offset-transparent'
            )}
          />
        ))}
      </div>
    </Field>
  )
}

// The modular builder: block templates, then shape / size / fill /
// border & shadow / content controls. Everything writes into the layer's
// "assembly", which previews live on Option B and is bundled into the merge.
// Each property lives in its own card (see `Field`) with generous padding
// between groups, instead of one dense, flat stack of controls.
function AssembleBuilder({ layer, frameWidth, assembly, onChange, onReset }) {
  const a = assembly ?? {}
  return (
    <div className="space-y-3 border-b border-white/10 p-4">
      <div className="flex items-center gap-2">
        <Blocks className="size-4 text-indigo-500" />
        <span className="text-sm font-semibold text-foreground">Build {layer.name}</span>
        <button
          type="button"
          onClick={onReset}
          disabled={!assembly}
          className="ml-auto rounded-full px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
        >
          Reset
        </button>
      </div>

      <Field label="Blocks">
        <div className="flex flex-wrap gap-2">
          {blockTemplates(layer, frameWidth).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.patch)}
              className="rounded-full border border-indigo-500/40 px-3.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-indigo-500/15"
            >
              {t.label}
            </button>
          ))}
        </div>
      </Field>

      <ShapeControl assembly={a} onChange={onChange} />
      <SizeControl layer={layer} assembly={a} onChange={onChange} />
      <FillControl assembly={a} onChange={onChange} />
      <Field label="Border">
        <Seg options={[['none', 'None'], ['outline', 'Outline'], ['thick', 'Thick']]} value={a.border ?? 'none'} onChange={(border) => onChange({ border })} />
      </Field>
      <Field label="Shadow">
        <Seg options={[['none', 'None'], ['soft', 'Soft'], ['glow', 'Glow']]} value={a.shadow ?? 'none'} onChange={(shadow) => onChange({ shadow })} />
      </Field>
      {['button', 'input', 'chip'].includes(layer.type) && (
        <>
          <Field label="Alignment">
            <Seg options={[['start', 'Left'], ['center', 'Center'], ['end', 'Right']]} value={a.align} onChange={(align) => onChange({ align })} />
          </Field>
          {layer.type !== 'input' && (
            <Field label="Icon">
              <Seg options={[[null, 'None'], ['left', 'Left'], ['right', 'Right']].map(([id, l]) => [id ?? 'none', l])} value={a.icon ?? 'none'} onChange={(icon) => onChange({ icon: icon === 'none' ? null : icon })} />
            </Field>
          )}
        </>
      )}
    </div>
  )
}

// For elements with no parseable design-system options: an AI
// recommendation (one-click apply) beside plain manual controls.
function ManualFallback({ layer, assembly, onChange }) {
  const rec = recommendAssembly(layer)
  const a = assembly ?? {}
  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-slate-800/70 p-3.5">
      <p className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">No design tokens found</p>
      <div className="rounded-xl border border-indigo-500/40 bg-gradient-to-r from-indigo-500/10 to-violet-500/10 p-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Sparkles className="size-3.5 text-violet-500" />
          AI recommends
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{rec.rationale}</p>
        <button
          type="button"
          onClick={() => onChange(rec.patch)}
          className="mt-2.5 flex items-center gap-1.5 rounded-full bg-slate-700 text-foreground hover:bg-slate-600 px-3.5 py-1.5 text-xs font-semibold transition-colors"
        >
          <Wand2 className="size-3.5" />
          Apply recommendation
        </button>
      </div>
      <p className="text-xs text-muted-foreground">Or set it manually:</p>
      <ShapeControl assembly={a} onChange={onChange} />
      <SizeControl layer={layer} assembly={a} onChange={onChange} />
      <FillControl assembly={a} onChange={onChange} />
    </div>
  )
}

// What used to be MergeCanvasCompare's own docked "Variant Inspector"
// column — now a tab inside the floating Block Deck instead of a fixed
// sidebar next to the artboards, so it can float freely like the rest of
// the deck. Still entirely selection-driven: reacts to whichever layer was
// last clicked on either artboard on the infinite canvas.
// Every drift for this item (design + code, via the same `buildDrifts` the
// canvas's own < > pager and the merge wizard's Check step use), as an
// accordion: one row open at a time, its detail (A/B pills for a design
// drift, current/incoming for a code drift) expanding in place while every
// other row collapses back to its summary line — so reviewing one drift
// never leaves a wall of everyone else's detail on screen too. Opening a
// row also jumps/selects it on the canvas, exactly like the canvas's own
// drift navigator. Consolidated here so the Compare tab is the one place
// to both see drift history and review each one's detail.
function DriftHistoryAccordion({ item, frame, resolutions, onResolve, onHoverDiff, expandedId, onExpand }) {
  const { requestMergeFocus, getFileLines } = useWorkspace()
  const drifts = buildDrifts(item, frame)
  if (!drifts.length) return null

  function toggle(d) {
    const opening = expandedId !== d.id
    onExpand(opening ? d.id : null)
    if (opening) {
      requestMergeFocus({
        itemId: item.id,
        keepDeck: true,
        label: d.label,
        ...(d.kind === 'design' ? { layerId: d.layerId } : { fileId: d.fileId, line: d.line }),
      })
    }
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Drift History · {drifts.length}</p>
      {drifts.map((d) => {
        const resolved = d.kind === 'design' && d.diffs.every((diff) => resolutions[`${d.layerId}:${diff.id}`])
        const open = expandedId === d.id
        const original = d.kind === 'code' ? (getFileLines(d.fileId)[d.line - 1] ?? '') : null
        const incoming = d.kind === 'code' ? codeMergeVariants[item.id]?.[d.fileId]?.find((x) => x.line === d.line)?.incoming : null
        return (
          <div
            key={d.id}
            className={cn(
              'overflow-hidden rounded-xl border transition-colors',
              // The active/open row gets an unmissable primary ring on top
              // of its own tinted surface — not just a border color change
              // — so it's obvious at a glance which one you're reviewing.
              open ? 'border-primary/50 bg-primary/10 ring-1 ring-inset ring-primary/30' : 'border-white/10 bg-slate-800/70'
            )}
          >
            <button
              type="button"
              onClick={() => toggle(d)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-white/5"
            >
              <ChevronRight className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')} />
              <span
                className={cn(
                  'flex size-4 shrink-0 items-center justify-center rounded-full',
                  resolved ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-muted-foreground'
                )}
              >
                {resolved && <Check className="size-2.5" />}
              </span>
              <span className={cn('min-w-0 flex-1 truncate', open ? 'font-semibold text-foreground' : 'text-foreground')}>{d.label}</span>
              <span className="shrink-0 rounded-full bg-slate-700 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {d.kind === 'design' ? 'Design' : 'Code'}
              </span>
            </button>

            {open && (
              <div className="space-y-2 border-t border-white/10 px-3 py-2.5">
                {d.kind === 'design' ? (
                  d.diffs.map((diff) => (
                    <DiffRow
                      key={diff.id}
                      diff={diff}
                      resolution={resolutions[`${d.layerId}:${diff.id}`]}
                      onResolve={(diffId, side) => onResolve(d.layerId, diffId, side)}
                      onHover={(diffId, side) => onHoverDiff(diffId ? { layerId: d.layerId, diffId, side } : null)}
                    />
                  ))
                ) : (
                  <div className="grid grid-cols-[4.5rem_1fr] items-start gap-x-2 gap-y-1.5 text-xs">
                    <span className="pt-1 text-muted-foreground">Current</span>
                    <p className="rounded-md bg-destructive/10 px-2 py-1 font-mono text-[11px] break-words text-destructive/90">{original || ' '}</p>
                    <span className="pt-1 text-muted-foreground">Incoming</span>
                    <p className="rounded-md bg-emerald-500/10 px-2 py-1 font-mono text-[11px] break-words text-emerald-400">{incoming}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function VariantCompareTab({ item, selectedLayerId, resolutions, onResolve, onHoverDiff, assembly, onAssemble }) {
  const page = canvasPages.find((p) => p.id === item.designPageId)
  const frame = page?.frames[0]
  const selectedLayer = frame?.layers.find((l) => l.id === selectedLayerId)
  const specificDiffs = designMergeVariants[item.id]?.layerDiffs?.[selectedLayerId]
  const tokenSpec = selectedLayer ? inspectorSpecsByType[selectedLayer.type] : null

  // Which drift row the accordion has open — defaults to whichever design
  // drift matches the canvas's current selection, so clicking a layer on
  // the canvas still opens its detail here automatically; the user can
  // then expand any other row instead, same as clicking one directly.
  const [expandedId, setExpandedId] = useState(selectedLayerId ? `d:${selectedLayerId}` : null)
  useEffect(() => {
    if (selectedLayerId && designMergeVariants[item.id]?.layerDiffs?.[selectedLayerId]) {
      setExpandedId(`d:${selectedLayerId}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLayerId])

  const resolvedCount = specificDiffs?.filter((d) => resolutions[`${selectedLayerId}:${d.id}`]).length ?? 0

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="shrink-0 px-4 pt-3 text-xs text-muted-foreground">
        {selectedLayer && specificDiffs ? `${resolvedCount} of ${specificDiffs.length} resolved` : 'Nothing selected'}
      </p>

      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
        <DriftHistoryAccordion
          item={item}
          frame={frame}
          resolutions={resolutions}
          onResolve={onResolve}
          onHoverDiff={onHoverDiff}
          expandedId={expandedId}
          onExpand={setExpandedId}
        />

        {!selectedLayer && (
          <div className="flex flex-col items-center gap-2 p-3 text-center">
            <MousePointerClick className="size-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Select an element, frame, or component on the canvas — or a drift above — to inspect it.
            </p>
          </div>
        )}

        {selectedLayer && !specificDiffs && tokenSpec && (
          <div className="rounded-xl border border-white/10 bg-slate-800/70 p-3.5">
            <p className="mb-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              Token Binding
            </p>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Fill</span>
                <span className="flex items-center gap-1.5 text-foreground">
                  <span
                    className="size-3 rounded-sm border border-border"
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

        {selectedLayer && !specificDiffs && (
          <ManualFallback layer={selectedLayer} assembly={assembly} onChange={onAssemble} />
        )}
      </div>
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
        'group relative rounded-xl border p-3.5 text-left transition-colors',
        applied ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/60'
      )}
    >
      <button type="button" onClick={() => onApply(preset)} className="flex w-full items-start gap-3 text-left">
        <span className={cn('size-9 shrink-0 rounded-full', preset.previewClass)} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{preset.label}</span>
            <span className="flex items-center gap-0.5 rounded-full bg-indigo-500/15 text-indigo-400 px-2 py-0.5 text-[10px] font-semibold">
              <Sparkles className="size-3" />
              AI
            </span>
            {applied && <Check className="ml-auto size-4 shrink-0 text-primary" />}
          </span>
          <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
            {preset.rationale}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={() => onDelete(preset.id)}
        title="Dismiss suggestion"
        className="absolute top-2.5 right-2.5 flex size-6 items-center justify-center rounded-full text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted hover:text-foreground"
      >
        <X className="size-3.5" />
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
function AiSuggestionsSection({ selectedLayerName, appliedPresetId, onApplyPreset }) {
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
      <p className="shrink-0 px-4 pt-3 text-xs text-muted-foreground">
        {selectedLayerName ? (
          <>
            Suggestions for <span className="font-medium text-foreground">{selectedLayerName}</span>
          </>
        ) : (
          'Select a canvas element to preview suggestions on it'
        )}
      </p>

      <div className="space-y-3 p-4">
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
          <p className="p-3 text-center text-sm text-muted-foreground">
            All suggestions dismissed. Generate more below.
          </p>
        )}
      </div>

      <div className="shrink-0 border-t border-white/10 p-4">
        <button
          type="button"
          onClick={generateAlternatives}
          disabled={!hasMore}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-primary/40 px-3 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Wand2 className="size-4" />
          {hasMore ? 'Generate alternatives' : 'No more alternatives'}
        </button>
      </div>
    </div>
  )
}

// Block Assemble: structural builder for the selected element, then the AI
// style suggestions below it.
function BlockAssembleTab({ selectedLayer, frameWidth, assembly, onAssemble, onAssembleReset, ...suggestionProps }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {selectedLayer ? (
        <AssembleBuilder
          layer={selectedLayer}
          frameWidth={frameWidth}
          assembly={assembly}
          onChange={onAssemble}
          onReset={onAssembleReset}
        />
      ) : (
        <p className="border-b border-white/10 p-5 text-center text-sm text-muted-foreground">
          Select an element on the canvas to assemble its shape, size and layout.
        </p>
      )}
      <AiSuggestionsSection {...suggestionProps} />
    </div>
  )
}

// Design System library: browse the integrated component library, then
// either restyle the selected element with a component ("Apply") or pull
// a fresh instance onto both artboards ("Add").
function ComponentPreview({ def }) {
  const box = { w: 124, h: 58 }
  const k = Math.min(1, box.w / def.width, box.h / def.height)
  const layer = { id: def.id, type: def.type, label: def.label, x: 0, y: 0, width: def.width, height: def.height }
  const override = { ...assemblyToOverride(def.assembly, layer), static: true }
  return (
    <div className="flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-800/70" style={{ width: box.w + 12, height: box.h + 12 }}>
      <div className="relative" style={{ width: def.width * k, height: def.height * k }}>
        <div className="absolute top-0 left-0" style={{ width: def.width, height: def.height, transform: `scale(${k})`, transformOrigin: 'top left' }}>
          <StaticLayer layer={layer} override={override} onSelect={() => {}} />
        </div>
      </div>
    </div>
  )
}

function ComponentsTab({ selectedLayer, onApply, onAdd, onInsert }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [showAll, setShowAll] = useState(false)
  // Contextual: with an element selected, only components that can replace
  // it or be inserted into it are listed (unless "Show all" is on).
  const compat = selectedLayer ? libraryCompat(selectedLayer) : null
  const modeOf = (def) => (!compat ? null : compat.replace.has(def.type) ? 'replace' : compat.insert.has(def.type) ? 'insert' : null)
  const pool = designSystemComponents.filter((c) => showAll || !compat || modeOf(c))
  const categories = ['All', ...new Set(pool.map((c) => c.category))]
  const visible = pool.filter(
    (c) => (category === 'All' || c.category === category) && c.name.toLowerCase().includes(query.trim().toLowerCase())
  )
  const activeCategory = categories.includes(category) ? category : 'All'

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="space-y-3 border-b border-white/10 p-4">
        <div className="flex items-center gap-2 text-sm">
          <Library className="size-4 text-indigo-500" />
          <span className="font-semibold text-foreground">{designSystemMeta.name}</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{designSystemMeta.version}</span>
          <span className="ml-auto flex items-center gap-1 text-xs text-emerald-400">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            {designSystemMeta.syncedLabel}
          </span>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search components…"
            className="h-9 w-full rounded-full border border-white/10 bg-slate-800/70 pr-3 pl-8 text-sm outline-none focus:border-violet-500"
          />
        </div>
        <Seg options={categories.map((c) => [c, c])} value={activeCategory} onChange={setCategory} />

        {selectedLayer ? (
          <div className="flex items-start gap-2.5 rounded-xl bg-indigo-500/10 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
            <span className="min-w-0 flex-1">
              {showAll ? 'Showing every component.' : `${pool.length} component${pool.length === 1 ? '' : 's'} fit`}{' '}
              <span className="font-medium text-foreground">{selectedLayer.name}</span>
              {showAll ? '' : ' — replace it or insert into it.'}
            </span>
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="shrink-0 rounded-full border border-indigo-500/40 px-2.5 py-1 font-medium text-foreground hover:bg-indigo-500/15"
            >
              {showAll ? 'Only compatible' : 'Show all'}
            </button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Select an element to see only the components that fit it, or Add one to the canvas.</p>
        )}
      </div>

      <div className="space-y-3 p-4">
        {visible.map((def) => {
          const mode = modeOf(def)
          return (
            <div key={def.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-800/70 p-3">
              <ComponentPreview def={def} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{def.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {mode === 'replace' ? `Replaces ${selectedLayer.name}` : mode === 'insert' ? `Inserts into ${selectedLayer.name}` : def.tokens.join(' · ')}
                </p>
                {/* Fixed 2-col grid instead of a flex row — "Replace"/"Insert"
                    and "Add" each get a stable half-width cell, so the
                    longer label never wraps or gets squeezed. Alone (no
                    mode), "Add" spans both columns. */}
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {mode === 'replace' && (
                    <button
                      type="button"
                      onClick={() => onApply(def)}
                      className="w-full truncate rounded-full bg-slate-700 text-foreground hover:bg-slate-600 px-3 py-1 text-xs font-semibold whitespace-nowrap transition-colors"
                    >
                      Replace
                    </button>
                  )}
                  {mode === 'insert' && (
                    <button
                      type="button"
                      onClick={() => onInsert(def)}
                      className="w-full truncate rounded-full bg-slate-700 text-foreground hover:bg-slate-600 px-3 py-1 text-xs font-semibold whitespace-nowrap transition-colors"
                    >
                      Insert
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onAdd(def)}
                    className={cn(
                      'w-full truncate rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap',
                      !mode && 'col-span-2',
                      mode ? 'border border-indigo-500/50 text-foreground hover:bg-indigo-500/15' : 'bg-slate-700 text-foreground hover:bg-slate-600'
                    )}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )
        })}
        {visible.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">No components match.</p>}
      </div>
    </div>
  )
}

// A floating, freely draggable window — rendered only while `open` (the
// workspace opens it when an element, frame, or code line on the canvas is
// clicked; there is no standalone trigger button). Drag it by its header
// anywhere within Merge Studio. "Variant Compare" is the design-merge
// inspector; "Block Assemble" is the AI style-suggestion picker.
export const DECK_WIDTH = 360

function BlockDeckPanel({
  open,
  onClose,
  onFloat,
  item,
  selectedLayerId,
  selectedLayerName,
  appliedPresetId,
  onApplyPreset,
  resolutions,
  onResolve,
  onHoverDiff,
  selectedLayer,
  frameWidth,
  assembly,
  onAssemble,
  onAssembleReset,
  onApplyComponent,
  onAddComponent,
  onInsertComponent,
}) {
  const [tab, setTab] = useState('compare')
  const [pos, setPos] = useState(null)
  // Collapsed at rest (no selection yet) — but every fresh selection (a new
  // layer/frame/code diff clicked on the canvas) re-expands it automatically
  // so the right, context-aware tab content is immediately visible instead
  // of hiding behind a chevron the user has to remember to click.
  const [collapsed, setCollapsed] = useState(true)
  const rootRef = useRef(null)

  useEffect(() => {
    setCollapsed(false)
  }, [selectedLayerId])

  if (!open) return null

  function handleDragStart(event) {
    if (event.button !== 0) return
    event.preventDefault()
    onFloat?.()
    const root = rootRef.current
    const bounds = root.offsetParent.getBoundingClientRect()
    const rect = root.getBoundingClientRect()
    const start = {
      x: event.clientX,
      y: event.clientY,
      left: rect.left - bounds.left,
      top: rect.top - bounds.top,
    }
    function onMove(m) {
      setPos({
        left: Math.min(Math.max(0, start.left + m.clientX - start.x), Math.max(0, bounds.width - rect.width)),
        top: Math.min(Math.max(0, start.top + m.clientY - start.y), Math.max(0, bounds.height - 48)),
      })
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div
      ref={rootRef}
      style={{
        width: DECK_WIDTH,
        ...(pos ? { left: pos.left, top: pos.top } : { right: 16, top: 16 }),
      }}
      className="absolute z-30 flex max-h-[calc(100%-2rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-card/40 shadow-2xl backdrop-blur-xl backdrop-saturate-150"
    >
      <div
        onPointerDown={handleDragStart}
        className="flex h-12 shrink-0 cursor-grab items-center gap-2 border-b border-white/10 px-4 active:cursor-grabbing"
      >
        <GripHorizontal className="size-4 shrink-0 text-muted-foreground/50" />
        <Blocks className="size-4 shrink-0 text-indigo-500" />
        <span className="flex-1 text-sm font-semibold text-foreground">Block Deck</span>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          onPointerDown={(e) => e.stopPropagation()}
          title={collapsed ? 'Expand' : 'Collapse'}
          className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ChevronDown className={cn('size-4 transition-transform', collapsed && 'rotate-180')} />
        </button>
        <button
          type="button"
          onClick={onClose}
          onPointerDown={(e) => e.stopPropagation()}
          title="Close"
          className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      {!collapsed && (
      <>
      {/* Segmented pill switcher — each tab reads as its own clearly
          bounded choice, distinctly colored per role, with generous
          spacing rather than a cramped row of tiny labels. */}
      <div className="flex h-12 shrink-0 items-center gap-1.5 border-b border-white/10 px-2.5">
        <button
          type="button"
          onClick={() => setTab('compare')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
            tab === 'compare' ? 'bg-indigo-500 text-white' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Columns3 className="size-3.5" />
          Compare
        </button>
        <button
          type="button"
          onClick={() => setTab('assemble')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-colors',
            tab === 'assemble' ? 'bg-indigo-500 text-white' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Sparkles className="size-3.5" />
          Assemble
        </button>
        <button
          type="button"
          onClick={() => setTab('library')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-colors',
            tab === 'library' ? 'bg-indigo-500 text-white' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Library className="size-3.5" />
          Library
        </button>
      </div>
      <p className="shrink-0 border-b border-white/10 bg-slate-800/60 px-4 py-2 text-xs leading-snug text-muted-foreground">
        {tab === 'compare' && 'Choose current (A) or incoming (B) for each variant property.'}
        {tab === 'assemble' && 'Build a custom shape, size and style from scratch, or accept an AI suggestion.'}
        {tab === 'library' && 'Pull ready-made components from the Design System.'}
      </p>

      {tab === 'compare' ? (
        item.hasDesign ? (
          <VariantCompareTab
            item={item}
            selectedLayerId={selectedLayerId}
            resolutions={resolutions}
            onResolve={onResolve}
            onHoverDiff={onHoverDiff}
            assembly={assembly}
            onAssemble={onAssemble}
          />
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
            This merge item has no design page to compare.
          </div>
        )
      ) : tab === 'library' ? (
        <ComponentsTab selectedLayer={selectedLayer} onApply={onApplyComponent} onAdd={onAddComponent} onInsert={onInsertComponent} />
      ) : (
        <BlockAssembleTab
          selectedLayer={selectedLayer}
          frameWidth={frameWidth}
          assembly={assembly}
          onAssemble={onAssemble}
          onAssembleReset={onAssembleReset}
          selectedLayerName={selectedLayerName}
          appliedPresetId={appliedPresetId}
          onApplyPreset={onApplyPreset}
        />
      )}
      </>
      )}
    </div>
  )
}

export default BlockDeckPanel
