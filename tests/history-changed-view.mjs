import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'

// History's preview, "Changed element | Whole screen": the changed-element
// view is the box around what changed — on a prototype frame its layers, on
// a render of the code its parts — and a comparison cuts both sides to the
// same box.
const store = new Map()
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) }
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { CHANGED_PAD, CHANGED_MAX_SCALE, changedRegionAt, changedScale, padBox, partRegionsAt, unionBox, viewOf } = await server.ssrLoadModule('/src/lib/changedView.js')
  const { layoutAt } = await server.ssrLoadModule('/src/lib/codeRender.js')
  const { focusBox } = await server.ssrLoadModule('/src/lib/devicePreview.js')
  const { canvasPages } = await server.ssrLoadModule('/src/data/mockData.js')

  // The tab in view: "changed" unless the whole screen was picked — and the whole screen when nothing changed.
  assert.equal(viewOf(null, true), 'changed', 'the changed element by default')
  assert.equal(viewOf('changed', true), 'changed')
  assert.equal(viewOf('full', true), 'full')
  assert.equal(viewOf('changed', false), 'full', 'nothing changed: the whole screen')

  // A prototype frame: the box around the changed layers, enlarged up to 3× (× zoom).
  const frame = canvasPages.find((page) => page.id === 'page-1').frames[0]
  const bar = frame.layers.find((l) => l.id === 'tab-bar')
  const box = focusBox(frame, ['tab-bar'])
  assert.ok(box.x <= bar.x && box.y <= bar.y && box.x + box.width >= bar.x + bar.width && box.y + box.height >= bar.y + bar.height, 'the box holds the layer')
  assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= frame.width && box.y + box.height <= frame.height, '…within the frame')
  assert.equal(focusBox(frame, []), null, 'no changed layer, no box')
  assert.equal(changedScale({ width: 2000, height: 2000 }, { width: 100, height: 50 }), CHANGED_MAX_SCALE, 'at most 3×')
  assert.equal(changedScale({ width: 2000, height: 2000 }, { width: 100, height: 50 }, 150), CHANGED_MAX_SCALE * 1.5, '…times the zoom')
  assert.equal(changedScale({ width: 400, height: 2000 }, { width: 800, height: 100 }), 0.5, 'a wide box is fitted to the room')

  // A render of the code: its parts, their union, 16px around, kept on the screen.
  assert.deepEqual(unionBox([{ x: 10, y: 10, width: 20, height: 20 }, { x: 40, y: 0, width: 10, height: 50 }]), { x: 10, y: 0, width: 40, height: 50 })
  assert.equal(unionBox([]), null)
  assert.deepEqual(padBox({ x: 4, y: 100, width: 50, height: 50 }, { width: 60, height: 400 }), { x: 0, y: 100 - CHANGED_PAD, width: 60, height: 50 + CHANGED_PAD * 2 }, 'the padding stops at the screen’s edges')
  const screen = { width: 768, height: 1024 }
  const fluid = { base: 'repeat(4, minmax(0, 1fr))', tablet: 'repeat(2, minmax(0, 1fr))' }
  const fixed = { base: 'repeat(4, minmax(0, 1fr))', tablet: 'repeat(2, 360px)' }
  const single = { base: 'repeat(4, minmax(0, 1fr))', tablet: 'repeat(1, minmax(0, 1fr))' }
  const parts = partRegionsAt(fluid, screen)
  assert.deepEqual(parts.grid, layoutAt(fluid, screen).grid, 'the grid is where the layout puts it')
  assert.deepEqual(parts.cards, parts.grid)
  assert.ok(parts.title.y < parts.subtitle.y && parts.subtitle.y < parts.grid.y && parts.grid.y + parts.grid.height < parts.cta.y, 'title, subtitle, grid, button — top to bottom')
  assert.equal(changedRegionAt([fluid], screen), null, 'nothing changed, no region')
  assert.equal(changedRegionAt([null], screen, { grid: true }), null)
  const grid = changedRegionAt([fluid], screen, { grid: true })
  assert.deepEqual(grid, { x: parts.grid.x - CHANGED_PAD, y: parts.grid.y - CHANGED_PAD, width: parts.grid.width + CHANGED_PAD * 2, height: parts.grid.height + CHANGED_PAD * 2 })
  const both = changedRegionAt([fluid], screen, { parts: ['title', 'cta'] })
  assert.ok(both.y <= parts.title.y && both.y + both.height >= parts.cta.y + parts.cta.height, 'several parts: the box around all of them')
  assert.ok(both.x >= 0 && both.x + both.width <= screen.width)

  // A comparison: one box for both sides — whichever side is given first — holding each side's grid.
  const pair = changedRegionAt([fluid, single], screen, { grid: true })
  assert.deepEqual(pair, changedRegionAt([single, fluid], screen, { grid: true }), 'the same box on both sides')
  for (const spec of [fluid, single]) { const g = layoutAt(spec, screen).grid; assert.ok(pair.y <= g.y && pair.y + pair.height >= g.y + g.height, 'each side’s grid is inside it') }
  assert.ok(pair.height > grid.height, 'the taller side sets the height')
  assert.deepEqual(changedRegionAt([fluid, fixed], screen, { grid: true }), grid, 'same rows on both sides: the grid’s own box')

  // The tabs, in a preview with the view controls: "changed" first and picked by default; off when nothing changed.
  const { ConflictStoreProvider } = await server.ssrLoadModule('/src/state/ConflictStore.jsx')
  const { WorkspaceProvider } = await server.ssrLoadModule('/src/state/WorkspaceProvider.jsx')
  const { default: Preview } = await server.ssrLoadModule('/src/components/dockview/panels/PreviewPanelContent.jsx')
  const render = (props) => renderToString(createElement(MemoryRouter, null, createElement(ConflictStoreProvider, null, createElement(WorkspaceProvider, { projectId: 'dashboard-redesign' }, createElement(Preview, { historical: true, variant: 'compare', ...props })))))
  const tabsOf = (html) => [...html.matchAll(/<button[^>]*data-preview-view="(\w+)"[^>]*>/g)].map(([tag, id]) => ({ id, picked: /aria-selected="true"/.test(tag), off: /\sdisabled=""/.test(tag) }))
  const changed = render({ viewControls: true, codeRender: { title: 'This version', category: 'tablet', spec: fixed, previous: fluid } })
  assert.match(changed, /role="tablist"[^>]*data-preview-views|data-preview-views[^>]*role="tablist"/, 'a tablist')
  assert.deepEqual(tabsOf(changed), [{ id: 'changed', picked: true, off: false }, { id: 'full', picked: false, off: false }], 'Changed element | Whole screen, the changed element by default')
  assert.match(changed, /data-render-region=/, 'the render is cut to the changed part')
  assert.match(changed, /data-render-part="grid"/)
  const same = render({ viewControls: true, codeRender: { title: 'This version', category: 'tablet', spec: fluid, previous: fluid, unchanged: true } })
  assert.deepEqual(tabsOf(same), [{ id: 'changed', picked: false, off: true }, { id: 'full', picked: true, off: false }], 'nothing changed: off, and the whole screen is shown')
  assert.doesNotMatch(same, /data-render-region=/)
  const sides = render({ viewControls: true, codeRender: { title: 'Checkpoint #1', category: 'tablet', spec: fluid, thisSide: 'other', compare: { title: 'This version', spec: fixed } } })
  const regions = [...sides.matchAll(/data-render-region="([^"]+)"/g)].map((m) => m[1])
  assert.ok(regions.length >= 2 && new Set(regions).size === 1, 'both sides of a comparison are cut to the same box')
  assert.doesNotMatch(render({ codeRender: { title: 'This version', category: 'tablet', spec: fixed, previous: fluid } }), /data-preview-view=/, 'no tabs without the view controls')

  const ko = readFileSync(new URL('../src/i18n/ko.js', import.meta.url), 'utf8')
  assert.match(ko, /Whole screen\|화면 전체/)
  assert.match(ko, /Changed element\|바뀐 요소/)
  const source = readFileSync(new URL('../src/components/dockview/panels/PreviewPanelContent.jsx', import.meta.url), 'utf8')
  assert.ok(source.indexOf('{toolbarExtra}') < source.indexOf('data-preview-views') && source.indexOf('data-preview-views') < source.indexOf('<DevicePicker'), 'after the baseline tabs, before the device picker')
  console.log('Passed: History preview’s Changed element | Whole screen tabs — default, disabled state, frame box, render part union, and one box for both sides of a comparison.')
} finally { delete globalThis.localStorage; await server.close() }
