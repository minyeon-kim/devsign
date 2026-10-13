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

  // (`dockWith`: the view it belongs beside, when that's open — Design Compare
  // with the canvas. AI Chat's window is its own: nothing else opens into it.)
  const sibling = (def.dockWith && dockApi.getPanel(def.dockWith)) || dockApi.panels.find((p) => panelById[p.id]?.group === def.group && p.id !== panelById.chat.id)
  if (sibling) {
    addDockPanel(dockApi, def, { position: { direction: 'within', referencePanel: sibling.id } })?.api.setActive()
    return
  }

  // That whole family is closed — fall back to a sensible spot relative to
  // whatever's still open, roughly matching buildInitialLayout's shape.
  // The navigator isn't an anchor: a view opened beside it goes on its
  // right, keeping the navigator at the far left.
  const navigator = dockApi.getPanel(panelById.navigator.id)
  const anchor = dockApi.getPanel(panelById.editor.id) ?? dockApi.panels.find((p) => p.id !== panelById.navigator.id)
  if (!anchor && navigator && def.group !== 'sidebar') {
    addDockPanel(dockApi, def, { position: { direction: 'right', referencePanel: navigator.id }, share: 0.75 })
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
  // pane (NavigatorPanel), which WorkspaceSplitLayout docks at the far left.
  //
  // Every view is an independent tab (close, drag, split, reopen from a
  // `+`). The default split: the code file on the left, the Canvas up front
  // in the center with Preview beside it, and AI Chat in a window of its
  // own at the far right (folded until asked for — see WorkspaceSplitLayout).
  // Split shares determine the workspace pane widths; give Canvas a little
  // more than half so the main work area dominates.
  addDockPanel(api, panelById.editor, { initialWidth: 380 })
  addDockPanel(api, panelById.canvas, {
    position: { direction: 'right', referencePanel: panelById.editor.id },
    share: 0.68,
  })
  addDockPanel(api, panelById.preview, {
    position: { direction: 'within', referencePanel: panelById.canvas.id },
  })
  addDockPanel(api, panelById.chat, {
    position: { direction: 'right', referencePanel: panelById.canvas.id },
    share: 0.3,
  })

  api.getPanel(panelById.canvas.id)?.api.setActive()
}

