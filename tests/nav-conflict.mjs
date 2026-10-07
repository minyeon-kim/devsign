import assert from 'node:assert/strict'
import { createServer } from 'vite'

// cc-4 is a real conflict: both branches changed the same lines from one
// base, and the suggested merge keeps both changes — written into the hand
// code the review's direct adjustment uses, it's found there again.
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { conflictChecklist } = await server.ssrLoadModule('/src/data/mockData.js')
  const { codeChangeOf, handLinesOf, withHandLines } = await server.ssrLoadModule('/src/lib/mergeResult.js')
  const navIcon = conflictChecklist.find((c) => c.id === 'cc-4')
  const { base, before, after, merged } = navIcon.diff
  assert.equal(base.length, before.length)
  assert.ok(after.some((line, i) => line !== base[i]), 'A changed the base')
  assert.ok(before.some((line, i) => line !== base[i] && after[i] !== base[i]), 'both changed the same line')
  assert.match(merged[0], /size-6/); assert.match(merged[0], /aria-hidden/)
  assert.match(merged[1], /Badge/); assert.match(merged[1], /text-\[11px\]/)
  const typed = withHandLines(navIcon, {}, merged, Array(11).fill('          '))
  assert.deepEqual(handLinesOf(navIcon, typed).map((l) => l.trim()), merged)
  assert.ok(codeChangeOf(before, merged).to.includes('size-6'))
  console.log('Passed: cc-4 is a two-branch conflict whose suggested merge keeps both changes.')
} finally { await server.close() }
