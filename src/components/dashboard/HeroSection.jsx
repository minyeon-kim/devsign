import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

// A thin product-status strip, not a marketing banner — the dashboard's
// job is to surface conflicts/drift immediately below, so this stays
// compact and text-only (no illustration, no gradients) rather than
// competing with that for attention.
function HeroSection() {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-sm font-semibold text-foreground">Detect → Review → Merge</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          DevSign catches design-code drift and helps your team resolve it before it ships.
        </p>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="shrink-0 gap-1 self-start px-0 text-primary hover:bg-transparent hover:text-primary/80 sm:self-auto"
      >
        Learn how DevSign works
        <ArrowRight className="size-3.5" />
      </Button>
    </div>
  )
}

export default HeroSection
