import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from 'cn'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { mergeSchedule } from '@/data/mockData'

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function isoFor(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function getMonthCells(date) {
  const year = date.getFullYear()
  const month = date.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startWeekday = new Date(year, month, 1).getDay()
  return [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1, dateISO: isoFor(year, month, i + 1) })),
  ]
}

function MergeSchedule() {
  const navigate = useNavigate()
  const [monthDate, setMonthDate] = useState(() => new Date())
  const [selectedDateISO, setSelectedDateISO] = useState(null)

  const today = new Date()
  const cells = getMonthCells(monthDate)
  const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const scheduledByDate = mergeSchedule.reduce((map, entry) => {
    ;(map[entry.dateISO] ??= []).push(entry)
    return map
  }, {})
  const selectedEntries = selectedDateISO ? (scheduledByDate[selectedDateISO] ?? []) : []

  function shiftMonth(delta) {
    setMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1))
  }

  function handleOpenProject(projectId) {
    setSelectedDateISO(null)
    navigate(`/projects/${projectId}/workspace`)
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground">Merge schedule</h3>

      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          aria-label="Previous month"
          className="flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" />
        </button>
        <span className="text-xs font-medium text-foreground/80">{monthLabel}</span>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          aria-label="Next month"
          className="flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronRight className="size-3.5" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label, i) => (
          <span key={i} className="text-center text-[10px] text-muted-foreground/70">
            {label}
          </span>
        ))}
        {cells.map((cell, i) => {
          if (!cell) return <span key={i} className="py-0.5" />
          const isToday = cell.dateISO === isoFor(today.getFullYear(), today.getMonth(), today.getDate())
          const hasSchedule = Boolean(scheduledByDate[cell.dateISO])
          return (
            <div key={i} className="flex items-center justify-center py-0.5">
              <button
                type="button"
                onClick={() => hasSchedule && setSelectedDateISO(cell.dateISO)}
                className={cn(
                  'relative flex size-5 items-center justify-center rounded-full text-[11px] transition-colors',
                  isToday ? 'bg-primary font-semibold text-primary-foreground' : 'text-foreground/70 hover:bg-muted',
                  hasSchedule && !isToday && 'font-medium text-foreground'
                )}
              >
                {cell.day}
                {hasSchedule && (
                  <span
                    className={cn(
                      'absolute -bottom-1 size-1 rounded-full',
                      isToday ? 'bg-primary-foreground' : 'bg-primary'
                    )}
                  />
                )}
              </button>
            </div>
          )
        })}
      </div>

      <Dialog open={Boolean(selectedDateISO)} onOpenChange={(open) => !open && setSelectedDateISO(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Scheduled merges</DialogTitle>
            <DialogDescription>
              {selectedDateISO &&
                new Date(`${selectedDateISO}T00:00:00`).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 flex flex-col divide-y divide-border/60">
            {selectedEntries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => handleOpenProject(entry.projectId)}
                className="flex flex-col gap-0.5 py-2.5 text-left transition-colors hover:text-foreground"
              >
                <span className="text-sm text-foreground">{entry.title}</span>
                <span className="text-xs text-muted-foreground">
                  {entry.projectName} · {entry.time}
                </span>
              </button>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSelectedDateISO(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default MergeSchedule
