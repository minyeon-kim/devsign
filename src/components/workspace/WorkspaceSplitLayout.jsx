import { useEffect, useRef, useState } from 'react'
import { cn } from 'cn'
import ExplorerPanel from '@/components/dockview/panels/ExplorerPanel'
import LayersPanel from '@/components/dockview/panels/LayersPanel'
import AssetsPanel from '@/components/dockview/panels/AssetsPanel'
import CanvasPanel from '@/components/dockview/panels/CanvasPanel'
import EditorPanel from '@/components/dockview/panels/EditorPanel'
import PreviewPanelContent from '@/components/dockview/panels/PreviewPanelContent'
import LayerInspectPanel from '@/components/dockview/panels/LayerInspectPanel'
import ChatPanel from '@/components/dockview/panels/ChatPanel'
import TerminalPanel from '@/components/dockview/panels/TerminalPanel'
import ConsolePanel from '@/components/dockview/panels/ConsolePanel'
import NavigatorPanel from '@/components/dockview/panels/NavigatorPanel'
import { addDockPanel, buildInitialLayout, panelById } from '@/components/dockview/DockLayout'
import SplitHandle from '@/components/layout/SplitHandle'
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
  chat: ChatPanel,
  terminal: TerminalPanel,
  console: ConsolePanel,
  navigator: NavigatorPanel,
}

const MIN_PANE = 200
const DRAG_THRESHOLD = 5
// How close to a pane's edge (as a share of its size) a drop docks beside
// it rather than into it as a tab.
const EDGE = 0.28

// A minimized window: a slim strip keeping its place — its icon and name
// (running vertically in a row, across in a stack); click to bring it back.
function MinimizedStrip({ group, panelsById, dockApi, dir }) {
  const panel = panelsById[group.activeId]
  const Icon = PANEL_ICONS[panel?.params?.iconName]
  return (
    <button
      type="button"
      title={`Restore ${panel?.title ?? 'window'}`}
      aria-label={`Restore ${panel?.title ?? 'window'}`}
      onClick={() => dockApi.minimizeGroup(group.id, false)}
      className={cn(
        'flex shrink-0 items-center gap-2 text-slate-400 transition-colors hover:text-white',
        dir === 'col' ? 'h-10 w-full px-4' : 'h-full w-10 flex-col py-3',
        PANEL_RADIUS,
        FLOATING_PANEL
      )}
    >
      {Icon && <Icon className="size-4 shrink-0" />}
      <span className={cn('text-[12px] font-medium', dir !== 'col' && '[writing-mode:vertical-rl]')}>{panel?.title}</span>
    </button>
  )
}

// Where a dragged window would land on the pane under the pointer.
function dropZone(rect, x, y) {
  const fx = (x - rect.left) / rect.width
  const fy = (y - rect.top) / rect.height
  const edges = [
    ['left', fx],
    ['right', 1 - fx],
    ['above', fy],
    ['below', 1 - fy],
  ].filter(([, d]) => d < EDGE)
  if (edges.length === 0) return 'center'
  return edges.sort((a, b) => a[1] - b[1])[0][0]
}

// The part of a pane a drop zone covers, for the preview overlay.
function zoneRect(rect, zone) {
  switch (zone) {
    case 'left':
      return { ...rect, width: rect.width / 2 }
    case 'right':
      return { ...rect, left: rect.left + rect.width / 2, width: rect.width / 2 }
    case 'above':
      return { ...rect, height: rect.height / 2 }
    case 'below':
      return { ...rect, top: rect.top + rect.height / 2, height: rect.height / 2 }
    default:
      return rect
  }
}

// The Workspace as a focused split-pane frame (Cursor / VS Code style)
// instead of an infinite canvas of floating windows: the Code Editor on the
// left, the hi-fi Canvas (with Preview and AI Chat as its tabs) on the
// right — and the Files / Layers navigator as a pane before them. Every
// pane, the navigator and AI Chat included, can be resized, dragged and
// docked into any side of any other. Panes split both ways: side by side and stacked, as a tree
// (floatingDockApi's `layout`), with draggable splitters between them.
// Drag a window by its header — or a single tab — onto a pane to dock it
// beside it (drop near an edge) or into it as a tab (drop in the middle);
// each header's `+` opens another view in that pane.
// It's the same window model as before (floatingDockApi, built by
// DockLayout's buildInitialLayout), so every window keeps its header —
// tabs, the panel's own toolbar, maximize / close, plus minimize — and
// everything that opens, closes or focuses panels through `dockApi`
// (Layout presets, the Preview button, the command palette, the canvas's
// layer-inspect tabs) works unchanged.
function WorkspaceSplitLayout() {
  const { setDockApi, filesWindow, setFilesWindow } = useWorkspace()
  const { dockApi, store } = useFloatingDockApi()
  const [dock, setDock] = useState(null) // { groupId, target, zone, rect } while dragging a window
  const rootRef = useRef(null)
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

  // The navigator (Files / Layers / Assets) is an ordinary pane, kept in
  // step with `filesWindow.open`: opening it (palette, `+`, …) docks it at
  // the far left — a slim share — and closing its window closes it.
  useEffect(() => {
    const panel = dockApi.getPanel(panelById.navigator.id)
    if (filesWindow.open && !panel) {
      const first = firstLeaf(store.layout)
      const anchor = first && store.groups[first.id]?.activeId
      addDockPanel(dockApi, panelById.navigator, {
        position: anchor ? { direction: 'left', referencePanel: anchor } : undefined,
        share: 0.3,
      })
    } else if (!filesWindow.open && panel) {
      panel.api.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filesWindow.open, dockApi])

  const hadNavigator = useRef(false)
  useEffect(() => {
    const disposable = dockApi.onDidLayoutChange(() => {
      const has = !!dockApi.getPanel(panelById.navigator.id)
      if (hadNavigator.current && !has) setFilesWindow({ open: false })
      hadNavigator.current = has
    })
    return () => disposable.dispose()
  }, [dockApi, setFilesWindow])

  // Drag a window by its header — or one of its tabs — past a small
  // threshold, then track the pane under the pointer and the zone on it;
  // dropping docks it there. A tab may also land on an edge of its own
  // window (splitting it off), when there are other tabs to leave behind.
  function startDockDrag(source, event) {
    const { groupId, panelId } = source
    const startX = event.clientX
    const startY = event.clientY
    let current = null
    let moved = false

    function onMove(m) {
      if (!moved && Math.hypot(m.clientX - startX, m.clientY - startY) < DRAG_THRESHOLD) return
      moved = true
      document.body.style.cursor = 'grabbing'
      document.body.style.userSelect = 'none'
      const leaf = document.elementFromPoint(m.clientX, m.clientY)?.closest('[data-leaf]')
      const target = leaf?.getAttribute('data-leaf')
      const root = rootRef.current?.getBoundingClientRect()
      const r = leaf?.getBoundingClientRect()
      const zone = r && dropZone(r, m.clientX, m.clientY)
      const own = target === groupId
      const allowed =
        leaf && target && root && (!own || (panelId && zone !== 'center' && store.groups[groupId]?.panelIds.length > 1))
      if (!allowed) {
        current = null
        setDock({ groupId, target: null })
        return
      }
      const z = zoneRect({ left: r.left, top: r.top, width: r.width, height: r.height }, zone)
      current = { target, zone }
      setDock({ groupId, target, zone, rect: { left: z.left - root.left, top: z.top - root.top, width: z.width, height: z.height } })
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      setDock(null)
      if (!current) return
      if (panelId) dockApi.dockPanel(panelId, current.target, current.zone)
      else dockApi.dockGroup(groupId, current.target, current.zone)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function renderNode(node, parentDir) {
    if (node.type === 'leaf') {
      const group = store.groups[node.id]
      if (!group || !group.open || group.panelIds.length === 0) return null
      if (group.minimized) return <MinimizedStrip group={group} panelsById={store.panels} dockApi={dockApi} dir={parentDir} />
      return (
        <div data-leaf={group.id} className="flex size-full min-h-0 min-w-0">
          <FloatingWindow
            group={group}
            panelsById={store.panels}
            dockApi={dockApi}
            components={components}
            docked
            onDockDragStart={startDockDrag}
          />
        </div>
      )
    }
    return <SplitNode node={node} dockApi={dockApi} store={store} renderNode={renderNode} />
  }

  return (
    <div className="absolute inset-0 bg-background px-3 pt-16 pb-3">
      <div ref={rootRef} className="relative isolate flex size-full min-w-0">
        <div className="flex min-w-0 flex-1">{store.layout && renderNode(store.layout, 'row')}</div>

        {/* Where a dragged window would dock. */}
        {dock?.rect && (
          <div
            className="pointer-events-none absolute z-[600] rounded-2xl bg-emerald-400/10 ring-2 ring-emerald-400/60 transition-all duration-100"
            style={dock.rect}
          />
        )}
      </div>
    </div>
  )
}

// One split of the tree: its children side by side ('row') or stacked
// ('col'), with a splitter between each neighboring pair.
function SplitNode({ node, dockApi, store, renderNode }) {
  const ref = useRef(null)
  const drag = useRef(null)
  const row = node.dir === 'row'
  const isMinimized = (child) => child.type === 'leaf' && store.groups[child.id]?.minimized
  const visible = node.children.filter((child) => child.type === 'split' || (store.groups[child.id]?.open && store.groups[child.id]?.panelIds.length))
  // Weights as shares of the row / column (flex-grow values that sum
  // below 1 would leave part of it empty).
  const total = visible.reduce((sum, child) => sum + (isMinimized(child) ? 0 : (node.sizes[node.children.indexOf(child)] ?? 1)), 0) || 1

  // Start of a splitter drag: every child's measured size becomes its
  // weight (so nothing else jumps), then the pair on either side trades.
  function startResize(a, b) {
    const measured = [...node.sizes]
    ref.current.querySelectorAll(':scope > .contents > [data-split-child]').forEach((el) => {
      const r = el.getBoundingClientRect()
      measured[Number(el.dataset.splitChild)] = row ? r.width : r.height
    })
    drag.current = { a, b, measured }
  }

  function resize(delta) {
    const d = drag.current
    if (!d) return
    const { a, b, measured } = d
    const total = measured[a] + measured[b]
    const first = Math.min(total - MIN_PANE, Math.max(MIN_PANE, measured[a] + delta))
    const sizes = [...measured]
    sizes[a] = first
    sizes[b] = total - first
    dockApi.setSplitSizes(node.id, sizes)
  }

  return (
    <div ref={ref} className={cn('flex size-full min-h-0 min-w-0', row ? 'flex-row' : 'flex-col')}>
      {visible.map((child, i) => {
        const index = node.children.indexOf(child)
        const prev = visible[i - 1]
        const resizable = prev && !isMinimized(prev) && !isMinimized(child)
        return (
          <div key={child.id} className="contents">
            {prev &&
              (resizable ? (
                <SplitHandle
                  label="Resize panes"
                  orientation={row ? 'vertical' : 'horizontal'}
                  onResizeStart={() => startResize(node.children.indexOf(prev), index)}
                  onResize={resize}
                  onResizeEnd={() => (drag.current = null)}
                  onStep={(delta) => {
                    startResize(node.children.indexOf(prev), index)
                    resize(delta)
                    drag.current = null
                  }}
                />
              ) : (
                <span className={row ? 'w-2 shrink-0' : 'h-2 shrink-0'} />
              ))}
            {isMinimized(child) ? (
              renderNode(child, node.dir)
            ) : (
              <div
                data-split-child={index}
                className="flex min-h-0 min-w-0"
                style={{ flex: `${((node.sizes[index] ?? 1) / total) * 100} 1 0px`, [row ? 'minWidth' : 'minHeight']: MIN_PANE }}
              >
                {renderNode(child, node.dir)}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function firstLeaf(node) {
  if (!node) return null
  return node.type === 'leaf' ? node : firstLeaf(node.children[0])
}

export default WorkspaceSplitLayout
