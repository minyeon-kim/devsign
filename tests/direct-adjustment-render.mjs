import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'

// The third card renders an editor for every compared value once it's
// chosen, with the way into Merge Studio.
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { ConflictStoreProvider } = await server.ssrLoadModule('/src/state/ConflictStore.jsx')
  const { WorkspaceProvider } = await server.ssrLoadModule('/src/state/WorkspaceProvider.jsx')
  const { default: Panel } = await server.ssrLoadModule('/src/components/dockview/panels/ConflictReviewPanel.jsx')
  const { conflictChecklist } = await server.ssrLoadModule('/src/data/mockData.js')
  const wrap = (projectId, child) => createElement(MemoryRouter, null, createElement(ConflictStoreProvider, null, createElement(WorkspaceProvider, { projectId }, child)))
  for (const id of ['cc-4', 'cc-7', 'cc-8', 'cc-9', 'cc-10', 'cc-11']) {
    const conflict = { ...conflictChecklist.find((c) => c.id === id), reviewStage: 'detected', customChosen: true }
    const html = renderToStaticMarkup(wrap(conflict.projectId, createElement(Panel, { conflict, onOpenChange() {}, onUpdate() {}, onOpenMergeStudio() {} })))
    const editors = html.match(/data-value-editor="/g)?.length ?? 0
    assert.equal(editors, conflict.comparisonFields.length, `${id}: an editor for each of ${conflict.comparisonFields.length} values (got ${editors})`)
    assert.ok(html.includes('data-adjust-more'), `${id}: the way into Merge Studio`)
  }
  console.log('Passed: every compared value has an editor on the direct adjustment card, with Merge Studio’s button.')
} finally { await server.close() }
