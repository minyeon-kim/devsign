import { cn } from 'cn'
import { FLOATING_PILL } from '@/components/mergestudio/floatingStyles'

// A small floating status pill (same family as the canvas's zoom-control
// pill) telling the user their work is saved. History itself — checkpoints
// and rollback — lives in the activity bar's History menu, not here.
function SaveStatusIndicator() {
  return (
    <div
      className={cn(
        // bottom-5, on Merge Studio's bottom-row baseline (its zoom pill and AI bar).
        'absolute bottom-5 left-4 z-20 flex h-11 items-center gap-2.5 rounded-full px-4 text-xs',
        FLOATING_PILL
      )}
    >
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <span className="size-1.5 rounded-full bg-emerald-400" />
        Saved
      </span>
    </div>
  )
}

export default SaveStatusIndicator
