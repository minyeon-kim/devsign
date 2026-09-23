import { CircleCheck } from 'lucide-react'
import { cn } from 'cn'
import { onboardingChecklist } from '@/data/mockData'

function GettingStarted() {
  const doneCount = onboardingChecklist.filter((step) => step.done).length
  const percent = Math.round((doneCount / onboardingChecklist.length) * 100)

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Getting started</h3>
        <span className="text-[11px] text-muted-foreground">
          {doneCount} / {onboardingChecklist.length} completed
        </span>
      </div>

      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>

      <ul className="mt-3 flex flex-col gap-2">
        {onboardingChecklist.map((step) => (
          <li key={step.id} className="flex items-center gap-2">
            <CircleCheck
              className={cn(
                'size-3.5 shrink-0',
                step.done ? 'text-primary' : 'text-muted-foreground/40'
              )}
            />
            <span
              className={cn(
                'text-xs',
                step.done ? 'text-foreground/70 line-through' : 'text-foreground/90'
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
