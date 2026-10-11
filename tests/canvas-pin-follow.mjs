import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { PIN, pinPress, pinTip } = await server.ssrLoadModule('/src/lib/canvasPins.js')
  const { MAX_SHARE, STRIP_HEIGHT, panelSizeStyle } = await server.ssrLoadModule('/src/lib/bottomPanelSize.js')

  // --- A pin has no position of its own: it is its element's corner. ---
  const frame = { left: 0, right: 2000 }
  const card = { left: 120, top: 200, right: 300, bottom: 260 }
  const base = pinTip([card], { frame })
  assert.deepEqual(base, { x: 300 - PIN.inset, y: 200 + PIN.inset, flipped: false })
  // Dragging, arrow keys, resizing, undo: whatever moves the element's box
  // moves the tip by exactly as much, in the same call.
  for (const [dx, dy] of [[1, 0], [0, -1], [37, 12], [-300, 250]]) {
    const moved = pinTip([{ left: card.left + dx, top: card.top + dy, right: card.right + dx, bottom: card.bottom + dy }], { frame })
    assert.deepEqual([moved.x - base.x, moved.y - base.y], [dx, dy])
  }
  const resized = pinTip([{ ...card, right: card.right + 40 }], { frame })
  assert.equal(resized.x - base.x, 40, 'resizing carries the corner')
  // Zoom 50%…200%: a box measured on screen scales about its origin; the tip
  // follows the corner exactly (inset is screen px), and the pin's size is
  // PIN's — it never depends on the zoom.
  for (const zoom of [0.5, 1, 2]) {
    const scaled = pinTip([{ left: card.left * zoom, top: card.top * zoom, right: card.right * zoom, bottom: card.bottom * zoom }], { frame })
    assert.deepEqual([scaled.x, scaled.y], [card.right * zoom - PIN.inset, card.top * zoom + PIN.inset])
  }
  // Several elements: their union's corner.
  const other = { left: 400, top: 150, right: 520, bottom: 190 }
  assert.deepEqual(pinTip([card, other], { frame }), { x: 520 - PIN.inset, y: 150 + PIN.inset, flipped: false })

  // --- Only a press opens the panel; the same pin again closes it. ---
  assert.equal(pinPress(null, 'a'), 'open')
  assert.equal(pinPress('a', 'b'), 'swap', 'another pin swaps the content — no close and reopen')
  assert.equal(pinPress('a', 'a'), 'close')

  // --- The panel is as tall as its content, never over 40% of the window. ---
  const closed = { open: false, maximized: false, userHeight: null, dragHeight: null, availableHeight: 600, fullHeight: 700 }
  assert.deepEqual(panelSizeStyle(closed), { height: STRIP_HEIGHT })
  assert.equal(MAX_SHARE, 0.4)
  assert.deepEqual(panelSizeStyle({ ...closed, open: true }), { maxHeight: '40vh' }, 'no fixed height: fits its content')
  assert.equal(panelSizeStyle({ ...closed, open: true }).height, undefined)
  // A height the user dragged to is remembered (and kept inside the room there is).
  assert.deepEqual(panelSizeStyle({ ...closed, open: true, userHeight: 300 }), { height: 300 })
  assert.deepEqual(panelSizeStyle({ ...closed, open: true, userHeight: 900 }), { height: 600 })
  assert.deepEqual(panelSizeStyle({ ...closed, open: true, maximized: true }), { height: 700 })
  assert.deepEqual(panelSizeStyle({ ...closed, open: true, dragHeight: 222 }), { height: 222 })

  // --- Source-level guards for the rest of the conditions. ---
  const css = readFileSync('src/index.css', 'utf8')
  const pinRule = css.match(/\.ds-pin \{[^}]*\}/)[0]
  assert.ok(!/left|top|width|height/.test(pinRule.replace(/\/\*.*?\*\//g, '')), 'no transition on the pin’s position or size')
  const canvas = readFileSync('src/components/dockview/panels/CanvasPanel.jsx', 'utf8')
  const handleSelect = canvas.slice(canvas.indexOf('function handleSelect('), canvas.indexOf('function pickConflictPin'))
  assert.ok(!handleSelect.includes('setBottomPanel'), 'selecting an element never opens the panel')
  const panelSource = readFileSync('src/components/workspace/WorkspaceBottomPanel.jsx', 'utf8')
  assert.ok(!/OPEN_SHARE|LIST_MIN_HEIGHT|REVIEW_SHARE/.test(panelSource), 'no fixed opening height')
  const pins = readFileSync('src/components/conflicts/ConflictPins.jsx', 'utf8')
  assert.ok(/useLayoutEffect\(\(\) => \{ measure\(\) \}\)/.test(pins), 'pins are measured in every commit, before paint')
  const hoverHandlers = pins.match(/onMouseEnter=\{[^\n]*\}/g).join('\n')
  assert.ok(!hoverHandlers.includes('onSelect') && !hoverHandlers.includes('setBottomPanel'), 'hover only shows the tooltip')
  console.log('canvas-pin-follow: ok')
} finally {
  await server.close()
}
