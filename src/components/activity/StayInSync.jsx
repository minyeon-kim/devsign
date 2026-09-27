import { ArrowRight } from 'lucide-react'

// Deliberately quiet — a small glow, no illustration, no bright color,
// so it doesn't compete with the activity timeline for attention.
function StayInSync() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-4">
      <div
        className="pointer-events-none absolute -top-8 -right-8 size-28 rounded-full bg-primary/10 blur-2xl"
        aria-hidden="true"
      />
      <div className="relative">
        <h3 className="text-sm font-semibold text-foreground">Stay in sync</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Get notified when there are new conflicts or merges.
        </p>
        <button
          type="button"
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
        >
          Turn on notifications
          <ArrowRight className="size-3" />
        </button>
      </div>
    </div>
  )
}

export default StayInSync
