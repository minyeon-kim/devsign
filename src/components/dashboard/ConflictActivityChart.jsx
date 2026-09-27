import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from 'cn'
import { conflictActivitySeries } from '@/data/mockData'

const BAR_PX_PER_UNIT = 12

const SERIES = [
  { key: 'resolved', label: 'Resolved', dotClass: 'bg-primary', barClass: 'bg-primary' },
  { key: 'inReview', label: 'In review', dotClass: 'bg-sky-400', barClass: 'bg-sky-400' },
  { key: 'pending', label: 'Pending', dotClass: 'bg-muted-foreground/40', barClass: 'bg-muted-foreground/30' },
]

function ConflictActivityChart() {
  const navigate = useNavigate()
  const [visible, setVisible] = useState(() => new Set(SERIES.map((s) => s.key)))
  const peakDay = conflictActivitySeries.find((day) => day.peak)

  function toggleSeries(key) {
    setVisible((prev) => {
      const next = new Set(prev)
      if (next.has(key) && next.size === 1) return next // keep at least one series visible
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Conflict activity</h3>
        <button
          type="button"
          onClick={() => navigate('/activity')}
          className="rounded-full border border-border px-3 py-1 text-[11px] font-medium text-foreground/70 transition-colors hover:bg-muted"
        >
          See more
        </button>
      </div>

      <div className="mt-3 flex items-center gap-4">
        {SERIES.map((s) => {
          const isOn = visible.has(s.key)
          return (
            <button
              key={s.key}
              type="button"
              aria-pressed={isOn}
              onClick={() => toggleSeries(s.key)}
              className={cn(
                'flex items-center gap-1.5 text-[11px] transition-colors',
                isOn ? 'text-muted-foreground hover:text-foreground' : 'text-muted-foreground/40'
              )}
            >
              <span className={cn('size-1.5 rounded-full', s.dotClass, !isOn && 'opacity-40')} />
              {s.label}
            </button>
          )
        })}
      </div>

      <div className="mt-4 flex h-[130px] items-end justify-around gap-3">
        {conflictActivitySeries.map((day) => (
          <div key={day.label} className="flex flex-col items-center gap-1.5">
            <div className="relative">
              {day.peak && (
                <span className="absolute -top-7 left-1/2 -translate-x-1/2 rounded-md border border-border bg-popover px-2 py-1 text-[10px] font-medium whitespace-nowrap text-foreground shadow-sm">
                  Peak day
                </span>
              )}
              <div className="flex w-4 flex-col-reverse overflow-hidden rounded-t-sm rounded-b-[3px]">
                {SERIES.map((s) => (
                  <div
                    key={s.key}
                    className={cn(s.barClass, 'transition-[height] duration-150')}
                    style={{ height: visible.has(s.key) ? day[s.key] * BAR_PX_PER_UNIT : 0 }}
                  />
                ))}
              </div>
            </div>
            <span className="text-[10px] text-muted-foreground">{day.label}</span>
          </div>
        ))}
      </div>
      {peakDay && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          {peakDay.label} resolved the most conflicts this week.
        </p>
      )}
    </div>
  )
}

export default ConflictActivityChart
