import { useNavigate } from 'react-router-dom'
import ChangeList from '@/components/conflicts/ChangeList'
import { changeHref } from '@/lib/changeLink'
import { needsReviewFrom } from '@/lib/conflicts'
import { currentUserFor } from '@/data/mockData'
import { LocalizedText } from '@/i18n/runtime'
import { useConflictStore } from '@/state/ConflictStore'

// Home's first thing: only what's waiting on *you*, across every project (a project's own home lists all its
// changes — this is the one place that gathers yours). One line each, the soonest due first; a row opens that
// change in its project. With nothing waiting, nothing is said.
export default function ReviewQueue() {
  const navigate = useNavigate()
  const { conflicts } = useConflictStore()
  const waiting = conflicts.filter((conflict) => needsReviewFrom(conflict, currentUserFor(conflict.projectId).id))
  if (!waiting.length) return null
  return (
    <section data-review-queue aria-labelledby="review-queue-title">
      <h2 id="review-queue-title" className="mb-3 flex items-baseline gap-1.5 text-[15px] font-semibold text-foreground">
        <LocalizedText text="Waiting on your review" />
        <span className="font-normal text-slate-500 tabular-nums">{waiting.length}</span>
      </h2>
      <ChangeList label="Waiting on your review" conflicts={waiting} withProject onOpen={(conflict) => navigate(changeHref(conflict.projectId, conflict.id))} />
    </section>
  )
}
