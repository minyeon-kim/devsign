import { ArrowRight } from 'lucide-react'
import { cn } from 'cn'
import { LocalizedText } from '@/i18n/runtime'
import { NAV_BUTTON, NAV_BUTTON_ICON } from '@/components/conflicts/ConflictBadges'
import { activities, allPeople, currentUserFor } from '@/data/mockData'
import { TASK_LABEL, needsReviewFrom } from '@/lib/conflicts'
import { useConflictStore } from '@/state/ConflictStore'

const EVENT_ACTION = {
  approve: 'approved',
  changes: 'requested changes on',
  merge: 'merged',
  revert: 'opened a revert of',
}

// Review / merge actions taken this session (ConflictStore events), shaped
// like the seeded activity entries so both read as one feed.
function eventToActivity(event) {
  const viewer = currentUserFor(event.projectId)
  const person = event.actorId === viewer.id ? viewer : allPeople.find((p) => p.id === event.actorId)
  return {
    id: event.id,
    actorName: event.actorId === viewer.id ? 'You' : person?.name,
    actorInitials: person?.initials,
    actorColorClass: person?.colorClass,
    action: EVENT_ACTION[event.kind] ?? event.kind,
    target: event.title,
    conflictId: event.conflictId,
    projectId: event.projectId,
    timestamp: event.timeLabel,
  }
}

// Recent activity. Entries that ask something of you — a review you still
// owe — are set apart (accent, "Needs your review", a Review action) from
// plain "this happened" entries, and stop standing out once you've
// reviewed, since both read the same conflict store.
function ActivityList({ projectId, limit = 6, onOpenConflict, inset = false }) {
  const { conflicts, events } = useConflictStore()
  const items = [...events.map(eventToActivity), ...activities]
    .filter((a) => !projectId || a.projectId === projectId)
    .slice(0, limit)

  if (items.length === 0) return <p className="py-4 text-center text-xs text-slate-500">Nothing yet.</p>

  return (
    <ul className={cn('flex flex-col gap-0.5', !inset && '-mx-2')}>
      {items.map((a) => {
        const conflict = a.conflictId && conflicts.find((c) => c.id === a.conflictId)
        const actionNeeded = conflict && needsReviewFrom(conflict)
        return (
          <li
            key={a.id}
            className={cn(
              'flex items-center gap-3 rounded-lg px-2 py-2 text-xs',
              actionNeeded && 'bg-emerald-400/[0.06]'
            )}
          >
            <span
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white',
                a.actorColorClass
              )}
            >
              {a.actorInitials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-slate-400">
                <span className="font-medium text-slate-200">{a.actorName}</span> {a.action}{' '}
                <span className="text-slate-200">{a.target}</span>
              </span>
              {actionNeeded && <span className="text-[11px] font-medium text-emerald-300">Needs your review</span>}
            </span>
            {/* The way to the conflict: the same secondary button as
                every other list — "Review →" when it's yours to review. */}
            {conflict && onOpenConflict && (
              <button type="button" onClick={() => onOpenConflict(conflict)} className={cn(NAV_BUTTON, 'h-7')}>
                <LocalizedText text={actionNeeded ? TASK_LABEL.review : 'View'} />
                <ArrowRight className={NAV_BUTTON_ICON} />
              </button>
            )}
            <span className="w-14 shrink-0 text-right text-[11px] text-slate-500">{a.timestamp}</span>
          </li>
        )
      })}
    </ul>
  )
}

export default ActivityList
