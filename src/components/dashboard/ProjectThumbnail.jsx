import { cn } from 'cn'

// Abstract, frontend-only "UI preview" per project — no images, just small
// CSS blocks that read as a miniature of the relevant screen type.

function CheckoutThumbnail() {
  return (
    <div className="flex h-full flex-col justify-center gap-1.5 px-4">
      <div className="h-2 w-2/3 rounded-full bg-foreground/15" />
      <div className="h-5 rounded-md border border-border/80 bg-background/60" />
      <div className="h-5 rounded-md border border-border/80 bg-background/60" />
      <div className="mt-1 h-4 w-1/2 rounded-full bg-primary/70" />
    </div>
  )
}

function DesignSystemThumbnail() {
  return (
    <div className="grid h-full grid-cols-4 gap-1.5 p-4">
      {['bg-primary/60', 'bg-violet-500/60', 'bg-sky-500/50', 'bg-emerald-500/50', 'bg-foreground/15', 'bg-primary/30', 'bg-violet-500/30', 'bg-foreground/10'].map(
        (c, i) => (
          <div key={i} className={cn('rounded-md', c)} />
        )
      )}
    </div>
  )
}

function OnboardingThumbnail() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex h-full w-14 flex-col items-center gap-1.5 rounded-xl border border-border/80 bg-background/60 py-2.5">
        <div className="h-6 w-6 shrink-0 rounded-full bg-primary/60" />
        <div className="mt-0.5 h-1.5 w-8 rounded-full bg-foreground/15" />
        <div className="h-1.5 w-6 rounded-full bg-foreground/10" />
        <div className="mt-auto flex items-center gap-1">
          <span className="size-1 rounded-full bg-primary" />
          <span className="size-1 rounded-full bg-foreground/20" />
          <span className="size-1 rounded-full bg-foreground/20" />
        </div>
      </div>
    </div>
  )
}

function MobileNavThumbnail() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex h-full w-14 flex-col rounded-xl border border-border/80 bg-background/60">
        <div className="flex-1 p-2">
          <div className="h-2 w-3/4 rounded-full bg-foreground/15" />
          <div className="mt-1.5 h-6 rounded-md bg-foreground/10" />
        </div>
        <div className="flex items-center justify-around border-t border-border/80 py-1.5">
          <span className="size-1.5 rounded-full bg-primary" />
          <span className="size-1.5 rounded-full bg-foreground/20" />
          <span className="size-1.5 rounded-full bg-foreground/20" />
        </div>
      </div>
    </div>
  )
}

function MarketingThumbnail() {
  return (
    <div className="flex h-full flex-col gap-1.5 p-4">
      <div className="h-6 w-full rounded-md bg-gradient-to-r from-primary/40 to-violet-500/30" />
      <div className="flex flex-1 gap-1.5">
        <div className="flex-1 rounded-md bg-foreground/10" />
        <div className="flex-1 rounded-md bg-foreground/10" />
      </div>
    </div>
  )
}

const THUMBNAILS = {
  checkout: CheckoutThumbnail,
  'design-system': DesignSystemThumbnail,
  onboarding: OnboardingThumbnail,
  'mobile-nav': MobileNavThumbnail,
  marketing: MarketingThumbnail,
}

function ProjectThumbnail({ type, className }) {
  const Variant = THUMBNAILS[type] ?? DesignSystemThumbnail
  return (
    <div
      className={cn(
        'h-24 w-full overflow-hidden rounded-lg border border-border/60 bg-muted/40',
        className
      )}
    >
      <Variant />
    </div>
  )
}

export default ProjectThumbnail
