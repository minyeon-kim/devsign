import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { PIN, anchorOf, layoutPins, markerRect, markersOf, pinsFor } = await server.ssrLoadModule('/src/lib/canvasPins.js')
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
  // A conflict about a screen as a whole links to that screen, with no element marked.
  const { designLinkOf } = await server.ssrLoadModule('/src/lib/conflictInsight.js')
  const { canvasPages } = await server.ssrLoadModule('/src/data/mockData.js')
  const dashboardPages = canvasPages.filter((page) => page.projectId === 'dashboard-redesign')
  for (const conflict of records) {
    const link = designLinkOf(conflict, dashboardPages)
    assert.ok(link?.frame, `${conflict.id} has a screen to show`)
    assert.equal(Boolean(link.layer), Boolean(conflict.layerId))
  }

  // One pin per change, however many elements it's about: four cards → one pin counting 4.
  const markers = markersOf(pins)
  assert.equal(markers.filter((marker) => marker.conflictId === padding.id).length, 1)
  assert.equal(markers.find((marker) => marker.conflictId === padding.id).count, 4)
  assert.equal(markers.length, new Set(pins.map((pin) => pin.conflictId)).size, 'one marker per change id')
  assert.deepEqual(markers.map((marker) => marker.number), [...markers.map((marker) => marker.number)].sort((a, b) => a - b))
  // It goes on all its elements together (their union)…
  const cards = [{ left: 10, top: 20, right: 110, bottom: 80 }, { left: 130, top: 20, right: 230, bottom: 80 }, { left: 10, top: 100, right: 110, bottom: 160 }, { left: 130, top: 100, right: 230, bottom: 160 }]
  assert.deepEqual(markerRect(cards), { left: 10, top: 20, right: 230, bottom: 160 })
  // …or the group they sit in, as long as it isn't far more than they are.
  const group = { left: 0, top: 10, right: 240, bottom: 170 }
  assert.deepEqual(markerRect(cards, group), group)
  assert.deepEqual(markerRect(cards, { left: 0, top: 0, right: 1200, bottom: 900 }), { left: 10, top: 20, right: 230, bottom: 160 })

  // Pins more than 24px apart stay where they are.
  const apart = layoutPins([{ id: 'a', number: 1, x: 100, y: 100 }, { id: 'b', number: 2, x: 200, y: 100 }, { id: 'c', number: 3, x: 100, y: 125 }])
  assert.deepEqual(apart.map((item) => [item.kind, item.x, item.y]), [['pin', 100, 100], ['pin', 200, 100], ['pin', 100, 125]])
  // Two within 24px are one cluster counting both; zooming in (tips moving apart) separates them.
  const near = layoutPins([{ id: 'a', number: 4, x: 300, y: 100 }, { id: 'b', number: 5, x: 316, y: 116 }])
  assert.deepEqual(near.map((item) => [item.kind, item.pins?.length]), [['cluster', 2]])
  assert.deepEqual(layoutPins([{ id: 'a', number: 4, x: 300, y: 100 }, { id: 'b', number: 5, x: 340, y: 140 }]).map((item) => item.kind), ['pin', 'pin'])
  const crowd = layoutPins([{ id: 'a', number: 3, x: 300, y: 100 }, { id: 'b', number: 1, x: 304, y: 104 }, { id: 'c', number: 2, x: 298, y: 96 }])
  assert.equal(crowd[0].pins.length, 3)
  assert.deepEqual(crowd[0].pins.map((pin) => pin.number), [1, 2, 3], 'listed in number order')
  // Sizes: 16 × 21, and 20 × 26 when picked.
  assert.deepEqual([PIN.head, PIN.height, PIN.headSelected, PIN.heightSelected], [16, 21, 20, 26])
  await server.ssrLoadModule('/src/components/conflicts/ConflictPins.jsx')
  console.log('Passed: pin numbers follow the list, one pin per change, its box, anchors and flipping, clustering within 24px, and sizes.')
} finally { await server.close() }
