import { useWorkspace } from '@/state/WorkspaceProvider'
import MergeStudioWorkspace from '@/components/mergestudio/MergeStudioWorkspace'

// Merge Studio replaces the workspace body with one canvas, on the item
// WorkspaceProvider says is open (`openMergeItem`: the selection, or the
// next unmerged item) — the same one AI Chat's thread follows.
function MergeStudioView() {
  const { openMergeItem: selected } = useWorkspace()

  return (
    <div className="relative flex min-h-0 flex-1 flex-row overflow-hidden">
      <MergeStudioWorkspace key={selected?.id ?? 'empty'} item={selected} />
    </div>
  )
}

export default MergeStudioView
