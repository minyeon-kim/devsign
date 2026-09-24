import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from 'cn'
import { projects } from '@/data/mockData'

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const BADGE_COLORS = ['bg-amber-500 text-black/80', 'bg-rose-500 text-white', 'bg-emerald-500 text-black/80', 'bg-violet-500 text-white']

function getMonthCells(date) {
  const year = date.getFullYear()
  const month = date.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startWeekday = new Date(year, month, 1).getDay()
  return [...Array(startWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
}

// The calendar month is decorative furniture (DevSign has no real
// scheduling feature) — the useful part is the timeline underneath it,
// which lists every project with a merge waiting on it.
function MergeSchedule() {
  const navigate = useNavigate()
  const today = new Date()
  const cells = getMonthCells(today)
  const monthLabel = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const pending = projects.filter((p) => p.pendingMerges > 0)

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground">Merge schedule</h3>

      <div className="mt-3 flex items-center justify-between">
        <ChevronLeft className="size-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-foreground/80">{monthLabel}</span>
        <ChevronRight className="size-3.5 text-muted-foreground" />
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label, i) => (
          <span key={i} className="text-center text-[10px] text-muted-foreground/70">
            {label}
          </span>
        ))}
        {cells.map((day, i) => {
          const isToday = day === today.getDate()
          return (
            <span key={i} className="flex items-center justify-center py-0.5">
              {day && (
                <span
                  className={cn(
                    'flex size-5 items-center justify-center rounded-full text-[11px]',
                    isToday ? 'bg-primary font-semibold text-primary-foreground' : 'text-foreground/70'
                  )}
                >
                  {day}
                </span>
              )}
            </span>
          )
        })}
      </div>

      <div className="mt-4 border-t border-border/60 pt-3">
        <p className="text-xs font-semibold text-foreground/80">Pending merges</p>
        {pending.length === 0 ? (
          <p className="mt-2 text-[11px] text-muted-foreground">Nothing waiting to merge.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {pending.map((project, index) => (
              <li key={project.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/projects/${project.id}/workspace`)}
                  className="flex w-full items-center gap-2.5 text-left"
                >
                  <span
                    className={cn(
                      'shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold',
                      BADGE_COLORS[index % BADGE_COLORS.length]
                    )}
                  >
                    {project.pendingMerges} PR
                  </span>
                  <span className="truncate text-[11.5px] text-foreground/80">{project.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default MergeSchedule
