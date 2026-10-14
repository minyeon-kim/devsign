import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

// The resolution's comparison, opened large: what's built and every way, side by side at one size and one
// zoom (2×2, 1×4 from 1600px) — each the change's real component drawn with that way's values.
const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
try {
  const { fitScaleOf, stepZoom, zoomAbout, FIT_SHARE, PRESETS } = await server.ssrLoadModule('/src/components/conflicts/PictureViewer.jsx')
  const { liveComponentOf } = await server.ssrLoadModule('/src/components/conflicts/live/index.jsx')

  // 맞춤: the component at 80% of a cell's width (never past 80% of its height).
  assert.equal(FIT_SHARE, 0.8)
  assert.equal(fitScaleOf({ width: 320, height: 66 }, { width: 748, height: 368 }), (748 * 0.8) / 320)
  assert.equal(fitScaleOf({ width: 100, height: 200 }, { width: 800, height: 300 }), (300 * 0.8) / 200)
  // − / +: 맞춤 · 200% · 400% · 800% (null: 맞춤).
  assert.deepEqual(PRESETS, [2, 4, 8])
  assert.equal(stepZoom(null, 1.87, 1), 2)
  assert.equal(stepZoom(2, 1.87, 1), 4)
  assert.equal(stepZoom(4, 1.87, 1), 8)
  assert.equal(stepZoom(8, 1.87, 1), 8)
  assert.equal(stepZoom(4, 1.87, -1), 2)
  assert.equal(stepZoom(2, 1.87, -1), null)
  // Zoomed about the pointer: the point under it stays put.
  const view = zoomAbout({ scale: 2, x: 10, y: 0 }, 4, { x: 100, y: 50 })
  assert.deepEqual(view, { scale: 4, x: -80, y: -50 })

  // The real component, once per way: the shipping row with each way's stroke — not a crop, not a screenshot.
  const draw = liveComponentOf({ fileId: 'shipping', preview: { kind: 'icon' } })
  assert.equal(draw({ stroke: 2.5 }).props.iconStrokeWidth, 2.5)
  assert.equal(liveComponentOf({ fileId: 'app', preview: { kind: 'button' } }), null)
  const row = read('components/conflicts/live/ShippingOptionRow.jsx')
  assert.ok(row.includes('<Truck className="size-4" strokeWidth={iconStrokeWidth} />') && row.includes('Standard shipping'))

  const viewer = read('components/conflicts/PictureViewer.jsx')
  const flow = read('components/conflicts/DesignDecisionFlow.jsx')
  // No rail, no single picture: four cells, one view shared ({ scale, x, y }), scaled by transform.
  assert.ok(!viewer.includes('data-viewer-thumb') && viewer.includes('grid-cols-2 grid-rows-2') && viewer.includes('min-[1600px]:grid-cols-4 min-[1600px]:grid-rows-1'))
  assert.ok(viewer.includes('translate(${view.x}px, ${view.y}px) scale(${scale})') && viewer.includes('bg-[#F5F5F5]') && viewer.includes('rounded-xl') && viewer.includes('h-10') && viewer.includes('h-14') && viewer.includes('h-16'))
  // Picked: the header or a press that isn't a drag, ← / →; the accent border and header, '선택됨'; Space shows what's built there.
  assert.ok(viewer.includes('if (!moved && !cell.base) onSelect(cell.id)') && viewer.includes("event.key === 'ArrowRight'") && viewer.includes("const shown = on && peek && base ? base.id : cell.id"))
  assert.ok(viewer.includes("on ? 'border-[var(--ds-accent-border)]'") && viewer.includes("on ? 'bg-[var(--ds-accent-bg)]'") && viewer.includes("'선택됨'") && viewer.includes('←→ 옵션 선택 · Space 누르고 있으면 현재와 비교'))
  // The pick is the detail's own; the action is the detail's, for the way picked.
  assert.ok(flow.includes('selected={proposal}') && flow.includes('if (!readOnly && id !== proposal) pick(id)') && flow.includes('render={drawCell}') && flow.includes('action={viewerAction}'))
  assert.ok(flow.includes("if (proposal !== 'other') pick('other'); typeValue(event.target.value)"), '다른 값: typed in its header, drawn at once')
  console.log('Passed: the comparison viewer — four cells, one shared view, the real component per way, and the pick shared with the detail.')
} finally { await server.close() }
