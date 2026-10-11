import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
try {
  const { diffLines } = await server.ssrLoadModule('/src/lib/lineDiff.js')
  const { foldRows, changedLineCount, numberRows } = await server.ssrLoadModule('/src/lib/diffHunks.js')
  const { renderOf, layoutDelta, layoutAt } = await server.ssrLoadModule('/src/lib/codeRender.js')
  const { screenOf } = await server.ssrLoadModule('/src/lib/devicePresets.js')

  // A one-line change in a 15-line file: the hunk and two folds around it.
  const file = (line7) => Array.from({ length: 15 }, (_, index) => (index === 6 ? line7 : `line ${index + 1}`))
  const rows = diffLines(file('const columns = "repeat(2, 360px)"'), file('const columns = "repeat(2, minmax(0, 1fr))"'))
  assert.equal(changedLineCount(rows), 1, 'a replaced line is one change')
  const folded = foldRows(rows)
  assert.deepEqual(folded.map((row) => row.kind), ['fold', 'same', 'same', 'remove', 'add', 'same', 'same', 'fold'])
  assert.deepEqual([folded[0].count, folded.at(-1).count], [4, 6], 'each fold says how many lines it hides')
  assert.deepEqual([folded[3].from, folded[3].to, folded[4].from, folded[4].to], [7, null, null, 7], 'a hunk keeps its real line numbers')
  // The old side reads first: this version is removed (left / above), the current version added.
  assert.equal(folded[3].text.includes('360px'), true)
  assert.equal(changedLineCount(folded), 1, 'folding doesn’t change the count')
  // Stretches too short to hide stay; no change, nothing to show but one fold.
  assert.equal(foldRows(diffLines(['a', 'b', 'c'], ['a', 'x', 'c'])).some((row) => row.kind === 'fold'), false)
  assert.deepEqual(foldRows(diffLines(file('x'), file('x'))).map((row) => row.kind), ['fold'])
  assert.deepEqual(numberRows([{ kind: 'remove', text: 'a' }, { kind: 'add', text: 'b' }]).map((row) => [row.from, row.to]), [[1, null], [null, 1]])

  // The change in a person's words, at the tablet reference screen — and nothing where the layouts agree.
  const fixed = renderOf('dashboard-redesign', 'app', ['const columns = tablet ? "repeat(2, 360px)" : "repeat(2, minmax(0, 1fr))"']).spec
  const fluid = renderOf('dashboard-redesign', 'app', ['const columns = tablet ? "repeat(2, minmax(0, 1fr))" : "repeat(2, minmax(0, 1fr))"']).spec
  const oneColumn = renderOf('dashboard-redesign', 'app', ['const columns = tablet ? "minmax(0, 1fr)" : "repeat(2, minmax(0, 1fr))"']).spec
  const tablet = screenOf({ deviceId: 'ipad-classic' }, 'tablet')
  assert.equal(layoutDelta(fixed, fluid, tablet), '태블릿(768px)에서 카드 열 너비: 360px 고정 → 화면에 맞춰 늘어남 · 카드 겹침 해소')
  assert.equal(layoutDelta(fluid, fixed, tablet), '태블릿(768px)에서 카드 열 너비: 화면에 맞춰 늘어남 → 360px 고정 · 카드가 16px 겹침')
  assert.match(layoutDelta(fixed, oneColumn, tablet), /카드 열 수: 2열 → 1열/)
  assert.equal(layoutDelta(fixed, fluid, screenOf({ deviceId: 'iphone-15' }, 'tablet')), null, 'a tablet-only rule changes nothing on a phone')
  assert.equal(layoutDelta(fixed, fixed, tablet), null)
  // A render can stop at its content: shorter than the tablet's screen, taller for one column.
  assert.ok(layoutAt(fluid, tablet).contentHeight < tablet.height)
  assert.ok(layoutAt(oneColumn, tablet).contentHeight > layoutAt(fluid, tablet).contentHeight)
  console.log('Passed: diff hunks fold around a change with real line numbers, and a layout change is said in words.')
} finally {
  await server.close()
}
