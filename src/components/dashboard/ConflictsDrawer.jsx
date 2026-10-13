import { useEffect, useRef, useState } from 'react'
import { changeHref } from '@/lib/changeLink'
import { RecentTime } from '@/components/ui/RecentTime'
import { useLocation, useNavigate } from 'react-router-dom'
import { Check, ChevronDown, CircleCheck, ListFilter } from 'lucide-react'
import { cn } from 'cn'
import { useConflictList } from '@/components/conflicts/useConflictList'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { LocalizedText } from '@/i18n/runtime'
import { translateText } from '@/i18n/translate'
import { useLanguage } from '@/i18n/language'
import { DrawerCount, DrawerEmpty, DrawerFilters, DrawerGroup, DrawerRow, DrawerSearch, DrawerShell, chipClass } from '@/components/dashboard/DrawerList'
import { conflictListRecord, dueRank, listStatusOf, shortDue } from '@/lib/conflicts'
import { kindWordOf } from '@/lib/conflictInsight'
import { scheduleOf } from '@/lib/designDecisions'
import { projects } from '@/data/mockData'

// The drawer behind the activity bar's Conflict Points icon: the same list
// as the bottom panel's tab (useConflictList — one set of records, filters
// and order), drawn for a narrow column with the parts History's drawer is
// made of too (DrawerList). A row opens that conflict in the full-screen
// viewer over the work area; from a page without one (the project's home,
// Docs, History) it goes to the Workspace and opens there.
//
// A row is two lines, the same for every item — selected or not:
//   1 · the title on one line (cut with … when long, the whole of it on
//       hover), the due date at the right;
//   2 · its status (a dot: slate before review, white after), then what kind
//       of change it is.
// Nothing here is colored: a due date that's today, tomorrow or past is
// white and a little heavier, the rest slate. The selected row is marked by
// its fill and a 2px bar at its left.
// (Linked with the canvas's pins: pointing at a row points at its pin.)
// Rows are grouped by when they're due; done ones fold under "Done N".

// Today, tomorrow or already past reads as urgent.
const urgentOf = (conflict) => dueRank(conflict) <= 1

// The due groups, in the order the list already has (a stable split).
const GROUPS = [['Today', (rank) => rank <= 0], ['This week', (rank) => rank >= 1 && rank <= 7], ['Next week', (rank) => rank >= 8 && rank <= 14], ['After that', () => true]]
export function drawerGroupsOf(items) {
  const left = new Set(items)
  return GROUPS.map(([label, test]) => {
    const list = items.filter((conflict) => left.has(conflict) && test(dueRank(conflict)))
    list.forEach((conflict) => left.delete(conflict))
    return [label, list]
  }).filter(([, list]) => list.length > 0)
}

// What a row says, as one string — what a search looks in.
function statusOf(conflict) {
  const done = conflict.reviewStage === 'resolved'
  const scheduled = !done && conflict.decisionFlow && !conflict.decisionFix ? scheduleOf(conflict, projects.find((project) => project.id === conflict.projectId)?.release) : null
  return done ? (conflict.rollback ? 'Previous version restored' : conflict.revertOf ? 'Merge canceled' : 'Merged') : scheduled ? `승인됨 · ${scheduled}` : listStatusOf(conflict).label
}

// (Also the row of a screen's change list on the Screens board.)
export function ConflictRow({ conflict, selected = false, hovered = false, onOpen, onHover = () => {} }) {
  const row = useRef(null)
  // Picked (here or by its pin on the canvas): brought into view in the list.
  useEffect(() => { if (selected) row.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }, [selected])
  const done = conflict.reviewStage === 'resolved'
  const when = done ? conflict.resolvedAtLabel ?? conflict.timestamp ?? null : shortDue(conflict.dueLabel)
  const urgent = !done && urgentOf(conflict)
  const kind = kindWordOf(conflict)
  const stage = listStatusOf(conflict).id
  return (
    <DrawerRow
      ref={row}
      data-conflict-row={conflict.id}
      data-conflict-stage={conflict.reviewStage}
      data-pin-hover={hovered ? '' : undefined}
      selected={selected}
      onOpen={() => onOpen(conflict)}
      // (Pointing at a row points at its pin on the canvas, and back.)
      onMouseEnter={() => onHover(conflict.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(conflict.id)}
      onBlur={() => onHover(null)}
      className={cn(done && 'opacity-60')}
      title={<LocalizedText text={conflict.title} />}
      time={when && <span data-due={done ? 'later' : urgent ? 'urgent' : 'later'}>{done && Number.isFinite(conflict.resolvedAtMs) ? <RecentTime at={conflict.resolvedAtMs} fallback={when} /> : <LocalizedText text={when} />}</span>}
      timeStrong={urgent}
      meta={(
        <>
          {done ? <Check aria-hidden className="size-3 shrink-0" /> : <span aria-hidden data-status-dot className={cn('size-1.5 shrink-0 rounded-full', stage === 'detected' ? 'bg-slate-500' : 'bg-white')} />}
          <span className="min-w-0 truncate"><LocalizedText text={statusOf(conflict)} />{kind && <> · <LocalizedText text={kind} /></>}</span>
        </>
      )}
    />
  )
}

// The count beside the drawer's title: every change in the list.
export function ConflictCount() {
  const { conflicts } = useWorkspace()
  return <DrawerCount data-conflicts-count count={conflicts.filter(conflictListRecord).length} />
}

function ConflictsDrawer({ project }) {
  const { conflicts, openItems, doneItems, filter, primaryFilters, statusFilters, setFilter, countOf, selectedId, open } = useConflictList({ view: 'overlay' })
  const { conflictPin, hoverConflictPin, focusConflictPin } = useWorkspace()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const language = useLanguage()
  const [showDone, setShowDone] = useState(false)
  const [query, setQuery] = useState('')
  const workspacePath = `/projects/${project.id}/workspace`
  const onWorkspace = pathname.replace(/\/$/, '') === workspacePath

  function openRow(conflict) {
    // Its pin is picked with it, and the canvas glides there (seen as soon
    // as the detail is closed: the pin rings once).
    focusConflictPin(conflict)
    if (onWorkspace) open(conflict.id)
    else navigate(changeHref(project.id, conflict.id))
  }

  if (conflicts.length === 0) {
    return <DrawerEmpty icon={CircleCheck}><LocalizedText text="No conflicts — design and code are in sync." /></DrawerEmpty>
  }

  // A finer status picked from the dropdown shows on its trigger.
  const status = statusFilters.find((entry) => entry.id === filter.id && !primaryFilters.includes(entry)) ?? null
  // Picked: the one open in the detail, else the one whose pin is picked.
  const pickedId = selectedId ?? conflictPin.selected?.conflictId ?? null
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  const found = (conflict) => {
    if (!terms.length) return true
    const text = [conflict.title, kindWordOf(conflict), statusOf(conflict)].filter(Boolean).flatMap((part) => [part, translateText(part, language)]).join(' ').toLocaleLowerCase()
    return terms.every((term) => text.includes(term))
  }
  const openShown = openItems.filter(found)
  const doneShown = doneItems.filter(found)
  const filtering = filter.id !== 'all' || terms.length > 0
  const clear = () => { setFilter('all'); setQuery('') }
  const row = (conflict) => <ConflictRow key={conflict.id} conflict={conflict} selected={pickedId === conflict.id} hovered={conflictPin.hoverId === conflict.id} onOpen={openRow} onHover={hoverConflictPin} />

  return (
    <DrawerShell
      data-conflicts-drawer
      top={(
        <>
          <DrawerSearch value={query} onChange={setQuery} placeholder={translateText('Search changes…', language)} label={translateText('Search changes', language)} />
          {/* One line: the four standing filters, then the statuses in a menu. */}
          <DrawerFilters label="Filter conflicts">
            {primaryFilters.map((entry) => {
              const count = countOf(entry)
              const on = entry.id === filter.id
              return (
                // (A filter with nothing in it is there, but can't be picked.)
                <button key={entry.id} type="button" aria-pressed={on} disabled={count === 0 && !on} onClick={() => setFilter(entry.id)} className={cn(chipClass(on), 'px-1.5 disabled:pointer-events-none disabled:text-slate-600')}>
                  <LocalizedText text={entry.label} />
                  <span data-count={count} className={cn('tabular-nums @max-[250px]:hidden', on ? 'text-slate-300' : 'text-slate-500')}>{count}</span>
                </button>
              )
            })}
            <DropdownMenu>
              <DropdownMenuTrigger data-status-filter aria-label={translateText('Status', language)} title={status ? translateText(status.label, language) : translateText('Status', language)} className={cn(chipClass(Boolean(status)), 'ml-auto w-6 justify-center px-0')}>
                <ListFilter className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44">
                <DropdownMenuRadioGroup value={status?.id ?? ''} onValueChange={(value) => setFilter(value === status?.id ? 'all' : value)}>
                  {statusFilters.map((entry) => {
                    const count = countOf(entry)
                    return (
                      // (A status with nothing in it is still there, quieter.)
                      <DropdownMenuRadioItem key={entry.id} value={entry.id} data-empty={count === 0 ? '' : undefined} className={cn('text-xs', count === 0 && 'opacity-45')}>
                        <LocalizedText text={entry.label} />
                        <span className="ml-auto pl-3 text-slate-500 tabular-nums">{count}</span>
                      </DropdownMenuRadioItem>
                    )
                  })}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </DrawerFilters>
        </>
      )}
    >
      {openShown.length === 0 && doneShown.length === 0 && (
        <DrawerEmpty onClear={filtering ? clear : null}>
          <LocalizedText text={terms.length ? 'No matching conflicts.' : 'No conflicts in this view.'} />
        </DrawerEmpty>
      )}
      {drawerGroupsOf(openShown).map(([label, items]) => (
        <DrawerGroup key={label} label={label}>
          <ul className="flex flex-col">{items.map((conflict) => <li key={conflict.id}>{row(conflict)}</li>)}</ul>
        </DrawerGroup>
      ))}
      {/* Done: folded away at the bottom until asked for. */}
      {doneShown.length > 0 && (
        <div data-done-group className="mt-2 border-t border-white/[0.07] pt-2">
          <button type="button" aria-expanded={showDone || terms.length > 0} onClick={() => setShowDone((value) => !value)} className="ds-intrinsic flex h-7 w-full items-center gap-1 rounded-lg px-3 text-xs text-slate-400 transition-colors hover:bg-white/[0.05] hover:text-slate-200 focus-visible:outline-2 focus-visible:outline-white/60">
            <ChevronDown className={cn('size-3.5 transition-transform', !(showDone || terms.length > 0) && '-rotate-90')} />
            <LocalizedText text="Done" />
            <span className="text-slate-500 tabular-nums">{doneShown.length}</span>
          </button>
          {(showDone || terms.length > 0) && <ul className="mt-1 flex flex-col">{doneShown.map((conflict) => <li key={conflict.id}>{row(conflict)}</li>)}</ul>}
        </div>
      )}
    </DrawerShell>
  )
}

export default ConflictsDrawer
