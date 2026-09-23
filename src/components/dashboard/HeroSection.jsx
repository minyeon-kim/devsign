import { ArrowRight, Bell, Folder, History, Layers } from 'lucide-react'
import { cn } from 'cn'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const TOKEN_SWATCHES = ['bg-violet-500', 'bg-sky-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500']
const CHART_BARS = [40, 65, 50, 80, 55, 92, 70]
const ACTIVITY_ROWS = [
  { color: 'bg-sky-500/80', width: 'w-3/4' },
  { color: 'bg-violet-500/80', width: 'w-1/2' },
]

// Frontend-only "screenshot" of the DevSign product UI — a believable
// mini dashboard (window chrome, nav rail, token swatches, a gradient
// bar chart, activity rows) built from plain CSS/HTML, not an image
// asset, so it stays in step with the app's real dark theme instead of
// drifting from it like a static export would.
function ProductPreview() {
  return (
    <div className="relative w-full max-w-md shrink-0 lg:-mr-4">
      <div className="absolute inset-0 rounded-3xl bg-primary/20 blur-3xl" aria-hidden="true" />

      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl">
        {/* Window titlebar */}
        <div className="flex items-center gap-1.5 border-b border-border/60 bg-muted/40 px-3 py-2">
          <span className="size-2 rounded-full bg-destructive/60" />
          <span className="size-2 rounded-full bg-amber-500/60" />
          <span className="size-2 rounded-full bg-emerald-500/60" />
          <div className="ml-2 flex-1 truncate rounded-md bg-background/60 px-2 py-1 text-[9px] text-muted-foreground">
            devsign.app/projects/design-system-v2
          </div>
          <Bell className="size-3 shrink-0 text-muted-foreground" />
        </div>

        <div className="flex">
          {/* Nav rail */}
          <div className="flex w-9 shrink-0 flex-col items-center gap-2.5 border-r border-border/60 bg-card py-3">
            <div className="size-5 rounded-md bg-primary" />
            <Folder className="size-3.5 text-primary" />
            <Layers className="size-3.5 text-muted-foreground" />
            <History className="size-3.5 text-muted-foreground" />
          </div>

          {/* Main content */}
          <div className="flex-1 space-y-2.5 p-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-foreground">Design tokens</p>
              <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[8px] font-medium text-primary">
                Synced
              </span>
            </div>

            <div className="flex gap-1.5">
              {TOKEN_SWATCHES.map((color) => (
                <div key={color} className={cn('size-5 rounded-md shadow-sm', color)} />
              ))}
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/30 p-2 shadow-sm">
              <div className="flex h-12 items-end gap-1">
                {CHART_BARS.map((height, index) => (
                  <div
                    key={index}
                    className="flex-1 rounded-sm bg-gradient-to-t from-primary/70 to-primary/20"
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-1.5 rounded-lg border border-border/60 bg-muted/20 p-2 shadow-sm">
              {ACTIVITY_ROWS.map((row, index) => (
                <div key={index} className="flex items-center gap-1.5">
                  <div className={cn('size-3.5 shrink-0 rounded-full', row.color)} />
                  <div className={cn('h-1.5 rounded-full bg-foreground/10', row.width)} />
                  <div className="h-1.5 w-6 shrink-0 rounded-full bg-foreground/5" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -top-3 -right-3 flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[9px] font-medium text-foreground shadow-lg">
        <span className="size-1.5 rounded-full bg-emerald-500" />3 components synced
      </div>
    </div>
  )
}

function HeroSection() {
  return (
    <div className="flex flex-col items-start gap-8 rounded-2xl border border-border/60 bg-card/40 px-8 py-8 lg:flex-row lg:items-center lg:justify-between">
      <div className="max-w-lg">
        <Badge variant="secondary" className="rounded-full">
          Design meets development
        </Badge>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
          디자인 시스템을 코드로, 일관성을 자동으로.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          DevSign은 디자인 토큰과 컴포넌트를 동기화하여 개발 효율성을 극대화합니다.
        </p>
        <Button variant="ghost" className="mt-5 gap-1.5 px-0 text-primary hover:bg-transparent hover:text-primary/80">
          Learn how DevSign works
          <ArrowRight className="size-3.5" />
        </Button>
      </div>

      <ProductPreview />
    </div>
  )
}

export default HeroSection
