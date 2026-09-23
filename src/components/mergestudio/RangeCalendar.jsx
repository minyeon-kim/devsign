import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from 'cn'
import { DUE_PRESETS, addDays, formatDay, sameDay, startOfDay } from '@/components/mergestudio/mergeFilters'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

// Due date pieces for the Merge List's Filter menu (MergeFilterMenu).

// Label for the Due filter: the range (plus "+N" for any presets also
// picked), a single preset's name, or a count.
export function dueSummary(due) {
  if (due.range) {
    const { from, to } = due.range
    const range = !to || sameDay(from, to) ? formatDay(from) : `${formatDay(from)} – ${formatDay(to)}`
    return due.presets.length ? `${range} +${due.presets.length}` : range
  }
  if (due.presets.length === 1) return DUE_PRESETS.find((p) => p.id === due.presets[0])?.label
  if (due.presets.length > 1) return `Due · ${due.presets.length}`
  return 'Due'
}

// Month grid for a custom range: first click sets the start, second the end
// (swapped if earlier), a third starts over. Days that have a due item get
// a dot so the calendar doubles as a quick "what's due when" overview.
export function RangeCalendar({ range, onChange, markedDays }) {
  const today = startOfDay(new Date())
  const [month, setMonth] = useState(() => {
    const base = range?.from ?? today
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const days = Array.from({ length: 42 }, (_, i) => addDays(first, i - first.getDay()))
  const from = range?.from ? startOfDay(range.from) : null
  const to = range?.to ? startOfDay(range.to) : null

  function pick(day) {
    if (!from || to) onChange({ from: day, to: null })
    else if (day < from) onChange({ from: day, to: from })
    else onChange({ from, to: day })
  }

  return (
    <div>
      <div className="mb-1.5 flex h-7 items-center justify-between">
        <button
          type="button"
          title="Previous month"
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-white/5 hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" />
        </button>
        <span className="text-xs font-semibold text-foreground">
          {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </span>
        <button
          type="button"
          title="Next month"
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-white/5 hover:text-foreground"
        >
          <ChevronRight className="size-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="flex h-6 items-center justify-center text-[10px] font-medium text-muted-foreground">
            {d}
          </span>
        ))}
        {days.map((day) => {
          const inMonth = day.getMonth() === month.getMonth()
          const isFrom = from && sameDay(day, from)
          const isTo = to && sameDay(day, to)
          const inRange = from && to && day > from && day < to
          const marked = markedDays.some((m) => sameDay(m, day))
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => pick(day)}
              className={cn(
                'relative flex h-8 items-center justify-center text-[11px] tabular-nums transition-colors',
                inRange && 'bg-white/[0.06]',
                isFrom && to && !sameDay(from, to) && 'rounded-l-full bg-white/[0.06]',
                isTo && !sameDay(from, to) && 'rounded-r-full bg-white/[0.06]'
              )}
            >
              <span
                className={cn(
                  'flex size-7 items-center justify-center rounded-full',
                  isFrom || isTo
                    ? 'bg-foreground font-semibold text-background'
                    : cn(inMonth ? 'text-foreground' : 'text-muted-foreground/40', 'hover:bg-white/10'),
                  sameDay(day, today) && !(isFrom || isTo) && 'ring-1 ring-inset ring-white/25'
                )}
              >
                {day.getDate()}
              </span>
              {marked && !(isFrom || isTo) && <span className="absolute bottom-0.5 size-1 rounded-full bg-violet-400" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
