import { useState } from 'react'
import { ChevronDown, FilePlus2, RotateCcw, Search, X } from 'lucide-react'
import { cn } from 'cn'
import { mergeConflictLevels, mergeDueFilters, mergeFilterTags } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'

const conflictBadgeClass = {
  None: 'bg-emerald-500/15 text-emerald-500',
  Low: 'bg-sky-500/15 text-sky-500',
  Medium: 'bg-amber-500/15 text-amber-500',
  High: 'bg-destructive/15 text-destructive',
}

const dueBucketByFilter = { Overdue: 'overdue', 'Due Soon': 'soon', 'No Due Date': 'none' }

// A collapsed-by-default category: a header row (label + up/down chevron)
// that expands to reveal its pill options underneath. Once a non-default
// tag is picked, a removable pill badge renders next to the header — so the
// active filter stays visible and easy to clear even while collapsed —
// and the section auto-collapses back down.
function AccordionFilterSection({ label, options, value, defaultValue, onChange }) {
  const [expanded, setExpanded] = useState(false)
  const hasSelection = value !== defaultValue

  return (
    <div className="border-b border-border/60 pb-2 last:border-none last:pb-0">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg py-1 text-left"
      >
        <span className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold tracking-wide text-muted-foreground/80 uppercase">
            {label}
          </span>
          {hasSelection && (
            <span
              role="button"
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation()
                onChange(defaultValue)
              }}
              className="flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary"
            >
              {value}
              <X className="size-2.5" />
            </span>
          )}
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
          {options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                onChange(option)
                setExpanded(false)
              }}
              className={cn(
                'rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                value === option
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
function MergeItemCard({ item, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      className={cn(
        'flex w-full flex-col items-start gap-1.5 rounded-2xl border p-3 text-left transition-all',
        active
          ? 'border-primary bg-primary/10 shadow-[0_0_0_1px_var(--primary),0_0_18px_color-mix(in_oklch,var(--primary)_55%,transparent)]'
          : 'border-border bg-card hover:bg-muted/60'
      )}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-foreground">{item.title}</span>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          {item.tag}
        </span>
      </div>
      <span className="text-[11px] text-muted-foreground">{item.subtitle}</span>
      <div className="flex w-full items-center justify-between gap-2">
        <span className="text-[10px] text-muted-foreground/70">{item.updatedLabel}</span>
        <div className="flex items-center gap-1">
          {item.conflictLevel && (
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[9px] font-medium',
                conflictBadgeClass[item.conflictLevel] ?? conflictBadgeClass.None
              )}
            >
              {item.conflictLevel} conflict
            </span>
          )}
        </div>
      </div>
      {item.dueLabel && (
        <span
          className={cn(
            'text-[10px]',
            item.dueBucket === 'overdue' ? 'font-medium text-destructive' : 'text-muted-foreground/70'
          )}
        >
          {item.dueLabel}
        </span>
      )}
    </button>
  )
}

// A floating panel docked to the left side of Merge Studio's infinite
// canvas — same treatment as the Block Deck panel on the right, so the
// canvas itself spans the full workspace width underneath both instead of
// the list being a rigid, layout-pushing sidebar box. Filters are an
// accordion: each dimension (Status / Conflict Level / Due Date) starts
// collapsed behind its header and expands on click; an active pick shows as
// a removable pill next to that header.
function MergeListSidebar() {
  const { mergeItems, selectedMergeItemId, setSelectedMergeItemId, startMergeFromOpenFiles } =
    useWorkspace()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [conflictFilter, setConflictFilter] = useState('Any')
  const [dueFilter, setDueFilter] = useState('Any')

  const hasActiveFilters =
    query.trim() !== '' || statusFilter !== 'All' || conflictFilter !== 'Any' || dueFilter !== 'Any'

  function resetFilters() {
    setQuery('')
    setStatusFilter('All')
    setConflictFilter('Any')
    setDueFilter('Any')
  }

  const visible = mergeItems.filter((item) => {
    if (query.trim() && !item.title.toLowerCase().includes(query.trim().toLowerCase())) {
      return false
    }
    if (statusFilter !== 'All' && item.tag !== statusFilter) return false
    if (conflictFilter !== 'Any' && item.conflictLevel !== conflictFilter) return false
    if (dueFilter !== 'Any' && item.dueBucket !== dueBucketByFilter[dueFilter]) return false
    return true
  })

  return (
    <div className="absolute top-4 bottom-4 left-4 z-20 flex w-72 flex-col overflow-hidden rounded-2xl border bg-card/98 shadow-2xl backdrop-blur-sm">
      <div className="shrink-0 space-y-3 border-b p-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Merge List</p>
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
            className="h-8 w-full rounded-full border bg-background pr-3 pl-8 text-xs outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="space-y-1.5">
          <AccordionFilterSection
            label="Status"
            options={mergeFilterTags}
            value={statusFilter}
            defaultValue="All"
            onChange={setStatusFilter}
          />
          <AccordionFilterSection
            label="Conflict Level"
            options={mergeConflictLevels}
            value={conflictFilter}
            defaultValue="Any"
            onChange={setConflictFilter}
          />
          <AccordionFilterSection
            label="Due Date"
            options={mergeDueFilters}
            value={dueFilter}
            defaultValue="Any"
            onChange={setDueFilter}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-auto p-3">
        {visible.map((item) => (
          <MergeItemCard
            key={item.id}
            item={item}
            active={selectedMergeItemId === item.id}
            onSelect={setSelectedMergeItemId}
          />
        ))}
        {visible.length === 0 && (
          <p className="p-3 text-center text-xs text-muted-foreground">
            No merge items match these filters.
          </p>
        )}
      </div>

      <div className="shrink-0 border-t p-3">
        <button
          type="button"
          onClick={startMergeFromOpenFiles}
          className="flex w-full items-center justify-center gap-1.5 rounded-full bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <FilePlus2 className="size-3.5" />
          Add Files to Merge
        </button>
      </div>
    </div>
  )
}

export default MergeListSidebar
