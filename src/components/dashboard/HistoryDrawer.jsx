import { ContextMenu } from '@base-ui/react/context-menu'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from '@/i18n/toast'
import { Archive, Check, ChevronDown, RotateCcw, Search, Sparkles, TriangleAlert, X } from 'lucide-react'
import { cn } from 'cn'
import RollbackCheckpointModal from '@/components/history/RollbackCheckpointModal'
import { useSelectedCheckpoint } from '@/components/history/useSelectedCheckpoint'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { allPeople } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { TRUNK, branchColors, branchGraph, branchNames, foldConflictCheckpoints, withBranches } from '@/lib/historyBranches'
import { useLanguage } from '@/i18n/language'
import { LocalizedText } from '@/i18n/runtime'
import { translateText } from '@/i18n/translate'
import { HISTORY_KINDS, KIND_ICON, KIND_LABEL, KIND_TONE, historyMeta, historyTargets, filterHistoryEntries } from '@/lib/historyMeta'

// The branch graph beside the list (Git-graph style), one slice per row:
// a vertical lane per branch in that branch's color, the checkpoint as a
// dot on its lane, and a curve where a branch leaves the trunk or comes
// back into it. The current branch's lane is drawn heavier. Rows are a
// fixed height, so the slices join up exactly.
// Every row is a title line and its branch line.
const ROW_HEIGHT = 46
const LANE_GAP = 12
const LANE_X = 9
const DOT_Y = 16
// The drawer's own surface: a checkpoint that isn't the current one is a
// ring of its branch's color around it.
const GRAPH_BG = 'var(--background)'

function GraphRow({ row, lanes, colors, currentBranch, selected, current, height }) {
  const x = (lane) => LANE_X + lane * LANE_GAP
  const stroke = (name) => ({ stroke: colors.get(name), strokeWidth: name === currentBranch ? 2.5 : 1.5 })
  const color = colors.get(row.lanes[row.lane]?.name)
  return (
    // `block`: an inline svg would sit on the text baseline and leave a
    // hairline gap under each row, breaking the lanes between items.
    <svg aria-hidden width={LANE_X * 2 + (lanes - 1) * LANE_GAP} height={height} className="block shrink-0" fill="none" strokeLinecap="round">
      {row.lanes.map((lane, index) => lane && (
        <g key={index} {...stroke(lane.name)}>
          {/* Newer is up. A lane passing through runs edge to edge; the
              checkpoint's own lane runs to its dot from whichever side it
              continues on. Lines overshoot the row by half a pixel so
              neighbouring slices overlap instead of leaving a seam. */}
          {!lane.dot && <path d={`M ${x(index)} -0.5 L ${x(index)} ${height + 0.5}`} />}
          {lane.dot && lane.up && <path d={`M ${x(index)} -0.5 L ${x(index)} ${DOT_Y}`} />}
          {lane.dot && lane.down && row.fork?.lane !== index && <path d={`M ${x(index)} ${DOT_Y} L ${x(index)} ${height + 0.5}`} />}
        </g>
      ))}
      {/* A branch starting here curves out of the trunk below… */}
      {row.fork && <path {...stroke(row.fork.name)} d={`M ${x(0)} ${height + 0.5} C ${x(0)} ${height - 8}, ${x(row.fork.lane)} ${DOT_Y + 14}, ${x(row.fork.lane)} ${DOT_Y}`} />}
      {/* …and a merged one curves from its lane into this trunk checkpoint. */}
      {row.merges.map((merge) => (
        <path key={merge.lane} {...stroke(merge.name)} d={`M ${x(merge.lane)} ${height + 0.5} C ${x(merge.lane)} ${height - 8}, ${x(row.lane)} ${DOT_Y + 14}, ${x(row.lane)} ${DOT_Y}`} />
      ))}
      {/* The checkpoint: a ring in its branch's color; filled when it's
          the current one; larger, with a halo, when it's selected. */}
      {selected && <circle cx={x(row.lane)} cy={DOT_Y} r="8" fill={color} opacity="0.22" />}
      <circle cx={x(row.lane)} cy={DOT_Y} r={selected ? 5 : 3.5} fill={current ? color : GRAPH_BG} stroke={color} strokeWidth="2" />
    </svg>
  )
}

// "Yesterday, 5:20 PM" → "Yesterday": the day is enough in the list; the
// full time is on hover and in the viewer.
// Translated first, so the day that's left reads in the viewer's language
// ("Mon, 2:10 PM" → "월요일 오후 2:10" → "월요일").
function shortTime(timestamp, language) {
  const text = translateText(String(timestamp ?? ''), language)
  const day = text.replace(/,? \d{1,2}:\d{2} (AM|PM)$/, '').replace(/ ?(오전|오후) \d{1,2}:\d{2}$/, '')
  return day || text
}

// A checkpoint's kind as a small icon badge, so the list reads at a glance
// without opening the row — Edit / AI edit / Merged / Rollback / Conflict
// detected each get their own icon + color (see lib/historyMeta).
function KindBadge({ kind }) {
  const Icon = KIND_ICON[kind]
  if (!Icon) return null
  return (
    <span title={KIND_LABEL[kind]} className={cn('flex size-4 shrink-0 items-center justify-center', KIND_TONE[kind])}>
      <Icon className="size-3" />
    </span>
  )
}

// Who made this checkpoint — a person's avatar, or a small sparkle for
// Devsign's own edits/sync (an `actorLabel`, see lib/historyMeta) — the
// same at-a-glance read as KindBadge, but for *who* instead of *what kind*.
function ActorAvatar({ entry }) {
  if (entry.actorLabel) {
    return (
      <span title={entry.actorLabel} className="flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300">
        <Sparkles className="size-2.5" />
      </span>
    )
  }
  const person = entry.actorId ? allPeople.find((p) => p.id === entry.actorId) : null
  if (!person) return null
  return (
    <span title={person.name} className={cn('flex size-4 shrink-0 items-center justify-center rounded-full text-[7px] leading-none font-semibold text-white', person.colorClass)}>
      {person.initials}
    </span>
  )
}

function HistoryEntryMenu({ children, entry, isCurrent, onOpen, onRestore, onArchive, onUnarchive }) {
  const itemClass = 'flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-xs outline-none data-highlighted:bg-white/10 data-disabled:opacity-40'
  return <ContextMenu.Root>
    <ContextMenu.Trigger render={children} />
    <ContextMenu.Portal>
      <ContextMenu.Positioner className="z-[1000]" sideOffset={4}>
        <ContextMenu.Popup className="min-w-40 rounded-lg bg-popover p-1 text-popover-foreground shadow-xl ring-1 ring-white/10">
          <ContextMenu.Item className={itemClass} onClick={onOpen}><LocalizedText text="Open preview" /></ContextMenu.Item>
          <ContextMenu.Item className={itemClass} disabled={isCurrent} onClick={onRestore}><RotateCcw className="size-3.5" /><LocalizedText text="Restore this state" /></ContextMenu.Item>
          <ContextMenu.Item className={itemClass} disabled={isCurrent} onClick={() => entry.archived ? onUnarchive(entry) : onArchive(entry)}><Archive className="size-3.5" /><LocalizedText text={entry.archived ? 'Restore to History' : 'Archive checkpoint'} /></ContextMenu.Item>
        </ContextMenu.Popup>
      </ContextMenu.Positioner>
    </ContextMenu.Portal>
  </ContextMenu.Root>
}

// History opens this compact list beside the current page first, with the
// project's checkpoints newest first. Clicking one shows it in
// History's main viewer — the same selection the timeline slider and
// playback move through (see useSelectedCheckpoint). Secondary actions live
// in the detail header and the row context menu.
//
// A project's checkpoints span every file/element it touches and every kind
// of change (a manual edit, an AI edit, a merge, a rollback) in one list —
// the kind pills and the target dropdown narrow that down; both apply to
// the History page's playback timeline too (shared via `historyFilter`).
function HistoryDrawer({ project }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { historyEntries, conflicts, activeHistoryId, archiveHistoryEntry, restoreHistoryEntry, currentUser, historyFilter, setHistoryFilter } = useWorkspace()
  const [selectedId, select] = useSelectedCheckpoint()
  const language = useLanguage()
  const [tab, setTab] = useState('active')
  const [query, setQuery] = useState('')
  const [rollbackId, setRollbackId] = useState(null)
  const historyPath = `/projects/${project.id}/history`
  const onHistoryPage = pathname.replace(/\/$/, '') === historyPath

  // Every checkpoint with the branch it sits on (lib/historyBranches); the
  // colors are fixed for the whole history, so a branch keeps its color
  // whatever the filters leave in view.
  // Only saved versions are rows (and nodes): a conflict's detection is a
  // mark on the version it was found on, not a checkpoint of its own.
  const branched = useMemo(() => foldConflictCheckpoints(withBranches(historyEntries, conflicts)), [historyEntries, conflicts])
  const colors = useMemo(() => branchColors(branched), [branched])
  const branches = branchNames(branched)
  // "Current" is the active checkpoint — or, when that's a conflict's
  // detection (not a version), the newest saved version.
  const currentId = branched.some((entry) => entry.id === activeHistoryId) ? activeHistoryId : branched.findLast((entry) => !entry.archived)?.id
  const currentBranch = branched.find((entry) => entry.id === currentId)?.branch ?? TRUNK
  const showConflicts = historyFilter.showConflicts ?? true
  const showResolved = historyFilter.showResolvedConflicts ?? true
  const kindFilter = historyFilter.kind === 'conflict' ? 'all' : historyFilter.kind
  const targets = historyTargets(historyEntries)
  const filtered = filterHistoryEntries(branched, { ...historyFilter, kind: kindFilter })
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  const matches = filtered.filter((entry) => {
    const text = [entry.label, entry.timestamp, entry.prompt, historyMeta(entry, currentUser.id)].filter(Boolean).join(' ').toLocaleLowerCase()
    return terms.every((term) => text.includes(term))
  })
  const active = [...matches].filter((e) => !e.archived).reverse()
  // The graph is laid out oldest → newest; the list shows it newest first.
  const graph = branchGraph([...active].reverse())
  const archived = [...matches].filter((e) => e.archived).reverse()
  const filtersActive = kindFilter !== 'all' || historyFilter.target !== 'all' || (historyFilter.branch ?? 'all') !== 'all'

  const open = (id) => {
    if (onHistoryPage) select(id)
    else navigate(`${historyPath}?v=${id}`)
  }

  // Arriving from a conflict ("Check the reasoning in History"): the
  // checkpoint it points at is selected by the link's `?v=`; here it's
  // brought into view and lit for a moment, once per arrival.
  const location = useLocation()
  const [flashId, setFlashId] = useState(null)
  const flashed = useRef(null)
  useEffect(() => {
    const target = location.state?.flashCheckpoint
    if (!target || flashed.current === location.key) return
    flashed.current = location.key
    setFlashId(target)
    requestAnimationFrame(() => refs.current.get(target)?.scrollIntoView({ block: 'center', behavior: 'smooth' }))
  }, [location.key, location.state])
  // (Its own effect, so nothing else re-running can cancel the timer.)
  useEffect(() => {
    if (!flashId) return
    const timer = window.setTimeout(() => setFlashId(null), 2400)
    return () => window.clearTimeout(timer)
  }, [flashId])

  // Keep the selected row in view as the slider / playback moves it.
  const refs = useRef(new Map())
  useEffect(() => {
    refs.current.get(selectedId)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedId])

  function archive(entry) {
    archiveHistoryEntry(entry.id)
    toast('Checkpoint archived', { description: entry.label, action: { label: 'Undo', onClick: () => restoreHistoryEntry(entry.id) } })
  }

  return (
    <div className="flex flex-col pb-2">
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          aria-label="Search project history"
          placeholder="Search history..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Escape') setQuery('') }}
          className="h-8 w-full min-w-0 appearance-none rounded-full border border-white/10 bg-[#090909] pr-8 pl-8 text-xs text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-primary/50 [&::-webkit-search-cancel-button]:appearance-none"
        />
        {query && <button type="button" aria-label="Clear history search" onClick={() => setQuery('')} className="absolute top-1/2 right-2 flex size-4 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"><X className="size-3" /></button>}
      </div>

      {/* Kind + target filters, both as dropdowns — one consistent filter
          language instead of a pill row next to a dropdown. Every
          checkpoint in this project's History, across every file it
          touched, otherwise shows in one undifferentiated list. Both also
          narrow the History page's playback timeline (see `historyFilter`
          in WorkspaceProvider). */}
      <div className="mb-2 flex flex-wrap items-center gap-x-1 gap-y-0.5 px-1">
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              'flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-medium transition-colors',
              kindFilter !== 'all' ? 'bg-white/[0.1] text-white' : 'text-slate-500 hover:text-slate-200'
            )}
          >
            {kindFilter !== 'all' && <KindBadge kind={kindFilter} />}
            <span className="truncate">{kindFilter === 'all' ? 'All kinds' : KIND_LABEL[kindFilter]}</span>
            <ChevronDown className="size-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onClick={() => setHistoryFilter({ kind: 'all' })}>All kinds</DropdownMenuItem>
            {HISTORY_KINDS.filter((kind) => kind !== 'conflict').map((kind) => (
              <DropdownMenuItem key={kind} onClick={() => setHistoryFilter({ kind })} className="gap-1.5">
                <KindBadge kind={kind} />
                {KIND_LABEL[kind]}
              </DropdownMenuItem>
            ))}
            {/* Conflicts aren't a kind of checkpoint — they're marks on
                the versions they were found on, shown or hidden here. */}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setHistoryFilter({ showConflicts: !showConflicts })} className="gap-1.5">
              <TriangleAlert className="size-3 text-amber-300" />
              <span className="flex-1">Conflict marks</span>
              {showConflicts && <Check className="size-3.5 text-slate-300" />}
            </DropdownMenuItem>
            {/* Resolved ones are quiet already; this drops them altogether. */}
            <DropdownMenuItem disabled={!showConflicts} onClick={() => setHistoryFilter({ showResolvedConflicts: !showResolved })} className="gap-1.5">
              <Check className="size-3 text-slate-400" />
              <span className="flex-1">Resolved conflicts</span>
              {showConflicts && showResolved && <Check className="size-3.5 text-slate-300" />}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {targets.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                'flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-medium transition-colors',
                historyFilter.target !== 'all' ? 'bg-white/[0.1] text-white' : 'text-slate-500 hover:text-slate-200'
              )}
            >
              <span className="max-w-24 truncate font-mono">{historyFilter.target === 'all' ? 'All files' : historyFilter.target}</span>
              <ChevronDown className="size-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => setHistoryFilter({ target: 'all' })}>All files</DropdownMenuItem>
              {targets.map((target) => (
                <DropdownMenuItem key={target} onClick={() => setHistoryFilter({ target })} className="font-mono">
                  {target}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {branches.length > 1 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                'flex h-6 min-w-0 items-center gap-1 rounded-full px-2 text-[11px] font-medium transition-colors',
                (historyFilter.branch ?? 'all') !== 'all' ? 'bg-white/[0.1] text-white' : 'text-slate-500 hover:text-slate-200'
              )}
            >
              {(historyFilter.branch ?? 'all') !== 'all' && <span className="size-1.5 shrink-0 rounded-full" style={{ background: colors.get(historyFilter.branch) }} />}
              <span translate="no" className="max-w-24 truncate font-mono">{(historyFilter.branch ?? 'all') === 'all' ? 'All branches' : historyFilter.branch}</span>
              <ChevronDown className="size-3 shrink-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => setHistoryFilter({ branch: 'all' })}>All branches</DropdownMenuItem>
              {branches.map((name) => (
                <DropdownMenuItem key={name} onClick={() => setHistoryFilter({ branch: name })} className="gap-2 font-mono">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: colors.get(name) }} />
                  <span translate="no" className="truncate">{name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {/* Archived is a view of the same list, not a second tab row. */}
        {(archived.length > 0 || tab === 'archived') && (
          <button
            type="button"
            aria-pressed={tab === 'archived'}
            onClick={() => setTab(tab === 'archived' ? 'active' : 'archived')}
            className={cn(
              'flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-medium transition-colors',
              'ml-auto',
              tab === 'archived' ? 'bg-white/[0.1] text-white' : 'text-slate-500 hover:text-slate-200'
            )}
          >
            <Archive className="size-3" />
            <span className="tabular-nums">{archived.length}</span>
          </button>
        )}
      </div>

      {tab === 'active' && active.length === 0 && (
        <p role="status" className="px-2.5 py-8 text-center text-xs text-slate-500">
          {query.trim() ? 'No matching checkpoints.' : filtersActive ? 'No checkpoints match this filter.' : 'No checkpoints yet.'}
        </p>
      )}
      {/* One quiet rail down the left — a dot per checkpoint, tinted for a
          merge or a rollback — drawn by each row itself, so it's there on
          first paint with nothing to measure. */}
      <div>
      {tab === 'active' &&
        active.map((entry, index) => {
          const isCurrent = entry.id === currentId
          const selected = onHistoryPage && entry.id === selectedId
          const meta = historyMeta(entry, currentUser.id)
          const row = graph.rows[active.length - 1 - index]
          // Every row names its branch; a merge names both ends.
          const branchLabel = entry.mergedBranches?.length ? `${entry.mergedBranches.join(', ')} → ${entry.branch}` : entry.branch ?? TRUNK
          // The conflicts this version caused: open ones, and resolved ones
          // unless they're filtered out.
          const marks = showConflicts ? (entry.conflictMarks ?? []).map((mark) => ({ ...mark, resolved: conflicts.find((c) => c.id === mark.conflictId)?.reviewStage === 'resolved' })).filter((mark) => showResolved || !mark.resolved) : []
          const openMarks = marks.filter((mark) => !mark.resolved)
          return (
            <HistoryEntryMenu key={entry.id} entry={entry} isCurrent={isCurrent}
              onOpen={() => open(entry.id)} onRestore={() => setRollbackId(entry.id)} onArchive={archive}>
            <div
              data-history-id={entry.id}
              ref={(el) => (el ? refs.current.set(entry.id, el) : refs.current.delete(entry.id))}
              className="group relative flex items-stretch"
            >
              <GraphRow row={row} lanes={graph.lanes} colors={colors} currentBranch={currentBranch} selected={selected} current={isCurrent} height={ROW_HEIGHT} />
              <div className={cn('relative min-w-0 flex-1 rounded-xl transition-colors', selected ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]', flashId === entry.id && 'history-row-arrived')}>
              <div
                // The row selects a preview; secondary actions use its context menu.
                role="button"
                tabIndex={0}
                onClick={() => open(entry.id)}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return
                  event.preventDefault()
                  open(entry.id)
                }}
                aria-current={selected ? 'true' : undefined}
                style={{ height: ROW_HEIGHT }}
                // 6px + half a 20px line = 16px: the dot's center.
                className="flex w-full cursor-pointer flex-col justify-start rounded-xl px-2.5 pt-1.5 text-left focus-visible:outline-2 focus-visible:outline-emerald-300"
              >
                {/* One line: what happened, and when — every title starts
                    at the same place. Everything else is the dot beside it,
                    the meta line under it, the hover, and the viewer. */}
                <span className="flex items-baseline gap-2">
                  <span
                    className={cn('min-w-0 flex-1 truncate text-[13px] leading-5', selected ? 'font-medium text-white' : 'text-slate-200')}
                    title={meta ? `${entry.label} — ${meta}` : entry.label}
                  >
                    {entry.label}
                  </span>
                  <span className={cn('shrink-0 text-[11px] tabular-nums', isCurrent ? 'font-medium text-emerald-300' : 'text-slate-500')}>
                    {isCurrent ? 'Current' : <span translate="no">{shortTime(entry.timestamp, language)}</span>}
                  </span>
                </span>
                {/* The meta line: its branch, in that lane's color (a merge:
                    from → to), then — only on a version that caused one —
                    the conflict: amber while it's open, a grey "Resolved"
                    once it's settled. Both remain visible while hovering. */}
                <span className="flex min-w-0 items-center gap-1.5 text-[10.5px] leading-4">
                  <span translate="no" className="min-w-0 truncate font-mono" style={{ color: colors.get(entry.branch ?? TRUNK) }}>{branchLabel}</span>
                  {marks.length > 0 && (
                    <>
                      <span aria-hidden className="text-slate-600">·</span>
                      <span
                        data-conflict-mark={openMarks.length ? 'open' : 'resolved'}
                        title={marks.map((mark) => mark.label).join(' · ')}
                        className={cn('ds-intrinsic inline-flex h-4 shrink-0 items-center gap-0.5 rounded font-medium', openMarks.length ? 'text-amber-300' : 'text-slate-500')}
                      >
                        {openMarks.length ? <TriangleAlert className="size-3" /> : <Check className="size-3" />}
                        <LocalizedText text={openMarks.length ? 'Conflict' : 'Resolved'} />
                        {(openMarks.length || marks.length) > 1 && <span className="tabular-nums">{openMarks.length || marks.length}</span>}
                      </span>
                    </>
                  )}
                </span>
              </div>
              </div>
            </div>
            </HistoryEntryMenu>
          )
        })}

      </div>

      {tab === 'archived' &&
        (archived.length === 0 ? (
          <p role="status" className="px-2.5 py-8 text-center text-xs text-slate-500">{query.trim() ? 'No matching archived checkpoints.' : 'No archived checkpoints.'}</p>
        ) : (
          archived.map((entry) => (
            <HistoryEntryMenu key={entry.id} entry={entry} isCurrent={entry.id === currentId}
              onOpen={() => open(entry.id)} onRestore={() => setRollbackId(entry.id)} onArchive={archive}
              onUnarchive={() => {
                restoreHistoryEntry(entry.id)
                toast('Checkpoint restored to History', { description: entry.label })
              }}>
              <div role="button" tabIndex={0} onClick={() => open(entry.id)}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget || !['Enter', ' '].includes(event.key)) return
                  event.preventDefault()
                  open(entry.id)
                }}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-white/[0.035] focus-visible:outline-2 focus-visible:outline-emerald-300">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] text-slate-300">{entry.label}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500 tabular-nums">
                    <KindBadge kind={entry.kind} />
                    <ActorAvatar entry={entry} />
                    <span className="min-w-0 truncate">{entry.timestamp}</span>
                  </p>
                </div>
              </div>
            </HistoryEntryMenu>
          ))
        ))}

      <RollbackCheckpointModal
        key={rollbackId}
        entryId={rollbackId}
        onOpenChange={(isOpen) => !isOpen && setRollbackId(null)}
        onDone={(entry, restoredId) => {
          if (onHistoryPage && restoredId) select(restoredId)
        }}
      />
    </div>
  )
}

export default HistoryDrawer
