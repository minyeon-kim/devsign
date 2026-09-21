import { useState } from 'react'
import { AlertTriangle, Clock, FilePlus2, RotateCcw, Search, Tag, User, X } from 'lucide-react'
import { cn } from 'cn'
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { allPeople, mergeConflictLevels, mergeDueFilters, mergeFilterTags } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'

const conflictBadgeClass = {
  None: 'bg-emerald-500/15 text-emerald-500',
  Low: 'bg-sky-500/15 text-sky-500',
  Medium: 'bg-amber-500/15 text-amber-500',
  High: 'bg-destructive/15 text-destructive',
}

const dueBucketByFilterValue = { Overdue: 'overdue', 'Due Soon': 'soon', 'No Due Date': 'none' }

// One persistent pill per dimension (never a mixed catalog) — `value` is
// what's matched against merge items (a person id for "Assigned to", the
// raw label otherwise); `display` is what shows up in the pill/list.
const filterDimensions = [
  {
    key: 'status',
    label: 'Status',
    icon: Tag,
    options: mergeFilterTags.filter((v) => v !== 'All').map((v) => ({ value: v, display: v })),
  },
  {
    key: 'assignee',
    label: 'Assignee',
    icon: User,
    options: allPeople.map((p) => ({ value: p.id, display: p.name })),
  },
  {
    key: 'conflict',
    label: 'Conflict',
    icon: AlertTriangle,
    options: mergeConflictLevels.filter((v) => v !== 'Any').map((v) => ({ value: v, display: v })),
  },
  {
    key: 'due',
    label: 'Due Date',
    icon: Clock,
    options: mergeDueFilters.filter((v) => v !== 'Any').map((v) => ({ value: v, display: v })),
  },
]

function matchesFilter(item, key, value) {
  if (key === 'status') return item.tag === value
  if (key === 'assignee') return item.assigneeId === value
  if (key === 'conflict') return item.conflictLevel === value
  if (key === 'due') return item.dueBucket === dueBucketByFilterValue[value]
  return true
}

// A single filter category's own pill — always present (Status, Assignee,
// Conflict Level, Due Date all show up whether or not they're set), never
// mixed with any other category's values. Reads as just the dimension name
// when unset ("Status"), or "Status: In Progress" with its icon once a
// value is picked. Its dropdown only ever lists *this* dimension's own
// options under a single header, so there's nothing to jumble it with —
// plus a leading "Any ⟨Dimension⟩" entry to clear it from inside the menu.
function CategoryFilterPill({ dim, value, onChange }) {
  const Icon = dim.icon
  const option = dim.options.find((o) => o.value === value)
  const active = value != null

  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-1 rounded-full border py-1 pr-1 pl-2.5 text-[11px] font-medium transition-colors',
        active
          ? 'border-primary/30 bg-primary/10 text-foreground'
          : 'border-border bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground'
      )}
    >
      <Icon className={cn('size-3', active ? 'text-primary' : 'text-muted-foreground')} />
      <Popover>
        <PopoverTrigger className="hover:underline">
          {active ? `${dim.label}: ${option?.display ?? value}` : dim.label}
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={6} className="w-52 gap-0.5 rounded-2xl p-2">
          <p className="px-1 pb-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            {dim.label}
          </p>
          <PopoverClose
            type="button"
            onClick={() => onChange(null)}
            className={cn(
              'flex w-full items-center rounded-xl px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted',
              !active ? 'font-semibold text-primary' : 'text-muted-foreground'
            )}
          >
            Any {dim.label}
          </PopoverClose>
          {dim.options.map((opt) => (
            <PopoverClose
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={cn(
                'flex w-full items-center rounded-xl px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted',
                opt.value === value ? 'font-semibold text-primary' : 'text-foreground'
              )}
            >
              {opt.display}
            </PopoverClose>
          ))}
        </PopoverContent>
      </Popover>
      {active && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="flex size-4 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-2.5" />
        </button>
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

const emptyFilterValues = Object.fromEntries(filterDimensions.map((d) => [d.key, null]))

// Left sidebar shown while in the Merge Studio view — search + a filter bar
// of persistent per-category pills (Status, Assignee, Conflict Level, Due
// Date — never a single mixed dropdown) on top of the saved merge cards,
// plus the entry point for adding more files to a merge. Selecting a card
// is the "routing" trigger: MergeStudioWorkspace reacts to
// `selectedMergeItemId` by syncing the shared activeFileId/activePageId to
// that item's files.
function MergeListSidebar() {
  const { mergeItems, selectedMergeItemId, setSelectedMergeItemId, startMergeFromOpenFiles } =
    useWorkspace()
  const [query, setQuery] = useState('')
  const [filterValues, setFilterValues] = useState(emptyFilterValues)

  const hasActiveFilters =
    query.trim() !== '' || Object.values(filterValues).some((v) => v != null)

  function resetFilters() {
    setQuery('')
    setFilterValues(emptyFilterValues)
  }

  function setFilterValue(key, value) {
    setFilterValues((prev) => ({ ...prev, [key]: value }))
  }

  const visible = mergeItems.filter((item) => {
    if (query.trim() && !item.title.toLowerCase().includes(query.trim().toLowerCase())) {
      return false
    }
    return filterDimensions.every((dim) => {
      const value = filterValues[dim.key]
      return value == null || matchesFilter(item, dim.key, value)
    })
  })

  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-r bg-card">
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

        <div className="flex flex-wrap items-center gap-1.5">
          {filterDimensions.map((dim) => (
            <CategoryFilterPill
              key={dim.key}
              dim={dim}
              value={filterValues[dim.key]}
              onChange={(value) => setFilterValue(dim.key, value)}
            />
          ))}
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
