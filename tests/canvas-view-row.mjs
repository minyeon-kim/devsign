import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Files · Layers · Assets · Inspect: a row in the main window's tab row, after Preview · Screens · Code —
// nothing floating over the canvas — their views opening under them.
const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const views = read('components/workspace/CanvasSideViews.jsx')
const layout = read('components/workspace/WorkspaceSplitLayout.jsx')
assert.ok(views.includes('aria-orientation="horizontal"') && !views.includes('flex-col items-center gap-0.5') && !views.includes('absolute top-14 left-2'), 'a row, not a floating column')
assert.ok(views.includes("const RULE = 'mx-1.5 h-4 w-px shrink-0 bg-white/10'") && views.includes("{ id: 'inspect', label: 'Inspect', icon: ScanEye, rule: true }"), 'a rule after the tabs, and before Inspect')
assert.ok(views.includes('size-7') && views.includes('rounded-[6px]') && views.includes('gap-0.5') && views.includes("'bg-[var(--ds-surface-2)] text-slate-100'"))
assert.ok(views.includes('onClick={() => toggleSideView(id)}'), 'the same action as before')
assert.ok(views.includes("document.querySelector(`[data-canvas-view=\"${open}\"]`)") && views.includes("className={cn('absolute top-1 bottom-2 z-30"), 'its view opens under it')
assert.ok(layout.includes('<WorkspaceViewTabs') && layout.includes('<CanvasViewRail /></>') && !layout.includes('viewRail={'), 'in the tab row, not over the canvas')
console.log('Passed: the workspace views as a row in the tab row, their panels under them.')
