import { CircleCheck } from 'lucide-react'
import { cn } from 'cn'
import { onboardingChecklist } from '@/data/mockData'

function GettingStarted() {
  const doneCount = onboardingChecklist.filter((step) => step.done).length
  const total = onboardingChecklist.length
  const isComplete = doneCount === total

  if (isComplete) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-3 py-2">
        <CircleCheck className="size-3.5 shrink-0 text-emerald-400" />
        <span className="text-xs text-muted-foreground">Getting started · Completed</span>
      </div>
    )
  }

  const percent = Math.round((doneCount / total) * 100)

  return (
    <div className="rounded-lg border border-border bg-card p-3.5">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-foreground">Getting started</h3>
        <span className="text-[11px] text-muted-foreground">
          {doneCount} / {total}
        </span>
      </div>

      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>

      <ul className="mt-2.5 flex flex-col gap-1.5">
        {onboardingChecklist.map((step) => (
          <li key={step.id} className="flex items-center gap-2">
            <CircleCheck
              className={cn(
                'size-3 shrink-0',
                step.done ? 'text-primary' : 'text-muted-foreground/40'
              )}
            />
            <span
              className={cn(
                'text-[11px]',
                step.done ? 'text-foreground/60 line-through' : 'text-foreground/80'
              )}
            >
              {step.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default GettingStarted
