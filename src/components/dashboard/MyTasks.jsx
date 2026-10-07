import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, CircleCheck, Clock3, Sparkles, X } from 'lucide-react'
import { cn } from 'cn'
import { checksFor } from '@/components/mergestudio/mergeChecks'
import { PAGE_CARD } from '@/components/mergestudio/floatingStyles'
import { allPeople, currentUserFor, mergeListItems } from '@/data/mockData'
import { LocalizedText } from '@/i18n/runtime'
import { TASK_LABEL, authorOf, dueUrgency, remainingWorkOf, taskGroups, taskListOf } from '@/lib/conflicts'
import { differencesOf, flowOf } from '@/lib/conflictInsight'
import { useConflictStore } from '@/state/ConflictStore'

// "My tasks" — the first thing on the Dashboard.
//   · The hero: the one task to do first (lib/conflicts' pickHero: due
//     within 24h → work in progress → soonest due), on a tinted card with the
//     screen's one filled button. Work in progress says where it stands.
//   · The rest, in one list by due date — a type chip (Decide / Review /
//     In progress), the title, "project · who asked", the two values a
//     decision is between, and the due date at the right. The whole row is
//     the way in; its action shows on hover or focus.
// A few rows by default (TASKS_SHOWN), the rest behind "+N" — which opens
// them in place and turns into "Show less".
const TASKS_SHOWN = 3

// A conflict that can't merge as it stands: a required check fails.
function isBlocked(conflict) {
  const item = mergeListItems.find((entry) => entry.id === conflict.mergeItemId || entry.conflictId === conflict.id)
  if (!item) return false
  const settled = [...(conflict.acceptedChecks ?? []), ...(conflict.reviewStage === 'approved' ? conflict.exceptionChecks ?? [] : [])]
  return (checksFor(item)?.blocking ?? []).some((check) => check.id !== 'decided' && !settled.includes(check.id))
}

// Who asked: whoever requested the review, else the change's author — never
// the viewer on a task that's waiting on them (a request can't be asked of
// yourself; a record that says so has the wrong person in `requestedBy`).
function requesterOf(conflict) {
  const viewerId = currentUserFor(conflict.projectId).id
  const requested = conflict.requestedBy && conflict.requestedBy !== viewerId ? conflict.requestedBy : null
  return allPeople.find((person) => person.id === (requested ?? authorOf(conflict))) ?? null
}

const isRevert = (conflict) => /^Revert: /.test(conflict.title ?? '')
const titleOf = (conflict) => (conflict.title ?? '').replace(/^Revert: /, '')

const KIND = {
  decide: { chip: 'Decide', label: 'Needs a decision', action: 'Choose a value' },
  review: { chip: 'Review', label: 'Review requests', action: 'Start review' },
  continue: { chip: 'In progress', label: 'In progress', action: TASK_LABEL.continue },
  merge: { chip: 'In progress', label: 'In progress', action: TASK_LABEL.merge },
}
const URGENCY_CLASS = {
  danger: 'font-medium text-red-300',
  warn: 'font-medium text-amber-300',
  muted: 'text-slate-400',
}

function Due({ conflict, icon = false }) {
  const due = dueUrgency(conflict)
  if (!due) return null
  return (
    <span data-due={due.level} className={cn('inline-flex shrink-0 items-center justify-end gap-1 text-xs leading-4 whitespace-nowrap tabular-nums', URGENCY_CLASS[due.level])}>
      {icon && <Clock3 aria-hidden className="size-3" />}
      <LocalizedText text={due.text} />
    </span>
  )
}

// Project · who asked: a person as avatar + "Request: Name"; a detection by
// the system as an icon + its name.
function Source({ conflict }) {
  const person = requesterOf(conflict)
  return (
    <span className="inline-flex min-w-0 shrink-0 items-center gap-1">
      {person ? (
        <>
          <span aria-hidden className={cn('flex size-4 shrink-0 items-center justify-center rounded-full text-[8px] font-medium text-white', person.colorClass)}>{person.initials}</span>
          <LocalizedText text={`Request: ${person.name}`} />
        </>
      ) : (
        <>
          <Sparkles aria-hidden className="size-3 shrink-0" />
          <LocalizedText text="Detected automatically" />
        </>
      )}
    </span>
  )
}

function Meta({ conflict, className }) {
  return (
    <span className={cn('flex min-w-0 items-center gap-x-1.5 text-[11px] text-slate-400', className)}>
      {conflict.projectName && <span className="truncate"><LocalizedText text={conflict.projectName} /></span>}
      {conflict.projectName && <span aria-hidden className="text-slate-600">·</span>}
      <Source conflict={conflict} />
    </span>
  )
}

function BlockedBadge() {
  return <span data-blocked className="inline-flex h-4 shrink-0 items-center rounded bg-amber-400/10 px-1.5 text-[10.5px] font-medium text-amber-200"><LocalizedText text="Merge blocked" /></span>
}

const HEX = /#[0-9a-fA-F]{3,8}\b/
const plain = (value) => String(value ?? '').replace(/\s*\(.*\)\s*$/, '')

// The two values a decision is between: "16px ↔ 20px", or two swatches for
// colors (when both values are literal colors).
function ValuePair({ conflict }) {
  const diff = differencesOf(conflict).find((entry) => !entry.shared)
  if (!diff) return null
  const hexes = [HEX.exec(String(diff.current))?.[0], HEX.exec(String(diff.expected))?.[0]]
  const label = `${diff.label}: ${diff.current} → ${diff.expected}`
  if (diff.kind === 'color' && hexes[0] && hexes[1]) {
    return (
      <span data-value-pair title={label} aria-label={label} className="hidden w-32 shrink-0 items-center justify-end gap-1.5 sm:inline-flex">
        <span aria-hidden className="size-4 rounded ring-1 ring-white/25" style={{ backgroundColor: hexes[0] }} />
        <span aria-hidden className="text-[11px] text-slate-400">↔</span>
        <span aria-hidden className="size-4 rounded ring-1 ring-white/25" style={{ backgroundColor: hexes[1] }} />
      </span>
    )
  }
  return (
    <span data-value-pair title={label} translate="no" className="hidden w-32 shrink-0 truncate text-right font-mono text-[11px] text-slate-400 tabular-nums sm:inline-block">
      {plain(diff.current)} ↔ {plain(diff.expected)}
    </span>
  )
}

function TaskRow({ entry, hideBlocked, onOpen }) {
  const { conflict, task, blocked } = entry
  const kind = KIND[task.kind]
  return (
    <li>
      <button
        type="button"
        data-task={task.kind}
        onClick={() => onOpen(conflict)}
        className="group flex w-full cursor-pointer items-center gap-4 rounded-lg px-3 py-3 text-left transition-colors hover:bg-white/[0.06] focus-visible:bg-white/[0.06] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-300"
      >
        <span data-task-chip className="inline-flex h-5 w-14 shrink-0 items-center justify-center rounded-md bg-white/[0.07] text-[11px] font-medium whitespace-nowrap text-slate-200">
          <LocalizedText text={kind.chip} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[13px] font-medium text-slate-100"><LocalizedText text={conflict.title} /></span>
            {blocked && !hideBlocked && <BlockedBadge />}
          </span>
          <Meta conflict={conflict} className="mt-1" />
        </span>
        {task.kind === 'decide' && <ValuePair conflict={conflict} />}
        {/* Due and the action share one cell: the due date gives way to the action on hover or focus. */}
        <span className="grid w-24 shrink-0 justify-items-end">
          <span className="col-start-1 row-start-1 transition-opacity group-hover:opacity-0 group-focus-visible:opacity-0"><Due conflict={conflict} /></span>
          <span className="col-start-1 row-start-1 inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap text-slate-100 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <LocalizedText text={kind.action} />
            <ArrowRight aria-hidden className="size-3.5" />
          </span>
        </span>
      </button>
    </li>
  )
}

// Where in-progress work stands: the step it's at, out of the review flow's.
function progressOf(conflict) {
  const flow = flowOf(conflict)
  if (!flow) return null
  const total = flow.steps.length
  const current = flow.steps.findIndex((step) => step.state === 'current')
  const step = current >= 0 ? current + 1 : flow.steps.filter((entry) => entry.state === 'done').length
  return { step, total }
}

function Hero({ entry, hideBlocked, onOpen }) {
  const { conflict, task, blocked } = entry
  const inProgress = task.kind === 'continue' || task.kind === 'merge'
  const progress = inProgress ? progressOf(conflict) : null
  const label = inProgress
    ? `${isRevert(conflict) ? 'Revert in progress' : 'Resolution in progress'}${progress ? ` · Step ${progress.step} of ${progress.total}` : ''}`
    : KIND[task.kind].label
  return (
    <div data-task-first className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl bg-emerald-400/[0.07] px-4 py-4 ring-1 ring-emerald-300/15">
      <div className="min-w-0 flex-1 basis-56">
        <p data-task-label className="text-[11px] leading-4 font-medium text-emerald-200"><LocalizedText text={label} /></p>
        {progress && (
          <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.step} className="mt-2 h-0.5 w-full max-w-64 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-emerald-300" style={{ width: `${(progress.step / progress.total) * 100}%` }} />
          </div>
        )}
        <p className="mt-2.5 flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold text-white"><LocalizedText text={titleOf(conflict)} /></span>
          {blocked && !hideBlocked && <BlockedBadge />}
        </p>
        <p className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs text-slate-200">
          <span data-task-remaining><LocalizedText text={remainingWorkOf(conflict)} /></span>
          {dueUrgency(conflict) && <><span aria-hidden className="text-slate-600">·</span><Due conflict={conflict} icon /></>}
        </p>
        <Meta conflict={conflict} className="mt-1" />
      </div>
      <button type="button" data-task-action onClick={() => onOpen(conflict)} className="ds-review-cta inline-flex h-8 shrink-0 cursor-pointer items-center rounded-full px-4 text-xs font-medium whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300">
        <LocalizedText text={KIND[task.kind].action} />
      </button>
    </div>
  )
}

// `projectId`: show only that project's tasks (set from a project card's
// "Review requests" chip); `onClearProject` lifts it again.
function MyTasks({ projectId = null, onClearProject }) {
  const { conflicts } = useConflictStore()
  const navigate = useNavigate()
  const [all, setAll] = useState(false)
  const everyone = Object.values(taskGroups(conflicts, { isBlocked })).flat()
  const entries = projectId ? everyone.filter((entry) => entry.conflict.projectId === projectId) : everyone
  const open = (conflict) => navigate(`/projects/${conflict.projectId}/workspace`, { state: { openConflictId: conflict.id } })

  if (everyone.length === 0) {
    return (
      <section data-my-tasks="empty" aria-label="My tasks" className={cn(PAGE_CARD, 'flex items-center gap-2 px-6 py-3 text-xs text-slate-400')}>
        <CircleCheck className="size-4 shrink-0 text-emerald-400" />
        <LocalizedText text="Nothing to do right now" />
      </section>
    )
  }

  const { hero, rest, visible: shown, hidden } = taskListOf(entries, { limit: TASKS_SHOWN, expanded: all })
  // When every decision blocks the merge, that's said once under the title;
  // otherwise the blocked rows say so themselves.
  const decisions = entries.filter((entry) => entry.task.kind === 'decide')
  const allDecisionsBlock = decisions.length > 0 && decisions.every((entry) => entry.blocked)
  const projectName = projectId ? conflicts.find((conflict) => conflict.projectId === projectId)?.projectName : null

  return (
    <section data-my-tasks aria-labelledby="my-tasks-title" className={cn(PAGE_CARD, 'px-5 py-5')}>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-2">
        <h2 id="my-tasks-title" className="flex items-baseline gap-2 text-[13px] font-semibold text-white">
          <LocalizedText text="My tasks" />
          <span className="text-xs font-normal text-slate-300 tabular-nums">{entries.length}</span>
        </h2>
        {allDecisionsBlock && <p data-task-hint className="text-xs text-slate-400"><LocalizedText text="A value has to be chosen before merging" /></p>}
        {projectId && (
          <button type="button" data-task-filter onClick={onClearProject} className="ds-intrinsic ml-auto inline-flex h-6 items-center gap-1 rounded-full bg-white/[0.07] pr-1.5 pl-2.5 text-[11px] font-medium text-slate-200 transition-colors hover:bg-white/[0.12] focus-visible:outline-2 focus-visible:outline-emerald-300">
            <LocalizedText text={projectName ?? projectId} />
            <X aria-label="Clear filter" className="size-3" />
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="px-1 py-3 text-xs text-slate-400"><LocalizedText text="No tasks in this project" /></p>
      ) : (
        <>
          <Hero entry={hero} hideBlocked={allDecisionsBlock && hero.task.kind === 'decide'} onOpen={open} />
          {rest.length > 0 && (
            <ul className="divide-y divide-white/[0.06]">
              {shown.map((entry) => <TaskRow key={entry.conflict.id} entry={entry} hideBlocked={allDecisionsBlock && entry.task.kind === 'decide'} onOpen={open} />)}
            </ul>
          )}
          {hidden > 0 && (
            <button type="button" data-task-more aria-expanded={all} onClick={() => setAll((value) => !value)} className="ds-intrinsic mt-1.5 rounded px-3 text-xs font-medium text-slate-300 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300">
              {all ? <LocalizedText text="Show less" /> : <><span className="tabular-nums">+{hidden}</span> <LocalizedText text="Show more" /></>}
            </button>
          )}
        </>
      )}
    </section>
  )
}

export default MyTasks
