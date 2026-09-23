import { useState } from 'react'
import { ArrowLeft, ChevronDown, FilePlus2, RotateCcw, Search } from 'lucide-react'
import { cn } from 'cn'
import { mergeConflictLevels, mergeDueFilters, mergeFilterTags } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import ConflictResolutionModal from '@/components/mergestudio/ConflictResolutionModal'

const conflictBadgeClass = {
  None: 'bg-emerald-500/15 text-emerald-500',
  Low: 'bg-sky-500/15 text-sky-500',
  Medium: 'bg-amber-500/15 text-amber-500',
  High: 'bg-destructive/15 text-destructive',
}

const dueBucketByFilter = { Overdue: 'overdue', 'Due Soon': 'soon', 'No Due Date': 'none' }

// One compact filter chip per category (Status / Conflict / Due), laid out
// as equal-width columns so the row spans exactly the search box's width:
// the pill shows the category name, or the picked value (or "Name · N" for
// several), and opens a small checkbox menu.
// Checkbox items keep the menu open (Base UI's default), so multi-select
// works without reopening it. An empty selection means "no filter" for
// that category.
function FilterChip({ label, options, value, onChange }) {
  const choices = options.filter((o) => o !== 'All' && o !== 'Any')
  const active = value.length > 0
  const summary = value.length === 1 ? value[0] : active ? `${label} · ${value.length}` : label

  function toggle(option, checked) {
    onChange(checked ? [...value, option] : value.filter((v) => v !== option))
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'flex h-8 w-full min-w-0 items-center justify-between gap-1 rounded-full border pr-2 pl-3 text-[11px] font-medium whitespace-nowrap transition-colors',
          active
            ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-200'
            : 'border-white/10 bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
        )}
      >
        <span className="truncate">{summary}</span>
        <ChevronDown className="size-3 shrink-0 opacity-70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-44 rounded-xl border border-white/10 bg-card/95 backdrop-blur-xl">
        {choices.map((option) => (
          <DropdownMenuCheckboxItem
            key={option}
            checked={value.includes(option)}
            onCheckedChange={(checked) => toggle(option, checked)}
            className="rounded-lg text-xs"
          >
            {option}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// The distinct "currently open" indicator: a vibrant indigo/purple glow
// (via the same color-mix technique used elsewhere in this app for
// theme-consistent glows/tints) on top of the normal tinted-border active
// state, so the open item is unmistakable at a glance versus merely
// hovered/selected-but-not-open.
// One muted, harmonious tone for every status — the label text alone (In
// Progress / Needs Review / Draft / Merged) carries the meaning, so the
// chip itself doesn't need to compete in a different color per value.
const STATUS_CHIP_CLASS = 'bg-indigo-500/10 text-indigo-300'

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
        'flex w-full flex-col gap-3 rounded-2xl border p-4 text-left transition-all',
        // Selected state: a solid, brighter slate surface plus a soft accent
        // ring — no heavy border, and none of the text dims against it (see
        // the subtitle/meta spans below), so it stays sharp, not washed out.
        active
          ? 'border-white/10 bg-slate-700 ring-1 ring-inset ring-primary/25'
          : 'border-white/10 bg-slate-800/70 hover:border-primary/40 hover:bg-slate-700/70'
      )}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <span className="min-w-0 flex-1 text-sm leading-snug font-semibold text-foreground">
          {item.title}
        </span>
        <span
          className={cn(
            'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap',
            // "Merged" gets its own unmistakable emerald/green treatment so a
            // completed merge reads as done at a glance; every other status
            // keeps sharing the one muted tone (see STATUS_CHIP_CLASS above).
            item.tag === 'Merged' ? 'bg-emerald-500/15 text-emerald-400' : STATUS_CHIP_CLASS
          )}
        >
          {item.tag}
        </span>
      </div>

      <span className={cn("text-xs leading-snug", active ? "text-foreground/90" : "text-muted-foreground")}>{item.subtitle}</span>

      <div className="flex w-full flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-border/60 pt-2.5">
        <span className={cn("text-[11px]", active ? "text-muted-foreground" : "text-muted-foreground/70")}>{item.updatedLabel}</span>
        {item.conflictLevel && item.conflictLevel !== 'None' && (
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
              'rounded-full px-2 py-0.5 text-[11px] font-medium',
              conflictBadgeClass[item.conflictLevel] ?? conflictBadgeClass.None,
              item.conflictLevel !== 'None' && 'cursor-pointer ring-1 ring-current/30 transition-all hover:ring-2'
            )}
          >
            {item.conflictLevel}
          </span>
        )}
        {item.dueLabel && (
          <span
            className={cn(
              'ml-auto text-[11px]',
              item.dueBucket === 'overdue' ? 'font-medium text-destructive' : active ? 'text-muted-foreground' : 'text-muted-foreground/70'
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
// the list being a rigid, layout-pushing sidebar box. Filters are one row of
// dropdown chips (Status / Conflict / Due), each a multi-select menu.
function MergeListSidebar() {
  const {
    mergeItems,
    selectedMergeItemId,
    setSelectedMergeItemId,
    startMergeFromOpenFiles,
    mergeListCollapsed,
    exitMergeStudio,
  } = useWorkspace()
  const [confirmExitOpen, setConfirmExitOpen] = useState(false)
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
    <div
      // Overlay drawer: a fixed-width glass panel that slides over the canvas
      // (transform only) instead of animating its width — nothing on the
      // canvas is laid out around it, so toggling it never shifts the
      // canvas or its centered floating controls.
      aria-hidden={mergeListCollapsed}
      inert={mergeListCollapsed}
      className={cn(
        'absolute top-0 bottom-0 left-0 z-30 flex w-72 flex-col overflow-hidden rounded-r-2xl border-y-0 border-l-0 border-r border-white/10 bg-card/70 shadow-2xl shadow-black/40 backdrop-blur-xl backdrop-saturate-150 transition-[translate,opacity] duration-300 ease-in-out will-change-transform',
        mergeListCollapsed ? 'pointer-events-none -translate-x-full opacity-0' : 'translate-x-0 opacity-100'
      )}
    >
      <div className="flex h-full min-w-72 flex-1 flex-col">
      <div className="flex shrink-0 flex-col gap-3 border-b px-4 pt-4 pb-5">
        {/* Header: navigation (← Workspace) on top — it lives inside the
            drawer, so it's isolated from the canvas's floating widgets and
            right-side panels at any window size — then "Merge List" as the
            pane's single title, with its count and a Reset for filters.
            The collapse toggle stays in the ActivityBar. Every row shares the
            same px-4 inset (no negative margins), so the button, title,
            search box and filter chips all line up on one left/right edge;
            pb-5 gives the chips the same breathing room above the divider
            that the header has at the top. */}
        <button
          type="button"
          onClick={() => setConfirmExitOpen(true)}
          className="flex w-fit items-center gap-1.5 rounded-full border border-white/10 bg-muted/50 px-3 py-1 text-xs font-semibold text-foreground transition-colors hover:border-indigo-500/40 hover:bg-indigo-500/10"
        >
          <ArrowLeft className="size-3.5" />
          Workspace
        </button>
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm leading-tight font-semibold text-foreground">
            Merge List
            <span className="rounded-full bg-indigo-500/15 px-1.5 text-[10px] font-semibold text-indigo-300 tabular-nums">
              {visible.length}
            </span>
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

        <div className="flex flex-col gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search merge items..."
            className="h-9 w-full rounded-full border bg-slate-800 pr-3 pl-9 text-sm outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <FilterChip label="Status" options={mergeFilterTags} value={statusFilter} onChange={setStatusFilter} />
          <FilterChip label="Conflict" options={mergeConflictLevels} value={conflictFilter} onChange={setConflictFilter} />
          <FilterChip label="Due" options={mergeDueFilters} value={dueFilter} onChange={setDueFilter} />
        </div>
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
          className="flex w-full items-center justify-center gap-1.5 rounded-full bg-indigo-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-400"
        >
          <FilePlus2 className="size-3.5" />
          Add Files to Merge
        </button>
      </div>
      </div>
      {conflictItem && (
        <ConflictResolutionModal
          item={mergeItems.find((i) => i.id === conflictItem.id) ?? conflictItem}
          onClose={() => setConflictItem(null)}
        />
      )}

      {/* Portaled, so it renders fine from inside the drawer. */}
      <Dialog open={confirmExitOpen} onOpenChange={setConfirmExitOpen}>
        <DialogContent
          showCloseButton={false}
          className="rounded-2xl border border-white/10 bg-card/90 p-5 shadow-2xl backdrop-blur-xl"
        >
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ArrowLeft className="size-4.5" strokeWidth={2.5} />
          </div>
          <DialogTitle className="text-base font-semibold">Back to Workspace?</DialogTitle>
          <DialogDescription>
            You'll leave Merge Studio and return to the main workspace. Your merge progress stays saved.
          </DialogDescription>
          <div className="mt-1 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmExitOpen(false)}
              className="rounded-full px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmExitOpen(false)
                exitMergeStudio()
              }}
              className="rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all hover:brightness-110"
            >
              Back to Workspace
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default MergeListSidebar
