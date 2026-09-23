import { useState } from 'react'
import {
  ArrowLeft,
  ChartLine,
  ChevronDown,
  CircleDot,
  CircleUser,
  FilePlus2,
  Files,
  Frame,
  GitMerge,
  Image,
  Layers,
  PanelBottom,
  PanelLeftClose,
  PanelLeftOpen,
  PanelTop,
  Pencil,
  RectangleHorizontal,
  RotateCcw,
  Search,
  Square,
  Table,
  Tag,
  TextCursorInput,
  ToggleRight,
  Type,
} from 'lucide-react'
import { cn } from 'cn'
import { codeMergeVariants, designMergeVariants, mergeConflictLevels, mergeDueFilters, mergeFilterTags } from '@/data/mockData'
import { getFileIconMeta } from '@/lib/fileIcons'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import ConflictResolutionModal from '@/components/mergestudio/ConflictResolutionModal'
import { FLOATING_PANEL, FLOATING_PILL } from '@/components/mergestudio/floatingStyles'

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

// Files tab: the open merge item's files (plus Merge Studio's copy.json),
// each with its incoming-change and hand-edit counts. Clicking one jumps the
// code window to its first change.
function FilesTab({ item, files, manualCode, activeFileId, onOpen }) {
  if (!files.length) return <EmptyTab text="This merge item has no files." />
  return (
    <div className="space-y-1 p-2">
      {files.map((f) => {
        const meta = getFileIconMeta(f.name)
        const incoming = codeMergeVariants[item.id]?.[f.id] ?? []
        const edits = Object.keys(manualCode ?? {})
          .filter((k) => k.startsWith(`${f.id}:`))
          .map((k) => Number(k.slice(k.lastIndexOf(':') + 1)))
        const firstLine = Math.min(...incoming.map((d) => d.line), ...edits, Infinity)
        const active = activeFileId === f.id
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onOpen(f, Number.isFinite(firstLine) ? firstLine : 1)}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors',
              active ? 'bg-indigo-500/15 ring-1 ring-inset ring-indigo-500/30' : 'hover:bg-white/5'
            )}
          >
            <meta.Icon className={cn('size-4 shrink-0', meta.colorClass)} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium text-foreground">{f.name}</span>
              <span className="block truncate text-[10px] text-muted-foreground">{f.path}</span>
            </span>
            {incoming.length > 0 && (
              <span title="Incoming changes" className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 text-[10px] font-semibold text-emerald-400 tabular-nums">
                +{incoming.length}
              </span>
            )}
            {edits.length > 0 && (
              <span title="Hand edits" className="flex shrink-0 items-center gap-0.5 rounded-full bg-violet-500/15 px-1.5 text-[10px] font-semibold text-violet-300 tabular-nums">
                <Pencil className="size-2.5" />
                {edits.length}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

const LAYER_ICONS = {
  text: Type,
  button: RectangleHorizontal,
  input: TextCursorInput,
  chip: Tag,
  image: Image,
  avatar: CircleUser,
  card: Square,
  bar: PanelTop,
  tabs: PanelBottom,
  toggle: ToggleRight,
  iconbtn: CircleDot,
  chart: ChartLine,
  table: Table,
}
const CONTAINER_TYPES = new Set(['card', 'bar'])

// Nests layers under the smallest card/bar that fully contains them, so the
// flat frame reads as a real layer tree (a chip inside its card, the logo
// inside the nav bar).
function layerTree(layers) {
  const inside = (c, l) => c.id !== l.id && l.x >= c.x && l.y >= c.y && l.x + l.width <= c.x + c.width && l.y + l.height <= c.y + c.height
  const parentOf = {}
  for (const l of layers) {
    const containers = layers.filter((c) => CONTAINER_TYPES.has(c.type) && inside(c, l))
    containers.sort((a, b) => a.width * a.height - b.width * b.height)
    parentOf[l.id] = containers[0]?.id ?? null
  }
  const rows = []
  const walk = (parentId, depth) => {
    for (const l of layers.filter((x) => parentOf[x.id] === parentId)) {
      rows.push({ layer: l, depth })
      walk(l.id, depth + 1)
    }
  }
  walk(null, 0)
  return rows
}

// Layers tab: the frame's layer tree. Violet dot = drifts from the Original
// Design, pencil = edited here (Assemble or text); clicking selects the
// layer on the canvas and pans to it.
function LayersTab({ item, frame, selectedLayerId, editedLayerIds, onSelect }) {
  if (!frame) return <EmptyTab text="This merge item has no design page." />
  const drifted = designMergeVariants[item.id]?.layerDiffs ?? {}
  return (
    <div className="p-2">
      <div className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-semibold text-foreground">
        <Frame className="size-3.5 text-indigo-400" />
        <span className="truncate">{frame.name}</span>
      </div>
      {layerTree(frame.layers).map(({ layer, depth }) => {
        const Icon = LAYER_ICONS[layer.type] ?? Square
        const active = selectedLayerId === layer.id
        return (
          <button
            key={layer.id}
            type="button"
            onClick={() => onSelect(layer.id)}
            style={{ paddingLeft: 14 + depth * 14 }}
            className={cn(
              'flex h-7 w-full items-center gap-2 rounded-lg pr-2.5 text-left text-xs transition-colors',
              active ? 'bg-indigo-500/20 text-foreground ring-1 ring-inset ring-indigo-500/30' : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
            )}
          >
            <Icon className={cn('size-3.5 shrink-0', active ? 'text-indigo-300' : 'text-muted-foreground/80')} />
            <span className="min-w-0 flex-1 truncate">{layer.name}</span>
            {editedLayerIds.has(layer.id) && <Pencil title="Edited" className="size-3 shrink-0 text-violet-300" />}
            {drifted[layer.id] && <span title="Drifts from Original Design" className="size-1.5 shrink-0 rounded-full bg-violet-400" />}
          </button>
        )
      })}
    </div>
  )
}

function EmptyTab({ text }) {
  return <p className="p-6 text-center text-xs text-muted-foreground">{text}</p>
}

const TABS = [
  ['merges', 'Merges', GitMerge],
  ['files', 'Files', Files],
  ['layers', 'Layers', Layers],
]

// Merge Studio's left-side chrome, floating over the full-width canvas:
// a standalone `← Workspace` pill pinned top-left, and below it the Merge
// List as a glass window (backdrop blur, translucent surface, soft indigo
// edge glow — the same family as the Block Deck and Changes log) with
// Merges / Files / Layers tabs. It collapses to a small pill; clicking the
// canvas collapses it too. Filters in Merges are one row of dropdown chips
// (Status / Conflict / Due), each a multi-select menu.
function MergeListSidebar({ item, files = [], frame, selectedLayerId, selectedFileId, manualCode, editedLayerIds = new Set() }) {
  const {
    mergeItems,
    selectedMergeItemId,
    setSelectedMergeItemId,
    startMergeFromOpenFiles,
    mergeListCollapsed,
    setMergeListCollapsed,
    exitMergeStudio,
    requestMergeFocus,
  } = useWorkspace()
  const [confirmExitOpen, setConfirmExitOpen] = useState(false)
  const [tab, setTab] = useState('merges')
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
    <>
      {/* Top-left row: exit, then the Merge List toggle — both always
          present, with a comfortable gap. The toggle is click-only (no
          hover flyout, no auto-close): the window stays open until it's
          toggled here or closed from its own header. */}
      <div className="absolute top-3 left-4 z-40 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setConfirmExitOpen(true)}
          className={cn('flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-semibold text-foreground transition-colors hover:bg-muted', FLOATING_PILL)}
        >
          <ArrowLeft className="size-3.5" />
          Workspace
        </button>
        <button
          type="button"
          onClick={() => setMergeListCollapsed((v) => !v)}
          aria-pressed={!mergeListCollapsed}
          title={mergeListCollapsed ? 'Show Merge List' : 'Hide Merge List'}
          className={cn(
            'flex h-9 items-center gap-2 rounded-full pr-2 pl-3 text-xs font-medium transition-colors',
            FLOATING_PILL,
            mergeListCollapsed ? 'text-foreground hover:bg-muted' : 'border-indigo-500/40 bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/25'
          )}
        >
          {mergeListCollapsed ? <PanelLeftOpen className="size-3.5 text-indigo-400" /> : <PanelLeftClose className="size-3.5 text-indigo-300" />}
          Merge List
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-500 px-1.5 text-[10px] font-semibold text-white tabular-nums">
            {mergeItems.length}
          </span>
        </button>
      </div>

    <div
      // Floating glass window that slides/fades over the canvas (transform
      // only), so toggling it never shifts the canvas or its centered
      // floating controls.
      aria-hidden={mergeListCollapsed}
      inert={mergeListCollapsed}
      className={cn(
        'absolute top-[60px] bottom-4 left-4 z-30 flex w-72 flex-col overflow-hidden rounded-2xl transition-[translate,opacity] duration-300 ease-in-out will-change-transform',
        FLOATING_PANEL,
        mergeListCollapsed ? 'pointer-events-none -translate-x-[110%] opacity-0' : 'translate-x-0 opacity-100'
      )}
    >
      <div className="flex h-full min-w-72 flex-1 flex-col">
      <div className="flex shrink-0 flex-col gap-3 border-b border-white/10 px-4 pt-3.5 pb-3">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm leading-tight font-semibold text-foreground">
            Merge List
            <span className="rounded-full bg-indigo-500/15 px-1.5 text-[10px] font-semibold text-indigo-300 tabular-nums">
              {visible.length}
            </span>
          </p>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              title="Hide Merge List"
              onClick={() => setMergeListCollapsed(true)}
              className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
            >
              <PanelLeftClose className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Merges / Files / Layers */}
        <div className="flex gap-1 rounded-full bg-black/25 p-1 ring-1 ring-white/5">
          {TABS.map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-xs font-medium transition-colors',
                tab === id ? 'bg-indigo-500 text-white shadow-sm shadow-indigo-500/30' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>

        {tab === 'merges' && (
        <div className="flex flex-col gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search merge items..."
            className="h-9 w-full rounded-full border border-white/10 bg-black/25 pr-3 pl-9 text-sm outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <FilterChip label="Status" options={mergeFilterTags} value={statusFilter} onChange={setStatusFilter} />
          <FilterChip label="Conflict" options={mergeConflictLevels} value={conflictFilter} onChange={setConflictFilter} />
          <FilterChip label="Due" options={mergeDueFilters} value={dueFilter} onChange={setDueFilter} />
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <RotateCcw className="size-3" />
            Reset filters
          </button>
        )}
        </div>
        )}
        {tab !== 'merges' && item && (
          <p className="truncate text-[11px] text-muted-foreground">
            In <span className="font-medium text-foreground">{item.title}</span>
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {tab === 'merges' ? (
          <div className="space-y-3 px-4 py-4">
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
        ) : !item ? (
          <EmptyTab text="Open a merge item to browse its files and layers." />
        ) : tab === 'files' ? (
          <FilesTab
            item={item}
            files={files}
            manualCode={manualCode}
            activeFileId={selectedFileId}
            onOpen={(f, line) => requestMergeFocus({ itemId: item.id, fileId: f.id, line, keepDeck: true, label: f.name })}
          />
        ) : (
          <LayersTab
            item={item}
            frame={frame}
            selectedLayerId={selectedLayerId}
            editedLayerIds={editedLayerIds}
            onSelect={(layerId) => requestMergeFocus({ itemId: item.id, layerId, keepDeck: true, label: layerId })}
          />
        )}
      </div>

      {tab === 'merges' && (
      <div className="shrink-0 border-t border-white/10 p-4">
        <button
          type="button"
          onClick={startMergeFromOpenFiles}
          className="flex w-full items-center justify-center gap-1.5 rounded-full bg-indigo-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-400"
        >
          <FilePlus2 className="size-3.5" />
          Add Files to Merge
        </button>
      </div>
      )}
      </div>
    </div>
      {conflictItem && (
        <ConflictResolutionModal
          item={mergeItems.find((i) => i.id === conflictItem.id) ?? conflictItem}
          onClose={() => setConflictItem(null)}
        />
      )}

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
    </>
  )
}

export default MergeListSidebar
