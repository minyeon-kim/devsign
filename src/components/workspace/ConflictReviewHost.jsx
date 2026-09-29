import { useNavigate } from 'react-router-dom'
import ConflictModal from '@/components/modals/ConflictModal'
import { useWorkspace } from '@/state/WorkspaceProvider'

// The project's single conflict review window. The bottom panel's
// Conflict Points tab (and the Dashboard / project overview links into it)
// call openConflictReview(id); this renders the one ConflictModal for
// whichever conflict that is, bound to the shared conflict store.
function ConflictReviewHost() {
  const navigate = useNavigate()
  const {
    projectId,
    conflicts,
    reviewConflictId,
    openConflictReview,
    updateConflict,
    approveConflict,
    requestChanges,
    resolveConflict,
  } = useWorkspace()
  const conflict = conflicts.find((c) => c.id === reviewConflictId) ?? null

  return (
    <ConflictModal
      conflict={conflict}
      onOpenChange={(open) => !open && openConflictReview(null)}
      onUpdate={updateConflict}
      onApprove={approveConflict}
      onRequestChanges={requestChanges}
      onResolve={resolveConflict}
      onOpenMergeStudio={(c) => {
        openConflictReview(null)
        // Works from Archive too: lands on the Workspace with Merge Studio
        // up, on this conflict's item and element (see WorkspacePage).
        navigate(`/projects/${projectId}/workspace`, {
          state: { openMergeStudio: true, mergeItemId: c.mergeItemId, layerId: c.layerId, fileId: c.fileId, line: c.line },
        })
      }}
    />
  )
}

export default ConflictReviewHost
