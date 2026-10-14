import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

// A fix previewed in place: the canvas's own screens drawn with the way's values put over what's built —
// on every screen with the same element and token — never a picture drawn apart from them.
const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
try {
  const { previewTargetsOf, overridesFor, affectedPagesOf, liveOverridesOf, setCanvasPreview, getCanvasPreview, isSubtleChange } = await server.ssrLoadModule('/src/lib/canvasPreview.js')
  const { lensPlacement, lensScaleOf, LENS } = await server.ssrLoadModule('/src/components/canvas/PreviewLens.jsx')
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
  // A button's height and colour: on the element itself, said outright (the canvas may draw it as built).
  const button = allConflictRecords().find((c) => c.id === 'CON-014')
  const buttonTargets = previewTargetsOf(button, pages)
  assert.deepEqual(buttonTargets.map((t) => `${t.pageId}:${t.layerId}`), ['page-checkout:place-order'])
  assert.deepEqual(overridesFor(button, buttonTargets, button.preview.after, pages), { 'place-order': { fillStyle: { background: '#6366f1', color: '#fff' }, dh: 0 } })
  assert.deepEqual(overridesFor(button, buttonTargets, button.preview.before, pages), { 'place-order': { fillStyle: { background: '#7c3aed', color: '#fff' }, dh: -4 } })
  // The magnifier by itself only when what changes is too small to see.
  assert.equal(isSubtleChange(icon), true)
  assert.equal(isSubtleChange(button), false, 'a button’s height and colour are plain to see')
  assert.equal(isSubtleChange({ preview: { before: { radius: 4 }, after: { radius: 8 } } }), true)
  assert.equal(isSubtleChange({ preview: { before: { gap: '12px' }, after: { gap: '20px' } } }), false)
  assert.equal(isSubtleChange({ preview: { before: { background: '#6366f1' }, after: { background: '#6466f0' } } }), true)
  // Beside the element, on the side with room — never over it — 160px, 400–800%.
  assert.equal(LENS.size, 160)
  assert.equal(lensScaleOf({ width: 16, height: 16 }), 7)
  assert.equal(lensScaleOf({ width: 240, height: 44 }), 4)
  const frame = { x: 80, y: 40 }
  const near = lensPlacement(frame, { x: 20, y: 297, width: 16, height: 16 }, { x: 0, y: 0, zoom: 100 }, { width: 900, height: 800 })
  assert.equal(near.side, 'right')
  assert.ok(near.x >= near.el.x + near.el.width + 20)
  assert.equal(lensPlacement(frame, { x: 700, y: 297, width: 16, height: 16 }, { x: 0, y: 0, zoom: 100 }, { width: 900, height: 800 }).side, 'left')
  assert.equal(lensPlacement(frame, { x: 20, y: 297, width: 16, height: 16 }, { x: -2000, y: 0, zoom: 100 }, { width: 900, height: 800 }), null, 'out of view: none')

  // What the canvas draws: the way picked — none while Space is held, none while comparing.
  const ways = [{ id: 'original', overrides: { a: { strokeWidth: 2 } } }]
  assert.deepEqual(liveOverridesOf({ ways, picked: 'original', peek: false, compare: null }), { a: { strokeWidth: 2 } })
  assert.deepEqual(liveOverridesOf({ ways, base: { overrides: { a: { strokeWidth: 2.5 } } }, picked: 'original', peek: true, compare: null }), { a: { strokeWidth: 2.5 } })
  assert.deepEqual(liveOverridesOf(null), {})
  setCanvasPreview({ conflictId: 'x' }); assert.equal(getCanvasPreview().conflictId, 'x'); setCanvasPreview(null)

  const layer = read('components/mergestudio/MergeInfiniteCanvas.jsx')
  assert.ok(layer.includes("type === 'glyph'") && layer.includes('override?.strokeWidth ?? mock.stroke'), 'the same drawing, the stroke an override')
  const canvas = read('components/dockview/panels/CanvasPanel.jsx')
  assert.ok(canvas.includes('preview?.overrides?.[layer.id]') && canvas.includes('dashed var(--ds-accent)') && canvas.includes('미리보기 · 적용 안 됨'))
  // Picking a way never moves the camera: no zoom of its own left on the canvas.
  assert.ok(!canvas.includes('focusView') && !canvas.includes('focusNonce') && canvas.includes('data-preview-reach') && canvas.includes('data-preview-banner') && canvas.includes('<PreviewLens'))
  assert.ok(canvas.includes("if (event.key !== ' ' || typing(event)) return") && canvas.includes('peek: true'))
  const compare = read('components/canvas/CompareCanvas.jsx')
  assert.ok(compare.includes("['side', '나란히'], ['swipe', 'Swipe'], ['onion', 'Onion']") && compare.includes('clipPath: `inset(0 0 0 ${preview.mix * 100}%)`') && compare.includes('{ opacity: preview.mix }'))
  assert.ok(compare.includes('preview.onPick?.(cellId)') && compare.includes("event.key !== 'Escape'") && compare.includes('<StaticLayer'))
  const flow = read('components/conflicts/DesignDecisionFlow.jsx')
  assert.ok(flow.includes('data-preview-diff') && flow.includes('영향 화면 {affected.length}개') && flow.includes('나란히 비교') && flow.includes('setCanvasPreview(null)'))
  assert.ok(flow.includes('readLens(conflict.id) ?? isSubtleChange(conflict)') && flow.includes('data-preview-lens-toggle') && !flow.includes('focusNonce'))
  console.log('Passed: the fix previewed in place — the canvas’s own screens with values put over them, wherever the element is.')
} finally { await server.close() }
