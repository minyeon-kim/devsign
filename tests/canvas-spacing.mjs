import assert from 'node:assert/strict'
import { createServer } from 'vite'

// The canvas's Figma-style redlines: gaps between two elements, and an
// element's inset inside the one that holds it (else the frame).
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { gaps, insets, parentOf, contains } = await server.ssrLoadModule('/src/lib/spacing.js')
  const { canvasPages } = await server.ssrLoadModule('/src/data/mockData.js')
  const frame = canvasPages.find((page) => page.id === 'page-1').frames[0]
  const boxes = frame.layers.map((l) => ({ id: l.id, x: l.x, y: l.y, w: l.width, h: l.height }))
  const box = (id) => boxes.find((b) => b.id === id)
  const frameBox = { id: frame.id, x: 0, y: 0, w: frame.width, h: frame.height }
  const values = (lines) => lines.map((line) => line.value)

  // An element inside another: its padding there.
  assert.equal(parentOf(box('status-chip'), boxes, frameBox).id, 'hero-card', 'the chip sits in the hero card')
  assert.deepEqual(values(insets(box('status-chip'), box('hero-card'))), [12, 168, 12, 98])
  // Nothing holds it: the frame does.
  assert.equal(parentOf(box('search-input'), boxes, frameBox), frameBox)
  assert.deepEqual(values(insets(box('search-input'), frameBox)), [20, 20, 340, 220])
  // Two apart: the gap between them, on the axis they're apart.
  const between = gaps(box('search-input'), box('email-input'))
  assert.deepEqual(values(between), [12])
  assert.equal(between[0].x1, between[0].x2, 'a vertical gap is a vertical line')
  // Side by side: a horizontal gap, drawn where they overlap.
  const side = gaps(box('avatar'), box('meta-text'))
  assert.deepEqual(values(side), [8])
  assert.ok(side[0].y1 >= box('meta-text').y && side[0].y1 <= box('meta-text').y + box('meta-text').h)
  // One holding the other reads as the inset, either way round.
  assert.deepEqual(values(gaps(box('hero-card'), box('status-chip'))), [12, 168, 12, 98])
  assert.ok(contains(box('hero-card'), box('card-image')) && !contains(box('card-image'), box('hero-card')))
  console.log('Passed: canvas redlines measure gaps, insets in the holding element, and the frame when nothing holds it.')
} finally { await server.close() }
