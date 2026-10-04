import { panelDefinitions } from '@/data/mockData'

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
  // The navigator isn't an anchor: a view opened beside it goes on its
  // left, keeping the navigator at the far right.
  const navigator = dockApi.getPanel(panelById.navigator.id)
  const anchor = dockApi.getPanel(panelById.editor.id) ?? dockApi.panels.find((p) => p.id !== panelById.navigator.id)
  if (!anchor && navigator && def.group !== 'sidebar') {
    addDockPanel(dockApi, def, { position: { direction: 'left', referencePanel: navigator.id }, share: 0.75 })
    return
  }
  const direction = def.group === 'bottom' ? 'below' : def.group === 'sidebar' ? 'left' : 'above'
  addDockPanel(dockApi, def, {
    position: anchor ? { direction, referencePanel: anchor.id } : undefined,
    initialWidth: def.group === 'sidebar' ? 260 : undefined,
    initialHeight: def.group === 'bottom' ? 220 : undefined,
  })
}

export function buildInitialLayout(api) {
  // Terminal, Console and Conflict Points aren't floating windows anymore —
  // they live in the workspace's docked bottom panel (WorkspaceBottomPanel).
  // No Explorer/Layers windows here either: both are tabs of the navigator
  // pane (NavigatorPanel), which WorkspaceSplitLayout docks at the far right.
  //
  // Every view is an independent tab (close, drag, split, reopen from a
  // `+`). The default split: AI Chat up front on the left with the code
  // file beside it as an inactive tab; the Canvas up front in the center
  // with Preview beside it.
  // Split shares determine the workspace pane widths; give Canvas a little
  // more than half so AI Chat starts narrower and the main work area dominates.
  addDockPanel(api, panelById.chat, { initialWidth: 380 })
  addDockPanel(api, panelById.editor, {
    position: { direction: 'within', referencePanel: panelById.chat.id },
  })
  addDockPanel(api, panelById.canvas, {
    position: { direction: 'right', referencePanel: panelById.chat.id },
    share: 0.68,
  })
  addDockPanel(api, panelById.preview, {
    position: { direction: 'within', referencePanel: panelById.canvas.id },
  })

  api.getPanel(panelById.chat.id)?.api.setActive()
  api.getPanel(panelById.canvas.id)?.api.setActive()
}

