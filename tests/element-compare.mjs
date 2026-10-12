import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

// A value change's detail shows its element enlarged — the design, the code
// as built, and what was applied — rather than a screen too small to read.
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { COMPARE_PAD, COMPARE_MIN_CELL, COMPARE_MAX_ZOOM, compareRegionOf, compareScaleOf, compareSidesOf, shortValue, markOf, codeOverridesOf, targetOf } = await server.ssrLoadModule('/src/lib/elementPreview.js')
  const { allConflictRecords } = await server.ssrLoadModule('/src/lib/conflicts.js')
  const { designLinkOf } = await server.ssrLoadModule('/src/lib/conflictInsight.js')
  const { canvasPages } = await server.ssrLoadModule('/src/data/mockData.js')
  const records = allConflictRecords()
  const padding = records.find((conflict) => conflict.id === 'CON-003')
  const pages = canvasPages.filter((page) => page.projectId === padding.projectId)

  // Which sides: not fixed → 원안 / 현재 구현; fixed or merged → 원안 / 구현 / 반영.
  assert.deepEqual(compareSidesOf(padding).map((side) => side.caption), ['원안 · 16px (space.4)', '현재 구현 · 12px'])
  const fixed = { ...padding, decisionFix: { appliedAtMs: 1, verified: true } }
  assert.deepEqual(compareSidesOf(fixed).map((side) => side.caption), ['원안 · 16px (space.4)', '구현 · 12px', '반영 · 16px'])
  assert.deepEqual(compareSidesOf({ ...padding, reviewStage: 'resolved' }).map((side) => side.key), ['design', 'built', 'applied'])
  // What went in is the design's drawing — unless keeping the code's value was what was approved.
  assert.equal(compareSidesOf(fixed).at(-1).side, 'after')
  const kept = compareSidesOf({ ...fixed, decisionRequest: { proposal: 'current' } }).at(-1)
  assert.deepEqual([kept.side, kept.caption], ['before', '반영 · 12px'])
  assert.deepEqual(compareSidesOf({ id: 'x' }), [], 'nothing compared: nothing drawn')
  assert.equal(shortValue('16px (space.4)'), '16px')
  assert.equal(shortValue('#1D4ED8 (fixed hex)'), '#1D4ED8')

  // The crop: the element with 24px around it (kept inside the frame), enlarged to fill its cell — within reason.
  const link = designLinkOf(padding, pages)
  const target = targetOf(padding, link)
  const layer = target.frame.layers.find((entry) => entry.id === target.mainId)
  const region = compareRegionOf(target.frame, target.mainId)
  assert.equal(COMPARE_PAD, 24)
  assert.deepEqual([region.x, region.y], [Math.max(0, layer.x - 24), Math.max(0, layer.y - 24)])
  assert.ok(region.width <= layer.width + 48 && region.width >= layer.width && region.height <= layer.height + 48)
  assert.ok(region.width < target.frame.width, 'never the whole screen for one element')
  assert.equal(compareScaleOf(320, region), 320 / region.width, 'the crop fills the cell’s width')
  assert.equal(compareScaleOf(5000, region), COMPARE_MAX_ZOOM)
  assert.equal(COMPARE_MIN_CELL, 200)
  // The difference is drawn on the element: the padding as a band, narrower as built than as designed.
  assert.equal(markOf(padding, target.frame, 'before').kind, 'inset')
  assert.ok(markOf(padding, target.frame, 'before').band < markOf(padding, target.frame, 'after').band)
  assert.ok(Object.keys(codeOverridesOf(padding, target.frame)).length > 0, 'the built side really is drawn with the built value')
  // A color or a weight is said as its value on the element.
  for (const id of ['CON-005', 'CON-006']) {
    const conflict = records.find((entry) => entry.id === id)
    const frame = targetOf(conflict, designLinkOf(conflict, pages)).frame
    assert.ok(['fill', 'text'].includes(markOf(conflict, frame, 'before').kind), id)
    assert.equal(compareSidesOf(conflict).length, 2)
  }

  // Where it's shown: with the status in every state for a value change; a layout keeps its screens.
  const flow = readFileSync(new URL('../src/components/conflicts/DesignDecisionFlow.jsx', import.meta.url), 'utf8')
  assert.match(flow, /const compare = conflict\.layouts \? null : <ElementCompare /)
  assert.match(flow, /\{compare && !compareInStatus && !\(developer && askingNow\) && <section data-status-compare/)
  assert.match(flow, /compare=\{compareInStatus \? compare : null\}/)
  assert.match(flow, /\{fix && !compare && \(/, 'the small before / after gives way to it — for a value change only')
  // The viewer is the one there already, opened full screen; the side panel's thumbnail says where and opens it.
  const preview = readFileSync(new URL('../src/components/conflicts/ElementPreview.jsx', import.meta.url), 'utf8')
  assert.ok(preview.includes('startFullscreen = false') && preview.includes("data-element-mode={id}") && preview.includes('data-element-zoom') && preview.includes("'반영 결과'"))
  assert.match(preview, /gridTemplateColumns: `repeat\(auto-fit, minmax\(\$\{COMPARE_MIN_CELL\}px, 1fr\)\)`/, 'cells stack when they can’t sit side by side')
  const thumb = readFileSync(new URL('../src/components/conflicts/DesignLinkThumb.jsx', import.meta.url), 'utf8')
  assert.ok(thumb.includes('cursor-zoom-in') && thumb.includes('startFullscreen') && thumb.includes('shadow-[0_0_0_9999px_rgba(15,23,42,0.28)]'))
  const panel = readFileSync(new URL('../src/components/dockview/panels/ConflictReviewPanel.jsx', import.meta.url), 'utf8')
  assert.ok(panel.includes('<Row label="Where on the screen" data-summary-row="Screen">'))
  await server.ssrLoadModule('/src/components/conflicts/ElementPreview.jsx')
  console.log('Passed: a value change’s element is compared enlarged — design, built and applied — with the value marked on it, and opens the full-screen viewer.')
} finally { await server.close() }
