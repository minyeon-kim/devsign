import { useEffect, useRef, useState } from 'react'
import { RecentTime, useRecentHighlight } from '@/components/ui/RecentTime'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown, CircleCheck } from 'lucide-react'
import { cn } from 'cn'
import { dueGroupsOf, useConflictList } from '@/components/conflicts/useConflictList'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { LocalizedText } from '@/i18n/runtime'
import { dueRank, listStatusOf, shortDue } from '@/lib/conflicts'
import { kindWordOf } from '@/lib/conflictInsight'
import { scheduleOf } from '@/lib/designDecisions'
import { projects } from '@/data/mockData'

// The drawer behind the activity bar's Conflict Points icon: the same list
// as the bottom panel's tab (useConflictList — one set of records, filters
// and order), drawn for a narrow column. A row opens that conflict in the
// full-screen viewer over the work area; from a page without one (the
// project's home, Docs, History) it goes to the Workspace and opens there.
//
// A row is two lines, the same for every item — selected or not:
//   1 · the title on one line (cut with … when long), the due date at the right;
//   2 · muted meta: its status, then what kind of change it is.
// One meaning, one signal: no dots, no tags, no arrows. The list holds what
// picking a row needs — its type and risk are the detail's to say. Color is
// kept for what has to be acted on now, so a row has at most one colored
// thing: a due date that's today or tomorrow (accent) or already past
// (warning). The selected row is marked by its background and a 2px bar at
// its left, and by nothing that changes its height or layout.
// (Linked with the canvas's pins: pointing at a row points at its pin, and
// the picked row's card takes the pins' accent orange as its border.)
// Done items fold under "Done N" at the bottom.

// Due today or tomorrow reads as urgent; past due, as late.
function dueToneOf(conflict) {
  const rank = dueRank(conflict)
  return rank < 0 ? 'late' : rank <= 1 ? 'urgent' : 'later'
}
const DUE_TONE = { late: 'font-medium text-destructive', urgent: 'font-medium text-amber-300', later: 'text-slate-500' }

function ConflictCard({ conflict, selected, hovered, onOpen, onHover }) {
  const row = useRef(null)
  // Picked (here or by its pin on the canvas): brought into view in the list.
  useEffect(() => { if (selected) row.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }, [selected])
  const done = conflict.reviewStage === 'resolved'
  // (Just merged: lit once as it shows — then still, saying 방금 until it's a minute old.)
  const recent = useRecentHighlight(`merged:${conflict.id}`, done ? conflict.resolvedAtMs : null)
  const when = done ? conflict.resolvedAtLabel ?? conflict.timestamp ?? null : shortDue(conflict.dueLabel)
  const tone = done ? 'later' : dueToneOf(conflict)
  // (Approved and put off: when it goes in — instead of "in review".)
  const scheduled = !done && conflict.decisionFlow && !conflict.decisionFix ? scheduleOf(conflict, projects.find((project) => project.id === conflict.projectId)?.release) : null
  const status = done ? (conflict.rollback ? 'Previous version restored' : conflict.revertOf ? 'Merge canceled' : 'Merged') : scheduled ? `승인됨 · ${scheduled}` : listStatusOf(conflict).label
  const kind = kindWordOf(conflict)
  return (
    <li>
      <button
        ref={row}
        type="button"
        data-conflict-row={conflict.id}
        data-conflict-stage={conflict.reviewStage}
        data-pin-hover={hovered ? '' : undefined}
        aria-current={selected ? 'true' : undefined}
        onClick={() => onOpen(conflict)}
        // (Pointing at a row points at its pin on the canvas, and back.)
        onMouseEnter={() => onHover(conflict.id)}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onHover(conflict.id)}
        onBlur={() => onHover(null)}
        className={cn(
          'flex w-full min-w-0 cursor-pointer flex-col gap-0.5 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-emerald-300 data-[pin-hover]:bg-white/[0.04] aria-[current=true]:border-orange-500 aria-[current=true]:bg-white/[0.07]',
          done && 'opacity-60',
          recent
        )}
      >
        <span className="flex min-w-0 items-baseline gap-3">
          <span data-row-title className="min-w-0 flex-1 truncate text-[13px] leading-5 font-medium text-slate-100"><LocalizedText text={conflict.title} /></span>
          {when && <span data-due={tone} className={cn('shrink-0 text-[11px] leading-5 tabular-nums', DUE_TONE[tone])}>{done && Number.isFinite(conflict.resolvedAtMs) ? <RecentTime at={conflict.resolvedAtMs} fallback={when} /> : <LocalizedText text={when} />}</span>}
        </span>
        <span data-row-meta className="block min-w-0 truncate text-[11px] leading-4 text-slate-500">
          <LocalizedText text={status} />{kind && <> · <LocalizedText text={kind} /></>}
        </span>
      </button>
    </li>
  )
}

const FILTER = 'ds-intrinsic inline-flex h-6 shrink-0 items-center gap-1 text-xs whitespace-nowrap transition-colors'

function ConflictsDrawer({ project }) {
  const { conflicts, openItems, doneItems, filter, primaryFilters, statusFilters, setFilter, countOf, selectedId, open } = useConflictList({ view: 'overlay' })
  const { conflictPin, hoverConflictPin, focusConflictPin } = useWorkspace()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [showDone, setShowDone] = useState(false)
  const workspacePath = `/projects/${project.id}/workspace`
  const onWorkspace = pathname.replace(/\/$/, '') === workspacePath

  function openRow(conflict) {
    // Its pin is picked with it, and the canvas glides there (seen as soon
    // as the detail is closed: the pin rings once).
    focusConflictPin(conflict)
    if (onWorkspace) open(conflict.id)
    else navigate(workspacePath, { state: { openConflictId: conflict.id, reviewView: 'overlay' } })
  }

  if (conflicts.length === 0) {
    return (
      <p className="flex flex-col items-center gap-2 px-2.5 py-8 text-center text-xs text-slate-500">
        <CircleCheck className="size-5 text-emerald-400" />
        <LocalizedText text="No conflicts — design and code are in sync." />
      </p>
    )
  }

  // A finer status picked from the dropdown shows on its trigger.
  const status = statusFilters.find((entry) => entry.id === filter.id && !primaryFilters.includes(entry)) ?? null
  // Picked: the one open in the detail, else the one whose pin is picked.
  const pickedId = selectedId ?? conflictPin.selected?.conflictId ?? null
  const card = (conflict) => <ConflictCard key={conflict.id} conflict={conflict} selected={pickedId === conflict.id} hovered={conflictPin.hoverId === conflict.id} onOpen={openRow} onHover={hoverConflictPin} />

  return (
    <div data-conflicts-drawer className="flex flex-col pb-2">
      {/* One line: the four standing filters, then the statuses' dropdown. */}
      <div role="group" aria-label="Filter conflicts" className="mb-1.5 flex flex-nowrap items-center gap-x-2.5 overflow-hidden px-2.5">
        {primaryFilters.map((entry) => (
          <button key={entry.id} type="button" aria-pressed={entry.id === filter.id} onClick={() => setFilter(entry.id)} className={cn(FILTER, entry.id === filter.id ? 'font-medium text-white' : 'text-slate-400 hover:text-slate-200')}>
            <LocalizedText text={entry.label} />
            {/* (A count of nothing is there, quieter.) */}
            <span data-count={countOf(entry)} className={cn('tabular-nums', countOf(entry) === 0 ? 'text-slate-600' : 'text-slate-500')}>{countOf(entry)}</span>
          </button>
        ))}
        <DropdownMenu>
          <DropdownMenuTrigger data-status-filter aria-label="Status" className={cn(FILTER, 'ml-auto min-w-0 gap-0.5', status ? 'font-medium text-white' : 'text-slate-400 hover:text-slate-200')}>
            <span className="min-w-0 truncate"><LocalizedText text={status ? status.label : 'Status'} /></span>
            <ChevronDown className="size-3 shrink-0" />
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
      </div>
      {openItems.length === 0 && doneItems.length === 0 && (
        <p className="px-2.5 py-6 text-center text-xs text-slate-500"><LocalizedText text="No conflicts in this view." /></p>
      )}
      {/* Grouped by when it's due, under small captions — spaced apart, no rules between rows. */}
      {dueGroupsOf(openItems).map(([label, items], index) => (
        <section key={label} data-due-group={label} className={cn(index > 0 && 'mt-3')}>
          <h4 className="mb-1 px-3 text-[11px] leading-4 text-slate-500"><LocalizedText text={label} /></h4>
          <ul className="flex flex-col gap-1">{items.map(card)}</ul>
        </section>
      ))}
      {/* Done: folded away at the bottom until asked for. */}
      {doneItems.length > 0 && (
        <div data-done-group className="mt-2 border-t border-white/[0.07] pt-2">
          <button type="button" aria-expanded={showDone} onClick={() => setShowDone((value) => !value)} className="ds-intrinsic flex h-7 w-full items-center gap-1 rounded-lg px-3 text-xs text-slate-400 transition-colors hover:bg-white/[0.05] hover:text-slate-200 focus-visible:outline-2 focus-visible:outline-emerald-300">
            <ChevronDown className={cn('size-3.5 transition-transform', !showDone && '-rotate-90')} />
            <LocalizedText text="Done" />
            <span className="text-slate-500 tabular-nums">{doneItems.length}</span>
          </button>
          {showDone && <ul className="mt-1 flex flex-col gap-1">{doneItems.map(card)}</ul>}
        </div>
      )}
    </div>
  )
}

export default ConflictsDrawer
