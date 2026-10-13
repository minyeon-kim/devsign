import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

// The Workspace's two side panels: the side panel at the left (Files ·
// Layers · Assets · Inspect, and Terminal / Console from the old bottom
// panel), opened from the activity bar; AI Chat at the right. Both start
// folded, are remembered under versioned keys, and keep their content while
// folded. The Workspace has no bottom panel.
const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const layout = read('components/workspace/WorkspaceSplitLayout.jsx')
const windowSource = read('components/workspace/FloatingWindow.jsx')
const tabs = read('components/workspace/PanelTabs.jsx')
const sidebar = read('components/dashboard/Sidebar.jsx')
const shell = read('components/dashboard/AppShell.jsx')
const dock = read('components/workspace/floatingDockApi.js')
const panels = read('components/dockview/dockPanels.js')
const provider = read('state/WorkspaceProvider.jsx')
const page = read('pages/WorkspacePage.jsx')
const bottom = read('components/workspace/WorkspaceBottomPanel.jsx')
const navigator = read('components/dockview/panels/NavigatorPanel.jsx')
const palette = read('components/layout/CommandPalette.jsx')

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const prefs = await server.ssrLoadModule('/src/lib/panelPrefs.js')
  const { AI_CHAT, MIN_CANVAS, SIDE_PANEL, SIDE_VIEWS, clampWidth, panelToFold, pressSideView, railSplit, readAiChat, readSidePanel, writeAiChat, writeSidePanel } = prefs
  const storage = () => { const map = new Map(); return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, String(v)), map } }

  // A new user: both folded, on Files, at their own widths.
  assert.deepEqual(readSidePanel(storage()), { open: false, tab: 'files', width: 240 })
  assert.deepEqual(readAiChat(storage()), { open: false, width: 380 })
  // The keys carry a version; what the old key said isn't read.
  assert.equal(SIDE_PANEL.key, 'devsign:sidePanel.v2')
  assert.equal(AI_CHAT.key, 'devsign:aiChat.v2')
  const old = storage(); old.setItem('devsign:right-panel:folded', '0')
  assert.equal(readSidePanel(old).open, false, 'the old "open, at the right" isn’t carried over')
  assert.ok(!layout.includes('right-panel:folded') && !provider.includes('right-panel:folded'))
  // What the person chose comes back: open or not, the view, the width.
  const kept = storage()
  writeSidePanel({ open: true, tab: 'layers', width: 320 }, kept); writeAiChat({ open: true, width: 420 }, kept)
  assert.deepEqual(readSidePanel(kept), { open: true, tab: 'layers', width: 320 })
  assert.deepEqual(readAiChat(kept), { open: true, width: 420 })
  // Anything else that's there is read as the default, never thrown on.
  const junk = storage(); junk.setItem(SIDE_PANEL.key, '{"open":"yes","tab":"nope","width":9000}'); junk.setItem(AI_CHAT.key, 'not json')
  assert.deepEqual(readSidePanel(junk), { open: false, tab: 'files', width: 480 })
  assert.deepEqual(readAiChat(junk), { open: false, width: 380 })
  assert.deepEqual(readSidePanel({ getItem() { throw new Error('blocked') } }), { open: false, tab: 'files', width: 240 })

  // Widths: 240–480 (or 40% of the window, whichever is less) for the side panel.
  assert.equal(clampWidth(SIDE_PANEL, 100), 240)
  assert.equal(clampWidth(SIDE_PANEL, 900), 480)
  assert.equal(clampWidth(SIDE_PANEL, 900, 1000), 400, '40% of a 1000px window')
  assert.equal(clampWidth(SIDE_PANEL, 900, 400), 240, 'never under its minimum')
  assert.equal(clampWidth(SIDE_PANEL, undefined), 240)

  // An activity bar icon: opens on its view, swaps the view, or — the one showing — folds.
  assert.deepEqual(SIDE_VIEWS, ['files', 'layers', 'assets', 'inspect', 'terminal', 'console'])
  const folded = { open: false, tab: 'files' }
  assert.deepEqual(pressSideView(folded, 'layers'), { open: true, tab: 'layers' })
  assert.deepEqual(pressSideView({ open: true, tab: 'layers' }, 'terminal'), { open: true, tab: 'terminal' })
  assert.deepEqual(pressSideView({ open: true, tab: 'terminal' }, 'terminal'), { open: false, tab: 'terminal' })
  assert.equal(pressSideView(folded, 'nope'), folded)

  // Both open with less than 480px left for the canvas: the one already open folds.
  assert.equal(MIN_CANVAS, 480)
  const both = { side: { open: true, width: 480 }, chat: { open: true, width: 380 } }
  assert.equal(panelToFold({ room: 1224, ...both, opened: 'chat' }), 'side')
  assert.equal(panelToFold({ room: 1224, ...both, opened: 'side' }), 'chat')
  assert.equal(panelToFold({ room: 1504, ...both, opened: 'chat' }), null, 'room enough: both stay')
  assert.equal(panelToFold({ room: 600, side: { open: true, width: 480 }, chat: { open: false, width: 380 }, opened: 'side' }), null, 'one panel never folds itself')

  // The bar never scrolls: what doesn't fit goes to More, which takes a slot itself.
  const seven = [1, 2, 3, 4, 5, 6, 7]
  assert.deepEqual(railSplit(seven, 7), { shown: seven, more: [] })
  assert.deepEqual(railSplit(seven, 5), { shown: [1, 2, 3, 4], more: [5, 6, 7] })
  assert.deepEqual(railSplit(seven, 0), { shown: [], more: seven })

  // --- The side panel: at the left, on the activity bar ---
  assert.ok(layout.includes('addDockPanel(dockApi, panelById.navigator, { share, atStart: true })'), 'docked at the row’s left end')
  assert.ok(dock.includes('if (atStart) { root.children.unshift(leaf); root.sizes.unshift(size) }'))
  for (const view of ['files', 'layers', 'assets', 'inspect', 'design-compare', 'terminal', 'console']) assert.ok(sidebar.includes(`{ id: '${view}', label:`), `${view} is on the bar`)
  assert.ok(sidebar.indexOf("id: 'inspect'") < sidebar.indexOf("id: 'design-compare'") && sidebar.includes("id: 'design-compare', label: 'Design Compare', icon: Layers3, rule: true"), 'the bottom panel’s views come after a hairline')
  assert.ok(sidebar.includes("aria-expanded={view.side ? showing(view) : undefined}") && sidebar.includes("aria-controls={view.side ? 'workspace-side-panel' : undefined}"))
  assert.ok(sidebar.includes('data-views-more') && sidebar.includes('railSplit(WORKSPACE_VIEWS, slots)') && sidebar.includes('onKeyDown={railArrowKeys}'))
  assert.ok(sidebar.includes('data-view-badge'), 'Design Compare’s count sits on its icon')
  assert.ok(shell.includes("workspace.activeView === 'workspace'") && shell.includes("const LAYER_PARAMS = ['change', 'doc', 'docs', 'history']"), 'only while the Workspace itself is showing')
  // Its views: the navigator's four as tabs (← / → between them); Terminal and Console in the same panel.
  assert.ok(windowSource.includes("role={isNavigatorGroup ? 'tablist' : undefined}") && tabs.includes("role={panel.component === 'navigator' ? 'tab' : undefined}") && navigator.includes('role="tabpanel"'))
  assert.ok(navigator.includes("filesWindow.tab === 'terminal' && <TerminalPanel />") && navigator.includes("filesWindow.tab === 'console' && <ConsolePanel />"))
  assert.ok(layout.includes('if (!SIDE_TABS.includes(filesTab.current)) return'), 'focus moving to an editor doesn’t take Terminal away')

  // --- Folded: mounted at no width, out of the focus order; eased, not under reduced motion, not while dragged ---
  assert.ok(layout.includes('? { flex: `0 0 ${folded ? 0 : own.width}px`, minWidth: 0, minHeight: 0 }'))
  assert.ok(layout.includes('inert={folded || undefined}') && layout.includes('aria-hidden={folded || undefined}'))
  assert.match(layout, /!resizing && "transition-\[flex-grow,flex-basis,min-width,opacity\] duration-200 ease-out motion-reduce:transition-none"/)
  assert.ok(layout.includes("folded || collapses(prev) ? 'size-0'"), 'the gap goes with it')
  // Read before the first paint, and put on the windows before it.
  assert.ok(provider.includes('useState(() => { const { open, width } = readSidePanel(); return { open, width } })') && provider.includes('useState(readAiChat)'))
  assert.match(layout, /useLayoutEffect\(\(\) => \{\n    if \(mergeStudio\) \{ applied\.current = \{\}; return \}/)
  // Opened by the person only: folded on purpose, raising one of its tabs leaves it folded.
  assert.ok(layout.includes('dockApi.minimizeGroup(sideGroup.id, !sidePanel.open, { byUser: true })'))
  assert.ok(dock.includes('if (!g.userFolded) g.minimized = false') && dock.includes('g.userFolded = minimized && byUser'))
  // Resized from its right edge, inside its limits; a double click goes back to its own width.
  assert.ok(layout.includes('if (before) { before.onWidth(measured[a] + delta); return }') && layout.includes('if (after) { after.onWidth(measured[b] - delta); return }'))
  assert.ok(layout.includes('onReset: () => setSidePanel({ width: SIDE_PANEL.width })') && read('components/layout/SplitHandle.jsx').includes('onDoubleClick={onReset}'))
  // Shortcuts: ⌘/Ctrl+B or \ — not while typing; ⌘/Ctrl+L for AI Chat.
  assert.ok(layout.includes("if (key === 'b' || key === '\\\\') {") && layout.includes('if (!sideGroup || isTyping(event.target)) return') && layout.includes("} else if (key === 'l') {"))
  // Its fold button says what it does and what it folds.
  assert.ok(layout.includes("{ label: 'Collapse panel', hint: SIDE_SHORTCUT, controls: SIDE_ID") && windowSource.includes('aria-controls={sideToggle.controls}') && sidebar.includes('aria-expanded={expanded}'))

  // --- AI Chat: its own window at the right, folded by default, kept while folded ---
  assert.ok(panels.includes("position: { direction: 'right', referencePanel: panelById.canvas.id },\n    share: 0.3,"))
  assert.ok(layout.includes('data-chat-toggle') && layout.includes('aria-controls={CHAT_ID}') && layout.includes('data-chat-unread'))
  assert.ok(provider.includes("if (wasAiTyping.current && !isAiTyping && !aiChat.open && activeViewNow.current !== 'mergeStudio') setChatUnread(true)") && provider.includes('if (aiChat.open && chatUnread) setChatUnread(false)'))
  assert.ok(layout.includes("leaf('chat')?.querySelector('textarea, [contenteditable=\"true\"], input[type=\"text\"]')?.focus()"), 'opened: the message box takes the focus')
  assert.ok(tabs.includes("['assets', 'layers', 'explorer', 'chat'].includes(panel.component) ? null : closeView"), 'it folds; it isn’t closed')

  // --- No bottom panel in the Workspace: what opened it opens that view where it lives now ---
  assert.ok(!/<WorkspaceBottomPanel[ \/>]/.test(page) && !page.includes("from '@/components/workspace/WorkspaceBottomPanel'"), 'not mounted by the Workspace')
  assert.ok(!/DEFAULT_TABS|TerminalPanel|ConsolePanel/.test(bottom), 'Merge Studio’s only: no Workspace tabs left in it')
  assert.ok(provider.includes("if (patch.open === true && activeViewNow.current !== 'mergeStudio') {") && provider.includes('patch = { ...patch, open: false }'))
  assert.ok(provider.includes("if (tab === 'terminal' || tab === 'console') openSideView(tab)") && provider.includes("else if (tab === 'design-compare') openOrFocusPanel(dockApi, panelById.designCompare)") && provider.includes('else requestConflictDrawer()'))
  assert.ok(palette.includes('run: () => openSideView(tab),') && palette.includes("id: 'toggle-side'") && palette.includes("id: 'toggle-chat'") && !palette.includes('toggle-bottom'))
  console.log('Passed: the side panel at the left on the activity bar and AI Chat at the right — folded by default, remembered (v2 keys), kept while folded — and no bottom panel in the Workspace.')
} finally { await server.close() }
