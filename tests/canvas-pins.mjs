import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { PIN, anchorOf, layoutPins, pinsFor } = await server.ssrLoadModule('/src/lib/canvasPins.js')
  const { conflictNumbersOf, orderedConflicts } = await server.ssrLoadModule('/src/components/conflicts/useConflictList.js')
  const { allConflictRecords } = await server.ssrLoadModule('/src/lib/conflicts.js')
  const records = allConflictRecords().filter((conflict) => conflict.projectId === 'dashboard-redesign')

  // Numbers are the list's own order, 1…n, one per change.
  const numbers = conflictNumbersOf(records)
  assert.deepEqual([...numbers.values()], records.map((_, index) => index + 1))
  assert.deepEqual([...numbers.keys()], orderedConflicts(records).map((conflict) => conflict.id))

  // A pin for every element a change is about, each carrying that change's number.
  const pins = pinsFor(records, numbers)
  const padding = records.find((conflict) => conflict.title === 'StatCard / Padding')
  assert.equal(pins.filter((pin) => pin.conflictId === padding.id).length, 4, 'four cards, four pins')
  assert.ok(pins.filter((pin) => pin.conflictId === padding.id).every((pin) => pin.number === numbers.get(padding.id)))
  assert.equal(pins.filter((pin) => pin.conflictId === padding.id && pin.primary).length, 1)
  assert.ok(pins.every((pin) => numbers.has(pin.conflictId)), 'every pin’s number is in the list')
  assert.deepEqual(pins.map((pin) => pin.number), [...pins.map((pin) => pin.number)].sort((a, b) => a - b), 'in number order (the Tab order)')
  // Done: still pinned, marked resolved. No element: no pin.
  assert.equal(pinsFor([{ ...padding, reviewStage: 'resolved' }], numbers).every((pin) => pin.resolved), true)
  assert.equal(pinsFor([{ id: 'x', title: 'No element' }], new Map([['x', 1]])).length, 0)

  // The tip sits 6px inside the element's top-right corner…
  const frame = { left: 100, right: 500 }
  assert.deepEqual(anchorOf({ left: 120, top: 200, right: 300, bottom: 260 }, frame), { x: 294, y: 206, flipped: false })
  // …or its top-left one when the head would leave the frame's right edge.
  assert.deepEqual(anchorOf({ left: 320, top: 200, right: 500, bottom: 260 }, frame), { x: 326, y: 206, flipped: true })
  assert.equal(anchorOf({ left: 320, top: 200, right: 480, bottom: 260 }, frame).flipped, false, 'room for the head: no flip')

  // Heads that don't touch stay where they are.
  const apart = layoutPins([{ id: 'a', number: 1, x: 100, y: 100 }, { id: 'b', number: 2, x: 200, y: 100 }])
  assert.deepEqual(apart.map((item) => [item.kind, item.x, item.y]), [['pin', 100, 100], ['pin', 200, 100]])
  // Two that collide (stacked, as beside a header's two lines) spread side by side, 4px apart.
  const two = layoutPins([{ id: 'a', number: 4, x: 300, y: 100 }, { id: 'b', number: 4, x: 300, y: 112 }])
  assert.deepEqual(two.map((item) => item.kind), ['pin', 'pin'])
  assert.equal(Math.abs(two[0].x - two[1].x), PIN.head + PIN.gap)
  assert.equal(two[0].y, two[1].y)
  assert.ok(Math.hypot(two[0].x - two[1].x, two[0].y - two[1].y) >= PIN.head, 'no longer overlapping: each can be pressed')
  // Three or more at one spot are one "+N" pin, which opens out when pressed.
  const crowd = [{ id: 'a', number: 1, x: 300, y: 100 }, { id: 'b', number: 2, x: 304, y: 104 }, { id: 'c', number: 3, x: 298, y: 96 }]
  const [cluster] = layoutPins(crowd)
  assert.equal(cluster.kind, 'cluster')
  assert.equal(cluster.pins.length, 3)
  const opened = layoutPins(crowd, { expanded: new Set([cluster.key]) })
  assert.deepEqual(opened.map((item) => item.pin.number), [1, 2, 3])
  assert.ok(opened.every((item, index) => index === 0 || item.x - opened[index - 1].x === PIN.head + PIN.gap))
  // Sizes: 22 × 28, and 28 × 36 when picked.
  assert.deepEqual([PIN.head, PIN.height, PIN.headSelected, PIN.heightSelected], [22, 28, 28, 36])
  await server.ssrLoadModule('/src/components/conflicts/ConflictPins.jsx')
  console.log('Passed: pin numbers follow the list, anchors and flipping, spreading two, clustering three, and sizes.')
} finally { await server.close() }
