import { useNavigate } from 'react-router-dom'
import { History } from 'lucide-react'
import { cn } from 'cn'
import { FLOATING_PILL } from '@/components/mergestudio/floatingStyles'
import { useWorkspace } from '@/state/WorkspaceProvider'

// A small floating status pill (same family as the canvas's zoom-control
// pill) telling the user their work is saved, with a direct link into
// Archive's History tab at the exact record currently active — the bridge
// between "what am I looking at" (workspace) and "how did it get here"
// (archive).
function SaveStatusIndicator({ projectId }) {
  const navigate = useNavigate()
  const { activeHistoryId } = useWorkspace()

  function viewHistory() {
    navigate(`/projects/${projectId}/archive`, {
      state: { tab: 'history', highlightId: activeHistoryId },
    })
  }

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
      <button
        type="button"
        onClick={viewHistory}
        className="flex items-center gap-1 rounded-full text-muted-foreground transition-colors hover:text-foreground"
      >
        <History className="size-3.5" />
        View change history
      </button>
    </div>
  )
}

export default SaveStatusIndicator
