import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { ConflictStoreProvider } = await server.ssrLoadModule('/src/state/ConflictStore.jsx')
  const { WorkspaceProvider } = await server.ssrLoadModule('/src/state/WorkspaceProvider.jsx')
  const { default: Studio } = await server.ssrLoadModule('/src/components/mergestudio/MergeStudioWorkspace.jsx')
  const { mergeListItems } = await server.ssrLoadModule('/src/data/mockData.js')
  let count = 0
  for (const item of mergeListItems) {
    const html = renderToString(createElement(MemoryRouter, null, createElement(ConflictStoreProvider, null,
      createElement(WorkspaceProvider, { projectId: item.projectId }, createElement(Studio, { item, listNavigation: { stack: 'list', direction: null }, onListNavigation: () => {} })))))
    assert.ok(!html.includes('data-card="code"'), `${item.id}: code must never render as a canvas card`)
    if (!item.hasDesign) assert.ok(html.includes('Code changes are available in the review panel.'), `${item.id}: provide the review entry point`)
    count++
  }
  console.log(`Passed: ${count} merge items render without canvas code cards, including code-only items.`)
} finally { await server.close() }
