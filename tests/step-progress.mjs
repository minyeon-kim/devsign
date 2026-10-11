import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const sp = await server.ssrLoadModule('/src/lib/stepProgress.js')
  const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) } }

  // The count: "4/4 완료" when all are done, "2/4" while not.
  assert.equal(sp.progressLabel(['done', 'done', 'done', 'done']), '4/4 완료')
  assert.equal(sp.progressLabel(['done', 'done', 'current', 'pending']), '2/4')
  assert.equal(sp.progressLabel(['done', 'done', 'done', 'problem']), '3/4')

  // First visit: every finished step moves, in order, a beat apart, in under a second.
  const storage = memory()
  assert.equal(sp.readSeen('CON-002', storage), 0)
  const first = sp.firstView(sp.readSeen('CON-002', storage), 4, true)
  assert.deepEqual([0, 1, 2, 3].map((i) => sp.moves(first, i)), [true, true, true, true])
  assert.deepEqual([0, 1, 2, 3].map((i) => sp.delayOf(first, i)), [0, 120, 240, 360])
  // (last start 360 + check 160 + 240 = 760ms)
  assert.ok(sp.delayOf(first, 3) + 160 + 240 < 1000)
  sp.writeSeen('CON-002', 4, storage)

  // Seen once: shown still. One more done since: only that one moves.
  assert.equal(sp.firstView(sp.readSeen('CON-002', storage), 4, true).phase, 'idle')
  const more = sp.firstView(3, 4, true)
  assert.deepEqual([0, 1, 2, 3].map((i) => sp.moves(more, i)), [false, false, false, true])
  assert.equal(sp.delayOf(more, 3), 0)
  // Other changes keep their own record; broken storage is just "not seen".
  assert.equal(sp.readSeen('CON-009', storage), 0)
  assert.equal(sp.readSeen('CON-002', { getItem() { throw new Error('denied') } }), 0)
  sp.writeSeen('CON-002', 4, { getItem() { throw new Error('denied') }, setItem() { throw new Error('denied') } })

  // Reduced motion: nothing moves. Finishing while watched: moves at once.
  assert.equal(sp.firstView(0, 4, false).phase, 'idle')
  assert.equal(sp.liveView(3, 4, false).phase, 'idle')
  const live = sp.liveView(3, 4, true)
  assert.deepEqual([live.phase, live.live, sp.moves(live, 3), sp.moves(live, 2)], ['play', true, true, false])
  assert.equal(sp.liveView(4, 3, true).phase, 'idle', 'going back moves nothing')

  // The replay's rail: before the current step done, it under way, the rest waiting.
  assert.deepEqual(sp.replayStates(4, 0, false), ['current', 'pending', 'pending', 'pending'])
  assert.deepEqual(sp.replayStates(4, 2, false), ['done', 'current', 'pending', 'pending'])
  assert.deepEqual(sp.replayStates(4, 4, false), ['done', 'done', 'done', 'current'])
  assert.deepEqual(sp.replayStates(4, 4, true), ['done', 'done', 'done', 'done'])
  console.log('step-progress: ok')
} finally {
  await server.close()
}
