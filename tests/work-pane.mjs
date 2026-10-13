import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

// The work pane: what the activity bar opens beside the Workspace, half and
// half — the changes to check and Design Compare — while the list menus stay
// narrow drawers. One thing at a time at the left; the address says which.
const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { PANELS, SPLIT, SPLIT_PANELS, isSplit, paneWidth, ratioOf, readSplit, writeSplit, readPanel, withPanel } = await server.ssrLoadModule('/src/lib/workPane.js')

  // Which menu opens how is said in one place.
  assert.deepEqual(SPLIT_PANELS, ['conflicts', 'compare'])
  assert.deepEqual(Object.entries(PANELS).filter(([, panel]) => panel.kind === 'list').map(([id]) => id), ['docs', 'history', 'import'])
  assert.ok(isSplit('compare') && !isSplit('docs') && !isSplit('nope'))

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
  assert.deepEqual(readSplit(storage), { ratio: 0.5, last: null })
  writeSplit({ ratio: 0.37, last: 'compare' }, storage)
  assert.deepEqual(readSplit(storage), { ratio: 0.37, last: 'compare' })
  map.set(SPLIT.key, '{"ratio":7,"last":"docs"}')
  assert.deepEqual(readSplit(storage), { ratio: 0.5, last: null })
  assert.deepEqual(readSplit({ getItem() { throw new Error('blocked') } }), { ratio: 0.5, last: null })

  // The address.
  assert.equal(readPanel('?view=screens&panel=compare'), 'compare')
  assert.equal(readPanel('?panel=docs'), null, 'a list drawer isn’t in the address')
  assert.equal(withPanel('?view=screens&screen=cart', 'conflicts'), '?view=screens&screen=cart&panel=conflicts', 'the view and the screen are left as they are')
  assert.equal(withPanel('?view=screens&panel=conflicts', null), '?view=screens')
  assert.equal(withPanel('?panel=conflicts', 'compare'), '?panel=compare')

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
  // The top bar's switch is the whole left area's, and brings back what was last open.
  assert.ok(topBar.includes('const { leftOpen: open, toggleLeft } = useWorkspace()') && provider.includes('const leftOpen = sidePanel.open || Boolean(workPane)') && provider.includes('if (isSplit(last)) setWorkPane(last)'))
  // The pane: a named region, as wide as its share; its edge a separator that says where it stands, resets on a double press.
  assert.ok(sidebar.includes("role={split ? 'region' : undefined}") && sidebar.includes('const pane = paneWidth(room, ratio, { maximized })'))
  assert.ok(sidebar.includes('value={Math.round((pane.width / Math.max(1, room)) * 100)}') && sidebar.includes('onReset={() => setShare(SPLIT.ratio, true)}') && read('components/layout/SplitHandle.jsx').includes('aria-valuenow={value}'))
  assert.ok(sidebar.includes('data-pane-maximize') && sidebar.includes('data-pane-workspace') && sidebar.includes('if (!frame) frame = requestAnimationFrame('), 'maximize, the way back when it has the window, one resize a frame')
  assert.ok(sidebar.includes("{panel === 'compare' && project && context && <WorkspaceDesignCompare />}") && sidebar.includes('data-work-pane-layer'))
  // A change's detail is shown in the pane, the Workspace still in use beside it.
  assert.ok(overlay.includes("const inPane = !inMergeStudio && workPane === 'conflicts' && workPaneHost") && overlay.includes('return inPane ? createPortal(layer, workPaneHost) : layer'))
  assert.ok(shell.includes("const LAYER_PARAMS = ['doc', 'docs', 'history']"))
  assert.ok(provider.includes("if (activeViewNow.current !== 'mergeStudio') dockApi?.getPanel('canvas')?.api.setActive()"), 'its element is brought up on the canvas')
  // Design Compare is no longer a mode of the main window.
  assert.ok(!/compareMode|setCompareMode|panelById\.designCompare/.test(layout + provider) && !read('data/mockData.js').includes("id: 'designCompare'"))
  assert.ok(read('components/workspace/WorkspaceDesignCompare.jsx').includes('const ofScreen = items.filter(item => item.designPageId === activePageId)'), 'what’s compared follows the screen in view')
  // The change list can be narrowed to the screen in view; the board's pin turns that on.
  assert.ok(read('components/dashboard/ConflictsDrawer.jsx').includes('data-screen-only') && board.includes('setChangesOfScreenOnly(true); requestConflictDrawer()'))
  // The board keeps its centre as its room changes — fitted while it's never been moved.
  assert.ok(board.includes('if (last && !fitted.current && (last.width !== next.width || last.height !== next.height)) {'))
  console.log('Passed: the work pane — which menus split, its width and limits, its address, one thing at a time at the left, and the change detail inside it.')
} finally { await server.close() }
