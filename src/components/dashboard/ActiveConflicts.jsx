import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { dashboardActiveConflicts } from '@/data/mockData'

const SEVERITY_STYLES = {
  high: 'bg-destructive/10 text-destructive',
  medium: 'bg-amber-500/10 text-amber-400',
  low: 'bg-muted text-muted-foreground',
}

// The dashboard's primary call to action: every design/code drift the AI
// has flagged, in one place, each leading straight into the project's
// workspace to resolve it. Sits above the project list per the Detect ->
// Review -> Merge hierarchy — this is what needs attention right now.
function ActiveConflicts() {
  const navigate = useNavigate()

  if (dashboardActiveConflicts.length === 0) return null

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-foreground">Needs attention</h2>
        <span className="text-[11px] text-muted-foreground">
          {dashboardActiveConflicts.length} active conflicts
        </span>
      </div>

      <div className="mt-3 divide-y divide-border/60 overflow-hidden rounded-lg border border-border bg-card">
        {dashboardActiveConflicts.map((conflict) => (
          <div key={conflict.id} className="flex items-center gap-4 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground">{conflict.token}</p>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize',
                    SEVERITY_STYLES[conflict.severity]
                  )}
                >
                  {conflict.severity}
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {conflict.projectName} · Design {conflict.designValue} → Code {conflict.codeValue}
              </p>
            </div>

            <Button
              size="sm"
              variant="outline"
              className="shrink-0 gap-1"
              onClick={() => navigate(`/projects/${conflict.projectId}/workspace`)}
            >
              Review conflict
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </section>
  )
}

export default ActiveConflicts
