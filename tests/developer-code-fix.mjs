import assert from 'node:assert/strict'
import { createServer } from 'vite'

// The developer track fixes a conflict in Merge Studio through its code:
// the guide names the line and the change; the designer track keeps the
// property guide.
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { fixesInCode } = await server.ssrLoadModule('/src/components/conflicts/CheckDecisions.jsx')
  const { conflictChecklist, projectViewerIds, teamMembers } = await server.ssrLoadModule('/src/data/mockData.js')
  const { codeChangeOf, handLinesOf, withHandLines } = await server.ssrLoadModule('/src/lib/mergeResult.js')
  const roleOn = (projectId) => teamMembers.find((m) => m.id === projectViewerIds[projectId])?.role
  assert.equal(roleOn('mobile-nav-revamp'), 'Developer')
  assert.equal(roleOn('checkout-redesign'), 'Designer')
  const navIcon = conflictChecklist.find((c) => c.id === 'cc-4')
  assert.ok(fixesInCode('Developer', navIcon), 'a developer fixes the nav icon in code')
  assert.ok(!fixesInCode('Designer', navIcon), 'a designer keeps the property guide')
  assert.ok(!fixesInCode('Developer', conflictChecklist.find((c) => c.diff?.before?.some((line) => /^<{7}/.test(line)))), 'merge markers are resolved in the review')
  // A real conflict: both branches changed the same lines from one base,
  // and the suggested merge keeps both changes.
  const { base, before, after, merged } = navIcon.diff
  assert.equal(base.length, before.length)
  assert.ok(after.some((line, i) => line !== base[i]), 'A changed the base')
  assert.ok(before.some((line, i) => line !== base[i] && after[i] !== base[i]), 'both changed the same line')
  assert.match(merged[0], /size-6/); assert.match(merged[0], /aria-hidden/)
  assert.match(merged[1], /Badge/); assert.match(merged[1], /text-\[11px\]/)
  // The merge typed in is found again in the hand-written code.
  const typed = withHandLines(navIcon, {}, merged, Array(11).fill('          '))
  assert.deepEqual(handLinesOf(navIcon, typed).map((l) => l.trim()), merged)
  assert.ok(codeChangeOf(before, merged).to.includes('size-6'))
  console.log('Passed: the developer track fixes conflicts in code (line and change named), the designer track keeps the property guide.')
} finally { await server.close() }

// The merge window: A and B side by side, the result editable, taking a side.
const server2 = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { createElement } = await import('react')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { default: CodeMergeWindow } = await server2.ssrLoadModule('/src/components/mergestudio/CodeMergeWindow.jsx')
  const { conflictChecklist } = await server2.ssrLoadModule('/src/data/mockData.js')
  const conflict = conflictChecklist.find((c) => c.id === 'cc-4')
  let kept = null
  const render = (manualCode) => renderToStaticMarkup(createElement(CodeMergeWindow, { conflict, manualCode, fileLines: [], onChange: (next) => { kept = next }, onLive() {}, onClose() {} }))
  const html = render({})
  assert.ok(html.includes('data-merge-side="A"') && html.includes('data-merge-side="B"'), 'both sides shown')
  assert.ok(html.includes('data-merge-result-line="10"') && html.includes('data-merge-result-line="11"'), 'both result lines are editable at their file lines')
  assert.ok(html.includes('data-merge-state="B"'), 'untouched, the result is B')
  assert.ok(html.includes('data-merge-take="merged"'), 'the suggested merge is offered')
  assert.ok(html.includes('−') && html.includes('+'), 'changes read as − and +')
  const both = { 'app:10': `          ${conflict.diff.merged[0]}`, 'app:11': `          ${conflict.diff.merged[1]}` }
  assert.ok(render(both).includes('data-merge-state="merged"'), 'both changes kept, it says so')
  const aOnly = { 'app:10': `          ${conflict.diff.after[0]}`, 'app:11': `          ${conflict.diff.after[1]}` }
  assert.ok(render(aOnly).includes('data-merge-state="A"'), 'A alone drops B’s change')
  assert.equal(kept, null)
  console.log('Passed: the code merge window shows A and B beside an editable result.')
} finally { await server2.close() }
