import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

// The resolution's two cards for a value change: the element cut out with 16px round it, filling the card
// (12px in, ≤8×), both cards at one scale, the card's shape the crop's, each side's value under it.
const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
try {
  const { cropOf, fitOf, cardRatioOf, valueChipOf, CROP_PAD, CARD_PAD, MAX_SCALE } = await server.ssrLoadModule('/src/components/conflicts/ValueCards.jsx')
  const { allConflictRecords } = await server.ssrLoadModule('/src/lib/conflicts.js')
  const { canvasPages } = await server.ssrLoadModule('/src/data/mockData.js')
  const byId = (id) => allConflictRecords().find((c) => c.id === id)
  assert.deepEqual([CROP_PAD, CARD_PAD, MAX_SCALE], [16, 12, 8])
  // The element, not the screen: the icon 16 + 16 + 16, the button 240 × 44 + 16 round it.
  // (Its label beside it, which 16px would cut into, is left out whole: the crop stops 4px short of it.)
  assert.deepEqual(cropOf(byId('CON-013'), canvasPages).box, { x: 4, y: 281, width: 36, height: 48 })
  // (The button's "Total" label right above it, which 16px would cut in half, is taken in whole.)
  assert.deepEqual(cropOf(byId('CON-014'), canvasPages).box, { x: 4, y: 452, width: 272, height: 102 })
  // Fitted to the inside, never past 8×; 1:1 for a near-square crop, 4:3 for a wide one.
  assert.equal(fitOf({ width: 48, height: 48 }, { width: 124, height: 124 }), 124 / 48)
  assert.equal(fitOf({ width: 10, height: 10 }, { width: 124, height: 124 }), 8)
  assert.equal(fitOf({ width: 272, height: 76 }, { width: 400, height: 300 }), 400 / 272)
  assert.equal(cardRatioOf({ width: 48, height: 48 }), 1)
  assert.equal(cardRatioOf({ width: 120, height: 76 }), 4 / 3)
  // A long crop (over 2:1 — the full-width button) keeps its shape, up to 4:1, and its cards stack.
  assert.equal(cardRatioOf({ width: 272, height: 76 }), 272 / 76)
  assert.equal(cardRatioOf({ width: 400, height: 40 }), 4)
  assert.ok(read('components/conflicts/ValueCards.jsx').includes("stacked ? 'grid-cols-1 gap-1'"))
  // Each side's value, short.
  assert.equal(valueChipOf(byId('CON-013'), { stroke: 2.5 }), 'stroke 2.5')
  assert.equal(valueChipOf(byId('CON-014'), { height: 44, background: '#6366f1' }), '44px · #6366f1')

  const cards = read('components/conflicts/ValueCards.jsx')
  assert.ok(cards.includes('const scale = fits.every((fit) => fit != null) ? Math.min(...fits) : null'), 'both cards at the smaller of the two fits')
  assert.ok(cards.includes("transform: `translate(-50%, -50%) scale(${scale ?? 1})`, transformOrigin: 'center'") && cards.includes('bg-[#F5F5F5]'))
  const flow = read('components/conflicts/DesignDecisionFlow.jsx')
  assert.ok(flow.includes('<ValueCards') && flow.includes("afterWhich === 'original' ? conflict.preview?.after"))
  console.log('Passed: the two cards — the element cut out and filling them, at one scale, with its values.')
} finally { await server.close() }
