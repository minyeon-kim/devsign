import { useNavigate } from 'react-router-dom'
import { ArrowRight, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { aiInsights, dashboardActiveConflicts } from '@/data/mockData'

// A workflow assist, not a decorative card: the pattern it surfaces maps
// directly onto the tokens listed in ActiveConflicts, and "Review
// patterns" drops straight into the first flagged project's workspace
// rather than just displaying the insight inertly.
function AIInsights() {
  const navigate = useNavigate()
  const [patternInsight, driftInsight] = aiInsights
  const reviewProjectId = dashboardActiveConflicts[0]?.projectId

  return (
    <div className="rounded-lg border border-border bg-card p-3.5">
      <div className="flex items-center gap-1.5">
        <Sparkles className="size-3.5 text-primary" />
        <h3 className="text-xs font-semibold text-foreground">AI insights</h3>
        <Badge variant="secondary" className="ml-auto rounded-full text-[10px]">
          BETA
        </Badge>
      </div>

      <div className="mt-2.5 rounded-md border border-border/60 bg-background/60 p-2.5">
        <p className="text-xs font-medium text-foreground">{patternInsight.title}</p>
        <ul className="mt-1.5 flex flex-col gap-1">
          {patternInsight.items.map((item) => (
            <li key={item} className="text-[11px] text-muted-foreground">
              {item}
            </li>
          ))}
        </ul>
        <Button
          variant="ghost"
          size="sm"
          disabled={!reviewProjectId}
          className="mt-1.5 h-6 gap-1 px-0 text-[11px] text-primary hover:bg-transparent hover:text-primary/80"
          onClick={() => reviewProjectId && navigate(`/projects/${reviewProjectId}/workspace`)}
        >
          Review patterns
          <ArrowRight className="size-3" />
        </Button>
      </div>

      <p className="mt-2.5 text-[11px] text-muted-foreground">
        {driftInsight.title} <span className="text-foreground/70">{driftInsight.detail}</span>
      </p>
    </div>
  )
}

export default AIInsights
