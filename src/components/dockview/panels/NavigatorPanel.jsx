import { useContext } from 'react'
import { MergeDeckSlotContext } from '@/components/mergestudio/MergeDeckSlot'
import ExplorerPanel from '@/components/dockview/panels/ExplorerPanel'
import LayersPanel from '@/components/dockview/panels/LayersPanel'
import AssetsPanel, { WorkspaceProperties } from '@/components/dockview/panels/AssetsPanel'
import { useWorkspace } from '@/state/WorkspaceProvider'

// The project's navigator as a pane — the file tree (Files), the canvas's
// layer tree (Layers) and its Assets, switched by the window header's tabs
// (see PanelTabs). It's where files are found and opened; the editor's
// header only holds the open ones. Like any pane it can be resized,
// dragged and docked anywhere; `filesWindow` (open, tab) is its state.
function NavigatorPanel() {
  const { filesWindow, activeView, selectedMergeItemId } = useWorkspace()
  const { setElement } = useContext(MergeDeckSlotContext)
  const deckActive = activeView === 'mergeStudio' && ['inspect', 'blockDeck', 'assets'].includes(filesWindow.tab)
  return (
    <div className="flex h-full min-h-0 flex-col font-sans [&_.bg-card]:bg-transparent">
      <div className="min-h-0 flex-1 overflow-hidden">
        {filesWindow.tab === 'files' && <ExplorerPanel />}
        {filesWindow.tab === 'layers' && <LayersPanel />}
        {filesWindow.tab === 'assets' && (!deckActive || !selectedMergeItemId) && <AssetsPanel />}
        {['inspect', 'blockDeck'].includes(filesWindow.tab) && (!deckActive || !selectedMergeItemId) && <WorkspaceProperties />}
        {activeView === 'mergeStudio' && <div ref={setElement} className={deckActive && selectedMergeItemId ? 'h-full min-h-0' : 'hidden'} />}
      </div>
    </div>
  )
}

export default NavigatorPanel
