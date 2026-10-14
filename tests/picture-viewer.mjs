import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

// The resolution's two pictures, opened large the way Pinterest opens an
// image: grown from where they sit, over a dark canvas, the few controls
// floating — drawn from the same state as the card.
const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { fitRect, flipFrom, nextZoom } = await server.ssrLoadModule('/src/components/conflicts/PictureViewer.jsx')
  // Fitted: its own shape, as big as fits in 84% of the screen, centred.
  const wide = fitRect(144 / 46, { width: 1560, height: 960 })
  assert.equal(wide.width, Math.round(1560 * 0.84))
  assert.ok(Math.abs(wide.width / wide.height - 144 / 46) < 0.01 && wide.x === Math.round((1560 - wide.width) / 2))
  const tall = fitRect(0.5, { width: 1560, height: 960 })
  assert.equal(tall.height, Math.round(960 * 0.84))
  // Grown from the thumbnail: the start puts the large picture exactly over the small one.
  assert.equal(flipFrom({ left: 123, top: 608, width: 144, height: 46 }, { x: 125, y: 271, width: 1310, height: 418 }), `translate(-2px, 337px) scale(${144 / 1310}, ${46 / 418})`)
  // 50 → 200%, in steps, never past either end.
  assert.deepEqual([nextZoom(1, 1), nextZoom(1, -1), nextZoom(2, 1), nextZoom(0.5, -1), nextZoom(1.1, 1), nextZoom(1.1, -1)], [1.25, 0.75, 2, 0.5, 1.25, 1])

  const viewer = read('components/conflicts/PictureViewer.jsx')
  const flow = read('components/conflicts/DesignDecisionFlow.jsx')
  // The thumbnail: an expand button only on hover or focus (32px, dark, 160ms), the picture itself opening it too.
  assert.ok(viewer.includes('data-picture-expand') && viewer.includes('size-8') && viewer.includes('opacity-0') && viewer.includes('group-hover/zoom:opacity-100') && viewer.includes('duration-[160ms]') && viewer.includes('<Maximize2'))
  assert.ok(viewer.includes('cursor-zoom-in'))
  // Opening and closing: transform alone, 300ms on cubic-bezier(0.22, 1, 0.36, 1); the canvas fades to a dark, slightly blurred 76%.
  assert.ok(viewer.includes("const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'") && viewer.includes('const DURATION = 300'))
  assert.ok(viewer.includes('bg-black/[0.76] backdrop-blur-[3px]') && viewer.includes('setStart(flipFrom(box, target))'), 'closing goes back to the thumbnail')
  // No card frame: the picture floats on the canvas; ✕ top left, the zoom bottom right, the switcher at the left.
  assert.ok(viewer.includes('top-4 left-4') && viewer.includes('right-4 bottom-4') && viewer.includes('data-viewer-thumb') && viewer.includes('aria-pressed={item.id === active}'))
  // Switching cross-fades in place; a press on the canvas or Esc closes; a press on the picture doesn't.
  assert.ok(viewer.includes("opacity 150ms ease-out") && viewer.includes('onClick={close}') && viewer.includes('onClick={(event) => event.stopPropagation()}') && viewer.includes("event.key === 'Escape'"))
  // Bigger than the screen: dragged with a grab cursor; the wheel zooms and the page never scrolls.
  assert.ok(viewer.includes("dragging ? 'cursor-grabbing' : 'cursor-grab'") && viewer.includes("addEventListener('wheel', onWheel, { passive: false })") && viewer.includes('event.preventDefault()'))
  // The same pictures as the card, from the same state: nothing drawn twice by hand.
  assert.ok(flow.includes("const afterWhich = holding ? 'original'") && flow.includes('<Picture conflict={conflict} which={afterWhich} overlap={overlap} scale={1.5} />') && flow.includes('which={wayWhich(id)} overlap={overlap} maxWidth={width}'))
  // The options at the left, the one shown in the accent; ↑↓ and digits switch, Space holds the current build, one solid action.
  assert.ok(viewer.includes('data-viewer-title') && viewer.includes('data-viewer-controls') && viewer.includes('data-viewer-apply') && viewer.includes('↑↓ 옵션 전환') && viewer.includes('Space 현재와 비교'))
  assert.ok(viewer.includes("event.key === 'ArrowDown'") && viewer.includes("event.key === ' '") && viewer.includes('setPeek'))
  assert.ok(flow.includes("base=\"before\"") && flow.includes('이 수정안 적용하기') && flow.includes('controlsFor='))
  console.log('Passed: the picture viewer — its fit, its growing from the thumbnail and back, its controls, and the card’s own pictures.')
} finally { await server.close() }
