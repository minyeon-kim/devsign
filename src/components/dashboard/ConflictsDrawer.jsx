import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, ChevronDown, CircleCheck } from 'lucide-react'
import { cn } from 'cn'
import { ListStatusLabel } from '@/components/conflicts/ConflictBadges'
import { ConflictTypeTag } from '@/components/conflicts/ConflictInsight'
import { useConflictList } from '@/components/conflicts/useConflictList'
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { LocalizedText } from '@/i18n/runtime'
import { translateText } from '@/i18n/translate'
import { useLanguage } from '@/i18n/language'
import { dueRank, shortDue } from '@/lib/conflicts'
import { differenceNoteOf, exceptionTypeOf } from '@/lib/conflictInsight'

// The drawer behind the activity bar's Conflict Points icon: the same list
// as the bottom panel's tab (useConflictList — one set of records, filters
// and order), drawn for a narrow column. A row opens that conflict in the
// full-screen viewer over the work area; from a page without one (the
// project's home, Docs, History) it goes to the Workspace and opens there.
//
// A card is two lines, no more:
//   1 · the title — and a tag only when it's an exception (most conflicts
//       are design drifts, so that's never tagged; one tag at most);
//   2 · its status, when it's due (accented only when that's close), and
//       anything about the difference the title doesn't already say.
// The whole card is the way in (a → shows on hover) — it carries no action
// of its own. Done items fold under "Done N" at the bottom.

// Due within this many days reads as close.
const DUE_CLOSE_DAYS = 2

function ConflictCard({ conflict, selected, onOpen }) {
  const language = useLanguage()
  const done = conflict.reviewStage === 'resolved'
  const when = done ? conflict.resolvedAtLabel ?? conflict.timestamp ?? null : shortDue(conflict.dueLabel)
  const close = !done && dueRank(conflict) <= DUE_CLOSE_DAYS
  const note = differenceNoteOf(conflict)
  return (
    <li>
      <button
        type="button"
        data-conflict-row={conflict.id}
        data-conflict-stage={conflict.reviewStage}
        aria-current={selected ? 'true' : undefined}
        onClick={() => onOpen(conflict)}
        className={cn(
          'group flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/[0.05] focus-visible:outline-2 focus-visible:outline-emerald-300 aria-[current=true]:bg-white/[0.08]',
          done && 'opacity-60'
        )}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="min-w-0 truncate text-[13px] leading-5 font-medium text-slate-100"><LocalizedText text={conflict.title} /></span>
            {exceptionTypeOf(conflict) && <ConflictTypeTag conflict={conflict} quiet className="h-[18px] px-1.5 text-[10.5px]" />}
          </span>
          <span className="flex min-w-0 items-center gap-x-1.5 text-[11px] leading-4 text-slate-400">
            <ListStatusLabel conflict={conflict} className="text-[11px] leading-4 font-normal text-slate-300" />
            {when && <>
              <span aria-hidden className="text-slate-600">·</span>
              <span data-due={close ? 'close' : 'later'} className={cn('shrink-0', close && 'font-medium text-amber-300')}><LocalizedText text={when} /></span>
            </>}
            {note && <>
              <span aria-hidden className="text-slate-600">·</span>
              <span data-difference-note className="min-w-0 truncate" title={note.detail.length ? note.detail.map((label) => translateText(label, language)).join(', ') : undefined}><LocalizedText text={note.text} /></span>
            </>}
          </span>
        </span>
        <ArrowRight aria-hidden className="size-3.5 shrink-0 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
      </button>
    </li>
  )
}

const FILTER = 'ds-intrinsic inline-flex h-6 shrink-0 items-center gap-1 text-xs whitespace-nowrap transition-colors'

function ConflictsDrawer({ project }) {
  const { conflicts, openItems, doneItems, filter, primaryFilters, statusFilters, setFilter, countOf, selectedId, open } = useConflictList({ view: 'overlay' })
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [showDone, setShowDone] = useState(false)
  const workspacePath = `/projects/${project.id}/workspace`
  const onWorkspace = pathname.replace(/\/$/, '') === workspacePath

  function openRow(conflict) {
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
  const card = (conflict) => <ConflictCard key={conflict.id} conflict={conflict} selected={selectedId === conflict.id} onOpen={openRow} />

  return (
    <div data-conflicts-drawer className="flex flex-col pb-2">
      {/* One line: the four standing filters, then the statuses' dropdown. */}
      <div role="group" aria-label="Filter conflicts" className="mb-1.5 flex flex-nowrap items-center gap-x-2.5 overflow-hidden px-2.5">
        {primaryFilters.map((entry) => (
          <button key={entry.id} type="button" aria-pressed={entry.id === filter.id} onClick={() => setFilter(entry.id)} className={cn(FILTER, entry.id === filter.id ? 'font-medium text-white' : 'text-slate-400 hover:text-slate-200')}>
            <LocalizedText text={entry.label} />
            <span className="text-slate-500 tabular-nums">{countOf(entry)}</span>
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
      {openItems.length > 0 && <ul className="flex flex-col gap-0.5">{openItems.map(card)}</ul>}
      {/* Done: folded away at the bottom until asked for. */}
      {doneItems.length > 0 && (
        <div data-done-group className="mt-2 border-t border-white/[0.07] pt-2">
          <button type="button" aria-expanded={showDone} onClick={() => setShowDone((value) => !value)} className="ds-intrinsic flex h-7 w-full items-center gap-1 rounded-lg px-3 text-xs text-slate-400 transition-colors hover:bg-white/[0.05] hover:text-slate-200 focus-visible:outline-2 focus-visible:outline-emerald-300">
            <ChevronDown className={cn('size-3.5 transition-transform', !showDone && '-rotate-90')} />
            <LocalizedText text="Done" />
            <span className="text-slate-500 tabular-nums">{doneItems.length}</span>
          </button>
          {showDone && <ul className="mt-0.5 flex flex-col gap-0.5">{doneItems.map(card)}</ul>}
        </div>
      )}
    </div>
  )
}

export default ConflictsDrawer
