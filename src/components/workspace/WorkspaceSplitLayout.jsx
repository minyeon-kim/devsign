import { codeMergeVariants, designMergeVariants } from '@/data/mockData'
import { MergeDeckSlotContext } from '@/components/mergestudio/MergeDeckSlot'
import { DOCUMENT_DRAG_TYPE, documentTarget, openWorkspaceDocument } from '@/lib/workspaceDocuments'
import DocumentPanel from '@/components/dockview/panels/DocumentPanel'
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
import { addDockPanel, buildInitialLayout, panelById } from '@/components/dockview/dockPanels'
import SplitHandle from '@/components/layout/SplitHandle'
import FloatingWindow from '@/components/workspace/FloatingWindow'
import { PANEL_ICONS } from '@/components/workspace/panelIcons'
import { useFloatingDockApi } from '@/components/workspace/floatingDockApi'
import { FLOATING_PANEL, PANEL_RADIUS } from '@/components/mergestudio/floatingStyles'
import { useWorkspace } from '@/state/WorkspaceProvider'

const components = {
  document: DocumentPanel,
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

const EMPTY_VIEWS = [panelById.editor, panelById.canvas, panelById.chat]
const MIN_PANE = 200
// The navigator's default width, in px.
const NAVIGATOR_W = 240
const DRAG_THRESHOLD = 5
// How close to a pane's edge (as a share of its size) a drop docks beside
// it rather than into it as a tab.
const EDGE = 0.2

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

// Merge Studio's own minimized state for a floating chat/navigator window:
// its panes sit absolutely positioned over the canvas rather than docked
// in the split tree MinimizedStrip expects to be a flex sibling of, so
// restoring it is its own small floating pill instead — bottom-left,
// clear of the canvas's other floating chrome (zoom controls, help,
// Merge List), same surface language as the rest of Merge Studio's pills.
function FloatingRestorePill({ group, panelsById, dockApi }) {
  const panel = panelsById[group.activeId]
  const Icon = PANEL_ICONS[panel?.params?.iconName]
  return (
    <div className="pointer-events-none absolute inset-0 z-40">
      <button
        type="button"
        title={`Restore ${panel?.title ?? 'window'}`}
        aria-label={`Restore ${panel?.title ?? 'window'}`}
        onClick={() => dockApi.minimizeGroup(group.id, false)}
        data-restore-pill={group.activeId}
        className={cn(
          // In the studio's header row, clear of the canvas: AI Chat's (it
          // starts closed) beside the Workspace button, the navigator's at
          // the right, over where it folded from.
          'pointer-events-auto absolute top-2 flex h-8',
          group.panelIds.includes(panelById.chat.id) ? 'left-[152px]' : 'right-2',
          'items-center gap-2 px-3.5 text-[12px] font-medium text-slate-300 transition-colors hover:text-white',
          PANEL_RADIUS,
          FLOATING_PANEL
        )}
      >
        {Icon && <Icon className="size-4 shrink-0" />}
        {panel?.title}
      </button>
    </div>
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
// instead of an infinite canvas of floating windows. Code Editor, Canvas,
// Preview and AI Chat are equal, independent tabs — none is a fixed pane;
// each can be closed, dragged and split, and reopened from any `+` — with
// the Files / Layers / Assets navigator as a pane at the far right. Every
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
function WorkspaceSplitLayout({ mergeStudio = false, children }) {
  const { setDockApi, filesWindow, setFilesWindow, bottomPanel, referenceDocs, setChatTargetOverride, openMergeItem } = useWorkspace()
  // In Merge Studio, the code editor rides along in AI Chat's window only
  // when the open item actually changes code — otherwise it's a file that
  // has nothing to do with what's on the canvas.
  const studioItemHasCode = Boolean(openMergeItem && (
    Object.keys(codeMergeVariants[openMergeItem.id] ?? {}).length ||
    Object.keys(designMergeVariants[openMergeItem.id]?.layerCodeMap ?? {}).length
  ))
  const { dockApi, store } = useFloatingDockApi()
  const [deckElement, setDeckElement] = useState(null)
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

  // Keep the same dock and side-panel instances across both work modes.
  // Reopen the shared panels if they were closed before entering the studio.
  useEffect(() => {
    if (!mergeStudio) return
    if (!dockApi.getPanel(panelById.canvas.id)) addDockPanel(dockApi, panelById.canvas)
    if (!dockApi.getPanel(panelById.chat.id)) {
      addDockPanel(dockApi, panelById.chat, {
        position: { direction: 'left', referencePanel: panelById.canvas.id },
        initialWidth: 380,
      })
    }
    const canvasGroupId = store.panels[panelById.canvas.id]?.groupId
    for (const [id, side] of [[panelById.chat.id, 'left'], [panelById.navigator.id, 'right']]) {
      if (store.panels[id]?.groupId === canvasGroupId) dockApi.dockPanel(id, canvasGroupId, side)
    }
    if (canvasGroupId) dockApi.minimizeGroup(canvasGroupId, false)
    dockApi.getPanel(panelById.chat.id)?.api.setActive()
    setFilesWindow({ open: true })
  }, [mergeStudio, dockApi, setFilesWindow, store])

  const studioGroup = Object.values(store.groups).find((group) =>
    group.open && group.panelIds.includes(panelById.canvas.id)
  )

  const floatingGroups = useRef(new Set())
  useEffect(() => {
    if (!mergeStudio) {
      floatingGroups.current.clear()
      return
    }
    const bounds = rootRef.current?.getBoundingClientRect()
    if (!bounds) return
    for (const [id, right] of [[panelById.chat.id, false], [panelById.navigator.id, true]]) {
      const groupId = store.panels[id]?.groupId
      if (!groupId || floatingGroups.current.has(groupId)) continue
      floatingGroups.current.add(groupId)
      // AI Chat a little narrower than a docked pane, and both windows flush
      // with the bottom panel's left and right edges (the same column).
      const width = Math.min(right ? NAVIGATOR_W : 300, bounds.width * 0.3)
      const height = Math.max(180, Math.min(560, bounds.height - 160))
      // Just under the 32px studio header row (8px + 32px + 8px gap) —
      // the same 48px line the Workspace's windows start on.
      dockApi.moveGroup(groupId, right ? bounds.width - width : 0, 48)
      dockApi.resizeGroup(groupId, width, height)
      // AI Chat and the navigator both float folded until asked for (their
      // pills in the header row bring them up), so the canvas starts with
      // the room.
      dockApi.minimizeGroup(groupId, true)
    }
  }, [mergeStudio, dockApi, store, filesWindow.open, studioGroup?.id])

  // The navigator (Files / Layers / Assets) is an ordinary pane, kept in
  // step with `filesWindow.open`: opening it (palette, `+`, …) docks it at
  // the far right of the frame — a compact ~NAVIGATOR_W column, opposite
  // the activity bar — and closing its window closes it.
  useEffect(() => {
    const panel = dockApi.getPanel(panelById.navigator.id)
    if (filesWindow.open && !panel) {
      const width = rootRef.current?.clientWidth
      const share = width ? Math.min(0.3, NAVIGATOR_W / width) : 0.2
      addDockPanel(dockApi, panelById.navigator, { share })
    } else if (!filesWindow.open && panel) {
      panel.api.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filesWindow.open, dockApi])

  // Context-aware navigator: whenever focus moves to a Code Editor tab it
  // shows Files; to a Canvas tab, Layers (or Assets, if that's already up).
  // Focus is the window the user last clicked into (or picked a tab in)
  // and its active tab — not one raised in code, e.g. the editor that
  // canvas→code sync brings forward on a layer click. Clicking into the
  // navigator itself counts too, so picking a view there sticks until
  // focus goes back to an editor or canvas.
  const hadNavigator = useRef(false)
  const focusKey = useRef(null)
  const filesTab = useRef(filesWindow.tab)
  filesTab.current = filesWindow.tab
  useEffect(() => {
    function sync() {
      const has = !!dockApi.getPanel(panelById.navigator.id)
      if (hadNavigator.current && !has) setFilesWindow({ open: false })
      hadNavigator.current = has

      const focused = store.groups[store.focusedGroupId]
      const top = focused?.open && focused.panelIds.length ? focused : null
      const key = top ? `${top.id}:${top.activeId}` : null
      if (key === focusKey.current) return
      focusKey.current = key
      const component = top && store.panels[top.activeId]?.component
      if (mergeStudio) return
      if (component === 'editor' && filesTab.current !== 'files') setFilesWindow({ tab: 'files' })
      if (component === 'canvas' && filesTab.current === 'files') setFilesWindow({ tab: 'layers' })
    }
    sync()
    const disposable = dockApi.onDidLayoutChange(sync)
    return () => disposable.dispose()
  }, [dockApi, store, setFilesWindow, mergeStudio])

  // Drag a window by its header — or one of its tabs — past a small
  // threshold, then track the pane under the pointer and the zone on it;
  // dropping docks it there. A tab may also land on an edge of its own
  // window (splitting it off), when there are other tabs to leave behind.
  function startDockDrag(source, event) {
    const { groupId, panelId, tabId, reorder } = source
    const startX = event.clientX
    const startY = event.clientY
    let current = null
    let moved = false

    function onMove(m) {
      if (!moved && Math.hypot(m.clientX - startX, m.clientY - startY) < DRAG_THRESHOLD) return
      moved = true
      document.body.style.cursor = 'grabbing'
      document.body.style.userSelect = 'none'
      const under = document.elementFromPoint(m.clientX, m.clientY)
      const leaf = under?.closest('[data-leaf]')
      const target = leaf?.getAttribute('data-leaf')
      const root = rootRef.current?.getBoundingClientRect()
      // Over a window's tab bar: merge into it as a tab. Over its body:
      // an edge splits, the middle also merges.
      const header = under?.closest('[data-window-header]')
      const targetTab = header && under?.closest('[data-tab-id]')
      const targetPanelId = targetTab?.getAttribute('data-panel-id')
      const targetTabId = targetTab?.getAttribute('data-tab-id')
      if (root && targetTab && panelId && tabId && (targetPanelId !== panelId || targetTabId !== tabId)) {
        const rect = targetTab.getBoundingClientRect()
        const after = m.clientX >= rect.left + rect.width / 2
        current = { target, zone: 'center', targetPanelId, targetTabId, after, reorder: true }
        setDock({ groupId, target, zone: 'center', onHeader: true, reorder: true,
          rect: { left: (after ? rect.right : rect.left) - root.left - 1, top: rect.top - root.top, width: 2, height: rect.height } })
        return
      }
      const r = leaf?.getBoundingClientRect()
      const zone = header ? 'center' : r && dropZone(r, m.clientX, m.clientY)
      const own = target === groupId
      const allowed =
        leaf && target && root && (!own || (panelId && zone !== 'center' && store.groups[groupId]?.panelIds.length > 1))
      if (!allowed) {
        current = null
        setDock({ groupId, target: null })
        return
      }
      const z = header
        ? header.getBoundingClientRect()
        : zoneRect({ left: r.left, top: r.top, width: r.width, height: r.height }, zone)
      current = { target, zone }
      setDock({
        groupId,
        target,
        zone,
        onHeader: !!header,
        rect: { left: z.left - root.left, top: z.top - root.top, width: z.width, height: z.height },
      })
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      setDock(null)
      if (moved) {
        // The pointerup after a drag must not activate the tab underneath it.
        const suppressClick = (event) => { event.preventDefault(); event.stopPropagation() }
        window.addEventListener('click', suppressClick, { capture: true, once: true })
        window.setTimeout(() => window.removeEventListener('click', suppressClick, true), 0)
      }
      if (!current) return
      if (current.reorder) {
        if (current.targetPanelId === panelId) reorder?.(tabId, current.targetTabId, current.after)
        else dockApi.reorderPanel(panelId, current.targetPanelId, current.after)
        return
      }
      if (panelId) dockApi.dockPanel(panelId, current.target, current.zone)
      else dockApi.dockGroup(groupId, current.target, current.zone)
    }
    function onCancel() { current = null; onUp() }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
  }

  function documentDrop(event, commit = false) {
    if (!Array.from(event.dataTransfer.types).includes(DOCUMENT_DRAG_TYPE)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    const leaf = event.target.closest('[data-leaf]')
    const group = leaf && store.groups[leaf.dataset.leaf]
    const root = rootRef.current.getBoundingClientRect()
    const rect = (leaf ?? rootRef.current).getBoundingClientRect()
    const zone = event.target.closest('[data-window-header]') ? 'center' : dropZone(rect, event.clientX, event.clientY)
    const preview = zoneRect({ left: rect.left, top: rect.top, width: rect.width, height: rect.height }, zone)
    if (!commit) {
      setDock({ rect: { ...preview, left: preview.left - root.left, top: preview.top - root.top } })
      return
    }
    setDock(null)
    const doc = referenceDocs.find((entry) => entry.id === event.dataTransfer.getData(DOCUMENT_DRAG_TYPE))
    if (!doc) return
    openWorkspaceDocument(dockApi, doc, group ? { referencePanel: group.activeId, direction: zone === 'center' ? 'within' : zone } : {})
    setChatTargetOverride(documentTarget(doc))
  }

  function renderNode(node, parentDir) {
    if (node.type === 'leaf') {
      const group = store.groups[node.id]
      if (!group || !group.open || group.panelIds.length === 0) return null
      const showStudio = mergeStudio && group.id === studioGroup?.id
      const floatingSide = mergeStudio && group.panelIds.some((id) => [panelById.chat.id, panelById.navigator.id].includes(id))
      if (group.minimized && !showStudio) {
        // MinimizedStrip is a flex sibling meant for the normal docked
        // split tree — Merge Studio's chat/navigator panes are absolutely
        // positioned over the canvas instead, so they get their own small
        // floating restore pill rather than a strip with nowhere in the
        // flex layout to actually sit.
        if (floatingSide) return <FloatingRestorePill key={group.id} group={group} panelsById={store.panels} dockApi={dockApi} />
        return <MinimizedStrip group={group} panelsById={store.panels} dockApi={dockApi} dir={parentDir} />
      }
      return (
        <div data-leaf={group.id} className={cn(
          'min-h-0 min-w-0',
          mergeStudio ? (showStudio ? 'absolute inset-0 flex' : floatingSide ? 'pointer-events-none absolute inset-0 z-40' : 'hidden') : 'relative flex size-full'
        )}>
          <div className={cn('size-full min-h-0 min-w-0', showStudio && 'hidden', floatingSide && '[&>[data-window]]:pointer-events-auto')} inert={showStudio || undefined}>
          <FloatingWindow
            group={mergeStudio && !studioItemHasCode && group.panelIds.includes(panelById.editor.id) && group.panelIds.length > 1
              ? (() => {
                  const panelIds = group.panelIds.filter((id) => id !== panelById.editor.id)
                  return { ...group, panelIds, activeId: panelIds.includes(group.activeId) ? group.activeId : panelIds[0] }
                })()
              : group}
            panelsById={store.panels}
            dockApi={dockApi}
            components={components}
            docked={!mergeStudio}
            onDockDragStart={startDockDrag}
          />
          </div>
          {showStudio && <div className="absolute inset-0 flex min-h-0 min-w-0 flex-col overflow-hidden">{children}</div>}
        </div>
      )
    }
    return <SplitNode node={node} dockApi={dockApi} store={store} renderNode={renderNode} floating={mergeStudio} />
  }

  // Dock flush to the activity rail and bottom panel; retain only top-bar clearance.
  return (
    <MergeDeckSlotContext.Provider value={{ element: deckElement, setElement: setDeckElement }}>
    <div className={cn('absolute inset-0 bg-background px-0 pr-2', mergeStudio ? 'pt-0' : 'pt-[var(--ds-chrome-size)]', bottomPanel.open ? 'pb-2' : 'pb-0')}>
      <div ref={rootRef} onDragOver={documentDrop} onDrop={(event) => documentDrop(event, true)} onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setDock(null)
      }} onDragEnd={() => setDock(null)} className="relative isolate flex size-full min-w-0">
        <div className={mergeStudio ? "contents" : "flex min-w-0 flex-1"}>
          {store.layout ? renderNode(store.layout, 'row') : <EmptyFrame dockApi={dockApi} />}
        </div>

        {/* Where a dragged window would dock. */}
        {/* Where a dragged window / tab would land: a split (a half of
            the pane) or a merge (its tab bar / whole body), labeled. */}
        {dock?.rect && (
          <div
            className={cn(
              'pointer-events-none absolute z-[600] flex items-center justify-center bg-emerald-400/10 ring-2 ring-emerald-400/60 transition-all duration-100',
              dock.onHeader ? 'rounded-t-[20px]' : 'rounded-2xl'
            )}
            style={dock.rect}
          >
          </div>
        )}
      </div>
    </div>
    </MergeDeckSlotContext.Provider>
  )
}

// Every view closed: a quiet placeholder to reopen one.
function EmptyFrame({ dockApi }) {
  return (
    <div className={cn('flex size-full flex-col items-center justify-center gap-3', PANEL_RADIUS, FLOATING_PANEL)}>
      <p className="text-[13px] text-slate-500">No views open</p>
      <div className="flex gap-1.5">
        {EMPTY_VIEWS.map((def) => {
          const Icon = PANEL_ICONS[def.iconName]
          return (
            <button
              key={def.id}
              type="button"
              onClick={() => addDockPanel(dockApi, def)}
              className="flex h-8 items-center gap-2 rounded-full px-3 text-xs text-slate-300 ring-1 ring-white/10 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              {Icon && <Icon className="size-3.5" />}
              {def.title}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// One split of the tree: its children side by side ('row') or stacked
// ('col'), with a splitter between each neighboring pair.
function SplitNode({ node, dockApi, store, renderNode, floating = false }) {
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
    <div ref={ref} className={floating ? 'contents' : cn('flex size-full min-h-0 min-w-0', row ? 'flex-row' : 'flex-col')}>
      {visible.map((child, i) => {
        const index = node.children.indexOf(child)
        const prev = visible[i - 1]
        const resizable = prev && !isMinimized(prev) && !isMinimized(child)
        return (
          <div key={child.id} className="contents">
            {prev && !floating &&
              (resizable ? (
                <SplitHandle
                  label="Resize panes"
                  orientation={row ? 'vertical' : 'horizontal'}
                  className={row ? 'w-2' : 'h-2'}
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
                className={floating ? "contents" : "flex min-h-0 min-w-0"}
                style={floating ? undefined : { flex: `${((node.sizes[index] ?? 1) / total) * 100} 1 0px`, [row ? 'minWidth' : 'minHeight']: MIN_PANE }}
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

export default WorkspaceSplitLayout
