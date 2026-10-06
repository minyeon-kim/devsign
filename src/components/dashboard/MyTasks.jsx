import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, CircleCheck, Clock3 } from 'lucide-react'
import { cn } from 'cn'
import { checksFor } from '@/components/mergestudio/mergeChecks'
import { PAGE_CARD } from '@/components/mergestudio/floatingStyles'
import { allPeople, mergeListItems } from '@/data/mockData'
import { LocalizedText } from '@/i18n/runtime'
import { TASK_LABEL, authorOf, isDueNow, remainingWorkOf, shortDue, taskGroups } from '@/lib/conflicts'
import { useConflictStore } from '@/state/ConflictStore'

// "My tasks" — the first thing on the Dashboard, sorted by what kind of
// thing it is (lib/conflicts' taskGroups):
//   · Continue your work — what you stopped partway (a reason still to
//     give, …). The most pressing one leads, alone on a tinted card with
//     the screen's one filled button; any others sit above the decisions.
//   · Needs a decision — conflicts with a value to choose.
//   · Approval requests — what others asked you to approve.
// The last two are columns of plain rows: a title and one line of meta
// (project · due · who asked), the whole row the way in — a → shows on
// hover — three at most, the rest behind "+N". Warnings are kept quiet: a
// red dot beside a title for "can't merge" (said once, in the legend), and
// a due date accented only when it's today or past.
const SHOWN = 3

// A conflict that can't merge as it stands: a required check fails.
function isBlocked(conflict) {
  const item = mergeListItems.find((entry) => entry.id === conflict.mergeItemId || entry.conflictId === conflict.id)
  if (!item) return false
  const settled = [...(conflict.acceptedChecks ?? []), ...(conflict.reviewStage === 'approved' ? conflict.exceptionChecks ?? [] : [])]
  return (checksFor(item)?.blocking ?? []).some((check) => check.id !== 'decided' && !settled.includes(check.id))
}

// Who asked: whoever requested the review, else the change's author.
function requesterOf(conflict) {
  return allPeople.find((person) => person.id === (conflict.requestedBy ?? authorOf(conflict)))?.name ?? null
}

// "Can't merge", as a dot: what it means is the legend's to say.
function BlockedDot() {
  return <span data-blocked role="img" aria-label="Can’t merge" title="Can’t merge" className="size-1.5 shrink-0 rounded-full bg-red-400" />
}

// Due: accented only when it's today or past; otherwise as quiet as the
// rest of the line.
function Due({ conflict, icon = false }) {
  const due = shortDue(conflict.dueLabel)
  if (!due) return null
  return (
    <span data-due={isDueNow(conflict) ? 'now' : 'later'} className={cn('inline-flex shrink-0 items-center gap-1', isDueNow(conflict) && 'font-medium text-amber-300')}>
      {icon && <Clock3 className="size-3" />}
      <LocalizedText text={due} />
    </span>
  )
}

// One task as a row: all of it is the way in.
function TaskRow({ entry, onOpen }) {
  const { conflict, blocked } = entry
  const requester = requesterOf(conflict)
  const due = shortDue(conflict.dueLabel)
  return (
    <li>
      <button
        type="button"
        data-task={entry.task.kind}
        onClick={() => onOpen(conflict)}
        className="group flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/[0.05] focus-visible:bg-white/[0.05] focus-visible:outline-2 focus-visible:outline-emerald-300"
      >
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[13px] font-medium text-slate-100"><LocalizedText text={conflict.title} /></span>
            {blocked && <BlockedDot />}
          </span>
          <span className="mt-0.5 flex min-w-0 items-center gap-x-1.5 text-[11px] text-slate-500">
            {conflict.projectName && <span className="truncate"><LocalizedText text={conflict.projectName} /></span>}
            {due && <><span aria-hidden className="text-slate-600">·</span><Due conflict={conflict} /></>}
            <span aria-hidden className="text-slate-600">·</span>
            <span className="shrink-0"><LocalizedText text={requester ?? 'Detected automatically'} /></span>
          </span>
        </span>
        <ArrowRight aria-hidden className="size-3.5 shrink-0 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
      </button>
    </li>
  )
}

// A group of rows under its heading: the count, what it asks of you, and
// three rows at most — the rest behind "+N".
function TaskGroup({ id, title, hint, empty, entries, onOpen }) {
  const [all, setAll] = useState(false)
  const shown = all ? entries : entries.slice(0, SHOWN)
  return (
    <div data-task-group={id} className="min-w-0">
      <h3 className="mb-1 flex items-baseline gap-1.5 px-2 text-xs font-semibold text-slate-200">
        <LocalizedText text={title} />
        <span className="font-normal text-slate-400 tabular-nums">{entries.length}</span>
        {hint && <span className="truncate font-normal text-slate-500">· <LocalizedText text={hint} /></span>}
      </h3>
      {entries.length === 0
        ? <p className="px-2 py-2 text-xs text-slate-500"><LocalizedText text={empty} /></p>
        : <ul className="flex flex-col gap-0.5">{shown.map((entry) => <TaskRow key={entry.conflict.id} entry={entry} onOpen={onOpen} />)}</ul>}
      {entries.length > SHOWN && (
        <button type="button" aria-expanded={all} onClick={() => setAll((value) => !value)} className="ds-intrinsic mt-1 px-2 text-xs font-medium text-slate-400 transition-colors hover:text-white">
          {all ? <LocalizedText text="Show less" /> : <><span className="tabular-nums">+{entries.length - SHOWN}</span> <LocalizedText text="Show more" /></>}
        </button>
      )}
    </div>
  )
}

function MyTasks() {
  const { conflicts } = useConflictStore()
  const navigate = useNavigate()
  const groups = taskGroups(conflicts, { isBlocked })
  const total = groups.continue.length + groups.decide.length + groups.review.length
  const open = (conflict) => navigate(`/projects/${conflict.projectId}/workspace`, { state: { openConflictId: conflict.id } })

  if (total === 0) {
    return (
      <section data-my-tasks="empty" aria-label="My tasks" className={cn(PAGE_CARD, 'flex items-center gap-2 px-6 py-3 text-xs text-slate-400')}>
        <CircleCheck className="size-4 shrink-0 text-emerald-400" />
        <LocalizedText text="Nothing to do right now" />
      </section>
    )
  }

  const [first, ...unfinished] = groups.continue
  const anyBlocked = Object.values(groups).flat().some((entry) => entry.blocked)

  return (
    <section data-my-tasks aria-labelledby="my-tasks-title" className={cn(PAGE_CARD, 'p-6')}>
      <h2 id="my-tasks-title" className="mb-3 flex items-baseline gap-2 text-[13px] font-semibold text-white">
        <LocalizedText text="My tasks" />
        <span className="text-xs font-normal text-slate-400 tabular-nums">{total}</span>
      </h2>

      {/* The one thing to do first — and the screen's one filled button. */}
      {first && (
        <div data-task-first className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl bg-emerald-400/[0.07] px-4 py-3.5 ring-1 ring-emerald-300/15">
          <div className="min-w-0 flex-1 basis-56">
            <p className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-sm font-semibold text-white"><LocalizedText text={first.conflict.title} /></span>
              {first.blocked && <BlockedDot />}
            </p>
            <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs text-slate-300">
              <span data-task-remaining><LocalizedText text={remainingWorkOf(first.conflict)} /></span>
              {shortDue(first.conflict.dueLabel) && <><span aria-hidden className="text-slate-600">·</span><Due conflict={first.conflict} icon /></>}
              {first.conflict.projectName && <><span aria-hidden className="text-slate-600">·</span><span className="truncate text-slate-400"><LocalizedText text={first.conflict.projectName} /></span></>}
            </p>
          </div>
          <button type="button" data-task-action onClick={() => open(first.conflict)} className="ds-review-cta inline-flex h-8 shrink-0 cursor-pointer items-center rounded-full px-4 text-xs font-medium whitespace-nowrap">
            <LocalizedText text={TASK_LABEL.continue} />
          </button>
        </div>
      )}

      <div className="-mx-2 grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4">
          {/* More unfinished work than the one above: it leads this column. */}
          {unfinished.length > 0 && <TaskGroup id="continue" title={TASK_LABEL.continue} entries={unfinished} onOpen={open} />}
          <TaskGroup id="decide" title="Needs a decision" hint="A value has to be chosen" empty="No conflicts to decide" entries={groups.decide} onOpen={open} />
        </div>
        <TaskGroup id="review" title="Approval requests" hint="Waiting for your approval" empty="No approval requests" entries={groups.review} onOpen={open} />
      </div>

      {/* The dot, explained once. */}
      {anyBlocked && (
        <p data-task-legend className="mt-4 flex items-center gap-1.5 border-t border-white/[0.07] pt-3 text-[11px] text-slate-500">
          <span aria-hidden className="size-1.5 rounded-full bg-red-400" />
          <LocalizedText text="Can’t merge" />
        </p>
      )}
    </section>
  )
}

export default MyTasks
