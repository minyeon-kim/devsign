import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

// The resolution's comparison, opened large: what's built and every way, side by side at one size and one
// zoom (2×2, 1×4 from 1600px) — each the change's real component drawn with that way's values.
const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
try {
  const { fitScaleOf, stepZoom, zoomAbout, cellLayoutOf, FIT_SHARE, CONTEXT_HEIGHT } = await server.ssrLoadModule('/src/components/conflicts/PictureViewer.jsx')
  const { liveComponentOf } = await server.ssrLoadModule('/src/components/conflicts/live/index.jsx')

  // 맞춤: the element at half the square's width — a 16px icon in a 288px square: 900%.
  assert.equal(FIT_SHARE, 0.5)
  assert.equal(fitScaleOf({ width: 16, height: 16 }, { width: 288, height: 288 }), 9)
  // − / +: half again, through 맞춤 on the way (null: 맞춤); never under 100%.
  assert.equal(stepZoom(null, 9, 1), 13.5)
  assert.equal(stepZoom(null, 9, -1), 6)
  assert.equal(stepZoom(6, 9, 1), null)
  assert.equal(stepZoom(1.2, 9, -1), 1)
  const view = zoomAbout({ scale: 2, x: 10, y: 0 }, 4, { x: 100, y: 50 })
  assert.deepEqual(view, { scale: 4, x: -80, y: -50 })
  // The cells: as tall as what's in them — a square, its 40px header and the 72px real-size line — fitted to the room.
  assert.equal(CONTEXT_HEIGHT, 72)
  assert.deepEqual(cellLayoutOf({ width: 1512, height: 824 }, false), { cols: 2, side: Math.floor((824 - 16) / 2 - 40 - 72 - 2) })
  assert.deepEqual(cellLayoutOf({ width: 1652, height: 824 }, true), { cols: 4, side: Math.floor((1652 - 48) / 4) })

  // The real component, per way: the icon alone to enlarge, and the shipping row at its size with the icon marked.
  const live = liveComponentOf({ fileId: 'shipping', preview: { kind: 'icon' } })
  assert.equal(live.focus({ stroke: 2.5 }).props.strokeWidth, 2.5)
  assert.equal(live.context({ stroke: 2 }).props.iconStrokeWidth, 2)
  assert.equal(live.context({ stroke: 2 }).props.markIcon, true)
  assert.deepEqual(live.quick, ['1.5', '1.75', '2.25'])
  assert.equal(liveComponentOf({ fileId: 'app', preview: { kind: 'button' } }), null)
  const row = read('components/conflicts/live/ShippingOptionRow.jsx')
  assert.ok(row.includes('strokeWidth={strokeWidth}') && row.includes('Standard shipping') && row.includes('outline-dashed'))

  const viewer = read('components/conflicts/PictureViewer.jsx')
  const flow = read('components/conflicts/DesignDecisionFlow.jsx')
  // No rail, no single picture: four cells, one view shared ({ scale, x, y }), scaled by transform.
  assert.ok(!viewer.includes('data-viewer-thumb') && viewer.includes('className="grid items-start gap-4"') && viewer.includes('gridTemplateColumns: `repeat(${cols}, ${side}px)`') && viewer.includes('aspect-square') && viewer.includes('{drawing?.context ??'))
  assert.ok(viewer.includes('translate(${view.x}px, ${view.y}px) scale(${scale})') && viewer.includes('bg-[#F5F5F5]') && viewer.includes('rounded-xl') && viewer.includes('h-10') && viewer.includes('h-14') && viewer.includes('h-16'))
  // Picked: the header or a press that isn't a drag, ← / →; the accent border and header, '선택됨'; Space shows what's built there.
  assert.ok(viewer.includes('if (!moved && !cell.base) onSelect(cell.id)') && viewer.includes("event.key === 'ArrowRight'") && viewer.includes("const shown = on && peek && base ? base.id : cell.id"))
  assert.ok(viewer.includes("on ? 'border-[var(--ds-accent-border)]'") && viewer.includes("on ? 'bg-[var(--ds-accent-bg)]'") && viewer.includes("'선택됨'") && viewer.includes('←→ 옵션 선택 · Space 누르고 있으면 현재와 비교'))
  // The pick is the detail's own; the action is the detail's, for the way picked.
  assert.ok(flow.includes('selected={proposal}') && flow.includes('if (!readOnly && id !== proposal) pick(id)') && flow.includes('render={drawCell}') && flow.includes('action={viewerAction}'))
  assert.ok(flow.includes("if (proposal !== 'other') pick('other'); typeValue(event.target.value)") && flow.includes("if (proposal !== 'other') pick('other'); typeValue(value)"), '다른 값: typed in its header or a chip pressed, drawn at once')
  assert.ok(viewer.includes('const zoomLabel = `${Math.round(scale * 100)}%`'), 'the zoom said as the square’s')
  console.log('Passed: the comparison viewer — four cells, one shared view, the real component per way, and the pick shared with the detail.')
} finally { await server.close() }
