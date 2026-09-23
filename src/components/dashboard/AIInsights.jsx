import { Sparkles, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { aiInsights } from '@/data/mockData'

function AIInsights() {
  const [patternInsight, driftInsight] = aiInsights

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-1.5">
        <Sparkles className="size-3.5 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">AI insights</h3>
        <Badge variant="secondary" className="ml-auto rounded-full text-[10px]">
          BETA
        </Badge>
      </div>

      <div className="mt-3 flex flex-col gap-2.5">
        <div className="rounded-lg border border-border/60 bg-background/60 p-2.5">
          <p className="text-xs font-medium text-foreground">{patternInsight.title}</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {patternInsight.items.map((item) => (
              <span
                key={item}
                className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
              >
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-start gap-1.5 rounded-lg border border-border/60 bg-background/60 p-2.5">
          <TrendingUp className="mt-0.5 size-3.5 shrink-0 text-amber-400" />
          <p className="text-xs text-foreground/90">
            {driftInsight.title}{' '}
            <span className="text-muted-foreground">{driftInsight.detail}</span>
          </p>
        </div>
      </div>
    </div>
  )
}

export default AIInsights
