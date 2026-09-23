import { ArrowRight, GitBranch } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

// Frontend-only illustration of the core Devsign flow (Design <-> Code,
// drift detected) — no images, just layered CSS/HTML blocks.
function DriftIllustration() {
  return (
    <div className="relative h-56 w-full max-w-sm shrink-0">
      <div className="absolute inset-0 rounded-full bg-primary/20 blur-3xl" aria-hidden="true" />

      {/* Design panel */}
      <div className="absolute top-2 left-0 w-48 rounded-2xl border border-border/80 bg-card/90 p-3 shadow-lg backdrop-blur-sm">
        <p className="text-[10px] font-medium text-muted-foreground">Design</p>
        <div className="mt-2 h-2 w-3/4 rounded-full bg-foreground/15" />
        <div className="mt-1.5 h-2 w-1/2 rounded-full bg-foreground/10" />
        <div className="mt-3 h-6 w-20 rounded-full bg-violet-500/70" />
      </div>

      {/* Code panel */}
      <div className="absolute top-16 left-20 w-48 rounded-2xl border border-border/80 bg-slate-950/90 p-3 shadow-lg backdrop-blur-sm">
        <p className="text-[10px] font-medium text-muted-foreground">Code</p>
        <div className="mt-2 space-y-1 font-mono text-[9px] leading-relaxed">
          <p>
            <span className="text-violet-400">.button</span> <span className="text-foreground/50">{'{'}</span>
          </p>
          <p className="pl-2 text-sky-400">
            radius: <span className="text-emerald-400">8px</span>
            <span className="text-foreground/40">;</span>
          </p>
          <p className="text-foreground/50">{'}'}</p>
        </div>
        <div className="mt-2.5 h-6 w-20 rounded-md border-2 border-dashed border-destructive/70 bg-destructive/10" />
      </div>

      {/* Drift indicator between the two panels */}
      <div className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-full border border-destructive/40 bg-card px-2.5 py-1 text-[10px] font-medium text-destructive shadow-md">
        <GitBranch className="size-3" />
        Drift detected
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
          Keep design and development in sync.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Devsign detects design-dev drift, highlights conflicts, and helps teams merge changes
          faster.
        </p>
        <Button variant="ghost" className="mt-5 gap-1.5 px-0 text-primary hover:bg-transparent hover:text-primary/80">
          Learn how Devsign works
          <ArrowRight className="size-3.5" />
        </Button>
      </div>

      <DriftIllustration />
    </div>
  )
}

export default HeroSection
