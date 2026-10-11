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
  // The change alone, for the change line: a problem it causes is said apart, as a problem.
  assert.equal(layoutDelta(fluid, fixed, tablet, { effects: false }), '태블릿(768px)에서 카드 열 너비: 화면에 맞춰 늘어남 → 360px 고정')
  // A render can stop at its content: shorter than the tablet's screen, taller for one column.
  assert.ok(layoutAt(fluid, tablet).contentHeight < tablet.height)
  assert.ok(layoutAt(oneColumn, tablet).contentHeight > layoutAt(fluid, tablet).contentHeight)
  // Inspection: one mark per problem, on the area it's about and nowhere else.
  const { problemsAt, inspectionsFor, layoutDeltaCode } = await server.ssrLoadModule('/src/lib/codeRender.js')
  assert.equal(layoutDeltaCode(fixed, fluid, tablet), 'repeat(2, 360px) → repeat(2, minmax(0, 1fr))')
  const [overlap] = problemsAt(fixed, tablet)
  assert.deepEqual([problemsAt(fixed, tablet).length, overlap.id, overlap.tone, overlap.label], [1, 'overlap', 'danger', '카드 겹침 16px'])
  // 768 − 2×32 = 704 wide from x 32: the right card starts at 32 + 704 − 360 = 376, the left ends at 392.
  assert.deepEqual([overlap.region.x, overlap.region.width], [376, 16], 'only the strip where the cards overlap')
  assert.equal(problemsAt(fluid, tablet).length, 0)
  assert.equal(problemsAt(fixed, screenOf({ deviceId: 'galaxy-tab' }, 'tablet'))[0].id, 'squeezed', 'a gap left too narrow is a warning, not an overlap')
  // Compared: each side's own problems; the same problem on both is marked once, on this version, and said to be shared.
  assert.deepEqual([inspectionsFor(fixed, fluid, tablet).mine.length, inspectionsFor(fixed, fluid, tablet).other.length], [1, 0])
  assert.deepEqual([inspectionsFor(fluid, fixed, tablet).mine.length, inspectionsFor(fluid, fixed, tablet).other.length], [0, 1])
  const shared = inspectionsFor(fixed, fixed, tablet)
  assert.deepEqual([shared.mine.length, shared.other.length, shared.mine[0].shared, shared.mine[0].label], [1, 0, true, '카드 겹침 16px · 두 버전 공통'])
  // "Differences only" with no problem behind the difference: the changed area, once; with a problem, just the problem.
  assert.deepEqual(inspectionsFor(fluid, oneColumn, tablet, { difference: true }).mine.map((mark) => mark.id), ['difference'])
  assert.deepEqual(inspectionsFor(fluid, oneColumn, tablet).mine, [])
  assert.deepEqual(inspectionsFor(fixed, fluid, tablet, { difference: true }).mine.map((mark) => mark.id), ['overlap'])
  // The code area: unfolded or not is the reader's alone — playing, pausing and the end change how the step is shown, never whether.
  const { codeViewOf } = await server.ssrLoadModule('/src/lib/diffHunks.js')
  const step = { comparing: true, changedLines: 1 }
  // play → pause → resume → end → previous, with the code unfolded: never folded, never empty.
  assert.deepEqual(
    [{ playing: true }, { playing: false }, { playing: true }, { playing: false }, { playing: false }].map((state) => codeViewOf({ open: true, ...step, ...state })),
    ['typing', 'hunks', 'typing', 'hunks', 'hunks'],
  )
  // Folded by the reader: it stays folded whatever playback does.
  assert.deepEqual([true, false].map((playing) => codeViewOf({ open: false, ...step, playing })), ['folded', 'folded'])
  // Entered without playing (a step picked): the code is there from the first frame.
  assert.equal(codeViewOf({ open: true, ...step }), 'hunks')
  assert.equal(codeViewOf({ open: true, ...step, wholeFile: true }), 'whole')
  // A step that changed no code keeps the area and says so (the file, on asking).
  assert.equal(codeViewOf({ open: true, comparing: false }), 'none')
  assert.equal(codeViewOf({ open: true, comparing: true, changedLines: 0 }), 'none')
  assert.equal(codeViewOf({ open: true, comparing: false, wholeFile: true }), 'file')
  assert.equal(codeViewOf({ open: true, comparing: false, playing: true }), 'typing')
  console.log('Passed: diff hunks fold around a change with real line numbers, a layout change is said in words, a problem is one mark on its own area, and the code stays shown through playback.')
} finally {
  await server.close()
}
