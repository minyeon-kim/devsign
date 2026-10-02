import { useEffect, useState } from 'react'
import { cn } from 'cn'
import { designSystemComponents } from '@/data/mockData'
import { ComponentPreview } from '@/components/mergestudio/ComponentPreview'
import { libraryCompat } from '@/components/mergestudio/mergeEffects'
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ListFilter } from 'lucide-react'

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
function LibraryRow({ def, mode, target, onApply, onInsert, onAdd, onDrag }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-white/[0.03]">
      <div onPointerDown={(event) => { if (event.button === 0 && onDrag) { event.preventDefault(); onDrag(def) } }} title={onDrag ? 'Drag onto the canvas to place' : undefined}>
        <ComponentPreview def={def} box={{ w: 36, h: 24 }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-medium text-slate-100">{def.name}</p>
        <p className="line-clamp-2 text-[11px] leading-snug text-slate-500">
          {mode === 'replace' ? `Replaces ${target}` : mode === 'insert' ? `Inserts into ${target}` : def.tokens.join(' · ')}
        </p>
        {(onApply || onInsert || onAdd) && <div className="mt-1 flex flex-wrap gap-2">
          {mode === 'replace' && onApply && <button type="button" className="ds-intrinsic text-[10px] text-emerald-300 hover:text-emerald-200" onClick={() => onApply(def)}>Replace</button>}
          {mode === 'insert' && onInsert && <button type="button" className="ds-intrinsic text-[10px] text-emerald-300 hover:text-emerald-200" onClick={() => onInsert(def)}>Insert</button>}
          {onAdd && <button type="button" className="ds-intrinsic text-[10px] text-slate-300 hover:text-white" onClick={() => onAdd(def)}>Add to canvas</button>}
        </div>}
      </div>
    </div>
  )
}

// The design system's component library, filtered to the canvas selection
// — same data and filtering rules as Merge Studio's Block Deck (see
// ComponentsTab there), but its own layout: everything stacked in a single
// column instead of side-by-side rows, so nothing has to fight for width
// in the ~240px sidebar.
export default function AssetsLibrary({ layer, onApply, onInsert, onAdd, onDrag }) {
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
            {/* A filter on the list, so text toggles like the sub-tabs
                above rather than a third row of segmented tabs. */}
            {!nothingFits && (
              <div className="flex items-center gap-x-4" role="group" aria-label="Show components">
                {[
                  ['fit', 'Compatible', fitting.length, `Only components that fit ${layer.name}`],
                  ['all', 'All', designSystemComponents.length, 'Every component'],
                ].map(([id, label, count, title]) => {
                  const on = (showAll ? 'all' : 'fit') === id
                  return (
                    <button
                      key={id}
                      type="button"
                      title={title}
                      aria-pressed={on}
                      onClick={() => setShowAll(id === 'all')}
                      className={cn('ds-intrinsic inline-flex h-5 items-center gap-1 text-[10.5px] whitespace-nowrap transition-colors', on ? 'font-medium text-white' : 'text-slate-500 hover:text-slate-300')}
                    >
                      {label}
                      <span className="text-slate-600 tabular-nums">{count}</span>
                    </button>
                  )
                })}
              </div>
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
            <LibraryRow key={def.id} def={def} mode={modeOf(def)} target={layer?.name} onApply={onApply} onInsert={onInsert} onAdd={onAdd} onDrag={onDrag} />
          ))}
          {items.length === 0 && <p className="py-4 text-center text-xs text-slate-500">No components match.</p>}
        </div>
      </div>
    </div>
  )
}

