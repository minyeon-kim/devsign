import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ChartLine,
  CircleDot,
  CircleUser,
  FilePlus2,
  Frame,
  Image,
  PanelBottom,
  PanelTop,
  Pencil,
  RectangleHorizontal,
  Search,
  Square,
  Table,
  Tag,
  TextCursorInput,
  ToggleRight,
  Type,
  ChevronRight,
} from 'lucide-react'
import { cn } from 'cn'
import { allPeople, codeMergeVariants, designMergeVariants } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { ActiveFilterChips, MergeFilterButton } from '@/components/mergestudio/MergeFilterMenu'
import { EMPTY_FILTERS, dueDateOf, matchesFilters, peopleOnItem } from '@/components/mergestudio/mergeFilters'
import { itemSeverity } from '@/components/mergestudio/mergeSummary'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { SeverityPill } from '@/components/mergestudio/ConflictTag'
import {
  AVATAR_RING,
  AVATAR_RING_ON_ACTIVE,
  AVATAR_RING_ON_HOVER,
  CATEGORY_TAB,
  CATEGORY_TAB_ACTIVE,
  CATEGORY_TAB_IDLE,
  COUNT_BADGE,
  FLOATING_PANEL,
  FLOATING_PILL,
  PANEL_RADIUS,
  PANEL_ROWS,
  PANEL_SURFACE,
  SEVERITY_BADGE,
  SEVERITY_COL,
} from '@/components/mergestudio/floatingStyles'

// Merge List spacing grid — one set of numbers for the whole panel:
//   inset 20px (px-5) for header and content; 12px inside grouped
//   surfaces (px-3); 16px between groups (space-y-4); 8px from a group label
//   to its surface (mb-2); controls 28px (h-7) or 32px (h-8).
// Grouped surface: a subtle tonal lift + hairline ring, so sections and
// lists read as containers without heavy boxes (shared with the Block Deck).
const GROUP_SURFACE = PANEL_SURFACE

// Merge List sections, in the order that needs attention first. Anything
// with an unexpected status lands in "Other".
const WORKFLOW_GROUPS = [
  { id: 'review', label: 'Needs review', tags: ['Needs Review'], dot: 'bg-emerald-300' },
  // PR opened from Merge Changes, waiting on its reviewers' approval.
  { id: 'inreview', label: 'In review', tags: ['In Review'], dot: 'bg-emerald-200/60' },
  { id: 'progress', label: 'In progress', tags: ['In Progress'], dot: 'bg-emerald-500/60' },
  { id: 'draft', label: 'Draft', tags: ['Draft'], dot: 'bg-slate-400' },
  { id: 'merged', label: 'Merged', tags: ['Merged'], dot: 'bg-slate-600' },
  { id: 'other', label: 'Other', tags: null, dot: 'bg-slate-600' },
]
const KNOWN_TAGS = new Set(WORKFLOW_GROUPS.flatMap((g) => g.tags ?? []))



// One merge item. Sidebar icon grid, shared by both navigation levels
// (list cards, the item summary, Files rows, the Layers frame row): the
// leading 16px icon sits 12px inside the group surface, text starts 12px
// after it — so icons and titles line up exactly from level to level
// (layer rows step in by 12px per depth). A card is two lines — title,
// then change status; the open item gets a soft surface and the left
// accent bar.
//
// The item's direct change status, in one phrase: how many design
// elements drift and how many code lines change ("5 drifts · 1 code
// change" — "drifts" as in the Compare tab), or "No changes yet".
function changeStatus(item) {
  const design = Object.keys(designMergeVariants[item.id]?.layerDiffs ?? {}).length
  const code = Object.values(codeMergeVariants[item.id] ?? {}).reduce((n, lines) => n + lines.length, 0)
  const parts = [
    design > 0 && `${design} drift${design === 1 ? '' : 's'}`,
    code > 0 && `${code} code change${code === 1 ? '' : 's'}`,
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'No changes yet'
}

// Everything else about the item — files, due date, conflict level,
// people — lives in the tooltip (and still drives the filters), so the
// card itself reads as just title + change status.
function itemTooltip(item) {
  const people = peopleOnItem(item)
    .map((p) => allPeople.find((x) => x.id === p.id)?.name)
    .filter(Boolean)
  return [
    item.title,
    item.subtitle,
    item.dueBucket !== 'none' && item.dueLabel,
    itemSeverity(item) && `Conflict (highest drift): ${itemSeverity(item).level}`,
    people.length && `People: ${people.join(', ')}`,
    `Updated ${item.updatedLabel}`,
  ]
    .filter(Boolean)
    .join('\n')
}

// Reviewers, compact: up to two 16px avatars (left-most on top, soft
// surface-colored rings) and a "+N" for the rest; the tooltip names
// everyone with their role.
const MINI_AVATAR = cn('relative flex size-4 shrink-0 items-center justify-center rounded-full text-[7px] font-semibold', AVATAR_RING)

function MiniPeople({ item }) {
  const people = peopleOnItem(item)
    .map((p) => ({ ...p, person: allPeople.find((x) => x.id === p.id) }))
    .filter((p) => p.person)
  if (!people.length) return null
  const shown = people.slice(0, 2)
  const extra = people.length - shown.length
  return (
    <Tooltip>
      <TooltipTrigger render={<span />} aria-label={people.map((p) => `${p.person.name} (${p.role})`).join(', ')} className="flex shrink-0 items-center -space-x-1">
        {shown.map(({ id, person }, i) => (
          <span key={id} style={{ zIndex: shown.length + 1 - i }} className={cn(MINI_AVATAR, 'text-white', person.colorClass)}>
            {person.initials}
          </span>
        ))}
        {extra > 0 && (
          <span style={{ zIndex: 1 }} className={cn(MINI_AVATAR, 'w-auto min-w-4 bg-[#3b3b42] px-0.5 font-medium text-slate-200 tabular-nums')}>
            +{extra}
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent side="top" className="flex-col items-stretch gap-1 px-2.5 py-2">
        {people.map(({ id, person, role }) => (
          <span key={id} className="flex items-center gap-1.5 text-xs">
            <span className={cn('flex size-4 shrink-0 items-center justify-center rounded-full text-[7px] font-semibold text-white', person.colorClass)}>{person.initials}</span>
            <span className="font-medium">{person.name}</span>
            <span className="opacity-60">{role}</span>
          </span>
        ))}
      </TooltipContent>
    </Tooltip>
  )
}

// A merge item as a small grid — the type icon centered against both
// lines, the text column, a right-aligned signal column, then the drill
// cue:
//   [icon]  title ·························· reviewers   [›]
//           N drifts · N code changes ······ severity
// The severity badge is the item's HIGHEST drift severity (see
// itemSeverity), i.e. its overall merge risk; its tooltip says which drift
// sets it.
function MergeItemBody({ item, trailing, titleClassName }) {
  const status = changeStatus(item)
  const severity = itemSeverity(item)
  return (
    // [severity] title (full width)
    //            N drifts · N code changes ·· reviewers
    <span className={cn('grid min-w-0 flex-1 items-center gap-x-3 gap-y-1.5', trailing ? 'grid-cols-[46px_minmax(0,1fr)_auto]' : 'grid-cols-[46px_minmax(0,1fr)]')}>
      <span className={cn('row-span-2 flex items-center', SEVERITY_COL)}>
        {severity && (
          <SeverityPill level={severity.level} title={`Highest drift severity: ${severity.level} — set by ${severity.source}`} className={SEVERITY_BADGE} />
        )}
      </span>
      <span className={cn('min-w-0 truncate text-[13px] leading-5 font-medium text-[#FFFFFF]', titleClassName)}>{item.title}</span>
      {trailing && <span className="row-span-2 flex items-center">{trailing}</span>}
      <span className="flex min-w-0 items-center gap-2.5">
        <span className="min-w-0 flex-1 truncate text-[11px] leading-4 text-slate-400">{status}</span>
        <MiniPeople item={item} />
      </span>
    </span>
  )
}

function MergeItemCard({ item, active, onSelect }) {
  return (
    <button
      type="button"
      title={itemTooltip(item)}
      aria-current={active ? 'true' : undefined}
      onClick={() => onSelect(item.id)}
      className={cn(
        // 12px sides (the panel grid); the body lays itself out as a grid.
        'group/card relative flex w-full items-center px-3 py-3.5 text-left transition-colors focus-visible:bg-white/[0.04] focus-visible:outline-none',
        // The item loaded in the center comparison: a soft surface plus the
        // left accent bar, so it's unmistakable at a glance.
        active ? cn('bg-white/[0.06]', AVATAR_RING_ON_ACTIVE) : cn('hover:bg-white/[0.03]', AVATAR_RING_ON_HOVER)
      )}
    >
      {/* The whole card opens the item (files & layers) — no chevron. */}
      <MergeItemBody item={item} />
    </button>
  )
}

// The open item's files (plus Merge Studio's copy.json), shown in its
// drill-down view, each with incoming-change and hand-edit counts. Clicking
// one jumps the code window to its first change.
function FilesList({ item, files, manualCode, activeFileId, onOpen }) {
  if (!files.length) return <DetailEmpty text="This merge item has no files." />
  return (
    <div className="space-y-px p-1">
      {files.map((f) => {
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
            // One concise line: icon · file name · change count. The path
            // is in the tooltip.
            title={f.path}
            className={cn(
              'flex h-9 w-full items-center gap-3 rounded-lg px-2 text-left transition-colors',
              active ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'
            )}
          >
            <span className="min-w-0 flex-1 truncate text-[13px] text-slate-100">{f.name}</span>
            {/* Counts spelled out ("2 changes", "1 edit") as plain colored
                text — no pills, no ambiguous "+N". */}
            {(incoming.length > 0 || edits.length > 0) && (
              <span className="flex shrink-0 items-center gap-2 text-[11px] font-medium whitespace-nowrap tabular-nums">
                {incoming.length > 0 && (
                  <span title="Incoming changes from the Current Implementation" className="text-emerald-400">
                    {incoming.length} change{incoming.length === 1 ? '' : 's'}
                  </span>
                )}
                {edits.length > 0 && (
                  <span title="Lines edited by hand" className="flex items-center gap-1 text-emerald-200">
                    <Pencil className="size-2.5" />
                    {edits.length} edit{edits.length === 1 ? '' : 's'}
                  </span>
                )}
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

// The open item's layer tree, in its drill-down view. Violet dot = drifts
// from the Original Design, pencil = edited here (Assemble or text);
// clicking selects the layer on the canvas and pans to it.
function LayersList({ item, frame, selectedLayerId, editedLayerIds, onSelect }) {
  if (!frame) return <DetailEmpty text="This merge item has no design page." />
  const drifted = designMergeVariants[item.id]?.layerDiffs ?? {}
  const rows = layerTree(frame.layers)
  return (
    <div className="p-1">
      <div className="flex h-8 items-center gap-3 px-2 text-xs font-medium text-slate-300">
        <Frame className="size-4 shrink-0 text-emerald-400" />
        <span className="truncate">{frame.name}</span>
      </div>
      <div className="space-y-px">
      {rows.map(({ layer, depth }) => {
        const Icon = LAYER_ICONS[layer.type] ?? Square
        const active = selectedLayerId === layer.id
        return (
          <button
            key={layer.id}
            ref={active ? revealRow : undefined}
            type="button"
            onClick={() => onSelect(layer.id)}
            title={drifted[layer.id] ? `${layer.name} — drifts from the Original Design` : layer.name}
            style={{ paddingLeft: 8 + (depth + 1) * 12 }}
            className={cn(
              'flex h-8 w-full items-center gap-3 rounded-lg pr-2 text-left text-[13px] transition-colors',
              active ? 'bg-white/[0.08] text-[#FFFFFF]' : 'text-slate-300 hover:bg-white/[0.04] hover:text-white'
            )}
          >
            <Icon className={cn('size-4 shrink-0', active ? 'text-emerald-300' : 'text-slate-500')} />
            <span className="min-w-0 flex-1 truncate">{layer.name}</span>
            {editedLayerIds.has(layer.id) && <Pencil title="Edited" className="size-3 shrink-0 text-emerald-200" />}
          </button>
        )
      })}
      </div>
    </div>
  )
}

function DetailEmpty({ text }) {
  return <p className="px-2 py-4 text-center text-xs text-slate-500">{text}</p>
}

// The drill-down view pushed in when a merge item is opened: the item
// itself as a header card (same 3-tier layout as its list card), then its
// Files and Layers behind a small switch — on the same 20 / 12 / 16 / 8px
// grid and type scale as the list view.
const DETAIL_VIEWS = [
  ['files', 'Files'],
  ['layers', 'Layers'],
]

function ItemDetailView({ item, files, frame, view, flashView, onView, selectedLayerId, selectedFileId, manualCode, editedLayerIds, onOpenFile, onSelectLayer }) {
  const counts = { files: files.length, layers: frame ? layerTree(frame.layers).length : 0 }
  return (
    <div className="space-y-4 px-5 pt-1 pb-5">
      {/* The drill-down's heading: title + change status, like the card. */}
      <div title={itemTooltip(item)} className="flex pt-1">
        <MergeItemBody item={item} titleClassName="text-sm font-semibold" />
      </div>
      <section>
        <div className="mb-2 flex h-7 items-center gap-1">
          {DETAIL_VIEWS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={view === id}
              onClick={() => onView(id)}
              className={cn(
                CATEGORY_TAB,
                'gap-1.5 transition-[background-color,color,box-shadow] duration-300',
                view === id ? CATEGORY_TAB_ACTIVE : CATEGORY_TAB_IDLE,
                flashView === id && 'shadow-[0_0_0_3px_rgba(52,211,153,0.35)]'
              )}
            >
              {label}
              <span className="text-[11px] text-slate-500 tabular-nums">{counts[id]}</span>
            </button>
          ))}
        </div>
        <div className={GROUP_SURFACE}>
          {view === 'files' ? (
            <FilesList item={item} files={files} manualCode={manualCode} activeFileId={selectedFileId} onOpen={onOpenFile} />
          ) : (
            <LayersList item={item} frame={frame} selectedLayerId={selectedLayerId} editedLayerIds={editedLayerIds} onSelect={onSelectLayer} />
          )}
        </div>
      </section>
    </div>
  )
}

// Merge Studio's left-side chrome, floating over the full-width canvas:
// a standalone `← Workspace` pill pinned top-left, and below it the Merge
// List as a glass window (backdrop blur, translucent surface, soft
// edge glow — the same family as the Block Deck and Changes log). It is a
// two-level navigation stack: the list (search, filters, status sections)
// and, pushed in when an item is opened, that item's Files / Layers with a
// "Back to Merge List" header. It collapses to a small pill; clicking the
// canvas collapses it too.
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
  // Navigation stack: 'list' or 'detail' (the open item's Files / Layers).
  // `navDir` picks the slide direction — forward pushes in from the right,
  // back returns from the left; null (first render) doesn't animate.
  const [stack, setStack] = useState('list')
  const [navDir, setNavDir] = useState(null)
  const [detailView, setDetailView] = useState('files')
  const inDetail = stack === 'detail' && Boolean(item)
  function push() {
    setNavDir('forward')
    setStack('detail')
  }
  function pop() {
    setNavDir('back')
    setStack('list')
  }
  // Context-aware view: clicking a design element shows Layers, a code line
  // shows Files (pushing the item's view in if the list is showing). Only switches when the
  // view actually changes, and marks it with a brief highlight so the
  // change is noticed rather than jarring.
  const [flashView, setFlashView] = useState(null)
  const lastFocus = useRef(null)
  useEffect(() => {
    if (!focusTab || !item || lastFocus.current === focusTab.nonce) return
    lastFocus.current = focusTab.nonce
    if (stack !== 'detail') push()
    if (detailView === focusTab.tab) return
    setDetailView(focusTab.tab)
    setFlashView(focusTab.tab)
    const t = setTimeout(() => setFlashView(null), 900)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTab?.nonce])
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  // Collapsed Merge List sections — Merged starts folded away.
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set(['merged']))

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
          // Straight back, no confirmation wall — merge progress is kept
          // in the workspace state either way.
          onClick={exitMergeStudio}
          className={cn('flex h-10 items-center justify-center gap-2 rounded-full px-4.5 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted', FLOATING_PILL)}
        >
          <ArrowLeft className="size-4" />
          Workspace
        </button>
        <button
          type="button"
          data-guide="merge-list-toggle"
          onClick={() => setMergeListCollapsed((v) => !v)}
          aria-pressed={!mergeListCollapsed}
          title={mergeListCollapsed ? 'Show Merge List' : 'Hide Merge List'}
          className={cn(
            // Solid surface — no glass / backdrop blur: an opaque neutral
            // dark pill with a hairline edge. Open = a slightly lifted
            // neutral tone (the mint count badge carries the accent).
            'flex h-10 items-center justify-center gap-2 rounded-full border border-white/10 pr-3 pl-4 text-[13px] font-medium shadow-lg shadow-black/30 transition-colors',
            mergeListCollapsed
              ? 'bg-[#1b1b1f] text-slate-200 hover:bg-[#232328] hover:text-white'
              : 'border-white/15 bg-[#2a2a30] text-white hover:bg-[#303036]'
          )}
        >
          Merge List
          <span className={cn(COUNT_BADGE, 'bg-emerald-400 text-slate-950')}>
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
        'absolute top-[60px] left-4 z-30 flex max-h-[calc(100%-76px)] w-[304px] flex-col overflow-hidden transition-[translate,opacity] duration-300 ease-in-out will-change-transform',
        PANEL_RADIUS,
        FLOATING_PANEL,
        mergeListCollapsed ? 'pointer-events-none -translate-x-[110%] opacity-0' : 'translate-x-0 opacity-100'
      )}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* View 1 — the list. Kept mounted (just hidden) while an item's view
          is pushed in, so search, filters, folded sections and scroll
          position are all still there on the way back. */}
      <div
        className={cn(
          'min-h-0 flex-1 flex-col',
          inDetail ? 'hidden' : 'flex',
          navDir === 'back' && 'animate-in fade-in slide-in-from-left-4 duration-200'
        )}
      >
      {/* No title row: the top "Merge List" pill (with its count) already
          names this panel, so it opens straight onto search and filters —
          20px in from the top, the same as the sides. */}
      <div className="scroll-fade-bottom min-h-0 flex-1 overflow-auto">
          <div className="space-y-4 px-5 pt-5 pb-5">
            {/* Search and a single Filter button on one row, straight in the
                panel's flow (no box around them); what's filtered shows as
                removable chips below, only when set. */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-slate-500" />
                  <input
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value)
                      onExplore?.()
                    }}
                    placeholder="Search…"
                    className="h-8 w-full rounded-full bg-white/[0.05] pr-3 pl-9 text-[13px] text-white outline-none placeholder:text-slate-500 focus:bg-white/[0.08] focus:ring-1 focus:ring-white/20"
                  />
                </div>
                <MergeFilterButton value={filters} onChange={changeFilters} items={mergeItems} markedDays={dueDays} />
                {/* Add files lives with the list's own controls. */}
                <button
                  type="button"
                  data-guide="add-files"
                  title="Add files — start a merge item from your open files"
                  aria-label="Add files"
                  onClick={startMergeFromOpenFiles}
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/[0.05] text-slate-300 transition-colors hover:bg-white/[0.09] hover:text-white"
                >
                  <FilePlus2 className="size-4" />
                </button>
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


            <div data-guide="merge-items" className="space-y-4">
            {visible.length === 0 && (
              <p className={cn(GROUP_SURFACE, 'py-6 text-center text-[13px] text-slate-400')}>No merge items match these filters.</p>
            )}
            {/* Grouped by workflow status (what needs you first), each a
                small collapsible section with a count — not one flat list. */}
            {WORKFLOW_GROUPS.map((g) => {
              const groupItems = visible.filter((it) => (g.tags ? g.tags.includes(it.tag) : !KNOWN_TAGS.has(it.tag)))
              if (!groupItems.length) return null
              const open = !collapsedGroups.has(g.id)
              return (
                <section key={g.id}>
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() =>
                      setCollapsedGroups((prev) => {
                        const next = new Set(prev)
                        if (next.has(g.id)) next.delete(g.id)
                        else next.add(g.id)
                        return next
                      })
                    }
                    // Structural guidepost: stronger than row metadata —
                    // semibold, light, a clear dot — with a quiet count.
                    className="group/section mb-2 flex h-7 w-full items-center gap-2 text-[13px] font-semibold text-slate-200 transition-colors hover:text-white"
                  >
                    <ChevronRight className={cn('size-3.5 text-slate-500 transition-transform', open && 'rotate-90')} />
                    {g.label}
                    <span className="font-medium text-slate-500 tabular-nums">{groupItems.length}</span>
                  </button>
                  {open && (
                    // The section's items on one grouped surface, split by hairlines.
                    <div className={cn(GROUP_SURFACE, PANEL_ROWS)}>
                      {groupItems.map((it) => (
                            <MergeItemCard
                              key={it.id}
                              item={it}
                              active={selectedMergeItemId === it.id}
                              onSelect={() => {
                                setSelectedMergeItemId(it.id)
                                push()
                                onExplore?.()
                              }}
                            />
                      ))}
                    </div>
                  )}
                </section>
              )
            })}
            </div>
          </div>
      </div>
      </div>

      {/* View 2 — the open item's Files / Layers, pushed in from the right. */}
      {inDetail && (
        <div className={cn('flex min-h-0 flex-1 flex-col', navDir === 'forward' && 'animate-in fade-in slide-in-from-right-4 duration-200')}>
          <div className="flex h-11 shrink-0 items-end px-5 pb-1">
            <button
              type="button"
              onClick={pop}
              // A quiet breadcrumb, not a heading: small muted text that only
              // brightens on hover, so the item's own title below leads.
              // The negative margin keeps the arrow on the 20px inset line.
              className="group/back -ml-1.5 flex h-7 items-center gap-1.5 rounded-full pr-2.5 pl-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-white/[0.04] hover:text-slate-200"
            >
              <ArrowLeft className="size-3.5 shrink-0 transition-transform group-hover/back:-translate-x-0.5" />
              Back to Merge List
            </button>
          </div>
          <div className="scroll-fade-bottom min-h-0 flex-1 overflow-auto">
            <ItemDetailView
              item={item}
              files={files}
              frame={frame}
              view={detailView}
              flashView={flashView}
              onView={(v) => {
                setDetailView(v)
                onExplore?.()
              }}
              selectedLayerId={selectedLayerId}
              selectedFileId={selectedFileId}
              manualCode={manualCode}
              editedLayerIds={editedLayerIds}
              onOpenFile={(f, line) => requestMergeFocus({ itemId: item.id, fileId: f.id, line, keepDeck: true, label: f.name })}
              onSelectLayer={(layerId) => requestMergeFocus({ itemId: item.id, layerId, keepDeck: true, label: layerId })}
            />
          </div>
        </div>
      )}

      </div>
    </div>
    </>
  )
}

export default MergeListSidebar
