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
  // The change the guide names, and the fix it recognises once typed.
  assert.deepEqual(codeChangeOf(navIcon.diff.before, navIcon.diff.after), { from: 'size-5', to: 'size-6' })
  const typed = withHandLines(navIcon, {}, ['<Icon className="size-6" />'], Array(10).fill('          <Icon className="size-5" />'))
  assert.deepEqual(handLinesOf(navIcon, typed).map((l) => l.trim()), navIcon.diff.after.map((l) => l.trim()))
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
  assert.ok(html.includes('data-merge-result-line="10"'), 'the result line is editable at its file line')
  assert.ok(html.includes('data-merge-state="B"'), 'untouched, the result is B')
  assert.ok(render({ 'app:10': '          <Icon className="size-6" />' }).includes('data-merge-state="A"'), 'typed to A, it says so')
  assert.equal(kept, null)
  console.log('Passed: the code merge window shows A and B beside an editable result.')
} finally { await server2.close() }
