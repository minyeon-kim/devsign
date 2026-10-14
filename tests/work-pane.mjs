import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

// The work pane: what the activity bar opens beside the Workspace, half and
// half — the changes to check and Design Compare — while the list menus stay
// narrow drawers. One thing at a time at the left; the address says which.
const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { PANELS, SPLIT, SPLIT_PANELS, isSplit, paneWidth, ratioOf, readSplit, writeSplit, readPanel, withPanel, defaultRatio, ratioFor } = await server.ssrLoadModule('/src/lib/workPane.js')

  // Which menu opens how is said in one place.
  assert.deepEqual(SPLIT_PANELS, ['conflicts'])
  assert.deepEqual(Object.entries(PANELS).filter(([, panel]) => panel.kind === 'list').map(([id]) => id), ['docs', 'compare', 'history', 'import'], 'Design Compare is a list drawer, like Docs: its pick opens in the work area')
  assert.ok(isSplit('conflicts') && !isSplit('compare') && !isSplit('docs') && !isSplit('nope'))

  // Half and half, inside the limits: the pane ≥ 360, the Workspace ≥ 480.
  assert.deepEqual(paneWidth(1512), { width: 756, full: false })
  assert.equal(paneWidth(1512, 0.9).width, 1512 - SPLIT.minWorkspace)
  assert.equal(paneWidth(1512, 0.05).width, SPLIT.minPane)
  // AI Chat open: what's left is what's halved.
  assert.equal(paneWidth(1512 - 388).width, 562)
  // No room to split (under 960), or maximized: the pane has it all.
  assert.deepEqual(paneWidth(900), { width: 900, full: true })
  assert.deepEqual(paneWidth(1512, 0.5, { maximized: true }), { width: 1512, full: true })
  assert.deepEqual(paneWidth(0), { width: 0, full: false })
  // A dragged width is kept as a share, inside the same limits.
  assert.equal(ratioOf(1512, 556), 556 / 1512)
  assert.equal(ratioOf(1512, 5000), (1512 - 480) / 1512)
  // The share and what was last open at the left are kept; anything else there is read as the default.
  const map = new Map(); const storage = { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) }
  assert.deepEqual(readSplit(storage), { ratio: 0.5, ratios: {}, last: null })
  writeSplit({ ratio: 0.37, ratios: { conflicts: 0.3, docs: 0.6 }, last: 'conflicts' }, storage)
  assert.deepEqual(readSplit(storage), { ratio: 0.37, ratios: { conflicts: 0.3 }, last: 'conflicts' })
  map.set(SPLIT.key, '{"ratio":7,"ratios":{"compare":2},"last":"docs"}')
  assert.deepEqual(readSplit(storage), { ratio: 0.5, ratios: {}, last: null })
  assert.deepEqual(readSplit({ getItem() { throw new Error('blocked') } }), { ratio: 0.5, ratios: {}, last: null })
  // Each pane its own share: the changes a third (the canvas keeps the rest) — until dragged.
  assert.equal(defaultRatio('conflicts'), 0.34)
  assert.equal(ratioFor('conflicts', {}), 0.34)
  assert.equal(ratioFor('conflicts', { conflicts: 0.42 }), 0.42)
  assert.ok(paneWidth(1392, defaultRatio('conflicts')).width < 1392 / 2.5, 'the canvas keeps most of the room')

  // The address.
  assert.equal(readPanel('?view=screens&panel=compare'), null, 'Design Compare is a drawer, not in the address')
  assert.equal(readPanel('?panel=docs'), null, 'a list drawer isn’t in the address')
  assert.equal(withPanel('?view=screens&screen=cart', 'conflicts'), '?view=screens&screen=cart&panel=conflicts', 'the view and the screen are left as they are')
  assert.equal(withPanel('?view=screens&panel=conflicts', null), '?view=screens')
  assert.equal(withPanel('?panel=conflicts', 'compare'), '')

  // --- In the app ---
  const provider = read('state/WorkspaceProvider.jsx')
  const shell = read('components/dashboard/AppShell.jsx')
  const sidebar = read('components/dashboard/Sidebar.jsx')
  const overlay = read('components/conflicts/ConflictReviewOverlay.jsx')
  const topBar = read('components/layout/TopBar.jsx')
  const layout = read('components/workspace/WorkspaceSplitLayout.jsx')
  const board = read('components/screens/ScreensBoard.jsx')
  // The pane is the address's; opening it replaces the address and folds the side panel — and the side panel opening closes it.
  assert.ok(provider.includes('const workPane = readPanel(location.search)') && provider.includes('{ replace: true, state: at.state }'))
  assert.ok(provider.includes('setSidePanelState((prev) => (prev.open ? { ...prev, open: false } : prev))') && provider.includes('if (readPanel(route.current.location.search)) setWorkPane(null)'))
  // Icons are switches: the same one again closes; another split panel swaps what's shown in the open pane.
  assert.ok(shell.includes('workspace?.setWorkPane(shown === panel ? null : panel)') && shell.includes('const shown = drawer ?? workPane'))
  assert.ok(sidebar.includes("view.side ? toggleSideView(view.id) : onToggleDrawer('compare')") && sidebar.includes('aria-expanded={showing(view)}'))
  // The top bar's switch is the app sidebar's (AppShell's drawer, registered in the provider), and brings back what was last open — not the Files / Layers panel.
  assert.ok(topBar.includes('const { leftOpen: open, toggleLeft } = useWorkspace()') && provider.includes('const leftOpen = appSidebar.open') && shell.includes('setAppSidebar?.({ open: sidebarOpen') && shell.includes('toggleDrawer(lastShown.current)'))
  // The pane: a named region, as wide as its share; its edge a separator that says where it stands, resets on a double press.
  assert.ok(sidebar.includes("role={split ? 'region' : undefined}") && sidebar.includes('const pane = paneWidth(room, ratio, { maximized })'))
  assert.ok(sidebar.includes('value={Math.round((pane.width / Math.max(1, room)) * 100)}') && sidebar.includes('onReset={() => setShare(defaultRatio(panel), true)}') && read('components/layout/SplitHandle.jsx').includes('aria-valuenow={value}'))
  assert.ok(sidebar.includes('data-pane-maximize') && sidebar.includes('data-pane-workspace') && sidebar.includes('if (!frame) frame = requestAnimationFrame('), 'maximize, the way back when it has the window, one resize a frame')
  assert.ok(sidebar.includes('<ComparePanel project={project}') && sidebar.includes('data-work-pane-layer'))
  // A change's detail is shown in the pane, the Workspace still in use beside it.
  assert.ok(overlay.includes("const inPane = !inMergeStudio && workPane === 'conflicts' && workPaneHost") && overlay.includes('return inPane ? createPortal(layer, workPaneHost) : layer'))
  assert.ok(shell.includes("const LAYER_PARAMS = ['doc', 'docs', 'history']"))
  assert.ok(provider.includes("if (activeViewNow.current !== 'mergeStudio') dockApi?.getPanel('canvas')?.api.setActive()"), 'its element is brought up on the canvas')
  // Design Compare is no longer a mode of the main window.
  assert.ok(!/compareMode|setCompareMode|panelById\.designCompare/.test(layout + provider) && !read('data/mockData.js').includes("id: 'designCompare'"))
  // What's compared is the set picked in the drawer's list (compareItemId) — shown in the work area, where the canvas is.
  assert.ok(read('components/workspace/WorkspaceDesignCompare.jsx').includes('const item = items.find(candidate => candidate.id === compareItemId) ?? null'), 'the set picked in the list')
  // The change list can be narrowed to the screen in view (the board's count zooms in on the screen instead — its markers are there).
  assert.ok(read('components/dashboard/ConflictsDrawer.jsx').includes('data-screen-only') && board.includes('zoomToCard(card, docked ? 0 : BOARD_PANEL_WIDTH + 64)'))
  // The board keeps its place as its room changes (a panel opening beside it) — only the window itself refits a board that is still fitted.
  assert.ok(board.includes('if (byPanel || !fitted.current) {') && board.includes('resizeShift({'))
  console.log('Passed: the work pane — which menus split, its width and limits, its address, one thing at a time at the left, and the change detail inside it.')
} finally { await server.close() }
