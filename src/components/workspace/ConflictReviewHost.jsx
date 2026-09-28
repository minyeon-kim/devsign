import { useNavigate } from 'react-router-dom'
import ConflictModal from '@/components/modals/ConflictModal'
import { useWorkspace } from '@/state/WorkspaceProvider'

// The project's single conflict review window. The Conflicts drawer and
// the bottom panel's Conflict Points tab both just call openConflictReview(id);
// this renders the one ConflictModal for whichever conflict that is,
// bound to the workspace's shared conflict list.
function ConflictReviewHost() {
  const navigate = useNavigate()
  const { projectId, conflicts, reviewConflictId, openConflictReview, updateConflict, resolveConflict } =
    useWorkspace()
  const conflict = conflicts.find((c) => c.id === reviewConflictId) ?? null

  return (
    <ConflictModal
      conflict={conflict}
      onOpenChange={(open) => !open && openConflictReview(null)}
      onUpdate={updateConflict}
      onResolve={resolveConflict}
      onOpenMergeStudio={() => {
        openConflictReview(null)
        // Works from Archive too: lands on the Workspace with Merge Studio up.
        navigate(`/projects/${projectId}/workspace`, { state: { openMergeStudio: true } })
      }}
    />
  )
}

export default ConflictReviewHost
