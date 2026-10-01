import { useEffect, useState } from 'react'
import { cn } from 'cn'
import { designSystemComponents, inspectorSpecsByType } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { BlockAssembleTab, ComponentPreview, Segmented } from '@/components/mergestudio/BlockDeckPanel'
import { libraryCompat } from '@/components/mergestudio/mergeEffects'
import { WORKSPACE_TAB_RADIUS } from '@/components/mergestudio/floatingStyles'
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ListFilter } from 'lucide-react'

const SUB_TABS = [
  ['assemble', 'Assemble'],
  ['library', 'Library'],
]

// The navigator's Assets view, laid out like Merge Studio's Block Deck:
// sub-tabs for Assemble (the selected canvas element's shape / size /
// style inspector) and Library (the design system's components, filtered
// to what fits the selection). Project files — imported design files
// included — live in the Files tree, not here. Outside Merge Studio the
// Library is browse-only: placing components is Merge Studio's.
// `tab` lives in WorkspaceProvider (not local state) so selecting an
// element on the canvas can switch this to Assemble (see CanvasPanel's
// handleSelect) instead of a floating editor over the canvas itself.
function AssetsPanel() {
  const { assetsTab: tab, setAssetsTab: setTab } = useWorkspace()

  return (
    <div className="flex h-full flex-col bg-card text-xs text-muted-foreground">
      {/* Same shape as the window header's workspace tabs (PanelTabs) —
          this panel's own Files/Layers/Assets/Inspect tabs included —
          instead of Merge Studio's larger rounded-full category pills. */}
      <div className="flex shrink-0 items-center gap-1 px-3 pt-2 pb-1.5">
        {SUB_TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              'flex h-7 items-center px-2 text-xs transition-colors',
              WORKSPACE_TAB_RADIUS,
              tab === id ? 'bg-white/[0.09] text-white' : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200'
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'assemble' && <AssembleView />}
      {tab === 'library' && <LibraryView />}
    </div>
  )
}

// The canvas's current selection, as the Block Deck tabs expect it: the
// layer plus the width of the frame it sits in.
function useSelectedLayer() {
  const { selectedLayerId, activePageId, projectPages } = useWorkspace()
  const page = projectPages.find((p) => p.id === activePageId) ?? projectPages[0]
  for (const frame of page?.frames ?? []) {
    const layer = frame.layers.find((l) => l.id === selectedLayerId)
    if (layer) return { layer, frameWidth: frame.width }
  }
  return { layer: null, frameWidth: 300 }
}

// BlockAssembleTab is Merge Studio's inspector, built for its 360px Block
// Deck — every section pads itself with `px-5` (20px a side), its
// three-column row grid leaves a 28px slot spare on rows a full-width
// Segmented spans past (`col-span-2` of 3), and its controls/text (14px
// headers, 28px-tall pill fields) are sized for that wider panel. Left
// as-is here, that's a third of this ~240px sidebar's width gone before
// any content, rows at nearly twice a Files/Layers row's height, and every
// three-option Segmented (Effects, Radius, Icon) clipping its longest
// label. Rather than fork the whole inspector, narrow this handful of
// utility classes for its subtree (same technique NavigatorPanel uses for
// `bg-card`) — every section tightens to the sidebar's own scale without
// touching Merge Studio.
function AssembleView() {
  const { assetAssemblies, assembleAsset } = useWorkspace()
  const { layer, frameWidth } = useSelectedLayer()
  const [appliedPresetId, setAppliedPresetId] = useState(null)
  return (
    <div className="flex min-h-0 flex-1 flex-col [&_.col-span-2]:col-span-3 [&_.h-7]:h-6 [&_.px-5]:px-3 [&_.py-2\.5]:py-1.5 [&_.size-7]:size-6 [&_.text-sm]:text-xs">
      <BlockAssembleTab
        selectedLayer={layer}
        frameWidth={frameWidth}
        assembly={layer ? assetAssemblies[layer.id] : undefined}
        onAssemble={(patch) => layer && assembleAsset(layer.id, patch)}
        onAssembleReset={() => layer && assembleAsset(layer.id, null)}
        tokenSpec={layer ? inspectorSpecsByType[layer.type] : null}
        selectedLayerName={layer?.name}
        appliedPresetId={appliedPresetId}
        onApplyPreset={setAppliedPresetId}
      />
    </div>
  )
}

// An icon-only category picker — next to the search field on the same
// row instead of a full labeled dropdown on its own line, so filtering
// doesn't cost the sidebar a whole row. A dot marks an active filter
// since the category name itself is tucked away in the menu.
function CategoryFilter({ categories, counts, value, onChange }) {
  const active = value !== 'All'
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        title={active ? `Filtered: ${value}` : 'Filter by category'}
        aria-label="Filter by category"
        className={cn(
          'relative flex size-7 shrink-0 items-center justify-center rounded-[6px] transition-colors',
          active ? 'bg-white/[0.1] text-white hover:bg-white/[0.13]' : 'bg-white/[0.05] text-slate-300 hover:bg-white/[0.08]'
        )}
      >
        <ListFilter className="size-3.5" />
        {active && <span className="absolute top-1 right-1 size-1.5 rounded-full bg-emerald-400" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44 rounded-xl border border-white/10 bg-card">
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          {categories.map((c) => (
            <DropdownMenuRadioItem key={c} value={c} className="text-xs">
              <span className="flex-1">{c === 'All' ? 'All types' : c}</span>
              <span className="ml-3 text-[11px] text-slate-500 tabular-nums">{counts[c] ?? 0}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// One library row, sized for the sidebar: a live thumbnail, the name and
// what it'd do, stacked — no reserved action column, since placing
// components is Merge Studio's job, not this browse-only view's.
function LibraryRow({ def, mode, target }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-white/[0.03]">
      <ComponentPreview def={def} box={{ w: 36, h: 24 }} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-medium text-slate-100">{def.name}</p>
        <p className="line-clamp-2 text-[11px] leading-snug text-slate-500">
          {mode === 'replace' ? `Replaces ${target}` : mode === 'insert' ? `Inserts into ${target}` : def.tokens.join(' · ')}
        </p>
      </div>
    </div>
  )
}

// The design system's component library, filtered to the canvas selection
// — same data and filtering rules as Merge Studio's Block Deck (see
// ComponentsTab there), but its own layout: everything stacked in a single
// column instead of side-by-side rows, so nothing has to fight for width
// in the ~240px sidebar.
function LibraryView() {
  const { layer } = useSelectedLayer()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [showAll, setShowAll] = useState(false)
  // A new selection is a new context: back to its compatible set.
  useEffect(() => {
    setShowAll(false)
    setCategory('All')
  }, [layer?.id])

  const compat = layer ? libraryCompat(layer) : null
  const modeOf = (def) => (!compat ? null : compat.replace.has(def.type) ? 'replace' : compat.insert.has(def.type) ? 'insert' : null)
  const fitting = compat ? designSystemComponents.filter((c) => modeOf(c)) : []
  const nothingFits = Boolean(compat) && fitting.length === 0
  const contextual = Boolean(compat) && !showAll && !nothingFits
  const pool = contextual ? fitting : designSystemComponents

  const q = query.trim().toLowerCase()
  const matchesQuery = (c) => c.name.toLowerCase().includes(q)
  const counts = { All: pool.filter(matchesQuery).length }
  pool.filter(matchesQuery).forEach((c) => (counts[c.category] = (counts[c.category] ?? 0) + 1))
  const categories = ['All', ...new Set(pool.map((c) => c.category))]
  const activeCategory = categories.includes(category) ? category : 'All'
  const visible = pool.filter((c) => (activeCategory === 'All' || c.category === activeCategory) && matchesQuery(c))
  const order = { replace: 0, insert: 1 }
  const items = contextual ? [...visible].sort((a, b) => (order[modeOf(a)] ?? 2) - (order[modeOf(b)] ?? 2)) : visible

  return (
    <div className="scroll-fade-bottom min-h-0 flex-1 overflow-auto">
      <div className="space-y-3 px-3 pt-1.5 pb-3">
        <div className="flex items-center gap-1.5">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search components…"
            className="h-7 min-w-0 flex-1 rounded-[6px] bg-white/[0.05] px-2.5 text-[11.5px] text-white outline-none placeholder:text-slate-500 focus:bg-white/[0.08] focus:ring-1 focus:ring-white/20"
          />
          <CategoryFilter categories={categories} counts={counts} value={activeCategory} onChange={setCategory} />
        </div>

        {layer ? (
          <div className="space-y-1.5">
            {!nothingFits && (
              <Segmented
                className="w-full"
                value={showAll ? 'all' : 'fit'}
                onChange={(v) => setShowAll(v === 'all')}
                options={[
                  { id: 'fit', label: 'Compatible', count: fitting.length, title: `Only components that fit ${layer.name}` },
                  { id: 'all', label: 'All', count: designSystemComponents.length, title: 'Every component' },
                ]}
              />
            )}
            <p className="truncate text-[11px] text-slate-500" title={layer.name}>
              {nothingFits ? (
                <>
                  Nothing fits <span className="text-slate-300">{layer.name}</span> — showing all
                </>
              ) : (
                <>
                  {showAll ? 'All components · ' : 'Fits '}
                  <span className="text-slate-300">{layer.name}</span>
                </>
              )}
            </p>
          </div>
        ) : (
          <p className="text-[11px] leading-relaxed text-slate-500">Select an element on the canvas to see only the components that fit it.</p>
        )}
      </div>

      <div className="px-3 pb-3">
        <div className="mb-1.5 flex h-5 items-center gap-2 text-xs font-medium text-slate-300">
          <span>Components</span>
          <span className="text-slate-500 tabular-nums">{items.length}</span>
        </div>
        {/* ComponentPreview's thumbnail tile is a light-canvas white (see
            BlockDeckPanel) — right for Merge Studio's white artboard, off
            against this dark sidebar, so it's narrowed to a dark surface
            for just this subtree instead of forking the shared component. */}
        <div className="space-y-0.5 [&_.bg-white]:bg-white/[0.08]">
          {items.map((def) => (
            <LibraryRow key={def.id} def={def} mode={modeOf(def)} target={layer?.name} />
          ))}
          {items.length === 0 && <p className="py-4 text-center text-xs text-slate-500">No components match.</p>}
        </div>
      </div>
    </div>
  )
}

export default AssetsPanel
