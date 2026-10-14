import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

// A fix previewed in place: the canvas's own screens drawn with the way's values put over what's built —
// on every screen with the same element and token — never a picture drawn apart from them.
const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
try {
  const { previewTargetsOf, overridesFor, affectedPagesOf, liveOverridesOf, setCanvasPreview, getCanvasPreview } = await server.ssrLoadModule('/src/lib/canvasPreview.js')
  const { allConflictRecords } = await server.ssrLoadModule('/src/lib/conflicts.js')
  const { canvasPages } = await server.ssrLoadModule('/src/data/mockData.js')
  const pages = canvasPages
  const icon = allConflictRecords().find((c) => c.id === 'CON-013')

  // CON-013 is about the Truck icon itself — a real layer now — and its fix reaches three screens.
  assert.equal(icon.layerId, 'shipping-icon')
  const targets = previewTargetsOf(icon, pages)
  assert.deepEqual(targets.map((t) => `${t.pageId}:${t.layerId}`), ['page-checkout:shipping-icon', 'page-cart:ct-shipping-icon', 'page-order-complete:oc-shipping-icon'])
  assert.ok(targets.every((t) => t.token === 'icon/stroke-default'))
  assert.deepEqual(affectedPagesOf(targets, 'page-checkout'), ['page-checkout', 'page-cart', 'page-order-complete'])
  // Only values over what's built: { [layerId]: { strokeWidth } }.
  assert.deepEqual(overridesFor(icon, targets, { stroke: 2 }), { 'shipping-icon': { strokeWidth: 2 }, 'ct-shipping-icon': { strokeWidth: 2 }, 'oc-shipping-icon': { strokeWidth: 2 } })
  assert.deepEqual(overridesFor(icon, targets, null), {})
  // A change with nothing on the canvas to put values on keeps its pictures.
  assert.deepEqual(previewTargetsOf(allConflictRecords().find((c) => c.id === 'CON-014'), pages), [])

  // What the canvas draws: the way picked — none while Space is held, none while comparing.
  const ways = [{ id: 'original', overrides: { a: { strokeWidth: 2 } } }]
  assert.deepEqual(liveOverridesOf({ ways, picked: 'original', peek: false, compare: null }), { a: { strokeWidth: 2 } })
  assert.deepEqual(liveOverridesOf({ ways, picked: 'original', peek: true, compare: null }), {})
  assert.deepEqual(liveOverridesOf(null), {})
  setCanvasPreview({ conflictId: 'x' }); assert.equal(getCanvasPreview().conflictId, 'x'); setCanvasPreview(null)

  const layer = read('components/mergestudio/MergeInfiniteCanvas.jsx')
  assert.ok(layer.includes("type === 'glyph'") && layer.includes('override?.strokeWidth ?? mock.stroke'), 'the same drawing, the stroke an override')
  const canvas = read('components/dockview/panels/CanvasPanel.jsx')
  assert.ok(canvas.includes('preview?.overrides?.[layer.id]') && canvas.includes('dashed var(--ds-accent)') && canvas.includes('미리보기 · 적용 안 됨'))
  assert.ok(canvas.includes('focusView({ x: frame.x + layer.x') && canvas.includes('data-preview-reach') && canvas.includes('data-preview-banner'))
  assert.ok(canvas.includes("if (event.key !== ' ' || typing(event)) return") && canvas.includes('peek: true'))
  const compare = read('components/canvas/CompareCanvas.jsx')
  assert.ok(compare.includes("['side', '나란히'], ['swipe', 'Swipe'], ['onion', 'Onion']") && compare.includes('clipPath: `inset(0 0 0 ${preview.mix * 100}%)`') && compare.includes('{ opacity: preview.mix }'))
  assert.ok(compare.includes('preview.onPick?.(cellId)') && compare.includes("event.key !== 'Escape'") && compare.includes('<StaticLayer'))
  const flow = read('components/conflicts/DesignDecisionFlow.jsx')
  assert.ok(flow.includes('data-preview-diff') && flow.includes('영향 화면 {affected.length}개') && flow.includes('나란히 비교') && flow.includes('setCanvasPreview(null)'))
  console.log('Passed: the fix previewed in place — the canvas’s own screens with values put over them, wherever the element is.')
} finally { await server.close() }
