import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

// One way for every panel to open: in the same flex row, taking its own width (never floating over the work).
//   app sidebar (Docs, Design Compare's list …) → pushes the whole work area;
//   tool panel (Files · Layers · Assets · Inspect) → pushes the canvas only; 200ms ease-out; 200–400px, kept;
//   Design Compare's pick opens in the canvas's place, beside the tool panel; the board's change list at the right.
// The canvas (or comparison) keeps 480px: the tool panel folds first, then the right panel; the camera keeps
// its scale and moves only as far as it takes.
const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const map = new Map(); const storage = { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, String(v)) }
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
try {
  const { MIN_CANVAS, TOOL_PANEL, clampToolPanelWidth, foldForRoom, readToolPanelWidth, writeToolPanelWidth } = await server.ssrLoadModule('/src/lib/panelPrefs.js')
  const { resizeShift } = await server.ssrLoadModule('/src/lib/canvasCamera.js')
  const { PANELS, isSplit } = await server.ssrLoadModule('/src/lib/workPane.js')

  // The tool panel: 260 to start, 200–400, remembered.
  assert.deepEqual([TOOL_PANEL.width, TOOL_PANEL.min, TOOL_PANEL.max], [260, 200, 400])
  assert.equal(readToolPanelWidth(storage), 260)
  assert.equal(clampToolPanelWidth(120), 200); assert.equal(clampToolPanelWidth(900), 400); assert.equal(clampToolPanelWidth(NaN), 260)
  writeToolPanelWidth(333, storage)
  assert.equal(readToolPanelWidth(storage), 333)
  assert.equal(readToolPanelWidth({ getItem() { throw new Error('blocked') } }), 260)

  // 480 for the canvas: the tool panel first, then the right panel, then AI Chat — the app sidebar is never asked.
  assert.equal(MIN_CANVAS, 480)
  const tool = { open: true, width: 260 }
  assert.equal(foldForRoom({ room: 740, tool }), null, '740 - 260 = 480: enough')
  assert.equal(foldForRoom({ room: 739, tool }), 'tool')
  assert.equal(foldForRoom({ room: 900, tool, right: { open: true, width: 380 } }), 'tool', 'both open: the tool panel goes first')
  assert.equal(foldForRoom({ room: 800, tool: { open: false, width: 260 }, right: { open: true, width: 380 } }), 'right')
  assert.equal(foldForRoom({ room: 470, tool: { open: false, width: 260 }, chat: true }), 'chat')
  assert.equal(foldForRoom({ room: 1200, tool, right: { open: true, width: 380 }, chat: true }), null)

  // The camera: the scale never changes; picked and in view → moved only as far as it takes; else the centre stays.
  assert.equal(resizeShift({ before: 1200, after: 940 }), -130, 'the centre stays: half of what was lost')
  assert.equal(resizeShift({ before: 940, after: 1200 }), 130)
  assert.equal(resizeShift({ box: { left: 100, right: 400 }, before: 1200, after: 940 }), 0, 'still whole: not moved')
  assert.equal(resizeShift({ box: { left: 700, right: 1100 }, before: 1200, after: 940 }), 940 - 16 - 1100, 'cut off at the right: just back inside')
  assert.equal(resizeShift({ box: { left: -50, right: 300 }, before: 1200, after: 940 }), 16 + 50, 'cut off at the left')
  assert.equal(resizeShift({ box: { left: 1300, right: 1500 }, before: 1200, after: 940 }), -130, 'it was out of view: the centre rule')

  // Design Compare is a list drawer, like Docs; the work pane is for the changes alone.
  assert.equal(PANELS.compare.kind, 'list'); assert.ok(!isSplit('compare') && isSplit('conflicts'))

  // --- In the app ---
  const views = read('components/workspace/CanvasSideViews.jsx')
  const floating = read('components/workspace/FloatingWindow.jsx')
  const layout = read('components/workspace/WorkspaceSplitLayout.jsx')
  const sidebar = read('components/dashboard/Sidebar.jsx')
  const shell = read('components/dashboard/AppShell.jsx')
  const drawer = read('components/dashboard/CompareDrawer.jsx')
  const compare = read('components/workspace/WorkspaceDesignCompare.jsx')
  // Docked: a flex child in the window's row, 200ms ease-out, no card (no radius, shadow or margin), a hairline at its right edge.
  assert.ok(floating.includes('{viewDock}') && floating.includes('{viewDockEnd}') && floating.indexOf('{viewDock}') < floating.indexOf('role={viewPanel'), 'in the same row, before the content')
  assert.ok(views.includes("DOCK_MOTION = 'duration-200 ease-out motion-reduce:transition-none'") && views.includes('border-r border-white/[0.06]') && views.includes('transition-[width]'))
  const tooldock = views.slice(views.indexOf('export function CanvasViewPanel'), views.indexOf('export function CompareWorkView'))
  assert.ok(!/absolute inset-y|rounded-xl|shadow-2xl|\bfixed\b/.test(tooldock.replace('absolute inset-y-0 right-0 z-10', '')), 'no floating card')
  assert.ok(tooldock.includes('foldForRoom(') && tooldock.includes('setToolPanelWidth(') && tooldock.includes("label=\"Resize tool panel\""))
  // No floating Design Compare any more: a drawer (the list) + a view where the canvas is.
  assert.ok(!views.includes('CanvasComparePanel') && !layout.includes('CanvasComparePanel') && !shell.includes('setCompareOpen') && !sidebar.includes('compareOpen'))
  assert.ok(layout.includes('<CompareWorkView />') && layout.includes('viewCovered={') && layout.includes('disabled={compareItemId != null}'), 'the comparison stands in the canvas’s place; the three tabs wait')
  assert.ok(sidebar.includes('<CompareDrawer project={project} />') && sidebar.includes("const comparing = drawer === 'compare'"))
  assert.ok(shell.includes("setDrawer('compare')") && shell.includes('setCompareItemId(null)'), 'with the list put away, the canvas is back')
  // The list is made of the change list's own parts (one row component), grouped by screen, searchable.
  assert.ok(drawer.includes("from '@/components/dashboard/DrawerList'") && drawer.includes('<DrawerRow') && drawer.includes('<DrawerSearch') && drawer.includes('aria-expanded={open_}'))
  // The comparison: "← canvas" (focusing the change), the sets not repeated as a column; the pick kept in step with the change lists, both ways.
  assert.ok(compare.includes('hideSets') && compare.includes('closeCompareView({ focus: true })') && compare.includes('boardConflicts') && compare.includes('conflictPin'))
  assert.ok(read('components/mergestudio/DesignComparison.jsx').includes('data-compare-back') && read('components/mergestudio/DesignComparison.jsx').includes('{!hideSets && ('))
  assert.ok(read('components/conflicts/ConflictReviewOverlay.jsx').includes('data-review-open-compare') && read('components/screens/BoardConflicts.jsx').includes('data-board-conflicts-compare'), 'the change’s detail opens the comparison')
  // The right panel (the board’s change list) docks in the row too.
  assert.ok(read('components/screens/BoardConflicts.jsx').includes('createPortal(panel, host)') && views.includes('export function BoardDockSlot'))
  // Reduced motion: no transition (the tool panel, the sidebar, the right panel).
  assert.ok(views.includes('motion-reduce:transition-none') && sidebar.includes('motion-reduce:transition-none'))
  console.log('Passed: panels dock in one row — the tool panel, the comparison, the right list — with the camera and the 480px rule.')
} finally { await server.close() }
