import { useContext } from 'react'
import { MergeDeckSlotContext } from '@/components/mergestudio/MergeDeckSlot'
import ExplorerPanel from '@/components/dockview/panels/ExplorerPanel'
import LayersPanel from '@/components/dockview/panels/LayersPanel'
import AssetsPanel from '@/components/dockview/panels/AssetsPanel'
import InspectPanel from '@/components/dockview/panels/InspectPanel'
import { useWorkspace } from '@/state/WorkspaceProvider'

// The project's navigator as a pane — the file tree (Files), the canvas's
// layer tree (Layers) and its Assets, switched by the window header's tabs
// (see PanelTabs). It's where files are found and opened; the editor's
// header only holds the open ones. Like any pane it can be resized,
// dragged and docked anywhere; `filesWindow` (open, tab) is its state.
function NavigatorPanel() {
  const { filesWindow, activeView, selectedMergeItemId, mergeCta } = useWorkspace()
  const { setElement } = useContext(MergeDeckSlotContext)
  const deckActive = activeView === 'mergeStudio' && ['inspect', 'blockDeck'].includes(filesWindow.tab)
  return (
    <div className="flex h-full min-h-0 flex-col font-sans [&_.bg-card]:bg-transparent">
      <div className="min-h-0 flex-1 overflow-hidden">
        {filesWindow.tab === 'files' && <ExplorerPanel />}
        {filesWindow.tab === 'layers' && <LayersPanel />}
        {filesWindow.tab === 'assets' && <AssetsPanel />}
        {['inspect', 'blockDeck'].includes(filesWindow.tab) && (!deckActive || !selectedMergeItemId) && <InspectPanel />}
        {activeView === 'mergeStudio' && <div ref={setElement} className={deckActive && selectedMergeItemId ? 'h-full min-h-0' : 'hidden'} />}
      </div>
      {activeView === 'mergeStudio' && (
        <div className="shrink-0 border-t border-white/10 p-3">
          <button
            type="button"
            onClick={() => mergeCta?.open()}
            disabled={!mergeCta || mergeCta.merged || mergeCta.count === 0}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-3 text-[13px] font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:cursor-default disabled:opacity-40"
          >
            <span>{mergeCta?.merged ? 'Merged' : 'Merge Changes'}</span>
            <span className="rounded-full bg-black/10 px-2 text-xs tabular-nums">{mergeCta?.count ?? 0}</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default NavigatorPanel
