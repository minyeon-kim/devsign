import { useNavigate } from 'react-router-dom'
import ConflictReviewPanel from '@/components/dockview/panels/ConflictReviewPanel'
import { useWorkspace } from '@/state/WorkspaceProvider'

export default function ReviewDetail({ conflict, inMergeStudio = false }) {
  const navigate = useNavigate()
  const { projectId, mergeItems, reviewView, openConflictReview, updateConflict, approveConflict, requestChanges, resolveConflict, revertConflict } = useWorkspace()
  const itemId = conflict.mergeItemId ?? mergeItems.find(item => item.conflictId === conflict.id)?.id
  return <div className="h-full min-h-0 min-w-0 bg-card">
    <ConflictReviewPanel
      conflict={conflict}
      inMergeStudio={inMergeStudio}
      onOpenChange={open => !open && openConflictReview(null)}
      onUpdate={updateConflict}
      onApprove={approveConflict}
      onRequestChanges={requestChanges}
      onResolve={resolveConflict}
      onRevert={id => { const revert = revertConflict(id); if (revert) openConflictReview(revert.id, { view: reviewView }) }}
      onOpenMergeStudio={(record, options) => navigate(`/projects/${projectId}/workspace`, {
        state: { openMergeStudio: true, conflictId: record.id, mergeItemId: itemId, layerId: record.layerId, fileId: record.fileId, line: record.line, collapsePanel: options?.collapsePanel },
      })}
    />
  </div>
}
