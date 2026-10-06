import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CircleCheck, Clock3, TriangleAlert } from 'lucide-react'
import { cn } from 'cn'
import { checksFor } from '@/components/mergestudio/mergeChecks'
import { PAGE_CARD } from '@/components/mergestudio/floatingStyles'
import { allPeople, mergeListItems } from '@/data/mockData'
import { LocalizedText } from '@/i18n/runtime'
import { authorOf, isDueSoon, myTasks, shortDue } from '@/lib/conflicts'
import { useConflictStore } from '@/state/ConflictStore'

// "My tasks" — the first thing on the Dashboard: review requests sent to
// you and conflicts you have to decide, across every project, most
// pressing first (due soon, then ones that can't merge, then the rest —
// see lib/conflicts' myTasks). A row is what it is (name · project · due ·
// who asked) and, at its right, the button named after what pressing it
// starts (taskFor); the whole row goes to the same place. With nothing to
// do it shrinks to one short line, and the projects move up.
const SHOWN = 5

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

function MyTasks() {
  const { conflicts } = useConflictStore()
  const navigate = useNavigate()
  const [all, setAll] = useState(false)
  const tasks = myTasks(conflicts, { isBlocked })
  const shown = all ? tasks : tasks.slice(0, SHOWN)
  const open = (conflict) => navigate(`/projects/${conflict.projectId}/workspace`, { state: { openConflictId: conflict.id } })

  if (tasks.length === 0) {
    return (
      <section data-my-tasks="empty" aria-label="My tasks" className={cn(PAGE_CARD, 'flex items-center gap-2 px-6 py-3 text-xs text-slate-400')}>
        <CircleCheck className="size-4 shrink-0 text-emerald-400" />
        <LocalizedText text="Nothing to do right now" />
      </section>
    )
  }

  return (
    <section data-my-tasks aria-labelledby="my-tasks-title" className={cn(PAGE_CARD, 'p-6')}>
      <h2 id="my-tasks-title" className="mb-2 flex items-baseline gap-2 text-[13px] font-semibold text-white">
        <LocalizedText text="My tasks" />
        <span className="text-xs font-normal text-slate-400 tabular-nums">{tasks.length}</span>
      </h2>
      <ul className="-mx-2 flex flex-col gap-0.5">
        {shown.map(({ conflict, task, blocked }) => {
          const due = shortDue(conflict.dueLabel)
          const urgent = isDueSoon(conflict)
          const requester = requesterOf(conflict)
          return (
            // The whole row goes where its button does; the button is what
            // the keyboard lands on.
            <li
              key={conflict.id}
              data-task={task.kind}
              onClick={() => open(conflict)}
              className="group flex cursor-pointer items-center gap-4 rounded-lg px-2 py-2.5 transition-colors hover:bg-white/[0.05]"
            >
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-[13px] font-medium text-slate-100"><LocalizedText text={conflict.title} /></span>
                  {blocked && (
                    <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-amber-300">
                      <TriangleAlert className="size-3" />
                      <LocalizedText text="Can’t merge" />
                    </span>
                  )}
                </span>
                <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 text-[11px] text-slate-400">
                  {conflict.projectName && <span className="truncate"><LocalizedText text={conflict.projectName} /></span>}
                  {due && <>
                    <span aria-hidden className="text-slate-600">·</span>
                    <span className={cn('inline-flex shrink-0 items-center gap-1', urgent && 'font-medium text-amber-300')}>
                      <Clock3 className="size-3" />
                      <LocalizedText text={due} />
                    </span>
                  </>}
                  <span aria-hidden className="text-slate-600">·</span>
                  <span className="shrink-0">
                    {requester ? <><span className="text-slate-500"><LocalizedText text="Requested by" /> </span><LocalizedText text={requester} /></> : <LocalizedText text="Detected automatically" />}
                  </span>
                </span>
              </span>
              <button
                type="button"
                data-task-action
                onClick={(event) => { event.stopPropagation(); open(conflict) }}
                className="ds-review-cta inline-flex h-8 shrink-0 cursor-pointer items-center rounded-full px-4 text-xs font-medium whitespace-nowrap"
              >
                <LocalizedText text={task.label} />
              </button>
            </li>
          )
        })}
      </ul>
      {tasks.length > SHOWN && (
        <button type="button" aria-expanded={all} onClick={() => setAll((value) => !value)} className="ds-intrinsic mt-2 text-xs font-medium text-slate-400 transition-colors hover:text-white">
          {all ? <LocalizedText text="Show less" /> : <><LocalizedText text="Show all" /> <span className="tabular-nums">{tasks.length}</span></>}
        </button>
      )}
    </section>
  )
}

export default MyTasks
