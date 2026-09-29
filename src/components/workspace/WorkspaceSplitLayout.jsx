import { useEffect, useRef, useState } from 'react'
import { cn } from 'cn'
import ExplorerPanel from '@/components/dockview/panels/ExplorerPanel'
import LayersPanel from '@/components/dockview/panels/LayersPanel'
import AssetsPanel from '@/components/dockview/panels/AssetsPanel'
import CanvasPanel from '@/components/dockview/panels/CanvasPanel'
import EditorPanel from '@/components/dockview/panels/EditorPanel'
import PreviewPanelContent from '@/components/dockview/panels/PreviewPanelContent'
import LayerInspectPanel from '@/components/dockview/panels/LayerInspectPanel'
import { buildInitialLayout } from '@/components/dockview/DockLayout'
import SplitHandle from '@/components/layout/SplitHandle'
import FilesLayersWindow from '@/components/workspace/FilesLayersWindow'
import FloatingWindow from '@/components/workspace/FloatingWindow'
import { PANEL_ICONS } from '@/components/workspace/panelIcons'
import { useFloatingDockApi } from '@/components/workspace/floatingDockApi'
import { FLOATING_PANEL, PANEL_RADIUS } from '@/components/mergestudio/floatingStyles'
import { useWorkspace } from '@/state/WorkspaceProvider'

const components = {
  explorer: ExplorerPanel,
  layers: LayersPanel,
  assets: AssetsPanel,
  canvas: CanvasPanel,
  editor: EditorPanel,
  preview: PreviewPanelContent,
  layerInspect: LayerInspectPanel,
}

const FILES_PANE = 'files-pane'
const FILES_WIDTH = 280
const MIN_PANE = 220

// A minimized window: a slim strip keeping its place in the row — its icon
// and name, running vertically; click to bring it back.
function MinimizedStrip({ group, panelsById, dockApi }) {
  const panel = panelsById[group.activeId]
  const Icon = PANEL_ICONS[panel?.params?.iconName]
  return (
    <button
      type="button"
      title={`Restore ${panel?.title ?? 'window'}`}
      aria-label={`Restore ${panel?.title ?? 'window'}`}
      onClick={() => dockApi.minimizeGroup(group.id, false)}
      className={cn(
        'flex h-full w-10 shrink-0 flex-col items-center gap-2 py-3 text-slate-400 transition-colors hover:text-white',
        PANEL_RADIUS,
        FLOATING_PANEL
      )}
    >
      {Icon && <Icon className="size-4 shrink-0" />}
      <span className="text-[12px] font-medium [writing-mode:vertical-rl]">{panel?.title}</span>
    </button>
  )
}

// The Workspace as a focused split-pane frame (Cursor / VS Code style)
// instead of an infinite canvas of floating windows: the Code Editor on the
// left, the hi-fi Canvas (with Preview as its tab) on the right — and the
// Files / Layers navigator as a pane before them when it's open. Nothing
// pans; draggable splitters between the panes set their widths.
// It's the same window model as before (floatingDockApi, built by
// DockLayout's buildInitialLayout), so every window keeps its header —
// tabs, the panel's own toolbar, maximize / close, plus minimize — and
// everything that opens, closes or focuses panels through `dockApi`
// (Layout menu, the Preview button, the command palette, the canvas's
// layer-inspect tabs) works unchanged: a newly opened window simply joins
// the row, by its position.
function WorkspaceSplitLayout() {
  const { setDockApi, filesWindow } = useWorkspace()
  const { dockApi, store } = useFloatingDockApi()
  // Each pane's share of the row, as flex weights (px once measured).
  const [sizes, setSizes] = useState({})
  const paneRefs = useRef(new Map())
  const drag = useRef(null)
  const didInit = useRef(false)

  useEffect(() => {
    setDockApi(dockApi)
    return () => setDockApi(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dockApi])

  useEffect(() => {
    if (didInit.current) return
    didInit.current = true
    buildInitialLayout(dockApi)
  }, [dockApi])

  // Windows in reading order: left to right, then top to bottom.
  const groups = Object.values(store.groups)
    .filter((g) => g.open && g.panelIds.length > 0)
    .sort((a, b) => a.x - b.x || a.y - b.y)

  const panes = [
    ...(filesWindow.open ? [{ id: FILES_PANE, weight: FILES_WIDTH }] : []),
    // (Capped, so the editor's generous root footprint doesn't squeeze the
    // canvas beside it before anyone has dragged a splitter.)
    ...groups.map((g) => ({ id: g.id, group: g, weight: Math.min(g.w, 900) })),
  ]

  // Start of a splitter drag: freeze every pane at its measured width (so
  // weights are all px and nothing else jumps), remember the two neighbors.
  function startResize(leftId, rightId) {
    const measured = {}
    panes.forEach((p) => {
      const el = paneRefs.current.get(p.id)
      if (el) measured[p.id] = el.getBoundingClientRect().width
    })
    drag.current = { leftId, rightId, left: measured[leftId], right: measured[rightId] }
    setSizes(measured)
  }

  function resize(dx) {
    const d = drag.current
    if (!d) return
    const total = d.left + d.right
    const left = Math.min(total - MIN_PANE, Math.max(MIN_PANE, d.left + dx))
    setSizes((prev) => ({ ...prev, [d.leftId]: left, [d.rightId]: total - left }))
  }

  function step(leftId, rightId, delta) {
    startResize(leftId, rightId)
    resize(delta)
    drag.current = null
  }

  const isMinimized = (pane) => pane.group?.minimized

  return (
    <div className="absolute inset-0 bg-background px-3 pt-16 pb-3">
      <div className="relative isolate flex size-full min-w-0">
        {panes.map((pane, i) => {
          const prev = panes[i - 1]
          const resizable = prev && !isMinimized(prev) && !isMinimized(pane)
          return (
            <div key={pane.id} className="contents">
              {prev &&
                (resizable ? (
                  <SplitHandle
                    label="Resize panes"
                    onResizeStart={() => startResize(prev.id, pane.id)}
                    onResize={resize}
                    onResizeEnd={() => (drag.current = null)}
                    onStep={(delta) => step(prev.id, pane.id, delta)}
                  />
                ) : (
                  <span className="w-2 shrink-0" />
                ))}
              {isMinimized(pane) ? (
                <MinimizedStrip group={pane.group} panelsById={store.panels} dockApi={dockApi} />
              ) : (
                <div
                  ref={(el) => (el ? paneRefs.current.set(pane.id, el) : paneRefs.current.delete(pane.id))}
                  data-pane={pane.id}
                  className="flex min-w-0"
                  style={{ flex: `${sizes[pane.id] ?? pane.weight} 1 0px`, minWidth: MIN_PANE }}
                >
                  {pane.id === FILES_PANE ? (
                    <FilesLayersWindow docked />
                  ) : (
                    <FloatingWindow group={pane.group} panelsById={store.panels} dockApi={dockApi} components={components} docked />
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default WorkspaceSplitLayout
