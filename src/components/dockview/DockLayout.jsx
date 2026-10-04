import DocumentPanel from '@/components/dockview/panels/DocumentPanel'
import { useEffect } from 'react'
import { DockviewReact } from 'dockview-react'
import CustomTab from '@/components/dockview/CustomTab'
import Watermark from '@/components/dockview/Watermark'
import { devsignTheme } from '@/components/dockview/theme'
import ExplorerPanel from '@/components/dockview/panels/ExplorerPanel'
import LayersPanel from '@/components/dockview/panels/LayersPanel'
import AssetsPanel from '@/components/dockview/panels/AssetsPanel'
import CanvasPanel from '@/components/dockview/panels/CanvasPanel'
import EditorPanel from '@/components/dockview/panels/EditorPanel'
import PreviewPanelContent from '@/components/dockview/panels/PreviewPanelContent'
import TerminalPanel from '@/components/dockview/panels/TerminalPanel'
import ConsolePanel from '@/components/dockview/panels/ConsolePanel'
import ConflictPanel from '@/components/dockview/panels/ConflictPanel'
import ChatPanel from '@/components/dockview/panels/ChatPanel'
import CommentsPanel from '@/components/dockview/panels/CommentsPanel'
import VersionHistoryPanel from '@/components/dockview/panels/VersionHistoryPanel'
import LayerInspectPanel from '@/components/dockview/panels/LayerInspectPanel'
import { buildInitialLayout } from '@/components/dockview/dockPanels'
export { addDockPanel, buildInitialLayout, openOrFocusPanel, panelById } from '@/components/dockview/dockPanels'
import { useWorkspace } from '@/state/WorkspaceProvider'

const components = {
  document: DocumentPanel,
  explorer: ExplorerPanel,
  layers: LayersPanel,
  assets: AssetsPanel,
  canvas: CanvasPanel,
  editor: EditorPanel,
  preview: PreviewPanelContent,
  terminal: TerminalPanel,
  console: ConsolePanel,
  conflict: ConflictPanel,
  chat: ChatPanel,
  comments: CommentsPanel,
  history: VersionHistoryPanel,
  layerInspect: LayerInspectPanel,
}

function DockLayout({ onReady }) {
  const { setDockApi } = useWorkspace()

  // DockviewReact unmounts whenever the app switches away from the normal
  // workspace body (e.g. into Merge Studio, see WorkspaceShell) — without
  // this, context would keep handing out a reference to an already-disposed
  // dockview instance, which anything reusing CanvasPanel/EditorPanel
  // outside the IDE (Merge Studio's workspace) could call into.
  useEffect(() => () => setDockApi(null), [setDockApi])

  return (
    <DockviewReact
      className="h-full w-full"
      theme={devsignTheme}
      components={components}
      defaultTabComponent={CustomTab}
      watermarkComponent={Watermark}
      floatingGroupBounds="boundedWithinViewport"
      onReady={(event) => {
        buildInitialLayout(event.api)
        setDockApi(event.api)
        onReady?.(event.api)
      }}
    />
  )
}

export default DockLayout
