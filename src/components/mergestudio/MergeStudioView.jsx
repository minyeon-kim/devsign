import { useWorkspace } from '@/state/WorkspaceProvider'
import MergeStudioWorkspace from '@/components/mergestudio/MergeStudioWorkspace'

// Merge Studio — the Merge tab's content: it fills the main window under the tab row, on the item
// WorkspaceProvider says is open (`openMergeItem`: the selection, or the next unmerged item) — the same one
// AI Chat's thread follows. Its way out is the tab row (the other three tabs): there's no header of its own.
function MergeStudioView() {
  const { openMergeItem: selected, startedMergeItemId, designCompareRequest } = useWorkspace()
  const started = selected && (startedMergeItemId === selected.id || designCompareRequest?.itemId === selected.id)

  if (!started) return <div data-merge-empty-canvas className="min-h-0 min-w-0 flex-1 bg-[#1C1C1C]" style={{ backgroundImage: 'radial-gradient(rgb(255 255 255 / 14%) 1px, transparent 1px)', backgroundSize: '18px 18px' }} />

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden">
      <MergeStudioWorkspace key={selected?.id ?? 'empty'} item={selected} />
    </div>
  )
}

export default MergeStudioView
