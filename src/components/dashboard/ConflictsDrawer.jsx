import { useLocation, useNavigate } from 'react-router-dom'
import { CircleCheck } from 'lucide-react'
import { cn } from 'cn'
import { ListStatusLabel } from '@/components/conflicts/ConflictBadges'
import { ConflictTypeTag, MismatchLabel } from '@/components/conflicts/ConflictInsight'
import { useConflictList } from '@/components/conflicts/useConflictList'
import { LocalizedText } from '@/i18n/runtime'
import { isOpen, shortDue, taskFor } from '@/lib/conflicts'

// The drawer behind the activity bar's Conflict Points icon: the same list
// as the bottom panel's tab (useConflictList — one set of records, filters
// and order), drawn for a narrow column. A row opens that conflict in the
// full-screen viewer over the work area; from a page without one (the
// project's home, Docs, History) it goes to the Workspace and opens there.
function ConflictsDrawer({ project }) {
  const { conflicts, visible, filter, shownFilters, setFilter, countOf, selectedId, open } = useConflictList({ view: 'overlay' })
  const navigate = useNavigate()
  const { pathname } = useLocation()
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

  return (
    <div data-conflicts-drawer className="flex flex-col pb-2">
      <div role="group" aria-label="Filter conflicts" className="mb-2 flex flex-wrap gap-x-3 gap-y-1 px-2.5">
        {shownFilters.map((entry) => (
          <button
            key={entry.id}
            type="button"
            aria-pressed={entry.id === filter.id}
            onClick={() => setFilter(entry.id)}
            className={cn('ds-intrinsic inline-flex h-6 shrink-0 items-center gap-1 text-xs whitespace-nowrap transition-colors', entry.id === filter.id ? 'font-medium text-white' : 'text-slate-400 hover:text-slate-200')}
          >
            <LocalizedText text={entry.label} />
            <span className="text-slate-500 tabular-nums">{countOf(entry)}</span>
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <p className="px-2.5 py-6 text-center text-xs text-slate-500"><LocalizedText text="No conflicts in this view." /></p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((conflict) => {
            const task = taskFor(conflict)
            const due = shortDue(conflict.dueLabel)
            return (
              <li key={conflict.id}>
                <button
                  type="button"
                  data-conflict-row={conflict.id}
                  aria-current={selectedId === conflict.id ? 'true' : undefined}
                  onClick={() => openRow(conflict)}
                  className={cn(
                    'group flex w-full min-w-0 cursor-pointer flex-col gap-1.5 rounded-xl px-3.5 py-3.5 text-left transition-colors hover:bg-white/[0.05] focus-visible:outline-2 focus-visible:outline-emerald-300 aria-[current=true]:bg-white/[0.08]',
                    !isOpen(conflict) && 'opacity-50'
                  )}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-100"><LocalizedText text={conflict.title} /></span>
                    {!conflict.rollback && <ConflictTypeTag conflict={conflict} quiet />}
                  </span>
                  <MismatchLabel conflict={conflict} className="truncate text-[10.5px] text-slate-500" />
                  <span className="flex min-w-0 items-center gap-x-2 text-[10.5px] text-slate-500">
                    <ListStatusLabel conflict={conflict} className="text-[10.5px] font-normal text-slate-400" />
                    {due && <span className={cn('shrink-0', /overdue|today/i.test(conflict.dueLabel) && 'font-medium text-amber-300')}><LocalizedText text={due} /></span>}
                    {/* What's yours to do there, in the same words as everywhere. */}
                    {task && <span data-task-action={task.kind} className="ml-auto shrink-0 font-medium text-slate-400 transition-colors group-hover:text-emerald-300"><LocalizedText text={task.label} /></span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default ConflictsDrawer
