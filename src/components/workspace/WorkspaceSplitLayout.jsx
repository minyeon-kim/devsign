import { codeMergeVariants, designMergeVariants } from '@/data/mockData'
import { MergeDeckSlotContext } from '@/components/mergestudio/MergeDeckSlot'
import { DOCUMENT_DRAG_TYPE, documentTarget, openWorkspaceDocument } from '@/lib/workspaceDocuments'
import DocumentPanel from '@/components/dockview/panels/DocumentPanel'
import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { AI_CHAT, SIDE_PANEL, SIDE_TABS, clampWidth, panelToFold } from '@/lib/panelPrefs'
import WorkspaceDesignCompare from '@/components/workspace/WorkspaceDesignCompare'
import WorkspaceViewTabs, { VIEW_PANEL_ID, viewTabId } from '@/components/workspace/WorkspaceViewTabs'
import ScreensBoard from '@/components/screens/ScreensBoard'
import { VIEWS } from '@/lib/viewLink'
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
  designCompare: WorkspaceDesignCompare,
  screens: ScreensBoard,
}

// The Workspace's views and the panels of its main window that show them:
// Screens is its board — or the canvas, while a screen is being edited.
const VIEW_PANELS = { preview: ['preview'], screens: ['screens', 'canvas'], code: ['editor'] }
const viewOfPanel = (component) => VIEWS.find((view) => VIEW_PANELS[view].includes(component)) ?? null

const EMPTY_VIEWS = [panelById.editor, panelById.canvas, panelById.chat]
const MIN_PANE = 200
// The navigator's default width, in px.
const NAVIGATOR_W = 240
// The side panel (Files · Layers · Assets · Inspect, Terminal, Console — at
// the left) and AI Chat (at the right) fold away; whether they're open and
// how wide is kept for the browser (lib/panelPrefs). Their shortcuts:
const MAC = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform)
const SIDE_SHORTCUT = MAC ? '⌘B' : 'Ctrl+B'
const CHAT_SHORTCUT = MAC ? '⌘L' : 'Ctrl+L'
// (The ids their toggles name with `aria-controls`.)
const SIDE_ID = 'workspace-side-panel'
const CHAT_ID = 'workspace-ai-chat'
const isTyping = (target) => target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
const DRAG_THRESHOLD = 5
// How close to a pane's edge (as a share of its size) a drop docks beside
// it rather than into it as a tab.
const EDGE = 0.2

// Merge Studio's own minimized state for a floating chat/navigator window:
// its panes sit absolutely positioned over the canvas rather than docked
// in the split tree (nothing there to keep a place in), so
// restoring it is its own small floating pill instead — same surface
// language as the rest of Merge Studio's pills. AI Chat folds the same way
// in the Workspace too (`corner: 'bottom'`): a pill at the work area's
// bottom-left, clear of the tabs, rather than a full-height strip.
function FloatingRestorePill({ group, panelsById, dockApi, corner = 'top' }) {
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
          // starts closed) at its left end, the navigator's at
          // the right, over where it folded from.
          'pointer-events-auto absolute flex h-8',
          corner === 'bottom' ? 'bottom-4' : 'top-2',
          // (In the studio the way out is the row's first pill — "← Workspace", or its icon in a
          // narrow window — so AI Chat's sits after it.)
          group.panelIds.includes(panelById.chat.id) ? (corner === 'top' ? 'left-[9.75rem] @max-[1100px]:left-14' : 'left-4') : 'right-2',
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
  const { setDockApi, filesWindow, setFilesWindow, bottomPanel, referenceDocs, setChatTargetOverride, openMergeItem, projectId, sidePanel, setSidePanel, aiChat, setAiChat, chatUnread, chatAwaitingApproval, workspaceView, setWorkspaceView } = useWorkspace()
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

  // (Before the first paint — so is everything that folds a panel on
  // arrival: nothing opens and then shuts.)
  useLayoutEffect(() => {
    if (didInit.current) return
    didInit.current = true
    buildInitialLayout(dockApi)
    // (Which of the main window's views shows is the Workspace's view — below;
    // AI Chat starts folded for everyone — see the side panels.)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // (In the studio the code file rides in AI Chat's window — see `studioItemHasCode`.)
    const studioChatGroupId = store.panels[panelById.chat.id]?.groupId
    if (studioChatGroupId && store.panels[panelById.editor.id] && store.panels[panelById.editor.id].groupId !== studioChatGroupId) dockApi.dockPanel(panelById.editor.id, studioChatGroupId, 'center')
    if (canvasGroupId) dockApi.minimizeGroup(canvasGroupId, false)
    dockApi.getPanel(panelById.chat.id)?.api.setActive()
    setFilesWindow({ open: true })
  }, [mergeStudio, dockApi, setFilesWindow, store])

  // Back in the Workspace the code file leaves AI Chat's window for the main one.
  const wasStudio = useRef(mergeStudio)
  useLayoutEffect(() => {
    if (wasStudio.current === mergeStudio) return
    wasStudio.current = mergeStudio
    if (mergeStudio) return
    const editor = store.panels[panelById.editor.id]
    const canvasGroupId = store.panels[panelById.canvas.id]?.groupId
    if (!editor || !canvasGroupId || editor.groupId !== store.panels[panelById.chat.id]?.groupId) return
    // (Back as one of the main window's views; which one shows is put right just below.)
    applied.current.view = false
    dockApi.dockPanel(panelById.editor.id, canvasGroupId, 'center')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mergeStudio])

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
      // Both windows flush with the bottom panel's left and right edges (the
      // same column).
      // (AI Chat is the roomier of the two: it holds a conversation, so it
      // opens wide and tall instead of as a narrow card.)
      const width = right ? Math.min(NAVIGATOR_W, bounds.width * 0.3) : Math.min(440, bounds.width * 0.36)
      const height = right ? Math.max(180, Math.min(560, bounds.height - 160)) : Math.max(240, Math.min(760, bounds.height - 120))
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
  // the far left of the frame — a compact column beside the activity bar
  // — and closing its window closes it.
  useLayoutEffect(() => {
    const panel = dockApi.getPanel(panelById.navigator.id)
    if (filesWindow.open && !panel) {
      const width = rootRef.current?.clientWidth
      const share = width ? Math.min(0.3, NAVIGATOR_W / width) : 0.2
      addDockPanel(dockApi, panelById.navigator, { share, atStart: true })
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
  // (Which windows the panels' state has been put on, and that state now — see the side panels, below.)
  const applied = useRef({})
  const panelOpen = useRef({})
  panelOpen.current = { side: sidePanel.open, chat: aiChat.open }
  const viewNow = useRef(workspaceView)
  viewNow.current = workspaceView
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
      // A window unfolded from the dock's side (something raised one of its
      // tabs, or it was dragged somewhere): the panel's state follows.
      const chat = store.groups[store.panels[panelById.chat.id]?.groupId]
      if (chat && applied.current.chat === chat.id && Boolean(chat.minimized) === panelOpen.current.chat) setAiChat({ open: !chat.minimized })
      const side = store.groups[store.panels[panelById.navigator.id]?.groupId]
      if (side && applied.current.side === side.id && Boolean(side.minimized) === panelOpen.current.side) setSidePanel({ open: !side.minimized })
      // The main window showing another of its views (a file opened from the
      // tree, a pin taking the canvas up): the Workspace's view follows.
      const main = store.groups[store.panels[panelById.canvas.id]?.groupId]
      const showing = main && applied.current.view ? viewOfPanel(store.panels[main.activeId]?.component) : null
      if (showing && showing !== viewNow.current) setWorkspaceView(showing)
      // (Terminal and Console stay up until another view is picked.)
      if (!SIDE_TABS.includes(filesTab.current)) return
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

  // The Workspace's two side panels — the side panel (the navigator's
  // window, at the left) and AI Chat (in its own window, at the right).
  // Whether each is open and how wide is the provider's (lib/panelPrefs:
  // kept for the browser, read before the first render); here their windows
  // are kept in step with it, before paint. The side panel is opened by the
  // person only — an activity bar icon, its shortcut; AI Chat by anything
  // that asks for it. Folded, a window stays mounted at no width
  // (SplitNode): what's in it — a draft, a scroll position, an answer being
  // written — is kept.
  const groupOf = (panelId) => Object.values(store.groups).find((group) => group.open && group.panelIds.includes(panelId)) ?? null
  const sideGroup = groupOf(panelById.navigator.id)
  const chatGroup = groupOf(panelById.chat.id)
  const sideGroupId = sideGroup?.id ?? null
  const chatGroupId = chatGroup?.id ?? null
  useLayoutEffect(() => {
    if (mergeStudio) { applied.current = {}; return }
    if (sideGroup && Boolean(sideGroup.minimized) === sidePanel.open) dockApi.minimizeGroup(sideGroup.id, !sidePanel.open, { byUser: true })
    if (chatGroup && Boolean(chatGroup.minimized) === aiChat.open) dockApi.minimizeGroup(chatGroup.id, !aiChat.open)
    applied.current = { side: sideGroupId, chat: chatGroupId }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mergeStudio, sideGroupId, chatGroupId, sidePanel.open, aiChat.open])

  // The Workspace's view (Preview · Screens · Code — the address's `?view`)
  // is which panel of the main window shows; put on it before paint, and
  // followed back when the window shows another by itself (the sync above).
  const mainGroup = groupOf(panelById.canvas.id)
  const mainGroupId = mainGroup?.id ?? null
  const mainShowing = mainGroup ? store.panels[mainGroup.activeId]?.component ?? null : null
  useLayoutEffect(() => {
    if (mergeStudio || !mainGroup) { applied.current.view = false; return }
    // (Leaving the studio runs first and moves the code file back: read the window afresh.)
    const showing = store.panels[store.groups[mainGroup.id]?.activeId]?.component
    if (!VIEW_PANELS[workspaceView].includes(showing)) dockApi.getPanel(panelById[VIEW_PANELS[workspaceView][0]].id)?.api.setActive()
    applied.current.view = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mergeStudio, mainGroupId, workspaceView])

  // Their widths, inside their limits for this window.
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window === 'undefined' ? null : window.innerWidth))
  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const sideWidth = clampWidth(SIDE_PANEL, sidePanel.width, viewportWidth)
  const chatWidth = clampWidth(AI_CHAT, aiChat.width, viewportWidth)
  const fixed = mergeStudio ? null : {
    ...(sideGroupId && { [sideGroupId]: { name: 'side', id: SIDE_ID, label: 'Resize side panel', width: sideWidth, onWidth: (width) => setSidePanel({ width }), onReset: () => setSidePanel({ width: SIDE_PANEL.width }) } }),
    ...(chatGroupId && { [chatGroupId]: { name: 'chat', id: CHAT_ID, label: 'Resize AI Chat', width: chatWidth, onWidth: (width) => setAiChat({ width }), onReset: () => setAiChat({ width: AI_CHAT.width }) } }),
  }

  // Opened or folded: where the focus goes, and room for the canvas.
  //   · AI Chat opened → its message box; the side panel opened by its
  //     shortcut → its tab. Folded with the focus inside → the button that
  //     brings it back (the activity bar's icon, AI Chat's pill).
  //   · Both open with too little left between them (lib/panelPrefs'
  //     MIN_CANVAS): the one that was already open folds.
  const focusWithin = useRef(null)
  useEffect(() => {
    const onFocus = (event) => { focusWithin.current = event.target.closest?.('[data-side-leaf]')?.dataset.sideLeaf ?? null }
    document.addEventListener('focusin', onFocus)
    return () => document.removeEventListener('focusin', onFocus)
  }, [])
  const sideByKey = useRef(false)
  const shown = useRef({ side: sidePanel.open, chat: aiChat.open })
  useEffect(() => {
    const before = shown.current
    shown.current = { side: sidePanel.open, chat: aiChat.open }
    if (mergeStudio) return
    const leaf = (name) => rootRef.current?.querySelector(`[data-side-leaf="${name}"]`)
    // (The focus was in it: still there, or already let go of as it folded.)
    const held = (name) => focusWithin.current === name && (!document.activeElement || document.activeElement === document.body || leaf(name)?.contains(document.activeElement))
    let opened = null
    if (before.side !== sidePanel.open) {
      // (A frame later: the window has stopped being inert by then.)
      if (sidePanel.open) { opened = 'side'; if (sideByKey.current) requestAnimationFrame(() => (leaf('side')?.querySelector('[role="tab"][aria-selected="true"]') ?? leaf('side')?.querySelector('button'))?.focus()) }
      else if (held('side')) (document.querySelector('[data-sidebar-toggle]') ?? document.querySelector(`[data-side-view="${filesWindow.tab}"]`) ?? document.querySelector('[data-side-view]'))?.focus()
      sideByKey.current = false
    }
    if (before.chat !== aiChat.open) {
      if (aiChat.open) { opened = 'chat'; requestAnimationFrame(() => leaf('chat')?.querySelector('textarea, [contenteditable="true"], input[type="text"]')?.focus()) }
      else if (held('chat')) rootRef.current?.querySelector('[data-chat-toggle]')?.focus()
    }
    if (!opened) return
    const fold = panelToFold({ room: rootRef.current?.clientWidth ?? Infinity, side: { open: sidePanel.open, width: sideWidth }, chat: { open: aiChat.open, width: chatWidth }, opened })
    if (fold === 'side') setSidePanel({ open: false })
    if (fold === 'chat') setAiChat({ open: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidePanel.open, aiChat.open, mergeStudio])

  // ⌘/Ctrl+B (or ⌘/Ctrl+\) folds and unfolds the side panel — not while
  // typing; ⌘/Ctrl+L, AI Chat — while typing only from inside the chat itself.
  const onPanelKey = useEffectEvent((event) => {
    // ⌥1 / ⌥2 / ⌥3: Preview, Screens, Code — not while typing.
    if (event.altKey && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.defaultPrevented && /^Digit[1-3]$/.test(event.code) && !isTyping(event.target)) {
      event.preventDefault()
      setWorkspaceView(VIEWS[Number(event.code.slice(5)) - 1])
      return
    }
    if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || event.defaultPrevented) return
    const key = event.key.toLowerCase()
    if (key === 'b' || key === '\\') {
      if (!sideGroup || isTyping(event.target)) return
      event.preventDefault()
      sideByKey.current = !sidePanel.open
      setSidePanel({ open: !sidePanel.open })
    } else if (key === 'l') {
      if (!chatGroup || (isTyping(event.target) && !event.target.closest('[data-side-leaf="chat"]'))) return
      event.preventDefault()
      setAiChat({ open: !aiChat.open })
    }
  })
  useEffect(() => {
    if (mergeStudio) return undefined
    const onKey = (event) => onPanelKey(event)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mergeStudio])

  function renderNode(node, parentDir) {
    if (node.type === 'leaf') {
      const group = store.groups[node.id]
      if (!group || !group.open || group.panelIds.length === 0) return null
      const showStudio = mergeStudio && group.id === studioGroup?.id
      const floatingSide = mergeStudio && group.panelIds.some((id) => [panelById.chat.id, panelById.navigator.id].includes(id))
      if (group.minimized && !showStudio) {
        // A folded window has no place of its own in the normal docked
        // split tree — Merge Studio's chat/navigator panes are absolutely
        // positioned over the canvas instead, so they get their own small
        // floating restore pill rather than a strip with nowhere in the
        // flex layout to actually sit.
        if (floatingSide) return <FloatingRestorePill key={group.id} group={group} panelsById={store.panels} dockApi={dockApi} />
        // Nothing is left in a folded window's place — no strip. The side
        // panel and AI Chat stay mounted at no width (SplitNode), so they
        // come back as they were: the side panel from the activity bar's
        // icons, AI Chat from its pill (below).
        if (group.id !== sideGroupId && group.id !== chatGroupId) return null
      }
      const leaf = (
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
            // The main window's row starts with the Workspace's views.
            viewTabs={!mergeStudio && group.id === mainGroupId ? <WorkspaceViewTabs editing={workspaceView === 'screens' && mainShowing === 'canvas'} onBoard={() => dockApi.getPanel(panelById.screens.id)?.api.setActive()} /> : null}
            viewPanel={!mergeStudio && group.id === mainGroupId ? { id: VIEW_PANEL_ID, labelledBy: viewTabId(workspaceView) } : null}
            // The side panel's and AI Chat's own tab rows carry their fold buttons.
            sideToggle={mergeStudio ? null
              : group.id === sideGroupId ? { label: 'Collapse panel', hint: SIDE_SHORTCUT, controls: SIDE_ID, onToggle: () => setSidePanel({ open: false }) }
              : group.id === chatGroupId ? { label: 'Collapse AI Chat', hint: CHAT_SHORTCUT, controls: CHAT_ID, mirrored: true, onToggle: () => setAiChat({ open: false }) }
              : null}
          />
          </div>
          {showStudio && <div className="absolute inset-0 flex min-h-0 min-w-0 flex-col overflow-hidden">{children}</div>}
        </div>
      )
      return leaf
    }
    return <SplitNode node={node} dockApi={dockApi} store={store} renderNode={renderNode} floating={mergeStudio} fixed={fixed} />
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

        {/* AI Chat, folded: its pill at the work area's bottom right, over
            where it folded to — with a dot when an answer finished unseen. */}
        {!mergeStudio && chatGroup && !aiChat.open && (
          <button
            type="button"
            data-chat-toggle
            aria-expanded={false}
            aria-controls={CHAT_ID}
            aria-label={chatAwaitingApproval ? 'Expand AI Chat · Awaiting approval' : chatUnread ? 'Expand AI Chat · New reply' : 'Expand AI Chat'}
            title={`Expand AI Chat · ${CHAT_SHORTCUT}`}
            onClick={() => setAiChat({ open: true })}
            className={cn('absolute right-4 bottom-4 z-40 flex h-8 items-center gap-2 px-3.5 text-[12px] font-medium text-slate-300 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300', PANEL_RADIUS, FLOATING_PANEL)}
          >
            <Sparkles className="size-4 shrink-0" />
            AI Chat
            {/* A request waiting says so in words; a finished answer is a dot. */}
            {chatAwaitingApproval
              ? <span data-chat-awaiting aria-hidden className="shrink-0 rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[10px] leading-none font-semibold text-amber-200">Awaiting approval</span>
              : chatUnread && <span data-chat-unread aria-hidden className="size-2 shrink-0 rounded-full bg-emerald-400" />}
          </button>
        )}
        {/* (Said once, politely, when it appears.) */}
        <span role="status" aria-live="polite" className="sr-only">{mergeStudio || aiChat.open ? '' : chatAwaitingApproval ? 'Approval requested' : chatUnread ? 'New reply in AI Chat' : ''}</span>

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
// `fixed`: the windows that keep a width of their own, in px, rather than a
// share of the row — the side panel and AI Chat ({ [groupId]: { name, id,
// label, width, onWidth, onReset } }).
function SplitNode({ node, dockApi, store, renderNode, floating = false, fixed = null }) {
  const ref = useRef(null)
  const drag = useRef(null)
  // (While a splitter is dragged, widths follow the pointer — no easing.)
  const [resizing, setResizing] = useState(false)
  const row = node.dir === 'row'
  const isMinimized = (child) => child.type === 'leaf' && store.groups[child.id]?.minimized
  const visible = node.children.filter((child) => child.type === 'split' || (store.groups[child.id]?.open && store.groups[child.id]?.panelIds.length))
  // Weights as shares of the row / column (flex-grow values that sum
  // below 1 would leave part of it empty).
  const sizeOf = (child) => node.sizes[node.children.indexOf(child)] ?? 1
  const fixedOf = (child) => (!floating && row && child.type === 'leaf' ? fixed?.[child.id] ?? null : null)
  const foldsAway = (child) => isMinimized(child) && !floating && (Boolean(fixed?.[child.id]) || store.groups[child.id]?.panelIds.includes(panelById.navigator.id))
  // A folded right panel's share goes to the pane beside it (the canvas) —
  // the others keep theirs, so nothing else moves when it folds.
  const absorbed = new Map()
  visible.forEach((child, i) => {
    if (!foldsAway(child) || fixedOf(child)) return
    const beside = visible.slice(0, i).findLast((other) => !isMinimized(other)) ?? visible.slice(i + 1).find((other) => !isMinimized(other))
    if (beside) absorbed.set(beside.id, (absorbed.get(beside.id) ?? 0) + sizeOf(child))
  })
  const total = visible.reduce((sum, child) => sum + (fixedOf(child) || (isMinimized(child) && !foldsAway(child)) ? 0 : sizeOf(child)), 0) || 1

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
    // (A window with a width of its own takes the travel itself, inside its limits; the rest of the row makes room.)
    const before = fixedOf(node.children[a])
    const after = fixedOf(node.children[b])
    if (before) { before.onWidth(measured[a] + delta); return }
    if (after) { after.onWidth(measured[b] - delta); return }
    const total = measured[a] + measured[b]
    const first = Math.min(total - MIN_PANE, Math.max(MIN_PANE, measured[a] + delta))
    const sizes = [...measured]
    sizes[a] = first
    sizes[b] = total - first
    dockApi.setSplitSizes(node.id, sizes)
  }

  // Folded: the right panel keeps its place in the row at no width (so its
  // width eases in and out, 200ms — at once under reduced motion, and never
  // while a splitter is being dragged); anything else folded takes no room.
  const collapses = foldsAway
  const takesRoom = (child) => !isMinimized(child) || collapses(child)
  return (
    <div ref={ref} className={floating ? 'contents' : cn('flex size-full min-h-0 min-w-0', row ? 'flex-row' : 'flex-col')}>
      {visible.map((child, i) => {
        const index = node.children.indexOf(child)
        const prev = visible.slice(0, i).findLast(takesRoom)
        const resizable = prev && !isMinimized(prev) && !isMinimized(child)
        const folded = collapses(child)
        const own = fixedOf(child)
        const sized = own ?? (prev && fixedOf(prev))
        return (
          <div key={child.id} className="contents">
            {prev && !floating && takesRoom(child) &&
              (resizable ? (
                <SplitHandle
                  label={sized?.label ?? 'Resize panes'}
                  onReset={sized?.onReset}
                  orientation={row ? 'vertical' : 'horizontal'}
                  className={row ? 'w-2' : 'h-2'}
                  onResizeStart={() => { setResizing(true); startResize(node.children.indexOf(prev), index) }}
                  onResize={resize}
                  onResizeEnd={() => { drag.current = null; setResizing(false) }}
                  onStep={(delta) => {
                    startResize(node.children.indexOf(prev), index)
                    resize(delta)
                    drag.current = null
                  }}
                />
              ) : (
                // (The gap goes with a folded panel.)
                <span className={cn('shrink-0 transition-[width,height] duration-200 ease-out motion-reduce:transition-none', folded || collapses(prev) ? 'size-0' : row ? 'w-2' : 'h-2')} />
              ))}
            {isMinimized(child) && !folded ? (
              renderNode(child, node.dir)
            ) : (
              <div
                data-split-child={index}
                data-folded={folded ? '' : undefined}
                data-side-leaf={own?.name}
                id={own?.id}
                inert={folded || undefined}
                aria-hidden={folded || undefined}
                className={floating ? "contents" : cn("flex min-h-0 min-w-0", !resizing && "transition-[flex-grow,flex-basis,min-width,opacity] duration-200 ease-out motion-reduce:transition-none", (folded || own) && "overflow-hidden", folded && "opacity-0", own && index > 0 && "justify-end")}
                style={floating ? undefined : own
                  ? { flex: `0 0 ${folded ? 0 : own.width}px`, minWidth: 0, minHeight: 0 }
                  : folded
                  ? { flex: '0 1 0px', minWidth: 0, minHeight: 0 }
                  : { flex: `${(((node.sizes[index] ?? 1) + (absorbed.get(child.id) ?? 0)) / total) * 100} 1 0px`, [row ? 'minWidth' : 'minHeight']: MIN_PANE }}
              >
                {/* (At its full width whatever the row gives it, so nothing re-wraps while it opens and shuts.) */}
                {own ? <div className="flex h-full min-w-0 shrink-0" style={{ width: own.width }}>{renderNode(child, node.dir)}</div> : renderNode(child, node.dir)}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default WorkspaceSplitLayout
