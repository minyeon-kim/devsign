import { ContextMenu } from '@base-ui/react/context-menu'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { toast } from '@/i18n/toast'
import { Archive, Check, ChevronDown, RotateCcw, TriangleAlert } from 'lucide-react'
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
import { DrawerCount, DrawerEmpty, DrawerFilters, DrawerGroup, DrawerRow, DrawerSearch, DrawerShell, DrawerSkeleton, GROUP_HEIGHT, ROW_HEIGHT, TITLE_CENTER, chipClass } from '@/components/dashboard/DrawerList'
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
const LANE_GAP = 12
const LANE_X = 9
const DOT_Y = TITLE_CENTER
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
      {selected && <circle cx={x(row.lane)} cy={DOT_Y} r="7" fill="none" stroke="white" strokeWidth="1.5" />}
      <circle cx={x(row.lane)} cy={DOT_Y} r="3" fill={current ? color : GRAPH_BG} stroke={color} strokeWidth="2" />
    </svg>
  )
}

// When a checkpoint was made, as its group and its time of day: "Yesterday,
// 5:20 PM" → the group "Yesterday" and "오후 5:20" (the day is the group's).
// A group is today, yesterday, this week, or before that.
export function stampOf(timestamp, language) {
  const text = String(timestamp ?? '')
  const comma = text.indexOf(', ')
  // (A bare time of day is today's.)
  const day = comma === -1 ? (/^\d{1,2}:\d{2} (AM|PM)$/.test(text) ? 'Today' : text) : text.slice(0, comma)
  const clock = comma === -1 ? (day === 'Today' && /\d/.test(text) ? text : '') : text.slice(comma + 2)
  const ago = /^(\d+) days? ago$/.exec(day)
  const group = day === 'Today' || day === 'Just now' ? 'Today'
    : day === 'Yesterday' ? 'Yesterday'
      : (ago && Number(ago[1]) < 7) || /^(Mon|Tues?|Wed(nes)?|Thu(rs)?|Fri|Sat(ur)?|Sun)(day)?$/.test(day) ? 'This week'
        : 'Before that'
  const match = /^(\d{1,2}:\d{2}) (AM|PM)$/.exec(clock)
  const time = match ? (language === 'ko' ? `${match[2] === 'AM' ? '오전' : '오후'} ${match[1]}` : clock) : translateText(clock || day, language)
  return { group, time }
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

// How many saved versions the project has — beside the drawer's title (the
// path over the viewer doesn't count them). Conflict detections are marks,
// not versions; archived ones are in the Archive view.
export function HistoryCount() {
  const { historyEntries, conflicts } = useWorkspace()
  const count = foldConflictCheckpoints(withBranches(historyEntries, conflicts)).filter((entry) => !entry.archived).length
  return <DrawerCount data-history-count count={count} />
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
function HistoryDrawer() {
  const { historyEntries, conflicts, activeHistoryId, archiveHistoryEntry, restoreHistoryEntry, currentUser, historyFilter, setHistoryFilter, historyOpen, openHistory } = useWorkspace()
  const [selectedId, select] = useSelectedCheckpoint()
  const language = useLanguage()
  const [tab, setTab] = useState('active')
  const [query, setQuery] = useState('')
  const [rollbackId, setRollbackId] = useState(null)
  // (The History layer open — the address's `?history`: a row moves its selection. Not open: a row opens it there.)
  const onHistoryPage = historyOpen

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
    else openHistory(id)
  }

  // Arriving from a conflict ("Check the reasoning in History"): the
  // checkpoint it points at is selected by the address (`?history=<id>`); here it's
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

  const query_ = query.trim()
  const clearFilters = () => setHistoryFilter({ kind: 'all', target: 'all', branch: 'all' })
  const clearAll = () => { clearFilters(); setQuery('') }
  // The rows, newest first, in runs of one day (each run under its caption).
  const groups = []
  active.forEach((entry, index) => {
    const { group, time } = stampOf(entry.timestamp, language)
    const last = groups.at(-1)
    if (last?.label === group) last.items.push({ entry, index, time })
    else groups.push({ label: group, items: [{ entry, index, time }] })
  })
  // The rail's width, and the lines that run on through a caption.
  const railWidth = LANE_X * 2 + (graph.lanes - 1) * LANE_GAP
  const railThrough = (row) => (
    <svg aria-hidden width={railWidth} height={GROUP_HEIGHT} className="block shrink-0" fill="none" strokeLinecap="round">
      {row.lanes.map((lane, lane_) => lane && (!lane.dot || lane.up) && (
        <path key={lane_} d={`M ${LANE_X + lane_ * LANE_GAP} -0.5 L ${LANE_X + lane_ * LANE_GAP} ${GROUP_HEIGHT + 0.5}`} stroke={colors.get(lane.name)} strokeWidth={lane.name === currentBranch ? 2.5 : 1.5} />
      ))}
    </svg>
  )
  const kindOn = kindFilter !== 'all'
  const fileOn = historyFilter.target !== 'all'
  const branchOn = (historyFilter.branch ?? 'all') !== 'all'

  if (!historyEntries) return <DrawerSkeleton />

  return (
    <DrawerShell
      data-history-drawer
      top={(
        <>
          <DrawerSearch value={query} onChange={setQuery} placeholder={translateText('Search history...', language)} label={translateText('Search project history', language)} />
          {/* The filters, one shape each, on one line — they also narrow the
              History layer's playback (`historyFilter`). Archived is a view of
              the same list, not a second tab row. */}
          <DrawerFilters label="Filter history">
            <DropdownMenu>
              <DropdownMenuTrigger data-filter="kind" className={chipClass(kindOn)}>
                {kindOn && <KindBadge kind={kindFilter} />}
                <span className="truncate">{kindOn ? <LocalizedText text={KIND_LABEL[kindFilter]} /> : <LocalizedText text="By kind" />}</span>
                <ChevronDown className="size-3 shrink-0" />
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
                <DropdownMenuTrigger data-filter="file" className={cn(chipClass(fileOn), 'min-w-0')}>
                  <span className={cn('max-w-24 truncate', fileOn && 'font-mono')}>{fileOn ? historyFilter.target : <LocalizedText text="By file" />}</span>
                  <ChevronDown className="size-3 shrink-0" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => setHistoryFilter({ target: 'all' })}><LocalizedText text="All files" /></DropdownMenuItem>
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
                <DropdownMenuTrigger data-filter="branch" className={cn(chipClass(branchOn), 'min-w-0')}>
                  <span translate="no" className={cn('max-w-24 truncate', branchOn && 'font-mono')}>{branchOn ? historyFilter.branch : <LocalizedText text="By branch" />}</span>
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
            {(archived.length > 0 || tab === 'archived') && (
              <button type="button" data-filter="archived" aria-pressed={tab === 'archived'} aria-label={translateText('Archived', language)} onClick={() => setTab(tab === 'archived' ? 'active' : 'archived')} className={cn(chipClass(tab === 'archived'), 'ml-auto')}>
                <Archive className="size-3" />
                <span className="tabular-nums">{archived.length}</span>
              </button>
            )}
          </DrawerFilters>
          {filtersActive && (
            <button type="button" data-drawer-clear onClick={clearFilters} className="ds-intrinsic mb-1 inline-flex h-6 items-center rounded-md px-2 text-xs text-slate-400 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-white/60">
              <LocalizedText text="Clear all filters" />
            </button>
          )}
        </>
      )}
    >
      {tab === 'active' && active.length === 0 && (
        <DrawerEmpty onClear={filtersActive || query_ ? clearAll : null}>
          <LocalizedText text={query_ ? 'No matching checkpoints.' : filtersActive ? 'No checkpoints match this filter.' : 'No checkpoints yet.'} />
        </DrawerEmpty>
      )}
      {/* The rail down the left — a dot per checkpoint on its branch's lane —
          drawn by each row itself (and carried through each caption), so it's
          there on first paint with nothing to measure. */}
      {tab === 'active' && groups.map(({ label, items }) => (
        <DrawerGroup key={`${label}:${items[0].entry.id}`} label={label} lead={railThrough(graph.rows[active.length - 1 - items[0].index])}>
          {items.map(({ entry, index, time }) => {
            const isCurrent = entry.id === currentId
            const selected = onHistoryPage && entry.id === selectedId
            const row = graph.rows[active.length - 1 - index]
            // The branch is said when it isn't the trunk (a merge names both ends).
            const branchLabel = entry.mergedBranches?.length ? `${entry.mergedBranches.join(', ')} → ${entry.branch}` : entry.branch ?? TRUNK
            const showBranch = Boolean(entry.mergedBranches?.length) || branchLabel !== TRUNK
            // The conflicts this version caused: open ones, and resolved ones
            // unless they're filtered out.
            const marks = showConflicts ? (entry.conflictMarks ?? []).map((mark) => ({ ...mark, resolved: conflicts.find((c) => c.id === mark.conflictId)?.reviewStage === 'resolved' })).filter((mark) => showResolved || !mark.resolved) : []
            const openMarks = marks.filter((mark) => !mark.resolved)
            const who = historyMeta({ ...entry, kind: null, target: null }, currentUser.id)
            const whole = historyMeta(entry, currentUser.id)
            return (
              <HistoryEntryMenu key={entry.id} entry={entry} isCurrent={isCurrent}
                onOpen={() => open(entry.id)} onRestore={() => setRollbackId(entry.id)} onArchive={archive}>
                <div
                  data-history-id={entry.id}
                  ref={(el) => (el ? refs.current.set(entry.id, el) : refs.current.delete(entry.id))}
                  className={cn('flex items-stretch rounded-lg', flashId === entry.id && 'bg-white/[0.1]')}
                >
                  <GraphRow row={row} lanes={graph.lanes} colors={colors} currentBranch={currentBranch} selected={selected} current={isCurrent} height={ROW_HEIGHT} />
                  <div className="min-w-0 flex-1">
                    <DrawerRow
                      selected={selected}
                      onOpen={() => open(entry.id)}
                      title={entry.label}
                      aria-label={whole ? `${entry.label} — ${whole}` : entry.label}
                      titleAdornment={isCurrent ? <span data-history-current className="inline-flex h-4 shrink-0 items-center rounded bg-white/10 px-1.5 text-[11px] font-medium text-slate-200"><LocalizedText text="Current" /></span> : null}
                      time={<span translate="no">{time}</span>}
                      meta={(
                        <>
                          <span className="min-w-0 truncate">
                            {who && <LocalizedText text={who} />}{who && KIND_LABEL[entry.kind] && ' · '}{KIND_LABEL[entry.kind] && <LocalizedText text={KIND_LABEL[entry.kind]} />}
                          </span>
                          {showBranch && <span translate="no" data-branch className="min-w-0 shrink-[3] truncate font-mono text-[11px]">· {branchLabel}</span>}
                          {marks.length > 0 && (
                            <span
                              data-conflict-mark={openMarks.length ? 'open' : 'resolved'}
                              title={marks.map((mark) => mark.label).join(' · ')}
                              className={cn('ds-intrinsic ml-auto inline-flex h-4 shrink-0 items-center gap-0.5 font-medium', openMarks.length ? 'text-amber-300' : 'text-slate-500')}
                            >
                              {openMarks.length ? <TriangleAlert className="size-3" /> : <Check className="size-3" />}
                              <LocalizedText text={openMarks.length ? 'Check change' : 'Resolved'} />
                            </span>
                          )}
                        </>
                      )}
                    />
                  </div>
                </div>
              </HistoryEntryMenu>
            )
          })}
        </DrawerGroup>
      ))}

      {tab === 'archived' &&
        (archived.length === 0 ? (
          <DrawerEmpty onClear={query_ ? clearAll : null}><LocalizedText text={query_ ? 'No matching archived checkpoints.' : 'No archived checkpoints.'} /></DrawerEmpty>
        ) : (
          archived.map((entry) => {
            const who = historyMeta({ ...entry, kind: null, target: null }, currentUser.id)
            return (
              <HistoryEntryMenu key={entry.id} entry={entry} isCurrent={entry.id === currentId}
                onOpen={() => open(entry.id)} onRestore={() => setRollbackId(entry.id)} onArchive={archive}
                onUnarchive={() => {
                  restoreHistoryEntry(entry.id)
                  toast('Checkpoint restored to History', { description: entry.label })
                }}>
                <div>
                  <DrawerRow
                    onOpen={() => open(entry.id)}
                    title={entry.label}
                    time={<span translate="no">{stampOf(entry.timestamp, language).time}</span>}
                    meta={<span className="min-w-0 truncate">{who && <LocalizedText text={who} />}{who && KIND_LABEL[entry.kind] && ' · '}{KIND_LABEL[entry.kind] && <LocalizedText text={KIND_LABEL[entry.kind]} />}</span>}
                  />
                </div>
              </HistoryEntryMenu>
            )
          })
        ))}

      <RollbackCheckpointModal
        key={rollbackId}
        entryId={rollbackId}
        onOpenChange={(isOpen) => !isOpen && setRollbackId(null)}
        onDone={(entry, restoredId) => {
          if (onHistoryPage && restoredId) select(restoredId)
        }}
      />
    </DrawerShell>
  )
}

export default HistoryDrawer
