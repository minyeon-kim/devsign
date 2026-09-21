import { useEffect, useRef, useState } from 'react'
import { ChevronDown, FilePlus2, RotateCcw, Search, X } from 'lucide-react'
import { cn } from 'cn'
import { mergeConflictLevels, mergeDueFilters, mergeFilterTags } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'
import ConflictResolutionModal from '@/components/mergestudio/ConflictResolutionModal'

const conflictBadgeClass = {
  None: 'bg-emerald-500/15 text-emerald-500',
  Low: 'bg-sky-500/15 text-sky-500',
  Medium: 'bg-amber-500/15 text-amber-500',
  High: 'bg-destructive/15 text-destructive',
}

const dueBucketByFilter = { Overdue: 'overdue', 'Due Soon': 'soon', 'No Due Date': 'none' }

// A collapsed-by-default, multi-select category: a header row (label +
// chevron) that expands to reveal its pill options. Clicking options
// toggles them and never closes the section — it stays open until the
// header is clicked again or the user clicks outside. Each picked tag also
// renders as a removable pill next to the header, visible even collapsed.
// An empty selection means "no filter" for that category.
function AccordionFilterSection({ label, options, value, onChange }) {
  const [expanded, setExpanded] = useState(false)
  const rootRef = useRef(null)
  const choices = options.filter((o) => o !== 'All' && o !== 'Any')

  useEffect(() => {
    if (!expanded) return
    function onDown(event) {
      if (!rootRef.current?.contains(event.target)) setExpanded(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [expanded])

  function toggle(option) {
    onChange(value.includes(option) ? value.filter((v) => v !== option) : [...value, option])
  }

  return (
    <div ref={rootRef} className="border-b border-border/60 pb-2 last:border-none last:pb-0">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg py-1 text-left"
      >
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold tracking-wide text-muted-foreground/80 uppercase">
            {label}
          </span>
          {value.map((v) => (
            <span
              key={v}
              role="button"
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation()
                toggle(v)
              }}
              className="flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary"
            >
              {v}
              <X className="size-2.5" />
            </span>
          ))}
        </span>
        <ChevronDown
          className={cn(
            'size-3.5 shrink-0 text-muted-foreground transition-transform',
            expanded && 'rotate-180'
          )}
        />
      </button>

      {expanded && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {choices.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => toggle(option)}
              className={cn(
                'rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                value.includes(option)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// The distinct "currently open" indicator: a vibrant indigo/purple glow
// (via the same color-mix technique used elsewhere in this app for
// theme-consistent glows/tints) on top of the normal tinted-border active
// state, so the open item is unmistakable at a glance versus merely
// hovered/selected-but-not-open.
const statusTagClass = {
  'In Progress': 'bg-indigo-500/15 text-indigo-400',
  'Needs Review': 'bg-violet-500/15 text-violet-400',
  Draft: 'bg-muted text-muted-foreground',
  Merged: 'bg-emerald-500/15 text-emerald-400',
}

// One scannable card: title is the strongest element (with the status pill
// beside it, tinted per status), the file/subtitle line is quiet, and a
// hairline divides that from the meta row (updated time · conflict · due)
// so the eye reads title -> status -> details. The open item gets the
// indigo glow on top of the tinted-border active state.
function MergeItemCard({ item, active, onSelect, onConflict }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      className={cn(
        'flex w-full flex-col gap-2.5 rounded-2xl border p-3.5 text-left transition-all',
        active
          ? 'border-primary bg-primary/10 shadow-[0_0_0_1px_var(--primary),0_0_18px_color-mix(in_oklch,var(--primary)_55%,transparent)]'
          : 'border-white/10 bg-slate-800/70 hover:border-primary/40 hover:bg-slate-700/70'
      )}
    >
      <div className="flex w-full items-start justify-between gap-2">
        <span className="min-w-0 flex-1 text-[13px] leading-snug font-semibold text-foreground">
          {item.title}
        </span>
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
            statusTagClass[item.tag] ?? 'bg-muted text-muted-foreground'
          )}
        >
          {item.tag}
        </span>
      </div>

      <span className="text-[11px] leading-snug text-muted-foreground">{item.subtitle}</span>

      <div className="flex w-full flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-border/60 pt-2.5">
        <span className="text-[10px] text-muted-foreground/70">{item.updatedLabel}</span>
        {item.conflictLevel && (
          <span
            role={item.conflictLevel !== 'None' ? 'button' : undefined}
            tabIndex={item.conflictLevel !== 'None' ? 0 : undefined}
            title={item.conflictLevel !== 'None' ? 'Resolve conflicts' : undefined}
            onClick={(event) => {
              if (item.conflictLevel === 'None') return
              event.stopPropagation()
              onConflict(item)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && item.conflictLevel !== 'None') {
                event.stopPropagation()
                onConflict(item)
              }
            }}
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-medium',
              conflictBadgeClass[item.conflictLevel] ?? conflictBadgeClass.None,
              item.conflictLevel !== 'None' && 'cursor-pointer ring-1 ring-current/30 transition-all hover:ring-2'
            )}
          >
            {item.conflictLevel} conflict
          </span>
        )}
        {item.dueLabel && (
          <span
            className={cn(
              'ml-auto text-[10px]',
              item.dueBucket === 'overdue' ? 'font-medium text-destructive' : 'text-muted-foreground/70'
            )}
          >
            {item.dueLabel}
          </span>
        )}
      </div>
    </button>
  )
}

// A floating panel docked to the left side of Merge Studio's infinite
// canvas — same treatment as the Block Deck panel on the right, so the
// canvas itself spans the full workspace width underneath both instead of
// the list being a rigid, layout-pushing sidebar box. Filters are an
// accordion: each dimension (Status / Conflict Level / Due Date) starts
// collapsed behind its header and expands on click; an active pick shows as
// removable pills next to that header (multi-select).
function MergeListSidebar() {
  const { mergeItems, selectedMergeItemId, setSelectedMergeItemId, startMergeFromOpenFiles } =
    useWorkspace()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState([])
  const [conflictFilter, setConflictFilter] = useState([])
  const [dueFilter, setDueFilter] = useState([])
  const [conflictItem, setConflictItem] = useState(null)

  const hasActiveFilters =
    query.trim() !== '' || statusFilter.length > 0 || conflictFilter.length > 0 || dueFilter.length > 0

  function resetFilters() {
    setQuery('')
    setStatusFilter([])
    setConflictFilter([])
    setDueFilter([])
  }

  const visible = mergeItems.filter((item) => {
    if (query.trim() && !item.title.toLowerCase().includes(query.trim().toLowerCase())) {
      return false
    }
    if (statusFilter.length && !statusFilter.includes(item.tag)) return false
    if (conflictFilter.length && !conflictFilter.includes(item.conflictLevel)) return false
    if (dueFilter.length && !dueFilter.some((d) => item.dueBucket === dueBucketByFilter[d])) return false
    return true
  })

  return (
    <div className="absolute top-0 bottom-0 left-0 z-20 flex w-72 flex-col overflow-hidden rounded-r-2xl border-y-0 border-r border-l-0 bg-card/98 shadow-2xl backdrop-blur-sm">
      <div className="shrink-0 space-y-3.5 border-b p-4">
        <div className="flex items-center justify-between">
          <p className="flex items-baseline gap-1.5 text-sm font-semibold text-foreground">
            Merge List
            <span className="text-[11px] font-normal text-muted-foreground">{visible.length}</span>
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <RotateCcw className="size-3" />
              Reset
            </button>
          )}
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search merge items..."
            className="h-8 w-full rounded-full border bg-slate-800 pr-3 pl-8 text-xs outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="space-y-1.5">
          <AccordionFilterSection
            label="Status"
            options={mergeFilterTags}
            value={statusFilter}
            onChange={setStatusFilter}
          />
          <AccordionFilterSection
            label="Conflict Level"
            options={mergeConflictLevels}
            value={conflictFilter}
            onChange={setConflictFilter}
          />
          <AccordionFilterSection
            label="Due Date"
            options={mergeDueFilters}
            value={dueFilter}
            onChange={setDueFilter}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-auto px-4 py-4">
        {visible.map((item) => (
          <MergeItemCard
            key={item.id}
            item={item}
            active={selectedMergeItemId === item.id}
            onSelect={setSelectedMergeItemId}
            onConflict={setConflictItem}
          />
        ))}
        {visible.length === 0 && (
          <p className="p-3 text-center text-xs text-muted-foreground">
            No merge items match these filters.
          </p>
        )}
      </div>

      <div className="shrink-0 border-t p-4">
        <button
          type="button"
          onClick={startMergeFromOpenFiles}
          className="flex w-full items-center justify-center gap-1.5 rounded-full bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <FilePlus2 className="size-3.5" />
          Add Files to Merge
        </button>
      </div>
      {conflictItem && (
        <ConflictResolutionModal
          item={mergeItems.find((i) => i.id === conflictItem.id) ?? conflictItem}
          onClose={() => setConflictItem(null)}
        />
      )}
    </div>
  )
}

export default MergeListSidebar
