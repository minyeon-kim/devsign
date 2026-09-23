import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ChartLine,
  CircleCheck,
  CircleDot,
  CircleUser,
  FilePlus2,
  Eye,
  Files,
  Braces,
  CodeXml,
  Frame,
  GitMerge,
  Image,
  Layers,
  PanelBottom,
  PanelLeftClose,
  PanelLeftOpen,
  PanelTop,
  Pencil,
  PencilLine,
  RectangleHorizontal,
  Search,
  Square,
  Table,
  Tag,
  TextCursorInput,
  ToggleRight,
  Type,
} from 'lucide-react'
import { cn } from 'cn'
import { allPeople, codeMergeVariants, designMergeVariants, openFiles } from '@/data/mockData'
import { getFileIconMeta } from '@/lib/fileIcons'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { ActiveFilterChips, MergeFilterButton } from '@/components/mergestudio/MergeFilterMenu'
import { SeverityPill } from '@/components/mergestudio/ConflictTag'
import { EMPTY_FILTERS, dueDateOf, matchesFilters, peopleOnItem } from '@/components/mergestudio/mergeFilters'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { COUNT_BADGE, FLOATING_PANEL, FLOATING_PILL, SEGMENT_TAB } from '@/components/mergestudio/floatingStyles'

// Status as its own at-a-glance cue: an outlined pill (so it never reads as
// one of the filled severity pills beside it) with a distinct colored icon
// per state — in progress, waiting on review, draft, done.
const STATUS_STYLE = {
  'In Progress': { icon: CircleDot, iconClass: 'text-indigo-400' },
  'Needs Review': { icon: Eye, iconClass: 'text-violet-400' },
  Draft: { icon: PencilLine, iconClass: 'text-muted-foreground' },
  Merged: { icon: CircleCheck, iconClass: 'text-emerald-400' },
}

function StatusPill({ status }) {
  const style = STATUS_STYLE[status] ?? STATUS_STYLE.Draft
  const Icon = style.icon
  return (
    <span className="flex h-5 shrink-0 items-center justify-center gap-1 rounded-full px-1.5 text-[10px] font-medium whitespace-nowrap text-foreground/90 ring-1 ring-inset ring-white/15">
      <Icon className={cn('size-2.5', style.iconClass)} />
      {status}
    </span>
  )
}

// Left-hand type icon — bare, no tile: a monochrome glyph for what the merge item mainly
// is (the icon shape carries the type, not color), readable at a glance (a scaled-down screen preview was too small to
// tell apart). A code-file title (AuthModal.tsx) is code; otherwise an item
// with a design page is a design; otherwise, only token/JSON files, tokens.
const CODE_EXT = /\.(tsx|jsx|ts|js|css|py)$/i
const ITEM_TYPE = {
  code: { icon: CodeXml, label: 'Code component' },
  design: { icon: Frame, label: 'Design frame' },
  tokens: { icon: Braces, label: 'Design tokens' },
}

function itemTypeOf(item) {
  if (CODE_EXT.test(item.title)) return ITEM_TYPE.code
  if (item.hasDesign) return ITEM_TYPE.design
  const names = (item.fileIds ?? []).map((id) => openFiles.find((f) => f.id === id)?.name ?? '')
  if (names.length && names.every((n) => n.endsWith('.json'))) return ITEM_TYPE.tokens
  return ITEM_TYPE.code
}

function ItemTypeBadge({ item }) {
  const type = itemTypeOf(item)
  const Icon = type.icon
  return (
    <span title={type.label} className="mt-0.5 flex shrink-0 text-muted-foreground">
      <Icon className="size-4" />
    </span>
  )
}

// Everyone on the item — assignee, then reviewers — as overlapping avatars
// (up to three, then "+N"); hovering the stack lists each name and role.
function PeopleStack({ item }) {
  const people = peopleOnItem(item)
    .map((p) => ({ ...p, person: allPeople.find((x) => x.id === p.id) }))
    .filter((p) => p.person)
  if (!people.length) return null
  const shown = people.slice(0, 3)
  const extra = people.length - shown.length
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span />}
        aria-label={people.map((p) => `${p.person.name} (${p.role})`).join(', ')}
        className="ml-auto flex shrink-0 items-center -space-x-1.5"
      >
        {shown.map(({ id, person }) => (
          <span key={id} className={cn('flex size-5 items-center justify-center rounded-full text-[8px] font-semibold text-white ring-2 ring-slate-800', person.colorClass)}>
            {person.initials}
          </span>
        ))}
        {extra > 0 && (
          <span className="flex size-5 items-center justify-center rounded-full bg-slate-600 text-[8px] font-semibold text-white ring-2 ring-slate-800">+{extra}</span>
        )}
      </TooltipTrigger>
      <TooltipContent side="top" className="flex-col items-stretch gap-1 px-2.5 py-2">
        {people.map(({ id, person, role }) => (
          <span key={id} className="flex items-center gap-1.5 text-[11px]">
            <span className={cn('flex size-4 shrink-0 items-center justify-center rounded-full text-[7px] font-semibold text-white', person.colorClass)}>{person.initials}</span>
            <span className="font-medium">{person.name}</span>
            <span className="opacity-60">{role}</span>
          </span>
        ))}
      </TooltipContent>
    </Tooltip>
  )
}

// One scannable card, top to bottom:
//   top row — status (left) and last update (right) on their own line;
//   header  — type icon + the title, which gets the full width (ellipsis
//             only if it truly doesn't fit), then the file line;
//   footer  — conflict level (the shared SeverityPill, same as the Block
//             Deck's drift rows) and the due date (red once overdue) on the
//             left, stacked assignee/reviewer avatars on the right.
// Hover brightens the border; the open item gets the tinted active state.
function MergeItemCard({ item, active, onSelect }) {
  const hasDue = item.dueBucket !== 'none' && item.dueLabel
  return (
    <button
      type="button"
      title={item.title}
      aria-current={active ? 'true' : undefined}
      onClick={() => onSelect(item.id)}
      className={cn(
        'relative flex w-full flex-col gap-3.5 overflow-hidden rounded-xl border px-3.5 py-3.5 text-left shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:outline-none',
        // The item loaded in the center comparison: accent border + tinted
        // surface (same treatment as the Block Deck's open drift row), plus
        // a left accent bar so it's unmistakable even at a glance.
        active
          ? 'border-primary/50 bg-primary/10 ring-1 ring-inset ring-primary/30'
          : 'border-white/10 bg-slate-800/70 hover:border-white/20 hover:bg-white/5'
      )}
    >
      {active && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-primary" />}
      {/* Top mini-row: status on its own line (left) with the last update
          (right), so the title below gets the card's full width. */}
      <div className="-mb-1 flex w-full items-center justify-between gap-2">
        <StatusPill status={item.tag} />
        <span className={cn('shrink-0 text-[11px]', active ? 'text-muted-foreground' : 'text-muted-foreground/70')}>{item.updatedLabel}</span>
      </div>

      <div className="flex w-full items-start gap-2.5">
        <ItemTypeBadge item={item} />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-[13px] leading-5 font-semibold text-foreground">{item.title}</p>
          <p className={cn('truncate text-xs leading-4', active ? 'text-foreground/90' : 'text-muted-foreground')}>{item.subtitle}</p>
        </div>
      </div>

      <div className="flex w-full items-center gap-2">
        <SeverityPill level={item.conflictLevel} title={`Conflict: ${item.conflictLevel}`} />
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-[11px]',
            item.dueBucket === 'overdue' ? 'font-medium text-destructive' : active ? 'text-muted-foreground' : 'text-muted-foreground/70'
          )}
        >
          {hasDue ? item.dueLabel : null}
        </span>
        <PeopleStack item={item} />
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
    <div className="space-y-1.5 p-4">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Files · {files.length}</p>
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
            ref={active ? revealRow : undefined}
            type="button"
            onClick={() => onOpen(f, Number.isFinite(firstLine) ? firstLine : 1)}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left shadow-sm transition-colors',
              active ? 'border-primary/50 bg-primary/10 ring-1 ring-inset ring-primary/30' : 'border-white/10 bg-slate-800/70 hover:bg-white/5'
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

// Keeps the active Files/Layers row in view as the selection changes.
function revealRow(el) {
  el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
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
  const rows = layerTree(frame.layers)
  return (
    <div className="space-y-1.5 p-4">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Layers · {rows.length}</p>
      <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-800/70 shadow-sm">
      <div className="flex items-center gap-2 border-b border-white/10 bg-slate-900/60 px-3 py-2 text-xs font-semibold text-foreground">
        <Frame className="size-3.5 text-indigo-400" />
        <span className="truncate">{frame.name}</span>
      </div>
      <div className="space-y-0.5 p-1.5">
      {rows.map(({ layer, depth }) => {
        const Icon = LAYER_ICONS[layer.type] ?? Square
        const active = selectedLayerId === layer.id
        return (
          <button
            key={layer.id}
            ref={active ? revealRow : undefined}
            type="button"
            onClick={() => onSelect(layer.id)}
            style={{ paddingLeft: 10 + depth * 14 }}
            className={cn(
              'flex h-7 w-full items-center gap-2 rounded-lg pr-2.5 text-left text-xs transition-colors',
              active ? 'bg-primary/15 text-foreground ring-1 ring-inset ring-primary/30' : 'text-muted-foreground hover:bg-slate-800/60 hover:text-foreground'
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
      </div>
    </div>
  )
}

function EmptyTab({ text }) {
  return <p className="m-4 rounded-xl border border-white/10 bg-slate-800/70 p-4 text-center text-xs text-muted-foreground">{text}</p>
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
function MergeListSidebar({ item, files = [], frame, selectedLayerId, selectedFileId, manualCode, focusTab, editedLayerIds = new Set(), onExplore }) {
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
  // Context-aware tab: clicking a design element shows Layers, a code line
  // shows Files. Only switches when the tab actually changes, and marks the
  // newly shown tab with a brief highlight so the change is noticed rather
  // than jarring.
  const [flashTab, setFlashTab] = useState(null)
  const lastFocus = useRef(null)
  useEffect(() => {
    if (!focusTab || !item || lastFocus.current === focusTab.nonce) return
    lastFocus.current = focusTab.nonce
    if (tab === focusTab.tab) return
    setTab(focusTab.tab)
    setFlashTab(focusTab.tab)
    const t = setTimeout(() => setFlashTab(null), 900)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTab?.nonce])
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState(EMPTY_FILTERS)

  // Any filter change also counts as exploring the list for the onboarding
  // guide.
  function changeFilters(next) {
    setFilters(next)
    onExplore?.()
  }
  const dueDays = mergeItems.map(dueDateOf).filter(Boolean)

  const visible = mergeItems.filter((item) => {
    if (query.trim() && !item.title.toLowerCase().includes(query.trim().toLowerCase())) return false
    return matchesFilters(item, filters)
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
          className={cn('flex h-9 items-center justify-center gap-1.5 rounded-full px-4 text-xs font-semibold text-foreground transition-colors hover:bg-muted', FLOATING_PILL)}
        >
          <ArrowLeft className="size-3.5" />
          Workspace
        </button>
        <button
          type="button"
          data-guide="merge-list-toggle"
          onClick={() => setMergeListCollapsed((v) => !v)}
          aria-pressed={!mergeListCollapsed}
          title={mergeListCollapsed ? 'Show Merge List' : 'Hide Merge List'}
          className={cn(
            'flex h-9 items-center justify-center gap-2 rounded-full px-2.5 text-xs font-medium transition-colors',
            FLOATING_PILL,
            mergeListCollapsed ? 'text-foreground hover:bg-muted' : 'border-indigo-500/40 bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/25'
          )}
        >
          {mergeListCollapsed ? <PanelLeftOpen className="size-3.5 text-indigo-400" /> : <PanelLeftClose className="size-3.5 text-indigo-300" />}
          Merge List
          <span className={cn(COUNT_BADGE, 'bg-indigo-500 text-white')}>
            {mergeItems.length}
          </span>
        </button>
      </div>

    <div
      // Floating glass window that slides/fades over the canvas (transform
      // only), so toggling it never shifts the canvas or its centered
      // floating controls.
      data-guide="merge-list"
      aria-hidden={mergeListCollapsed}
      inert={mergeListCollapsed}
      className={cn(
        // Sized to its content, capped 16px above the bottom edge (then the
        // body scrolls) — not stretched to the bottom regardless of content.
        'absolute top-[60px] left-4 z-30 flex max-h-[calc(100%-76px)] w-72 flex-col overflow-hidden rounded-2xl transition-[translate,opacity] duration-300 ease-in-out will-change-transform',
        FLOATING_PANEL,
        mergeListCollapsed ? 'pointer-events-none -translate-x-[110%] opacity-0' : 'translate-x-0 opacity-100'
      )}
    >
      <div className="flex min-h-0 min-w-72 flex-1 flex-col">
      {/* Same chrome as the Block Deck: 48px title bar, 48px tab bar, then a
          one-line context strip — the two panels read as a matched pair. */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-white/10 px-4">
        <GitMerge className="size-4 shrink-0 text-indigo-500" />
        <span className="flex flex-1 items-center gap-1.5 text-sm font-semibold text-foreground">
          Merge List
          <span className={cn(COUNT_BADGE, 'bg-indigo-500/15 text-indigo-300')}>{visible.length}</span>
        </span>
        <button
          type="button"
          title="Hide Merge List"
          onClick={() => setMergeListCollapsed(true)}
          className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <PanelLeftClose className="size-4" />
        </button>
      </div>

      <div className="flex h-12 shrink-0 items-center gap-1.5 border-b border-white/10 px-2.5">
        {TABS.map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setTab(id)
              onExplore?.()
            }}
            className={cn(
              SEGMENT_TAB,
              'transition-[background-color,color,box-shadow] duration-300',
              tab === id ? 'bg-white/[0.07] text-foreground ring-1 ring-inset ring-white/15' : 'text-muted-foreground hover:bg-white/[0.04] hover:text-foreground',
              flashTab === id && 'shadow-[0_0_0_3px_rgba(165,180,252,0.35)]'
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </div>
      {/* Context line only where it tells you something: which item the
          Files / Layers tabs are showing (Merges needs no helper text). */}
      {tab !== 'merges' && (
        <p className="shrink-0 truncate border-b border-white/10 bg-slate-800/60 px-4 py-2 text-xs leading-snug text-muted-foreground">
          {item ? <>In <span className="font-medium text-foreground">{item.title}</span></> : 'No merge item open.'}
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        {tab === 'merges' ? (
          <div className="space-y-4 p-4">
            {/* Primary action first (Figma / Linear pattern): always in reach
                at the top of the tab, above search and filters. */}
            <button
              type="button"
              data-guide="add-files"
              onClick={startMergeFromOpenFiles}
              className="flex h-9 w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-4 text-xs font-semibold text-foreground transition-colors hover:border-white/25 hover:bg-white/[0.07]"
            >
              <FilePlus2 className="size-3.5" />
              Add Files to Merge
            </button>
            {/* Search and a single Filter button on one row, straight in the
                panel's flow (no box around them); what's filtered shows as
                removable chips below, only when set. */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value)
                      onExplore?.()
                    }}
                    placeholder="Search merges…"
                    className="h-9 w-full rounded-full border border-white/10 bg-slate-900 pr-3 pl-9 text-sm outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <MergeFilterButton value={filters} onChange={changeFilters} items={mergeItems} markedDays={dueDays} />
              </div>
              <ActiveFilterChips
                value={filters}
                query={query}
                shown={visible.length}
                total={mergeItems.length}
                onChange={changeFilters}
                onClearQuery={() => setQuery('')}
              />
            </div>

            <div data-guide="merge-items" className="space-y-2">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Merge Items · {visible.length}</p>
            {visible.map((item) => (
              <MergeItemCard
                key={item.id}
                item={item}
                active={selectedMergeItemId === item.id}
                onSelect={setSelectedMergeItemId}
              />
            ))}
            {visible.length === 0 && (
              <p className="rounded-xl border border-white/10 bg-slate-800/70 p-3 text-center text-xs text-muted-foreground">
                No merge items match these filters.
              </p>
            )}
            </div>
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

      </div>
    </div>
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
              className="inline-flex items-center justify-center rounded-full px-4 h-8 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmExitOpen(false)
                exitMergeStudio()
              }}
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-4 h-8 text-xs font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all hover:brightness-110"
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
