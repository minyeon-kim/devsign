import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// The rail at the work area's right edge: the left navigation's icon buttons —
// an icon and a tooltip, never a label that could wrap or stand on end.
const layout = readFileSync(new URL('../src/components/workspace/WorkspaceSplitLayout.jsx', import.meta.url), 'utf8')
const sidebar = readFileSync(new URL('../src/components/dashboard/Sidebar.jsx', import.meta.url), 'utf8')

// One button for both rails, one width.
assert.match(sidebar, /export function RailButton\(/)
assert.match(sidebar, /export const RAIL_WIDTH = 'w-\[var\(--ds-chrome-size\)\]'/)
assert.match(layout, /import \{ RAIL_ACTIVE, RAIL_WIDTH, RailButton \} from '@\/components\/dashboard\/Sidebar'/)
const rail = layout.slice(layout.indexOf('function PanelRail('), layout.indexOf("// Merge Studio's own minimized state"))
assert.ok(rail.includes('<RailButton') && rail.includes('RAIL_WIDTH') && rail.includes('whitespace-nowrap'))
// No text of its own, and nothing written vertically anywhere in the layout.
assert.ok(!/writing-mode/.test(layout), 'no vertical writing: that stood "파일" on end, a character a line')
assert.ok(!/panel\?\.title\}<\/span>/.test(rail), 'the name is the tooltip’s and the label’s, not text in the rail')
// It says whether its window is open, is lit when it is, and toggles it.
assert.match(rail, /aria-expanded=\{open\}/)
assert.match(rail, /open && RAIL_ACTIVE/)
assert.match(rail, /onClick=\{\(\) => dockApi\.minimizeGroup\(group\.id, open\)\}/)
// The navigator keeps its rail beside it while open; folded, the rail is all that's left.
assert.match(layout, /const railed = !mergeStudio && parentDir === 'row' && group\.panelIds\.includes\(panelById\.navigator\.id\)/)
assert.match(layout, /return <PanelRail group=\{group\} panelsById=\{store\.panels\} dockApi=\{dockApi\} dir=\{parentDir\} \/>/)
console.log('Passed: the right rail uses the left navigation’s icon button — icon and tooltip, lit while open, no label to wrap.')
