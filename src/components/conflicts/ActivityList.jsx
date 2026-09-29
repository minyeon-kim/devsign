import { cn } from 'cn'
import { activities, allPeople, currentUser } from '@/data/mockData'
import { needsReviewFrom } from '@/lib/conflicts'
import { useConflictStore } from '@/state/ConflictStore'

const EVENT_ACTION = {
  approve: 'approved',
  changes: 'requested changes on',
  merge: 'merged',
}

// Review / merge actions taken this session (ConflictStore events), shaped
// like the seeded activity entries so both read as one feed.
function eventToActivity(event) {
  const person = event.actorId === currentUser.id ? currentUser : allPeople.find((p) => p.id === event.actorId)
  return {
    id: event.id,
    actorName: event.actorId === currentUser.id ? 'You' : person?.name,
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
function ActivityList({ projectId, limit = 6, onOpenConflict }) {
  const { conflicts, events } = useConflictStore()
  const items = [...events.map(eventToActivity), ...activities]
    .filter((a) => !projectId || a.projectId === projectId)
    .slice(0, limit)

  if (items.length === 0) return <p className="py-4 text-center text-xs text-slate-500">Nothing yet.</p>

  return (
    <ul className="-mx-2 flex flex-col gap-0.5">
      {items.map((a) => {
        const conflict = a.conflictId && conflicts.find((c) => c.id === a.conflictId)
        const actionNeeded = conflict && needsReviewFrom(conflict)
        return (
          <li
            key={a.id}
            className={cn(
              'flex items-center gap-3 rounded-lg px-2 py-2 text-xs',
              actionNeeded && 'bg-sky-400/[0.06] shadow-[inset_2px_0_0_0_rgb(56_189_248)]'
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
              {actionNeeded && <span className="text-[11px] font-medium text-sky-300">Needs your review</span>}
            </span>
            {conflict && onOpenConflict && (
              <button
                type="button"
                onClick={() => onOpenConflict(conflict)}
                className={cn(
                  'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                  actionNeeded ? 'bg-sky-400/15 text-sky-200 hover:bg-sky-400/25' : 'text-slate-400 hover:bg-white/[0.06] hover:text-white'
                )}
              >
                {actionNeeded ? 'Review' : 'Open'}
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
