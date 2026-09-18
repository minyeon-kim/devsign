import { DockviewReact } from 'dockview-react'
import CustomTab from '@/components/dockview/CustomTab'
import Watermark from '@/components/dockview/Watermark'
import { devsignTheme } from '@/components/dockview/theme'
import ExplorerPanel from '@/components/dockview/panels/ExplorerPanel'
import LayersPanel from '@/components/dockview/panels/LayersPanel'
import CanvasPanel from '@/components/dockview/panels/CanvasPanel'
import EditorPanel from '@/components/dockview/panels/EditorPanel'
import PreviewPanelContent from '@/components/dockview/panels/PreviewPanelContent'
import TerminalPanel from '@/components/dockview/panels/TerminalPanel'
import ConflictPanel from '@/components/dockview/panels/ConflictPanel'
import ChatPanel from '@/components/dockview/panels/ChatPanel'
import CommentsPanel from '@/components/dockview/panels/CommentsPanel'
import VersionHistoryPanel from '@/components/dockview/panels/VersionHistoryPanel'
import { panelDefinitions, sidebarWidthConstraints } from '@/data/mockData'

const components = {
  explorer: ExplorerPanel,
  layers: LayersPanel,
  canvas: CanvasPanel,
  editor: EditorPanel,
  preview: PreviewPanelContent,
  terminal: TerminalPanel,
  conflict: ConflictPanel,
  chat: ChatPanel,
  comments: CommentsPanel,
  history: VersionHistoryPanel,
}

export const panelById = Object.fromEntries(panelDefinitions.map((p) => [p.id, p]))

export function addDockPanel(api, def, options) {
  return api.addPanel({
    id: def.id,
    component: def.component,
    title: def.title,
    params: { iconName: def.iconName },
    ...options,
  })
}

export function buildInitialLayout(api) {
  addDockPanel(api, panelById.terminal, { initialHeight: 220 })

  addDockPanel(api, panelById.conflict, {
    position: { direction: 'within', referencePanel: panelById.terminal.id },
  })

  addDockPanel(api, panelById.editor, {
    position: { direction: 'above', referencePanel: panelById.terminal.id },
  })

  // Left sidebar: Explorer (top) and Layers (bottom) split so both are
  // visible at once, both pinned to the same width band.
  addDockPanel(api, panelById.explorer, {
    position: { direction: 'left', referencePanel: panelById.editor.id },
    initialWidth: 260,
    ...sidebarWidthConstraints,
  })

  addDockPanel(api, panelById.layers, {
    position: { direction: 'below', referencePanel: panelById.explorer.id },
    ...sidebarWidthConstraints,
  })

  addDockPanel(api, panelById.preview, {
    position: { direction: 'right', referencePanel: panelById.editor.id },
    initialWidth: 380,
  })

  api.getPanel(panelById.editor.id)?.api.setActive()
  api.getPanel(panelById.terminal.id)?.api.setActive()
}

function DockLayout({ onReady }) {
  return (
    <DockviewReact
      className="h-full w-full"
      theme={devsignTheme}
      components={components}
      defaultTabComponent={CustomTab}
      watermarkComponent={Watermark}
      onReady={(event) => {
        buildInitialLayout(event.api)
        onReady?.(event.api)
      }}
    />
  )
}

export default DockLayout
