import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from 'cn'

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function getMonthCells(date) {
  const year = date.getFullYear()
  const month = date.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startWeekday = new Date(year, month, 1).getDay()
  return [...Array(startWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
}

// The calendar month is decorative furniture (DevSign has no real
// scheduling feature).
function MergeSchedule() {
  const today = new Date()
  const cells = getMonthCells(today)
  const monthLabel = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

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
    </div>
  )
}

export default MergeSchedule
