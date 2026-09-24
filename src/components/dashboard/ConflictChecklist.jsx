import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { cn } from 'cn'
import { conflictChecklist } from '@/data/mockData'

// The dashboard's primary checklist: every open design/code conflict
// across projects, resolved or not, in one scannable list — the same
// role "Daily Tasks" plays in a generic task tool, mapped onto DevSign's
// actual unit of work (a conflict, not a to-do).
function ConflictChecklist() {
  const navigate = useNavigate()
  const firstUnresolved = conflictChecklist.find((c) => !c.resolved)

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Active conflicts</h3>
        <button
          type="button"
          onClick={() => navigate('/activity')}
          className="rounded-full border border-border px-3 py-1 text-[11px] font-medium text-foreground/70 transition-colors hover:bg-muted"
        >
          See more
        </button>
      </div>

      <ul className="mt-2 flex flex-col">
        {conflictChecklist.map((conflict) => (
          <li
            key={conflict.id}
            className="flex items-center justify-between gap-3 border-b border-border/60 py-2.5 last:border-b-0"
          >
            <div className="min-w-0">
              <p className="truncate text-xs text-foreground/90">{conflict.token}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {conflict.projectName} · {conflict.timestamp}
              </p>
            </div>
            <span
              className={cn(
                'flex size-5 shrink-0 items-center justify-center rounded-full',
                conflict.resolved ? 'bg-primary' : 'border-2 border-muted-foreground/30'
              )}
            >
              {conflict.resolved && <Check className="size-3 text-primary-foreground" strokeWidth={3} />}
            </span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() =>
          navigate(
            firstUnresolved
              ? `/projects/${firstUnresolved.projectId}/workspace`
              : `/projects/${conflictChecklist[0].projectId}/workspace`
          )
        }
        className="mt-4 h-10 w-full rounded-full bg-primary text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Open Merge Studio
      </button>
    </div>
  )
}

export default ConflictChecklist
