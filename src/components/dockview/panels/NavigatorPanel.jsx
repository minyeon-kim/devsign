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
  const { filesWindow } = useWorkspace()
  return (
    <div className="h-full font-sans [&_.bg-card]:bg-transparent">
      {filesWindow.tab === 'files' && <ExplorerPanel />}
      {filesWindow.tab === 'layers' && <LayersPanel />}
      {filesWindow.tab === 'assets' && <AssetsPanel />}
      {filesWindow.tab === 'inspect' && <InspectPanel />}
    </div>
  )
}

export default NavigatorPanel
