import { useNavigate, useSearchParams } from 'react-router-dom'
import { CircleCheck } from 'lucide-react'
import { cn } from 'cn'
import ConflictRow from '@/components/conflicts/ConflictRow'
import { CATEGORY_TAB, CATEGORY_TAB_ACTIVE, CATEGORY_TAB_IDLE, PAGE_CARD } from '@/components/mergestudio/floatingStyles'
import { isOpen, isPendingMerge, needsReviewFrom, reviewerFor } from '@/lib/conflicts'
import { useConflictStore } from '@/state/ConflictStore'

// "Your queue" — what needs you across every project, first thing on the
// Dashboard. Three views, each from the shared conflict store with the
// same rules as the Workspace lists:
//   · Needs your review — you're a required reviewer and haven't signed off;
//   · High risk — open, high-risk items, labeled with whether they're
//     assigned to you (risk and assignment are different things);
//   · Approved · Pending merge — every required approval is in, not merged.
// The chosen view is in the URL (?queue=), so coming Back from a conflict
// lands on the same view.
const VIEWS = [
  { id: 'review', label: 'Needs your review', test: (c) => needsReviewFrom(c), empty: 'Nothing needs your review.' },
  { id: 'high', label: 'High risk', test: (c) => isOpen(c) && c.severity === 'high', empty: 'No open high-risk items.' },
  { id: 'merge', label: 'Approved · Pending merge', test: isPendingMerge, empty: 'Nothing is waiting to be merged.' },
]

function ReviewQueue() {
  const { conflicts } = useConflictStore()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const view = VIEWS.find((v) => v.id === params.get('queue')) ?? VIEWS[0]
  const items = conflicts.filter(view.test)

  function open(conflict) {
    navigate(`/projects/${conflict.projectId}/workspace`, { state: { openConflictId: conflict.id } })
  }

  function assignmentNote(conflict) {
    if (view.id !== 'high') return null
    return reviewerFor(conflict) ? 'You’re a reviewer' : 'Not assigned to you'
  }

  return (
    <section className={cn(PAGE_CARD, 'p-6')}>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className="text-[13px] font-semibold text-white">Your queue</h2>
        <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label="Queue">
          {VIEWS.map((v) => {
            const count = conflicts.filter(v.test).length
            return (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={v.id === view.id}
                onClick={() => setParams(v.id === VIEWS[0].id ? {} : { queue: v.id }, { replace: true })}
                className={cn(CATEGORY_TAB, 'gap-1.5', v.id === view.id ? CATEGORY_TAB_ACTIVE : CATEGORY_TAB_IDLE)}
              >
                {v.label}
                <span className={cn('tabular-nums', v.id === 'review' && count > 0 ? 'text-sky-300' : 'text-slate-500')}>{count}</span>
              </button>
            )
          })}
        </div>
      </div>
      {items.length === 0 ? (
        <p className="flex items-center justify-center gap-2 py-6 text-xs text-slate-500">
          <CircleCheck className="size-4 text-emerald-400" />
          {view.empty}
        </p>
      ) : (
        <div className="-mx-2 flex flex-col gap-0.5">
          {items.map((c) => (
            <ConflictRow key={c.id} conflict={c} showProject note={assignmentNote(c)} onOpen={open} />
          ))}
        </div>
      )}
    </section>
  )
}

export default ReviewQueue
