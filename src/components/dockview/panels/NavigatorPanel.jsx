import { useContext } from 'react'
import { MergeDeckSlotContext } from '@/components/mergestudio/MergeDeckSlot'
import ExplorerPanel from '@/components/dockview/panels/ExplorerPanel'
import LayersPanel from '@/components/dockview/panels/LayersPanel'
import AssetsPanel, { WorkspaceProperties } from '@/components/dockview/panels/AssetsPanel'
import TerminalPanel from '@/components/dockview/panels/TerminalPanel'
import ConsolePanel from '@/components/dockview/panels/ConsolePanel'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { SIDE_TABS } from '@/lib/panelPrefs'

// The project's navigator as a pane — the file tree (Files), the canvas's
// layer tree (Layers) and its Assets, switched by the window header's tabs
// (see PanelTabs). It's where files are found and opened; the editor's
// header only holds the open ones. Like any pane it can be resized,
// dragged and docked anywhere; `filesWindow` (open, tab) is its state.
// Terminal and Console show here too (from the activity bar) — they used
// to be the bottom panel's; what they list is the workspace's, so it keeps
// coming in whether they're showing or not.
// `inCanvas`: the copy in the main window (CanvasSideViews), for Files · Layers · Assets · Inspect. The
// side panel's own copy then shows only Terminal and Console — except in Merge Studio, whose navigator
// floats on its own and shows them all.
function NavigatorPanel({ inCanvas = false }) {
  const { filesWindow, activeView, selectedMergeItemId } = useWorkspace()
  const { setElement } = useContext(MergeDeckSlotContext)
  if (!inCanvas && activeView !== 'mergeStudio' && SIDE_TABS.includes(filesWindow.tab === 'blockDeck' ? 'inspect' : filesWindow.tab)) return null
  const deckActive = activeView === 'mergeStudio' && ['inspect', 'blockDeck', 'assets'].includes(filesWindow.tab)
  return (
    <div role="tabpanel" aria-label={filesWindow.tab} className="flex h-full min-h-0 flex-col font-sans [&_.bg-card]:bg-transparent">
      <div className="min-h-0 flex-1 overflow-hidden">
        {filesWindow.tab === 'files' && <ExplorerPanel />}
        {filesWindow.tab === 'terminal' && <TerminalPanel />}
        {filesWindow.tab === 'console' && <ConsolePanel />}
        {filesWindow.tab === 'layers' && <LayersPanel />}
        {filesWindow.tab === 'assets' && (!deckActive || !selectedMergeItemId) && <AssetsPanel />}
        {['inspect', 'blockDeck'].includes(filesWindow.tab) && (!deckActive || !selectedMergeItemId) && <WorkspaceProperties />}
        {activeView === 'mergeStudio' && <div ref={setElement} className={deckActive && selectedMergeItemId ? 'h-full min-h-0' : 'hidden'} />}
      </div>
    </div>
  )
}

export default NavigatorPanel
