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
import { panelDefinitions } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'

const components = {
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

// Re-opens a panel definition (e.g. from the Preview toggle) next to whatever else from its own "family" is still open —
// sidebar panels next to the sidebar, main-area panels next to the editor,
// bottom-strip panels next to the terminal — instead of always docking
// "within" `dockApi.panels[0]`, which is whichever panel buildInitialLayout
// happened to add first (Terminal) and previously trapped every reopened
// panel inside the bottom terminal group regardless of what it was.
export function openOrFocusPanel(dockApi, def) {
  if (!dockApi) return
  const existing = dockApi.getPanel(def.id)
  if (existing) {
    existing.api.setActive()
    return
  }

  const sibling = dockApi.panels.find((p) => panelById[p.id]?.group === def.group)
  if (sibling) {
    addDockPanel(dockApi, def, { position: { direction: 'within', referencePanel: sibling.id } })
    return
  }

  // That whole family is closed — fall back to a sensible spot relative to
  // whatever's still open, roughly matching buildInitialLayout's shape.
  const anchor = dockApi.getPanel(panelById.editor.id) ?? dockApi.panels[0]
  const direction = def.group === 'bottom' ? 'below' : def.group === 'sidebar' ? 'left' : 'above'
  addDockPanel(dockApi, def, {
    position: anchor ? { direction, referencePanel: anchor.id } : undefined,
    initialWidth: def.group === 'sidebar' ? 260 : undefined,
    initialHeight: def.group === 'bottom' ? 220 : undefined,
  })
}

export function buildInitialLayout(api) {
  // Terminal, Console and Conflict Points aren't floating windows anymore —
  // they live in the workspace's docked bottom panel (WorkspaceBottomPanel)
  // — so the layout starts from the editor.
  addDockPanel(api, panelById.editor)

  // No Explorer/Layers windows here: both are tabs of the separate
  // floating Files / Layers window (see FilesLayersWindow), so the editor
  // spans the whole left of the layout.

  // Canvas sits beside the editor (with Preview as its sibling tab).
  // 620px (not 460) so the canvas surface keeps a usable width beside
  // its built-in Layers drawer.
  addDockPanel(api, panelById.canvas, {
    position: { direction: 'right', referencePanel: panelById.editor.id },
    initialWidth: 620,
  })
  addDockPanel(api, panelById.preview, {
    position: { direction: 'within', referencePanel: panelById.canvas.id },
  })
  // The AI chat is a pane like the others (no floating widget): a tab
  // beside Canvas / Preview, ready to drag out into a split.
  addDockPanel(api, panelById.chat, {
    position: { direction: 'within', referencePanel: panelById.canvas.id },
  })

  api.getPanel(panelById.editor.id)?.api.setActive()
  api.getPanel(panelById.canvas.id)?.api.setActive()
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
