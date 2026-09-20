import { useWorkspace } from '@/state/WorkspaceProvider'
import MergeListSidebar from '@/components/mergestudio/MergeListSidebar'
import MergeStudioWorkspace from '@/components/mergestudio/MergeStudioWorkspace'

// The Merge Studio screen — swapped in for the whole workspace body (see
// WorkspaceShell in App.jsx) instead of living as a dockview panel, since
// its left sidebar is a different navigation paradigm from the IDE's
// dockable tabs. Its own "Back to Workspace" + title used to live in a
// sub-header here; that's now TopBar's job (it replaces the Devsign logo
// with them while this view is active), so this is just sidebar + workspace.
function MergeStudioView() {
  const { mergeItems, selectedMergeItemId } = useWorkspace()
  const selected = mergeItems.find((item) => item.id === selectedMergeItemId)

  return (
    <div className="relative flex min-h-0 flex-1 flex-row overflow-hidden">
      <MergeListSidebar />
      <MergeStudioWorkspace item={selected} />
    </div>
  )
}

export default MergeStudioView
