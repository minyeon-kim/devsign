import { conflictActivitySeries } from '@/data/mockData'

const BAR_PX_PER_UNIT = 12

function ConflictActivityChart() {
  const peakDay = conflictActivitySeries.find((day) => day.peak)

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Conflict activity</h3>
        <button
          type="button"
          className="rounded-full border border-border px-3 py-1 text-[11px] font-medium text-foreground/70 transition-colors hover:bg-muted"
        >
          See more
        </button>
      </div>

      <div className="mt-3 flex items-center gap-4">
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary" />
          Resolved
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="size-1.5 rounded-full bg-sky-400" />
          In review
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="size-1.5 rounded-full bg-muted-foreground/40" />
          Pending
        </span>
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
                <div className="bg-primary" style={{ height: day.resolved * BAR_PX_PER_UNIT }} />
                <div className="bg-sky-400" style={{ height: day.inReview * BAR_PX_PER_UNIT }} />
                <div className="bg-muted-foreground/30" style={{ height: day.pending * BAR_PX_PER_UNIT }} />
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
