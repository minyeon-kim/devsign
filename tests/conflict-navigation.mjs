import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

// The Screens board's ‹ › (and J/K, [ ]): one change at a time, not one screen — the camera closing in on
// each one's element, the panel at the right on its detail.
const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
try {
  const { prototypeOf, boardLayout } = await server.ssrLoadModule('/src/lib/screens.js')
  const { conflictSequence, conflictsByScreen } = await server.ssrLoadModule('/src/lib/screenConflicts.js')
  const { focusView, glideAt, FOCUS } = await server.ssrLoadModule('/src/lib/screensBoard.js')
  const { allConflictRecords } = await server.ssrLoadModule('/src/lib/conflicts.js')

  // Every open change once, in the board's screen order and top to bottom on a screen; the one about no screen last.
  const shop = prototypeOf('checkout-redesign')
  const records = allConflictRecords().filter((c) => c.projectId === 'checkout-redesign')
  const order = boardLayout(shop).cards.map((card) => card.id)
  const steps = conflictSequence(shop, records, order)
  assert.equal(steps.length, conflictsByScreen(shop, records).total)
  assert.equal(new Set(steps.map((s) => s.conflict.id)).size, steps.length)
  assert.deepEqual(steps.map((s) => s.conflict.id), ['CON-022', 'CON-023', 'CON-016', 'CON-015', 'CON-013', 'CON-014', 'CON-018', 'CON-017', 'CON-019', 'CON-025'])
  const placed = steps.filter((s) => s.screenId)
  for (let i = 1; i < placed.length; i++) {
    const [a, b] = [placed[i - 1], placed[i]]
    assert.ok(order.indexOf(a.screenId) < order.indexOf(b.screenId) || (a.screenId === b.screenId && a.box.y <= b.box.y))
  }
  assert.deepEqual(steps.find((s) => s.conflict.id === 'CON-014').box, { x: 20, y: 494, width: 240, height: 44 })
  assert.equal(steps.at(-1).box, null)

  // The camera: the box centred in what's clear, ~40% of its width, 150%–400%, 48px around it at least.
  const area = { x: 0, y: 0, width: 1000, height: 800 }
  const wide = focusView({ x: 20, y: 494, width: 240, height: 44 }, area)
  assert.ok(Math.abs(wide.zoom - 400 / 240) < 1e-9)
  assert.equal(focusView({ x: 0, y: 0, width: 20, height: 20 }, area).zoom, FOCUS.max)
  assert.equal(focusView({ x: 0, y: 0, width: 600, height: 40 }, area).zoom, FOCUS.min)
  assert.ok(Math.abs(focusView({ x: 0, y: 0, width: 280, height: 600 }, area).zoom - (800 - 96) / 600) < 1e-9, 'a whole screen fits, 48px around')
  assert.equal(wide.x + (20 + 120) * wide.zoom, 500)
  // The glide: there at the end, backing out on the way when it's far.
  const from = { x: 0, y: 0, zoom: 1.7 }
  const to = { x: -5000, y: 0, zoom: 1.7 }
  assert.deepEqual(glideAt(from, to, 1, area), to)
  assert.ok(glideAt(from, to, 0.5, area).zoom < 1.7)
  assert.equal(glideAt(from, { x: -50, y: 0, zoom: 1.7 }, 0.5, area).zoom, 1.7)

  const board = read('components/screens/ScreensBoard.jsx')
  assert.ok(board.includes('const stepChange = (step) =>') && !board.includes('withChanges'), 'the arrows walk the changes, not the screens')
  assert.ok(board.includes('{focusAt + 1}<span className="text-slate-500"> / {countLabel(sequence.length)}</span>') && board.includes("wrapped > 0 && 'ds-count-flash'"))
  assert.ok(board.includes("{ j: 1, J: 1, ']': 1, k: -1, K: -1, '[': -1 }") && board.includes("event.key === 'Escape' && keys.current.focusOut()") && board.includes('if (!focusOut()) fit()'))
  assert.ok(board.includes('data-focus-outline') && board.includes('ds-focus-pulse') && read('index.css').includes('.ds-focus-pulse { animation: ds-focus-pulse 650ms'))
  assert.ok(board.includes('setBoardConflicts({ open: true, conflictId: entry.conflict.id })') && board.includes('focusOn(sequence.find((entry) => entry.conflict.id === conflict.id))') && board.includes('const pickBoardConflict = (conflict) => {'))
  console.log('Passed: the board’s ‹ › go one change at a time — the camera in on each, the panel on its detail.')
} finally { await server.close() }
