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

// Explorer/Layers render inside a *headerless* dockview group — a plain
// collapsible section (icon-only ActivityBar toggle, single in-panel
// header), not a tabbed/closable dockview pane the way Editor/Terminal/
// Preview are. Without `hideHeader: true` every group gets its own
// `--dv-tabs-and-actions-container` tab strip, which duplicated the
// section's own header (e.g. a "Layers" tab row sitting on top of the
// panel's own Layers/Assets tabs). Used by both the initial layout below
// and ActivityBar's reopen-after-close logic, so the two never drift.
export function addSidebarPanel(api, def, groupOptions) {
  const group = api.addGroup({ hideHeader: true, ...sidebarWidthConstraints, ...groupOptions })
  addDockPanel(api, def, { position: { referenceGroup: group } })
  return group
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
  // visible at once, both pinned to the same width band. Explorer gets a
  // modest fixed starting height instead of splitting 50/50 with Layers —
  // a handful of files doesn't need half the sidebar, and Layers' deeper
  // tree benefits far more from the extra room.
  const explorerGroup = addSidebarPanel(api, panelById.explorer, {
    direction: 'left',
    referencePanel: panelById.editor.id,
    initialWidth: 260,
    initialHeight: 220,
  })

  addSidebarPanel(api, panelById.layers, {
    direction: 'below',
    referenceGroup: explorerGroup,
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
