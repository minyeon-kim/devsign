// A part of a composed screen let go in the open stays where it was let go (layout `offsets`), the others keeping
// their places in the stack; putting it somewhere new in the stack takes that away.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
try {
  const { regionLayout, layoutDecision, composeDraftFrame, draftScreens, LAYOUT_KEY } = await server.ssrLoadModule('/src/data/draftScreens.js')
  const id = 'merge-checkout-payment-drafts'
  const ids = draftScreens[id].regions.map((region) => region.id)
  const base = { id: 'base', width: 280, height: 560, layers: [] }
  const picks = Object.fromEntries(ids.map((region) => [region, 'a']))
  const draftKey = Object.keys(draftScreens[id].drafts)[0]
  for (const region of ids) picks[region] = draftKey
  // Nothing moved: no decision, nothing offset.
  assert.equal(layoutDecision(id, { order: ids, removed: [] }), null)
  assert.deepEqual(regionLayout(id, {}).offsets, {})
  // One moved: recorded, read back, drawn there.
  const last = ids.at(-1)
  const decision = layoutDecision(id, { order: ids, removed: [], offsets: { [last]: { dx: 0, dy: 120 } } })
  assert.deepEqual(decision.custom.offsets, { [last]: { dx: 0, dy: 120 } })
  const layout = regionLayout(id, { [LAYOUT_KEY]: decision })
  const still = composeDraftFrame(id, base, picks, null, regionLayout(id, {}))
  const moved = composeDraftFrame(id, base, picks, null, layout)
  const bandOf = (frame, region) => frame.regions.find((entry) => entry.id === region)
  assert.equal(bandOf(moved, last).y - bandOf(still, last).y, 120, 'the part is drawn where it was let go')
  assert.equal(bandOf(moved, ids[0]).y, bandOf(still, ids[0]).y, 'the others keep their places')
  assert.ok(moved.height >= still.height, 'the screen holds it')
  assert.notEqual(moved.id, still.id, 'a new drawing, not the old one cached')
  // A zero move is no move.
  assert.equal(layoutDecision(id, { order: ids, removed: [], offsets: { [last]: { dx: 0, dy: 0 } } }), null)
} finally { await server.close() }

const canvas = readFileSync(new URL('../src/components/mergestudio/MergeInfiniteCanvas.jsx', import.meta.url), 'utf8')
assert.ok(canvas.includes('else tools.onPlace?.(region.id, (next.clientX - start.x) / k, (next.clientY - start.y) / k)'), 'let go in its own place or the open: placed there')
assert.ok(canvas.includes('data-region-unplace'), 'and a way back to its place in the stack')
const studio = readFileSync(new URL('../src/components/mergestudio/MergeStudioWorkspace.jsx', import.meta.url), 'utf8')
assert.ok(studio.includes("arrange({ order: rest, removed: mixLayout.removed, parents, moved: [id] })"), 'reordered: no longer placed by hand')
console.log('region-placement: ok')
