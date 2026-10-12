import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// The right panel (Files · Layers · Assets · Properties) folds from a button
// at the end of the canvas's tab row. There is no rail at the right edge.
const layout = readFileSync(new URL('../src/components/workspace/WorkspaceSplitLayout.jsx', import.meta.url), 'utf8')
const windowSource = readFileSync(new URL('../src/components/workspace/FloatingWindow.jsx', import.meta.url), 'utf8')
const sidebar = readFileSync(new URL('../src/components/dashboard/Sidebar.jsx', import.meta.url), 'utf8')
const dock = readFileSync(new URL('../src/components/workspace/floatingDockApi.js', import.meta.url), 'utf8')

// The rail is gone from the layout altogether — its component, its column, its strip.
assert.ok(!/PanelRail|MinimizedStrip|data-panel-rail|RailButton|RAIL_WIDTH/.test(layout), 'no rail component or rail column in the layout')
assert.ok(!/writing-mode/.test(layout))
assert.match(layout, /const NAVIGATOR_W = 240\n/, 'the panel is back to its own width')
// A folded right panel leaves nothing in its place: it stays mounted at no width, its gap gone with it.
assert.ok(layout.includes("? { flex: '0 1 0px', minWidth: 0, minHeight: 0 }") && layout.includes("folded ? 'size-0'"))
assert.ok(layout.includes('inert={folded || undefined}'))
// Its width goes to the pane beside it alone, so the canvas widens and nothing else moves.
assert.ok(layout.includes('absorbed.set(beside.id'))
// Eased, not while a splitter is dragged, not under reduced motion.
assert.match(layout, /!resizing && "transition-\[flex-grow,min-width,opacity\] duration-200 ease-out motion-reduce:transition-none"/)

// The toggle: the left list's own button, mirrored, at the end of the canvas's tab row.
assert.match(sidebar, /export function PanelToggleButton\(/)
assert.match(sidebar, /return <PanelToggleButton label="Close drawer" tip="Close" onClick=\{onClose\} \/>/, 'the left list’s Close is the same button')
assert.ok(windowSource.includes('<PanelToggleButton') && windowSource.includes('mirrored') && windowSource.includes("className=\"ds-intrinsic ml-auto\""))
assert.ok(windowSource.includes("label={sideToggle.open ? '오른쪽 패널 접기' : '오른쪽 패널 펼치기'}") && windowSource.includes('expanded={sideToggle.open}') && windowSource.includes('hint={sideToggle.hint}'))
assert.match(layout, /sideToggle=\{!mergeStudio && sideGroup && group\.panelIds\.includes\(panelById\.canvas\.id\)/, 'only the canvas’s window carries it')
// ⌘/Ctrl+B, and nothing else on that key.
assert.match(layout, /!\(event\.metaKey \|\| event\.ctrlKey\) \|\| event\.altKey \|\| event\.shiftKey \|\| event\.key\.toLowerCase\(\) !== 'b'/)
// Remembered, safely.
assert.ok(layout.includes("try { return localStorage.getItem(SIDE_FOLD_KEY) === '1' } catch { return false }") && layout.includes('writeSideFolded(fold)'))
// Folded on purpose, it isn't opened by anything but the person: raising one of its tabs leaves it folded.
assert.ok(dock.includes('if (!g.userFolded) g.minimized = false') && dock.includes('g.userFolded = minimized && byUser'))
assert.ok(layout.includes('dockApi.minimizeGroup(sideGroup.id, fold, { byUser: true })'))
console.log('Passed: no right rail; the canvas’s tab row folds the right panel — remembered, eased, and never opened behind the user’s back.')
