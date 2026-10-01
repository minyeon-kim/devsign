import { useWorkspace } from '@/state/WorkspaceProvider'
import MergeStudioWorkspace from '@/components/mergestudio/MergeStudioWorkspace'

// Merge Studio replaces the workspace body with one canvas. An existing
// selection is preserved; otherwise the next unmerged item opens by default.
function MergeStudioView() {
  const { mergeItems, selectedMergeItemId } = useWorkspace()
  const selected = mergeItems.find((item) => item.id === selectedMergeItemId)
    ?? mergeItems.find((item) => item.tag !== 'Merged')
    ?? mergeItems[0]

  return (
    <div className="relative flex min-h-0 flex-1 flex-row overflow-hidden">
      <MergeStudioWorkspace key={selected?.id ?? 'empty'} item={selected} />
    </div>
  )
}

export default MergeStudioView
